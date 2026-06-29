import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSessionContext } from '../../../lib/saas/session';
import { assertCanManageManagerTemplates, resolveManagerTemplateScope, ManagerTemplateScopeError } from '../../../lib/manager-template-scope';
import { createSupabaseAdminClient } from '../../../lib/supabase/admin';
import { inspectDynamicTemplateFromAsset, classifyFindingsToRules } from '../../../lib/templates/intelligence';
import { getManagerTemplateLibraryContext } from '../../../lib/templates/workspace/template-library-service';
import { buildTemplateRegistrationProfile } from '../../../lib/templates/workspace/template-registration-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TemplateAssetRow = {
  id: string;
  manager_user_id: string;
  round_label: string | null;
  original_filename: string | null;
  mime_type: string | null;
  validation_json: Record<string, unknown> | null;
  contract_json: Record<string, unknown> | null;
  rule_json: Record<string, unknown> | null;
};

function responseUrl(request: NextRequest, status: 'ok' | 'error', message: string) {
  const referer = request.headers.get('referer');
  const target = referer ? new URL(referer) : new URL('/manager-workspace/studio', request.url);
  target.searchParams.set('control', status);
  target.searchParams.set('message', message.slice(0, 220));
  return target;
}

function redirectBack(request: NextRequest, status: 'ok' | 'error', message: string, code = 303) {
  return NextResponse.redirect(responseUrl(request, status, message), code);
}

function clean(value: FormDataEntryValue | null, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, 900);
}

function annotationMode(value: string) {
  return value === 'strict' || value === 'adaptive' ? value : 'safe';
}

function policyValue(value: string, allowed: string[], fallback: string) {
  return allowed.includes(value) ? value : fallback;
}

function mutationClient(sessionSupabase: Awaited<ReturnType<typeof getSessionContext>>['supabase']) {
  try { return createSupabaseAdminClient() as typeof sessionSupabase; }
  catch { return sessionSupabase; }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session.user) return redirectBack(request, 'error', 'No authenticated user.', 303);
    const scope = await resolveManagerTemplateScope(session);
    assertCanManageManagerTemplates(scope);
    const formData = await request.formData();
    const assetId = clean(formData.get('assetId'));
    if (!assetId) return redirectBack(request, 'error', 'Upload or select an active template before registering precision rules.');
    const managerIntent = clean(formData.get('managerIntent'), 'precision-output');
    const managerNotes = clean(formData.get('managerNotes')) || null;
    const mode = annotationMode(clean(formData.get('annotationMode'), 'safe'));
    const workflowPolicy = {
      inPlaceAnchor: clean(formData.get('inPlaceAnchor'), 'Account Name – Account number'),
      renderPolicy: policyValue(clean(formData.get('renderPolicy'), 'replace-in-place'), ['replace-in-place', 'block-if-missing', 'manager-review'], 'replace-in-place'),
      preservationPolicy: policyValue(clean(formData.get('preservationPolicy'), 'preserve-surrounding-copy'), ['preserve-surrounding-copy', 'preserve-table-layout', 'preserve-paragraph-layout'], 'preserve-surrounding-copy'),
      updatedAt: new Date().toISOString()
    };
    const supabase = mutationClient(session.supabase);
    const assetResult = await supabase
      .from('template_assets')
      .select('id, manager_user_id, round_label, original_filename, mime_type, validation_json, contract_json, rule_json')
      .eq('manager_user_id', scope.managerUserId)
      .eq('id', assetId)
      .single();
    if (assetResult.error || !assetResult.data) return redirectBack(request, 'error', assetResult.error?.message || 'Template asset was not found.');
    const asset = assetResult.data as TemplateAssetRow;
    const context = await getManagerTemplateLibraryContext({ supabase: session.supabase, managerId: scope.managerUserId, round: asset.round_label as any });
    const intelligence = inspectDynamicTemplateFromAsset({
      id: asset.id,
      manager_user_id: scope.managerUserId,
      round_label: asset.round_label,
      original_filename: asset.original_filename,
      mime_type: asset.mime_type,
      validation_json: asset.validation_json,
      contract_json: asset.contract_json,
      rule_json: asset.rule_json
    });
    const rules = classifyFindingsToRules({ findings: intelligence.suggestedRules, managerUserId: scope.managerUserId, templateAssetId: asset.id, inspectionId: 'manager-registration-preview' });
    const profile = buildTemplateRegistrationProfile({ context, intelligence, rules, managerIntent, managerNotes, annotationMode: mode });
    const previousRuleJson = asset.rule_json && typeof asset.rule_json === 'object' ? asset.rule_json : {};
    const ruleJson = {
      ...previousRuleJson,
      registrationProfile: profile,
      registrationSummary: profile.summary,
      registrationUpdatedAt: profile.registeredAt,
      registrationMode: mode,
      workflowPolicy,
      workflowAnchorPolicy: {
        phrase: workflowPolicy.inPlaceAnchor,
        canonicalTarget: 'accounts.lines + account.name + account.number',
        renderAction: workflowPolicy.renderPolicy,
        preservation: workflowPolicy.preservationPolicy
      },
      registrationSource: 'manager-workspace-template-registration-console'
    };
    const update = await supabase.from('template_assets').update({ rule_json: ruleJson, updated_at: new Date().toISOString() }).eq('manager_user_id', scope.managerUserId).eq('id', asset.id);
    if (update.error) return redirectBack(request, 'error', update.error.message);
    revalidatePath('/manager-workspace');
    revalidatePath('/manager-workspace/studio');
    revalidatePath('/manager-workspace/test');
    revalidatePath('/manager-workspace/engine');
    return redirectBack(request, 'ok', `Template registered with ${profile.summary.annotations} annotation(s), ${profile.summary.map} mapped field(s), and ${profile.summary.blockers} blocker(s).`);
  } catch (error) {
    if (error instanceof ManagerTemplateScopeError) return redirectBack(request, 'error', error.message);
    return redirectBack(request, 'error', error instanceof Error ? error.message : 'Template registration failed.');
  }
}
