/**
 * POST /api/registration-forms/:id/assign-one
 * Assigns a single submission to the form's target group.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id: formId } = await context.params;
  const body = await request.json();
  const { submissionId } = body;

  if (!submissionId) {
    return NextResponse.json({ success: false, error: 'submissionId is required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Fetch form
  const { data: form, error: formError } = await supabase
    .from('registration_forms')
    .select('club_id, target_group_id')
    .eq('id', formId)
    .single();

  if (formError || !form) {
    return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
  }

  const access = await requireClubAccess(form.club_id);
  if (!access.ok) return access.response;

  if (!form.target_group_id) {
    return NextResponse.json({ success: false, error: 'Form has no target group' }, { status: 400 });
  }

  // Fetch submission
  const { data: submission, error: subError } = await supabase
    .from('form_submissions')
    .select('id, user_id, assigned_to_group')
    .eq('id', submissionId)
    .eq('form_id', formId)
    .single();

  if (subError || !submission) {
    return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
  }

  if (submission.assigned_to_group) {
    return NextResponse.json({ success: false, error: 'Already assigned' }, { status: 400 });
  }

  // Fetch target group
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, player_ids, parent_group_id')
    .eq('id', form.target_group_id)
    .single();

  if (!group) {
    return NextResponse.json({ success: false, error: 'Target group not found' }, { status: 404 });
  }

  // Add user to group
  const playerIds: string[] = group.player_ids ?? [];
  if (!playerIds.includes(submission.user_id)) {
    playerIds.push(submission.user_id);
    await supabase
      .from('groups')
      .update({ player_ids: playerIds })
      .eq('id', group.id);
  }

  // Also add to parent group if exists
  if (group.parent_group_id) {
    const { data: parentGroup } = await supabase
      .from('groups')
      .select('id, player_ids')
      .eq('id', group.parent_group_id)
      .single();

    if (parentGroup) {
      const parentPlayerIds: string[] = parentGroup.player_ids ?? [];
      if (!parentPlayerIds.includes(submission.user_id)) {
        parentPlayerIds.push(submission.user_id);
        await supabase
          .from('groups')
          .update({ player_ids: parentPlayerIds })
          .eq('id', parentGroup.id);
      }
    }
  }

  // Mark as assigned
  await supabase
    .from('form_submissions')
    .update({ assigned_to_group: true })
    .eq('id', submissionId);

  // Get user name for response
  const { data: user } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', submission.user_id)
    .single();

  return NextResponse.json({
    success: true,
    data: {
      user_name: user?.full_name ?? 'Unknown',
      group_name: group.name,
    },
  });
}
