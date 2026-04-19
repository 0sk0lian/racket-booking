/**
 * GET    /api/registration-forms/:id
 * PATCH  /api/registration-forms/:id
 * DELETE /api/registration-forms/:id
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/auth/guards';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const supabase = createSupabaseAdminClient();

  // Fetch form
  const { data: form, error } = await supabase
    .from('registration_forms')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !form) {
    return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
  }

  // Fetch submissions enriched with user name/email
  const { data: submissions } = await supabase
    .from('form_submissions')
    .select('*')
    .eq('form_id', id)
    .order('submitted_at', { ascending: true });

  const userIds = (submissions ?? []).map(s => s.user_id);
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, full_name, email').in('id', userIds)
    : { data: [] };

  const userMap = new Map((users ?? []).map(u => [u.id, u]));

  const enrichedSubs = (submissions ?? []).map(s => {
    const user = userMap.get(s.user_id);
    return {
      ...s,
      user_name: user?.full_name ?? 'Unknown',
      user_email: user?.email ?? '',
    };
  });

  // Get target group name
  let targetGroupName: string | null = null;
  if (form.target_group_id) {
    const { data: group } = await supabase
      .from('groups')
      .select('name')
      .eq('id', form.target_group_id)
      .single();
    targetGroupName = group?.name ?? null;
  }

  const submissionCount = enrichedSubs.length;
  const assignedCount = enrichedSubs.filter(s => s.assigned_to_group).length;

  return NextResponse.json({
    success: true,
    data: {
      ...form,
      submissions: enrichedSubs,
      submission_count: submissionCount,
      assigned_count: assignedCount,
      target_group_name: targetGroupName,
      spots_remaining: form.max_submissions != null ? form.max_submissions - submissionCount : null,
    },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await context.params;
  const body = await request.json();

  // camelCase -> snake_case mapping
  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.season !== undefined) updateData.season = body.season;
  if (body.fields !== undefined) updateData.fields = body.fields;
  if (body.sportType !== undefined) updateData.sport_type = body.sportType;
  if (body.targetGroupId !== undefined) updateData.target_group_id = body.targetGroupId;
  if (body.maxSubmissions !== undefined) updateData.max_submissions = body.maxSubmissions;

  updateData.updated_at = new Date().toISOString();

  const supabase = createSupabaseAdminClient();

  const { data: form, error } = await supabase
    .from('registration_forms')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: form });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();

  // Soft-delete: set status to closed
  const { error } = await supabase
    .from('registration_forms')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
