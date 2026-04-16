/**
 * Server-side Supabase client for Next.js Server Components and Route Handlers.
 *
 * Reads the user's session from cookies, so RLS policies fire under the
 * authenticated user's identity. Use this in:
 *   - Server Components (page.tsx without 'use client')
 *   - Route Handlers (app/api/.../route.ts)
 *   - Server Actions
 *
 * For privileged backend operations that must bypass RLS (admin actions,
 * cross-user reads, batch jobs), use `createSupabaseAdminClient()` below
 * which uses the SECRET key and never reads cookies.
 */
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can't set cookies; this is expected when called
            // from a non-mutating context. Middleware handles cookie refresh.
          }
        },
      },
    },
  );
}

/**
 * Privileged client — bypasses RLS. Use ONLY in trusted server contexts
 * (Route Handlers performing admin operations, cron jobs, webhook handlers).
 *
 * NEVER pass the result of this client to a browser or use it for queries
 * that should respect the calling user's permissions.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
