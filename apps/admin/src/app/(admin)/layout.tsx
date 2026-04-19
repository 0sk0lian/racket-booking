import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { AdminShell } from './admin-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Only check session — middleware already gates unauthenticated users.
  // Role checks happen in each API route via requireAdmin()/requireClubAccess().
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <AdminShell>{children}</AdminShell>
  );
}
