/**
 * POST /auth/signout — clears the Supabase session and redirects to /login.
 * Use a form POST from a client component:
 *   <form action="/auth/signout" method="POST"><button>Logga ut</button></form>
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
