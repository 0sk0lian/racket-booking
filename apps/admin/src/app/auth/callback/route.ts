/**
 * Auth callback — exchanges the Supabase OAuth/magic-link code for a session.
 *
 * Lands here from /login when the user clicks a magic link in their email or
 * returns from an OAuth provider. The redirectTo passed to the auth UI ends
 * with `/auth/callback?next=<where they were going>`.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  // Fall back to the login page on error
  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', url.origin));
}
