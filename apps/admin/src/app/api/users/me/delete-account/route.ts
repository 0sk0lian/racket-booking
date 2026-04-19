/**
 * DELETE /api/users/me/delete-account
 * GDPR account deletion — anonymizes user data and removes auth account.
 */
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireUser } from '../../../../../lib/auth/guards';

export async function DELETE() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const userId = auth.user.id;
  const supabase = createSupabaseAdminClient();

  // 1. Anonymize user profile
  const { error: profileError } = await supabase
    .from('users')
    .update({
      email: `deleted-${userId}@deleted`,
      full_name: 'Deleted User',
      phone_number: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileError) {
    return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
  }

  // 2. Cancel all active memberships
  const { error: membershipError } = await supabase
    .from('club_memberships')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .in('status', ['active', 'pending']);

  if (membershipError) {
    return NextResponse.json({ success: false, error: membershipError.message }, { status: 500 });
  }

  // 3. Delete auth user (signs them out everywhere)
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) {
    return NextResponse.json({ success: false, error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Account deleted and data anonymized' });
}
