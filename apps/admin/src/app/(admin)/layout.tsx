import { redirect } from 'next/navigation';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../lib/supabase/server';
import { AdminShell } from './admin-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
    redirect('/');
  }

  return (
    <AdminShell>{children}</AdminShell>
  );
}
