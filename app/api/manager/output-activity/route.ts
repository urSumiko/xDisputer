import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '../../../../lib/saas/session';
import { listManagerOutputApprovals } from '../../../../lib/saas/manager-user-settings';
import { normalizeOutputActivityFilter } from '../../../../src/features/manager-output-activity/output-activity-contract';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  return response;
}

async function syncManagerOutputActivity(supabase: any, managerId: string) {
  const activitySync = await supabase.rpc('sync_manager_recent_generation_output_activity_v1', {
    manager_id_input: managerId,
    max_rows: 50
  });
  if (activitySync.error) return activitySync.error.message;

  const notificationSync = await supabase.rpc('sync_manager_output_activity_notifications_v1', {
    manager_id_input: managerId,
    max_rows: 50
  });
  if (notificationSync.error) return notificationSync.error.message;

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await requireRole('manager');
    const filter = normalizeOutputActivityFilter(request.nextUrl.searchParams.get('filter') || 'all');
    const syncErrorMessage = await syncManagerOutputActivity(supabase, user.id);
    const result = await listManagerOutputApprovals(supabase, user.id, [], filter);

    return noStoreJson({
      activities: result.approvals,
      totals: result.totals,
      filter,
      errorMessage: result.errorMessage,
      syncErrorMessage,
      diagnostics: {
        managerId: user.id,
        rowCount: result.approvals.length,
        serverTime: new Date().toISOString()
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Output activity could not be loaded.';
    return noStoreJson({ activities: [], totals: null, errorMessage: message, syncErrorMessage: null }, { status: 500 });
  }
}
