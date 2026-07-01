import { createSupabaseAdminClient } from '../../../lib/supabase/admin';
import { getSessionContext } from '../../../lib/saas/session';
import { ManagerTemplateScopeError, managerTemplateScopePayload, resolveManagerTemplateScope } from '../../../lib/manager-template-scope';
import { managerTemplateStorageMode } from '../../../lib/supabase/template-storage-service';
import { serviceFailure, serviceSuccess, type ServiceResult } from '../contracts/service-result';
import { parseTemplateAssetRound, type TemplateAssetsListPayload } from '../contracts/template-assets-contract';
import { listActiveTemplateAssets } from '../repositories/template-assets-repository';

type SessionContext = Awaited<ReturnType<typeof getSessionContext>>;

type MutationClient = {
  supabase: SessionContext['supabase'];
  mode: string;
  warning: string | null;
};

type TemplateAssetTenantRow = {
  id?: unknown;
  manager_user_id?: unknown;
  owner_id?: unknown;
  uploaded_by_user_id?: unknown;
  validation_json?: unknown;
  rule_json?: unknown;
};

function mutationClient(session: SessionContext): MutationClient {
  try {
    return { supabase: createSupabaseAdminClient() as SessionContext['supabase'], mode: 'service-role', warning: null };
  } catch (error) {
    return {
      supabase: session.supabase,
      mode: 'session-rls',
      warning: error instanceof Error ? error.message : 'Service client unavailable; using session fallback.'
    };
  }
}

function objectValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nestedManagerId(value: unknown) {
  const object = objectValue(value);
  return stringValue(object?.managerUserId) || stringValue(object?.manager_user_id) || null;
}

function rowBelongsToManager(row: TemplateAssetTenantRow, managerUserId: string) {
  const managerColumn = stringValue(row.manager_user_id);
  const ownerColumn = stringValue(row.owner_id);
  const validationManager = nestedManagerId(row.validation_json);
  const ruleManager = nestedManagerId(row.rule_json);

  if (managerColumn !== managerUserId) return false;
  if (ownerColumn && ownerColumn !== managerUserId) return false;
  if (validationManager && validationManager !== managerUserId) return false;
  if (ruleManager && ruleManager !== managerUserId) return false;
  return true;
}

function isolateManagerAssets(rows: unknown, managerUserId: string) {
  if (!Array.isArray(rows)) return [];
  return (rows as TemplateAssetTenantRow[]).filter((row) => rowBelongsToManager(row, managerUserId));
}

async function autoBackfillDynamicTemplateV2() {
  return { assets: [], backfilledCount: 0, warnings: [] as string[] };
}

export async function readTemplateAssetsForRequest(input: { round: string | null }): Promise<ServiceResult<TemplateAssetsListPayload>> {
  const session = await getSessionContext();
  if (!session.user) return serviceFailure('unauthorized', 'No authenticated user.');

  try {
    const scope = await resolveManagerTemplateScope(session);
    const client = mutationClient(session);
    const round = parseTemplateAssetRound(input.round);
    const result = await listActiveTemplateAssets(client.supabase, { managerUserId: scope.managerUserId, round });

    if (result.error) return serviceFailure('database_error', result.error.message);

    await autoBackfillDynamicTemplateV2();

    const assets = isolateManagerAssets(result.data, scope.managerUserId);
    const droppedCrossTenantAssets = Array.isArray(result.data) ? Math.max(0, result.data.length - assets.length) : 0;

    return serviceSuccess({
      assets,
      managerTemplateScope: managerTemplateScopePayload(scope),
      tenantGuard: {
        managerUserId: scope.managerUserId,
        droppedCrossTenantAssets
      },
      templateStorage: {
        mode: managerTemplateStorageMode(),
        mutationMode: client.mode,
        warning: client.warning
      }
    });
  } catch (error) {
    if (error instanceof ManagerTemplateScopeError) {
      return serviceFailure(error.code === 'NO_AUTH' ? 'unauthorized' : 'forbidden', error.message, { code: error.code, category: 'MANAGER_TEMPLATE' });
    }
    return serviceFailure('unexpected_error', 'Could not load template assets.');
  }
}
