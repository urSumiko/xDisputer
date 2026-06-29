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

    return serviceSuccess({
      assets: result.data || [],
      managerTemplateScope: managerTemplateScopePayload(scope),
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
