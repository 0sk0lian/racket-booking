import { createSupabaseAdminClient } from './supabase/server';

/**
 * Called after a form submission is created.
 * If the form's club has no active membership for this user, auto-creates one.
 */
export async function onFormSubmitted(params: {
  userId: string;
  formId: string;
  clubId: string;
}) {
  const supabase = createSupabaseAdminClient();

  // Check if user already has a membership
  const { data: existing } = await supabase
    .from('club_memberships')
    .select('id, status')
    .eq('club_id', params.clubId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (existing?.status === 'active' || existing?.status === 'pending') return;

  // Auto-create pending membership
  await supabase.from('club_memberships').upsert({
    club_id: params.clubId,
    user_id: params.userId,
    status: 'pending',
    membership_type: 'standard',
    applied_at: new Date().toISOString(),
    notes: `Auto-created from form submission (${params.formId})`,
  }, { onConflict: 'club_id,user_id' });
}

/**
 * Check and auto-close forms that have passed their close date.
 * Called periodically or on form list load.
 */
export async function autoCloseExpiredForms() {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  await supabase
    .from('registration_forms')
    .update({ status: 'closed' })
    .eq('status', 'open')
    .lt('close_date', now);
}

/**
 * Check and auto-open forms that have reached their open date.
 */
export async function autoOpenScheduledForms() {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  await supabase
    .from('registration_forms')
    .update({ status: 'open' })
    .eq('status', 'draft')
    .lt('open_date', now)
    .gt('close_date', now);
}
