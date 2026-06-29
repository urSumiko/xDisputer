import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { clearManagerOutputHistory } from '../../../../../src/features/manager-output-activity/manager-output-clear-service';

function back(request: NextRequest, state: string, message: string) {
  const target = new URL(request.headers.get('referer') || '/admin/output-activity-v2', request.url);
  target.searchParams.set('control', state);
  target.searchParams.set('message', message.slice(0, 180));
  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  try {
    const result = await clearManagerOutputHistory(request);
    revalidatePath('/admin/output-activity-v2');
    revalidatePath('/workspace');
    return back(request, result.ok ? 'ok' : 'error', result.message);
  } catch (error) {
    return back(request, 'error', error instanceof Error ? error.message : 'Output history clear failed.');
  }
}
