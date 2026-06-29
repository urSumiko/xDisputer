import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '../../../lib/saas/session';
import { workspaceAccessErrorResponse } from '../../../lib/saas/access-entitlement';
import { assertCanManageManagerTemplates, managerTemplateScopePayload, resolveManagerTemplateScope, ManagerTemplateScopeError } from '../../../lib/manager-template-scope';
import { managerTemplateStorageMode, removeManagerTemplateObjects, uploadManagerTemplateObject } from '../../../lib/supabase/template-storage-service';
import { createSupabaseAdminClient } from '../../../lib/supabase/admin';
import { inspectTemplateContract, templateContractGateMessage, type TemplateContract, type TemplateDocumentKind } from '../../../lib/template-contracts';
import { inspectAndStoreDynamicTemplate } from '../../../lib/templates/intelligence';
import type { ExhibitKind } from '../../../lib/template-exhibits';
import type { LetterType } from '../../../lib/letter-engine';
import type { Round } from '../../../lib/reference-store';
import { templateStoragePath, type TemplateKind } from '../../../lib/supabase/template-registry';
import { jsonFromServiceResult } from '../../../src/server/http/api-response';
import { readTemplateAssetsForRequest } from '../../../src/server/services/template-assets-service';

const allowedRounds = ['1st Round', '2nd Round', '3rd Round', 'Final'];
const allowedLetterTypes = ['DISPUTE', 'LATE_PAYMENT'];
const allowedExhibitKinds = ['FCRA', 'AFFIDAVIT', 'ATTACHMENT', 'FTC'];

type SessionContext = Awaited<ReturnType<typeof getSessionContext>>;
type ExistingTemplateAsset = { id: string; storage_bucket: string; storage_path: string; version_number: number | null; is_active: boolean | null; content_hash: string | null };
type MutationClient = { supabase: SessionContext['supabase']; mode: 'service-role' | 'session-rls'; warning: string | null };

