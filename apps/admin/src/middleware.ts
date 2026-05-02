/**
 * Auth gate for the entire admin app.
 *
 * 1. Refresh Supabase session cookies on every request.
 * 2. Enforce route-level auth without doing role database checks here.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
];

function isPublicApiRequest(path: string, method: string) {
  if (method !== 'GET') return false;
  return path === '/api/health';
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

    return supabaseResponse;
  }

  const isPublic = PUBLIC_PATHS.some((publicPath) => path === publicPath || path.startsWith(publicPath + '/'));

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
