import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { AdminShell } from './admin-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Force password change for accounts created with a temp password
  if (user.user_metadata?.must_change_password) {
    redirect('/change-password');
  }

  return (
    <AdminShell>{children}</AdminShell>
  );
}