function wantsJson(request: NextRequest) { return request.headers.get('accept')?.includes('application/json') || request.headers.get('x-template-upload') === 'workspace'; }
function respond(request: NextRequest, status: 'ok' | 'error', message: string, code = status === 'ok' ? 200 : 400, extra: Record<string, unknown> = {}) {
  if (wantsJson(request)) return NextResponse.json({ status, message, ...extra }, { status: code });
  const fallback = new URL('/system/templates', request.url);
  const referer = request.headers.get('referer');
  const target = referer ? new URL(referer) : fallback;
  target.searchParams.set('control', status);
  target.searchParams.set('message', message.slice(0, 220));
  return NextResponse.redirect(target, 303);
}
function managerScopeFailure(request: NextRequest, error: ManagerTemplateScopeError) { return respond(request, 'error', error.message, error.code === 'NO_AUTH' ? 401 : 403, { code: error.code, category: 'MANAGER_TEMPLATE' }); }
function mutationClient(session: SessionContext): MutationClient {
  try { return { supabase: createSupabaseAdminClient() as SessionContext['supabase'], mode: 'service-role', warning: null }; }
  catch (error) { return { supabase: session.supabase, mode: 'session-rls', warning: error instanceof Error ? error.message : 'Service role client unavailable; using session RLS fallback.' }; }
}
function documentKind(input: { templateKind: string; letterType: string | null; exhibitKind: string | null }): TemplateDocumentKind { return input.templateKind === 'LETTER' ? input.letterType === 'LATE_PAYMENT' ? 'LATE_PAYMENT_LETTER' : 'DISPUTE_LETTER' : input.exhibitKind as TemplateDocumentKind; }
function assertFileType(file: File, kind: TemplateDocumentKind) {
  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx');
  if ((kind === 'FCRA' || kind === 'ATTACHMENT') && !isPdf) throw new Error(`${kind} requires a PDF file.`);
  if (kind !== 'FCRA' && kind !== 'ATTACHMENT' && !isDocx) throw new Error(`${kind} requires a DOCX file.`);
}
function validateSlot(input: { round: string; templateKind: string; letterType: string; exhibitKind: string }) {
  if (!allowedRounds.includes(input.round)) return 'Invalid round.';
  if (input.templateKind !== 'LETTER' && input.templateKind !== 'EXHIBIT') return 'Invalid template kind.';
  if (input.templateKind === 'LETTER' && !allowedLetterTypes.includes(input.letterType)) return 'Invalid letter type.';
  if (input.templateKind === 'EXHIBIT' && !allowedExhibitKinds.includes(input.exhibitKind)) return 'Invalid exhibit kind.';
  return null;
}
function sha256FromArrayBuffer(buffer: ArrayBuffer) { return createHash('sha256').update(Buffer.from(buffer)).digest('hex'); }
function buildValidationJson(contract: TemplateContract, input: { round: Round; templateKind: TemplateKind; letterType: LetterType | null; exhibitKind: ExhibitKind | null; contentHash: string; managerUserId: string; uploadedByUserId: string }) { return { status: contract.validation.status, confidence: contract.validation.confidence, renderMode: contract.validation.renderMode, requiredFields: contract.validation.requiredFields, fulfilledFields: contract.validation.fulfilledFields, missingFields: contract.validation.missingFields, unknownRequiredFields: contract.validation.unknownRequiredFields, warnings: contract.validation.warnings, errors: contract.validation.errors, whatIfs: contract.validation.whatIfs, aliasesUsed: contract.validation.aliasesUsed, contentHash: input.contentHash, templateScope: 'MANAGER_TEMPLATE_ASSET', managerUserId: input.managerUserId, uploadedByUserId: input.uploadedByUserId, slot: { round: input.round, templateKind: input.templateKind, letterType: input.letterType, exhibitKind: input.exhibitKind }, evaluatedAt: new Date().toISOString() }; }
async function findExistingAssets(supabase: SessionContext['supabase'], managerUserId: string, input: { round: string; templateKind: string; letterType: string | null; exhibitKind: string | null }) { let query = supabase.from('template_assets').select('id, storage_bucket, storage_path, version_number, is_active, content_hash').eq('manager_user_id', managerUserId).eq('round_label', input.round).eq('template_kind', input.templateKind).order('version_number', { ascending: false }); if (input.letterType) query = query.eq('letter_type', input.letterType); if (input.exhibitKind) query = query.eq('exhibit_kind', input.exhibitKind); return query; }
async function archiveAssetRecords(supabase: SessionContext['supabase'], managerUserId: string, assets: Array<{ id: string }>) { if (!assets.length) return { archived: 0, warning: null as string | null }; const ids = assets.map((asset) => asset.id); const update = await supabase.from('template_assets').update({ is_active: false, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('manager_user_id', managerUserId).in('id', ids); if (update.error) return { archived: 0, warning: update.error.message }; return { archived: assets.length, warning: null }; }
async function activateInsertedTemplateAsset(client: MutationClient, managerUserId: string, input: { assetId: string; existingAssets: ExistingTemplateAsset[] }) {
  if (client.mode === 'session-rls') {
    const activation = await client.supabase.rpc('app_activate_manager_template_asset_v1', { asset_id_input: input.assetId });
    if (!activation.error) { const row = Array.isArray(activation.data) ? activation.data[0] : null; return { archived: Number(row?.archived_count || 0), warning: client.warning, mode: 'manager-rpc' as const }; }
  }
  const activeAssets = input.existingAssets.filter((asset) => asset.is_active);
  const archive = await archiveAssetRecords(client.supabase, managerUserId, activeAssets);
  if (archive.warning) return { archived: archive.archived, warning: archive.warning, mode: client.mode === 'service-role' ? 'service-role-direct' as const : 'manager-fallback' as const };
  const activate = await client.supabase.from('template_assets').update({ is_active: true, archived_at: null, updated_at: new Date().toISOString() }).eq('manager_user_id', managerUserId).eq('id', input.assetId);
  if (activate.error) return { archived: archive.archived, warning: activate.error.message, mode: client.mode === 'service-role' ? 'service-role-direct' as const : 'manager-fallback' as const };
  return { archived: archive.archived, warning: client.warning, mode: client.mode === 'service-role' ? 'service-role-direct' as const : 'manager-fallback' as const };
}
async function deleteAssetRecordsAndFiles(session: SessionContext, client: MutationClient, managerUserId: string, assets: Array<{ id: string; storage_bucket: string; storage_path: string }>) {
  if (!assets.length) return { deleted: 0, warning: null as string | null };
  const bucketGroups = new Map<string, string[]>();
  assets.forEach((asset) => { const bucket = asset.storage_bucket || 'template-assets'; const paths = bucketGroups.get(bucket) || []; paths.push(asset.storage_path); bucketGroups.set(bucket, paths); });
  for (const [bucket, paths] of Array.from(bucketGroups.entries())) { const storageDelete = await removeManagerTemplateObjects({ sessionSupabase: session.supabase, bucket, paths }); if (storageDelete.error) return { deleted: 0, warning: storageDelete.error.message }; }
  const ids = assets.map((asset) => asset.id);
  const tableDelete = await client.supabase.from('template_assets').delete().eq('manager_user_id', managerUserId).in('id', ids);
  if (tableDelete.error) return { deleted: 0, warning: tableDelete.error.message };
  return { deleted: assets.length, warning: client.warning };
}

export async function GET(request: NextRequest) {
  const accessError = await workspaceAccessErrorResponse();
  if (accessError) return accessError;
  const result = await readTemplateAssetsForRequest({ round: request.nextUrl.searchParams.get('round') });
  if (!result.ok) return jsonFromServiceResult(result);
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: NextRequest) {
  let uploadedPath: string | null = null; let insertedAssetId: string | null = null; let sessionForCleanup: SessionContext | null = null; let clientForCleanup: MutationClient | null = null;
  try {
    const accessError = await workspaceAccessErrorResponse(); if (accessError) return accessError;
    const session = await getSessionContext(); sessionForCleanup = session;
    if (!session.user) return respond(request, 'error', 'No authenticated user.', 401);
    const scope = await resolveManagerTemplateScope(session); assertCanManageManagerTemplates(scope);
    const client = mutationClient(session); clientForCleanup = client;
    const formData = await request.formData();
    const round = String(formData.get('round') || '').trim() as Round; const templateKind = String(formData.get('templateKind') || '').trim(); const letterType = String(formData.get('letterType') || '').trim() as LetterType; const exhibitKind = String(formData.get('exhibitKind') || '').trim() as ExhibitKind; const file = formData.get('file');
    const validationError = validateSlot({ round, templateKind, letterType, exhibitKind }); if (validationError) return respond(request, 'error', validationError);
    const resolvedTemplateKind = templateKind as TemplateKind; const resolvedLetterType = resolvedTemplateKind === 'LETTER' ? letterType : null; const resolvedExhibitKind = resolvedTemplateKind === 'EXHIBIT' ? exhibitKind : null;
    if (!(file instanceof File) || file.size === 0) return respond(request, 'error', 'Template file is required.');
    const kind = documentKind({ templateKind, letterType: resolvedLetterType, exhibitKind: resolvedExhibitKind }); assertFileType(file, kind);
    const targetType = resolvedLetterType || resolvedExhibitKind; if (!targetType) return respond(request, 'error', 'Template type is required.');
    const fileBuffer = await file.arrayBuffer(); const contentHash = sha256FromArrayBuffer(fileBuffer); const templateFile = new File([fileBuffer], file.name, { type: file.type, lastModified: file.lastModified }); const contract = await inspectTemplateContract(templateFile, kind); const gateMessage = templateContractGateMessage(contract);
    if (gateMessage) return respond(request, 'error', gateMessage, 422, { validation: contract.validation });
    const existing = await findExistingAssets(client.supabase, scope.managerUserId, { round, templateKind, letterType: resolvedLetterType, exhibitKind: resolvedExhibitKind }); if (existing.error) return respond(request, 'error', existing.error.message, 500);
    const existingAssets = existing.data || []; const activeSameContent = existingAssets.find((asset) => asset.is_active && asset.content_hash === contentHash);
    if (activeSameContent) return respond(request, 'ok', `${round} ${targetType} manager template is already active with the same file content.`, 200, { assetId: activeSameContent.id, duplicate: true, contentHash, managerTemplateScope: managerTemplateScopePayload(scope), templateStorage: { mode: managerTemplateStorageMode(), mutationMode: client.mode, warning: client.warning }, validation: contract.validation });
    const nextVersion = existingAssets[0]?.version_number ? existingAssets[0].version_number + 1 : 1; const validationJson = buildValidationJson(contract, { round, templateKind: resolvedTemplateKind, letterType: resolvedLetterType, exhibitKind: resolvedExhibitKind, contentHash, managerUserId: scope.managerUserId, uploadedByUserId: session.user.id });
    const storagePath = templateStoragePath({ managerUserId: scope.managerUserId, round, kind: resolvedTemplateKind, type: targetType, filename: file.name }); uploadedPath = storagePath;
    const upload = await uploadManagerTemplateObject({ sessionSupabase: session.supabase, bucket: 'template-assets', path: storagePath, body: new Blob([fileBuffer], { type: file.type || 'application/octet-stream' }), contentType: file.type || 'application/octet-stream', upsert: false }); if (upload.error) return respond(request, 'error', upload.error.message, 500, { templateStorage: { mode: managerTemplateStorageMode(), mutationMode: client.mode, warning: client.warning } });
    const insert = await client.supabase.from('template_assets').insert({ owner_id: scope.managerUserId, manager_user_id: scope.managerUserId, uploaded_by_user_id: session.user.id, template_scope: 'MANAGER', round_label: round, template_kind: templateKind, letter_type: resolvedLetterType, exhibit_kind: resolvedExhibitKind, storage_bucket: 'template-assets', storage_path: storagePath, original_filename: file.name, mime_type: file.type || 'application/octet-stream', file_size: file.size, content_hash: contentHash, contract_json: contract, validation_json: validationJson, rule_json: { round, templateKind, letterType: resolvedLetterType, exhibitKind: resolvedExhibitKind, templateScope: 'MANAGER_TEMPLATE_ASSET', managerUserId: scope.managerUserId, uploadedByUserId: session.user.id, contractStatus: contract.validation.status, contractConfidence: contract.validation.confidence, activationPolicy: client.mode === 'service-role' ? 'service-role-direct' : 'manager-template-rpc-or-rls-fallback' }, version_number: nextVersion, is_active: false, archived_at: new Date().toISOString() }).select('id').single();
    if (insert.error) { await removeManagerTemplateObjects({ sessionSupabase: session.supabase, bucket: 'template-assets', paths: [storagePath] }); return respond(request, 'error', insert.error.message, 500, { templateStorage: { mode: managerTemplateStorageMode(), mutationMode: client.mode, warning: client.warning } }); }
    insertedAssetId = insert.data.id;
    const activation = await activateInsertedTemplateAsset(client, scope.managerUserId, { assetId: insert.data.id, existingAssets });
    if (activation.warning && client.mode === 'session-rls') { await removeManagerTemplateObjects({ sessionSupabase: session.supabase, bucket: 'template-assets', paths: [storagePath] }); await client.supabase.from('template_assets').delete().eq('manager_user_id', scope.managerUserId).eq('id', insert.data.id); return respond(request, 'error', activation.warning, 500); }
    const intelligence = await inspectAndStoreDynamicTemplate({ supabase: client.supabase, managerUserId: scope.managerUserId, templateAssetId: insert.data.id, asset: { id: insert.data.id, manager_user_id: scope.managerUserId, round_label: round, original_filename: file.name, mime_type: file.type || 'application/octet-stream', validation_json: validationJson, contract_json: contract as unknown as Record<string, unknown>, rule_json: null } });
    uploadedPath = null; insertedAssetId = null;
    return respond(request, 'ok', `${round} ${targetType} manager template saved as active version. ${activation.archived} previous active version(s) archived.`, 200, { assetId: insert.data.id, archivedVersions: activation.archived, activationMode: activation.mode, contentHash, managerTemplateScope: managerTemplateScopePayload(scope), templateStorage: { mode: managerTemplateStorageMode(), mutationMode: client.mode, warning: activation.warning }, validation: contract.validation, dynamicTemplateIntelligence: intelligence });
  } catch (error) {
    try { if (sessionForCleanup && uploadedPath) await removeManagerTemplateObjects({ sessionSupabase: sessionForCleanup.supabase, bucket: 'template-assets', paths: [uploadedPath] }); if (clientForCleanup && insertedAssetId) await clientForCleanup.supabase.from('template_assets').delete().eq('id', insertedAssetId); } catch {}
    if (error instanceof ManagerTemplateScopeError) return managerScopeFailure(request, error);
    return respond(request, 'error', error instanceof Error ? error.message : 'Template upload failed.', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const accessError = await workspaceAccessErrorResponse(); if (accessError) return accessError;
    const session = await getSessionContext(); if (!session.user) return respond(request, 'error', 'No authenticated user.', 401);
    const scope = await resolveManagerTemplateScope(session); assertCanManageManagerTemplates(scope); const client = mutationClient(session);
    const body = await request.json().catch(() => ({}));
    const round = String(body?.round || request.nextUrl.searchParams.get('round') || '').trim(); const templateKind = String(body?.templateKind || request.nextUrl.searchParams.get('templateKind') || '').trim(); const letterType = String(body?.letterType || request.nextUrl.searchParams.get('letterType') || '').trim(); const exhibitKind = String(body?.exhibitKind || request.nextUrl.searchParams.get('exhibitKind') || '').trim();
    const validationError = validateSlot({ round, templateKind, letterType, exhibitKind }); if (validationError) return respond(request, 'error', validationError);
    const resolvedTemplateKind = templateKind as TemplateKind; const resolvedLetterType = resolvedTemplateKind === 'LETTER' ? letterType : null; const resolvedExhibitKind = resolvedTemplateKind === 'EXHIBIT' ? exhibitKind : null;
    const existing = await findExistingAssets(client.supabase, scope.managerUserId, { round, templateKind, letterType: resolvedLetterType, exhibitKind: resolvedExhibitKind }); if (existing.error) return respond(request, 'error', existing.error.message, 500);
    const cleanup = await deleteAssetRecordsAndFiles(session, client, scope.managerUserId, existing.data || []); if (cleanup.warning) return respond(request, 'error', cleanup.warning, 500);
    return respond(request, 'ok', `${round} ${resolvedLetterType || resolvedExhibitKind} manager template removed from Supabase.`, 200, { deleted: cleanup.deleted, managerTemplateScope: managerTemplateScopePayload(scope), templateStorage: { mode: managerTemplateStorageMode(), mutationMode: client.mode, warning: client.warning } });
  } catch (error) {
    if (error instanceof ManagerTemplateScopeError) return managerScopeFailure(request, error);
    return respond(request, 'error', error instanceof Error ? error.message : 'Template removal failed.', 500);
  }
}
