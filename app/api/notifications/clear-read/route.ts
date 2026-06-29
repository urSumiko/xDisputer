import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { clearReadNotificationsForCurrentUser } from '../../../../src/features/notifications/notification-api-service';

const jsonHeaders = {
  'Cache-Control': 'no-store'
};

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const result = await clearReadNotificationsForCurrentUser(supabase);

  return NextResponse.json(
    { clearedCount: result.clearedCount, errorMessage: result.errorMessage },
    { status: result.status, headers: jsonHeaders }
  );
}
