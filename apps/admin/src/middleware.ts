/**
 * Auth gate for the entire admin app.
 *
 * Two responsibilities:
 *   1. Refresh the Supabase session cookies on every request (otherwise the
 *      session can expire mid-use).
 *   2. Enforce route-level access policy for pages and API handlers.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateSession } from './lib/supabase/middleware';

const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/clubs',
];

// The landing page (/) is public for everyone
const EXACT_PUBLIC = ['/', '/clubs'];

const ADMIN_API_PREFIXES = [
  '/api/admin',
  '/api/admin/club-admins',
  '/api/blackouts',
  '/api/recurrence-rules',
  '/api/training-planner',
  '/api/apply-batches',
  '/api/features',
];

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

function isAdminApiRequest(path: string, method: string) {
  if (ADMIN_API_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix + '/'))) {
    return true;
  }

  if (path === '/api/users') return true;
  if (path.startsWith('/api/users/') && !path.startsWith('/api/users/me')) return true;

  if (path === '/api/courses' && method !== 'GET') return true;
  if (/^\/api\/courses\/[^/]+$/.test(path) && (method === 'PATCH' || method === 'DELETE')) return true;
  if (/^\/api\/courses\/[^/]+\/registrations$/.test(path) && method !== 'GET') return true;
  if (/^\/api\/courses\/[^/]+\/sessions\/generate$/.test(path)) return true;

  return false;
}

async function isAdminUser(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data } = await supabase.from('users').select('role').eq('id', userId).single();
  return data?.role === 'admin' || data?.role === 'superadmin';
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

    if (isAdminApiRequest(path, method)) {
      const admin = await isAdminUser(user.id);
      if (!admin) {
        return apiError(403, 'Admin access required');
      }
    }

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
  // Match all request paths except for static files.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
