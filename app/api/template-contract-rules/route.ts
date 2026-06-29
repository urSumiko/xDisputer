import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '../../../lib/saas/session';
import { workspaceAccessErrorResponse } from '../../../lib/saas/access-entitlement';
import { assertCanManageManagerTemplates, resolveManagerTemplateScope, ManagerTemplateScopeError } from '../../../lib/manager-template-scope';
import { createSupabaseAdminClient } from '../../../lib/supabase/admin';

type RuleTarget = 'static-block' | 'field-binding' | 'entity-block' | 'affidavit-domain';
type RuleAction = 'PRESERVE' | 'REMOVE' | 'MAKE_OPTIONAL' | 'MAKE_DYNAMIC' | 'REPEAT_FOR_ENTITY' | 'USE_AS_STYLE_SEED';
type SessionContext = Awaited<ReturnType<typeof getSessionContext>>;
type MutationClient = { supabase: SessionContext['supabase']; mode: 'service-role' | 'session-rls'; warning: string | null };

function mutationClient(session: SessionContext): MutationClient {
  try { return { supabase: createSupabaseAdminClient() as SessionContext['supabase'], mode: 'service-role', warning: null }; }
  catch (error) { return { supabase: session.supabase, mode: 'session-rls', warning: error instanceof Error ? error.message : 'Service role client unavailable; using session RLS fallback.' }; }
}

function jsonScopeError(error: unknown) {
  if (error instanceof ManagerTemplateScopeError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'NO_AUTH' ? 401 : 403 });
  return NextResponse.json({ error: 'Could not resolve manager template scope.' }, { status: 500 });
}

function cleanString(value: unknown, fallback = '') {
  return String(value || fallback).trim();
}

function validTarget(value: string): value is RuleTarget {
  return ['static-block', 'field-binding', 'entity-block', 'affidavit-domain'].includes(value);
}

function validAction(value: string): value is RuleAction {
  return ['PRESERVE', 'REMOVE', 'MAKE_OPTIONAL', 'MAKE_DYNAMIC', 'REPEAT_FOR_ENTITY', 'USE_AS_STYLE_SEED'].includes(value);
}

async function assertTemplateOwnership(client: MutationClient, managerUserId: string, templateAssetId: string) {
  const query = await client.supabase.from('template_assets').select('id, manager_user_id, template_kind, letter_type, exhibit_kind, original_filename').eq('id', templateAssetId).eq('manager_user_id', managerUserId).maybeSingle();
  if (query.error) throw new Error(query.error.message);
  if (!query.data) throw new Error('Template asset is not owned by this manager.');
  return query.data;
}

