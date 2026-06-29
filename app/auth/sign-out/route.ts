import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { appRedirect } from '../../../lib/supabase/origin';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(appRedirect(request, '/login', { message: 'You have been signed out.' }), 303);
}
