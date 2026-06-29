import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { requireRole } from '../../../../lib/saas/session';
import { logSystemEvent, requestIdFrom, safeErrorMessage } from '../../../../lib/saas/system-observability';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = requestIdFrom(request);

  try {
    const { supabase } = await requireRole('master');

    const { error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;

    await logSystemEvent(supabase, {
      requestId,
      routePath: '/api/system/health',
      eventType: 'system_health_check',
      eventStatus: 'success',
      durationMs: Date.now() - startedAt
    });

    const response = NextResponse.json({
      ok: true,
      database: 'reachable',
      durationMs: Date.now() - startedAt
    });

    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    const supabase = await createSupabaseServerClient();

    await logSystemEvent(supabase, {
      requestId,
      routePath: '/api/system/health',
      eventType: 'system_health_check',
      eventStatus: 'error',
      durationMs: Date.now() - startedAt,
      safeMessage: safeErrorMessage(error)
    });

    const response = NextResponse.json({
      ok: false,
      error: safeErrorMessage(error)
    }, { status: 500 });

    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
