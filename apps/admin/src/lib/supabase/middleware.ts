/**
 * Middleware-side Supabase client.
 *
 * Used by Next.js middleware (apps/admin/src/middleware.ts) to refresh the
 * user's session cookies on every request. Without this, the session can
 * expire even while the user is actively using the app.
 *
 * Pattern from https://supabase.com/docs/guides/auth/server-side/nextjs.
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: refresh the auth token on every request — Supabase rotates
  // it periodically and stale tokens cause silent 401s in the app.
  const { data: { user } } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
