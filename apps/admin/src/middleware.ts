/**
 * Auth gate for the entire admin app.
 *
 * Two responsibilities:
 *   1. Refresh the Supabase session cookies on every request (otherwise the
 *      session can expire mid-use).
 *   2. Redirect unauthenticated requests to /login, except for /login itself
 *      and the auth callback path.
 *
 * Public marketing pages, the consumer surface, and `/api/public/*` would go
 * in the allowlist below as those land in later phases.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/api',           // API routes handle their own auth via Supabase service_role
];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  const path = request.nextUrl.pathname;
  const isPublic =
    PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Match all request paths except for static files. Adjust if you add
  // /api/public/* routes that should bypass auth.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
