import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { loadNotificationsForCurrentUser } from '../../../src/features/notifications/notification-api-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const jsonHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
};

function requestedLimit(request: NextRequest) {
  const parsed = Number(request.nextUrl.searchParams.get('limit') || 12);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(40, Math.floor(parsed))) : 12;
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const result = await loadNotificationsForCurrentUser(supabase, requestedLimit(request));

  if (result.status === 401) {
    return NextResponse.json({ notifications: [], unreadCount: 0 }, { status: 401, headers: jsonHeaders });
  }

  return NextResponse.json({
    notifications: result.notifications,
    unreadCount: result.unreadCount,
    errorMessage: result.errorMessage,
    syncErrorMessage: result.syncErrorMessage || null,
    serverTime: new Date().toISOString()
  }, { headers: jsonHeaders });
}
