'use client';
/**
 * Browser-side Supabase client.
 *
 * Used in client components and the auth-ui-react LoginForm. Honors RLS as the
 * authenticated user (via cookies set by the server-side flow) or as `anon`
 * if not signed in.
 *
 * Never import the SECRET key here — this code runs in the browser bundle.
 * Only the publishable key (NEXT_PUBLIC_*) is safe.
 */
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
