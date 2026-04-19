/**
 * Auth gate for the entire admin app.
 *
 * Two responsibilities:
 *   1. Refresh the Supabase session cookies on every request (otherwise the
 *      session can expire mid-use).
 *   2. Enforce route-level access policy — auth check only, NO database queries.
 *      Role-based checks are handled by the auth guards in each Route Handler.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/clubs',
];

const EXACT_PUBLIC = ['/', '/clubs'];

function isPublicApiRequest(path: string, method: string) {
  if (method !== 'GET') return false;
  if (path === '/api/health') return true;

  const publicGetPrefixes = [
    '/api/clubs',
    '/api/courts',
    '/api/availability',
    '/api/venue-profiles',
    '/api/matches/browse',
    '/api/courses',
  ];

  return publicGetPrefixes.some(prefix => path === prefix || path.startsWith(prefix + '/'));
}

function apiError(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  const path = request.nextUrl.pathname;
  const method = request.method.toUpperCase();

  if (path.startsWith('/api')) {
    if (method === 'OPTIONS') {
      return supabaseResponse;
    }

    if (isPublicApiRequest(path, method)) {
      return supabaseResponse;
    }

    if (!user) {
      return apiError(401, 'Authentication required');
    }

    // Admin role checks are handled by requireAdmin()/requireClubAccess()
    // inside each Route Handler — no DB query needed here.
    return supabaseResponse;
  }

  const isPublic =
    EXACT_PUBLIC.includes(path) ||
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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
