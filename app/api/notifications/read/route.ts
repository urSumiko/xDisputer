import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { markNotificationsReadForCurrentUser } from '../../../../src/features/notifications/notification-api-service';

const jsonHeaders = {
  'Cache-Control': 'no-store'
};

async function readIds(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return body && typeof body === 'object' ? (body as { ids?: unknown }).ids : undefined;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const result = await markNotificationsReadForCurrentUser(supabase, await readIds(request));

  return NextResponse.json(
    { updatedCount: result.updatedCount, errorMessage: result.errorMessage },
    { status: result.status, headers: jsonHeaders }
  );
}
