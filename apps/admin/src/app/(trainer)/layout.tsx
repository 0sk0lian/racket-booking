import { redirect } from 'next/navigation';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../lib/supabase/server';
import { TrainerShell } from './trainer-shell';

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Force password change for accounts created with a temp password
  if (user.user_metadata?.must_change_password) {
    redirect('/change-password');
  }

  // Check role — must be trainer
  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'trainer') {
    // Admins go to dashboard, others go to home
    if (profile?.role === 'admin' || profile?.role === 'superadmin') {
      redirect('/dashboard');
    }
    redirect('/');
  }

  return <TrainerShell>{children}</TrainerShell>;
}
