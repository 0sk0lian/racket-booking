/**
 * POST /api/registration-forms/:id/submit
 * Player submits a form answer.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireUser } from '../../../../../lib/auth/guards';
import { onFormSubmitted } from '../../../../../lib/form-automations';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id: formId } = await context.params;
  const body = await request.json();
  const userId = auth.user.id;

  const supabase = createSupabaseAdminClient();

  // Fetch form, verify it's open
  const { data: form, error: formError } = await supabase
    .from('registration_forms')
    .select('*')
    .eq('id', formId)
    .single();

  if (formError || !form) {
    return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
  }

  if (form.status !== 'open') {
    return NextResponse.json({ success: false, error: 'Form is not open for submissions' }, { status: 400 });
  }

  // Check unique constraint: one submission per user per form
  const { data: existing } = await supabase
    .from('form_submissions')
    .select('id')
    .eq('form_id', formId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: false, error: 'You have already submitted this form' }, { status: 400 });
  }

  // Check max_submissions capacity
  if (form.max_submissions != null) {
    const { count } = await supabase
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('form_id', formId);

    if ((count ?? 0) >= form.max_submissions) {
      return NextResponse.json({ success: false, error: 'Form has reached maximum submissions' }, { status: 400 });
    }
  }

  // Insert submission
  let assignedToGroup = false;

  const { data: submission, error: subError } = await supabase
    .from('form_submissions')
    .insert({
      form_id: formId,
      user_id: userId,
      answers: body.answers || {},
      submitted_at: new Date().toISOString(),
      assigned_to_group: false,
    })
    .select('*')
    .single();

  if (subError) {
    return NextResponse.json({ success: false, error: subError.message }, { status: 500 });
  }

  // Auto-assign to target group if configured
  if (form.target_group_id) {
    const { data: group } = await supabase
      .from('groups')
      .select('id, player_ids, parent_group_id')
      .eq('id', form.target_group_id)
      .single();

    if (group) {
      const playerIds: string[] = group.player_ids ?? [];
      if (!playerIds.includes(userId)) {
        playerIds.push(userId);
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
          if (!parentPlayerIds.includes(userId)) {
            parentPlayerIds.push(userId);
            await supabase
              .from('groups')
              .update({ player_ids: parentPlayerIds })
              .eq('id', parentGroup.id);
          }
        }
      }

      // Mark submission as assigned
      assignedToGroup = true;
      await supabase
        .from('form_submissions')
        .update({ assigned_to_group: true })
        .eq('id', submission.id);
    }
  }

  // Fire post-submission automation
  await onFormSubmitted({ userId, formId, clubId: form.club_id });

  return NextResponse.json({
    success: true,
    data: { ...submission, assigned_to_group: assignedToGroup },
  }, { status: 201 });
}
