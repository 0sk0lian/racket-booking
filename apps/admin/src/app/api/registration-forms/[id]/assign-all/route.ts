/**
 * POST /api/registration-forms/:id/assign-all
 * Assigns all unassigned submissions to the form's target group.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id: formId } = await context.params;
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

  // Fetch unassigned submissions
  const { data: unassigned } = await supabase
    .from('form_submissions')
    .select('id, user_id')
    .eq('form_id', formId)
    .eq('assigned_to_group', false);

  if (!unassigned || unassigned.length === 0) {
    return NextResponse.json({ success: true, data: { assigned: 0, group_name: null } });
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

  // Add all unassigned users to the group
  const playerIds: string[] = group.player_ids ?? [];
  const newUserIds = unassigned.map(s => s.user_id);
  for (const uid of newUserIds) {
    if (!playerIds.includes(uid)) {
      playerIds.push(uid);
    }
  }

  await supabase
    .from('groups')
    .update({ player_ids: playerIds })
    .eq('id', group.id);

  // Also add to parent group if exists
  if (group.parent_group_id) {
    const { data: parentGroup } = await supabase
      .from('groups')
      .select('id, player_ids')
      .eq('id', group.parent_group_id)
      .single();

    if (parentGroup) {
      const parentPlayerIds: string[] = parentGroup.player_ids ?? [];
      for (const uid of newUserIds) {
        if (!parentPlayerIds.includes(uid)) {
          parentPlayerIds.push(uid);
        }
      }
      await supabase
        .from('groups')
        .update({ player_ids: parentPlayerIds })
        .eq('id', parentGroup.id);
    }
  }

  // Mark all as assigned
  const submissionIds = unassigned.map(s => s.id);
  await supabase
    .from('form_submissions')
    .update({ assigned_to_group: true })
    .in('id', submissionIds);

  return NextResponse.json({
    success: true,
    data: { assigned: unassigned.length, group_name: group.name },
  });
}