async function saveStaticBlockRule(client: MutationClient, input: { managerUserId: string; templateAssetId: string; action: RuleAction; label: string; sampleText: string; templateDomain: string }) {
  const payload = {
    manager_user_id: input.managerUserId,
    template_asset_id: input.templateAssetId,
    template_family_key: input.templateDomain,
    block_key: `manual-${input.action.toLowerCase()}`,
    block_kind: input.action === 'MAKE_DYNAMIC' ? 'DYNAMIC_FIELD' : input.action === 'REPEAT_FOR_ENTITY' || input.action === 'USE_AS_STYLE_SEED' ? 'REPEATING_ENTITY_BLOCK' : 'UNKNOWN_MANAGER_CUSTOM_TEXT',
    manager_intent: input.action,
    preserve_when_empty: input.action !== 'REMOVE',
    sample_text: input.sampleText || input.label,
    rule_json: { label: input.label, source: 'template-studio-panel', action: input.action }
  };
  const result = await client.supabase.from('template_static_block_rules').insert(payload).select('id').single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function saveFieldBindingRule(client: MutationClient, input: { managerUserId: string; templateAssetId: string; action: RuleAction; label: string; templateDomain: string }) {
  const fieldKey = input.label.toLowerCase().includes('affidavit') ? 'affidavit.statement' : 'custom.manager_text';
  const payload = {
    manager_user_id: input.managerUserId,
    template_asset_id: input.templateAssetId,
    template_domain: input.templateDomain,
    field_key: fieldKey,
    source_path: fieldKey,
    placeholder_text: input.label,
    required: input.label.toLowerCase().includes('affidavit'),
    binding_status: input.action === 'MAKE_DYNAMIC' ? 'needs-review' : 'mapped',
    confidence: input.action === 'MAKE_DYNAMIC' ? 0.64 : 0.9,
    binding_json: { label: input.label, source: 'template-studio-panel', action: input.action }
  };
  const result = await client.supabase.from('template_field_bindings').upsert(payload, { onConflict: 'template_asset_id,field_key' }).select('id').single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function saveEntityBlockRule(client: MutationClient, input: { managerUserId: string; templateAssetId: string; action: RuleAction; label: string; sampleText: string }) {
  const entityKey = input.label.toLowerCase().includes('affidavit') ? 'dispute_accounts' : 'custom_items';
  const payload = {
    manager_user_id: input.managerUserId,
    template_asset_id: input.templateAssetId,
    entity_key: entityKey,
    repeat_mode: 'clone-paragraphs',
    preserve_style: true,
    empty_behavior: entityKey === 'dispute_accounts' ? 'block-generation' : 'remove-section',
    required_fields: entityKey === 'dispute_accounts' ? ['account.name', 'account.number'] : ['item.name'],
    prototype_text: input.sampleText || input.label,
    rule_status: input.action === 'USE_AS_STYLE_SEED' || input.action === 'REPEAT_FOR_ENTITY' ? 'active' : 'needs-review',
    rule_json: { label: input.label, source: 'template-studio-panel', action: input.action }
  };
  const result = await client.supabase.from('template_entity_block_rules').upsert(payload, { onConflict: 'template_asset_id,entity_key' }).select('id').single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function saveDomainContractRule(client: MutationClient, input: { managerUserId: string; templateAssetId: string; templateDomain: string; label: string; action: RuleAction }) {
  const payload = {
    manager_user_id: input.managerUserId,
    template_asset_id: input.templateAssetId,
    template_domain: input.templateDomain,
    contract_status: 'draft',
    required_fields: input.templateDomain === 'AFFIDAVIT' ? ['client.name', 'client.addressLines', 'client.ssnMasked', 'letter.date'] : [],
    optional_fields: input.templateDomain === 'AFFIDAVIT' ? ['client.dob', 'affidavit.state', 'affidavit.county', 'ftc.reportNumber', 'ftc.statement'] : [],
    required_entities: input.templateDomain === 'AFFIDAVIT' ? ['dispute_accounts'] : [],
    optional_entities: ['supporting_documents'],
    validation_json: { action: input.action, label: input.label, source: 'template-studio-panel' },
    contract_json: { managerOwnedDocx: true, affidavitMapping: input.templateDomain === 'AFFIDAVIT' || input.label.toLowerCase().includes('affidavit') }
  };
  const result = await client.supabase.from('template_domain_contracts').upsert(payload, { onConflict: 'template_asset_id,template_domain' }).select('id').single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function GET() {
  const accessError = await workspaceAccessErrorResponse(); if (accessError) return accessError;
  const session = await getSessionContext();
  if (!session.user) return NextResponse.json({ error: 'No authenticated user.' }, { status: 401 });
  let scope;
  try { scope = await resolveManagerTemplateScope(session); assertCanManageManagerTemplates(scope); }
  catch (error) { return jsonScopeError(error); }
  const client = mutationClient(session);
  const [staticRules, fieldBindings, entityRules, domainContracts] = await Promise.all([
    client.supabase.from('template_static_block_rules').select('*').eq('manager_user_id', scope.managerUserId).order('created_at', { ascending: false }).limit(25),
    client.supabase.from('template_field_bindings').select('*').eq('manager_user_id', scope.managerUserId).order('created_at', { ascending: false }).limit(25),
    client.supabase.from('template_entity_block_rules').select('*').eq('manager_user_id', scope.managerUserId).order('created_at', { ascending: false }).limit(25),
    client.supabase.from('template_domain_contracts').select('*').eq('manager_user_id', scope.managerUserId).order('created_at', { ascending: false }).limit(25)
  ]);
  const error = staticRules.error || fieldBindings.error || entityRules.error || domainContracts.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: { staticRules: staticRules.data || [], fieldBindings: fieldBindings.data || [], entityRules: entityRules.data || [], domainContracts: domainContracts.data || [] }, mutationMode: client.mode, warning: client.warning });
}

export async function POST(request: NextRequest) {
  const accessError = await workspaceAccessErrorResponse(); if (accessError) return accessError;
  const session = await getSessionContext();
  if (!session.user) return NextResponse.json({ error: 'No authenticated user.' }, { status: 401 });
  let scope;
  try { scope = await resolveManagerTemplateScope(session); assertCanManageManagerTemplates(scope); }
  catch (error) { return jsonScopeError(error); }
  try {
    const body = await request.json().catch(() => ({}));
    const templateAssetId = cleanString(body.templateAssetId);
    const target = cleanString(body.target);
    const action = cleanString(body.action);
    const label = cleanString(body.label, action);
    const sampleText = cleanString(body.sampleText, label);
    const templateDomain = cleanString(body.templateDomain, 'CUSTOM');
    if (!templateAssetId) return NextResponse.json({ error: 'templateAssetId is required.' }, { status: 400 });
    if (!validTarget(target)) return NextResponse.json({ error: 'Invalid rule target.' }, { status: 400 });
    if (!validAction(action)) return NextResponse.json({ error: 'Invalid rule action.' }, { status: 400 });
    const client = mutationClient(session);
    const asset = await assertTemplateOwnership(client, scope.managerUserId, templateAssetId);
    let saved;
    if (target === 'field-binding') saved = await saveFieldBindingRule(client, { managerUserId: scope.managerUserId, templateAssetId, action, label, templateDomain });
    else if (target === 'entity-block') saved = await saveEntityBlockRule(client, { managerUserId: scope.managerUserId, templateAssetId, action, label, sampleText });
    else if (target === 'affidavit-domain') saved = await saveDomainContractRule(client, { managerUserId: scope.managerUserId, templateAssetId, templateDomain: templateDomain === 'CUSTOM' ? 'AFFIDAVIT' : templateDomain, label, action });
    else saved = await saveStaticBlockRule(client, { managerUserId: scope.managerUserId, templateAssetId, action, label, sampleText, templateDomain });
    return NextResponse.json({ status: 'ok', message: `${label} rule saved.`, saved, asset, mutationMode: client.mode, warning: client.warning });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save manager DOCX rule.' }, { status: 500 });
  }
}
