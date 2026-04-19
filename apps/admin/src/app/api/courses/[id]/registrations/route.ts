/**
 * GET  /api/courses/:id/registrations          — list registrations
 * PATCH /api/courses/:id/registrations         — bulk approve/reject (body: { ids[], status })
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../../lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const status = request.nextUrl.searchParams.get('status');
  const supabase = createSupabaseAdminClient();

  let query = supabase.from('course_registrations').select('*').eq('course_id', courseId);
  if (status) query = query.eq('status', status);
  query = query.order('applied_at');

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const userIds = [...new Set((data ?? []).map(r => r.user_id))];
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, full_name, email, phone_number').in('id', userIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map(u => [u.id, u]));

  const enriched = (data ?? []).map(r => ({
    ...r,
    user_name: userMap.get(r.user_id)?.full_name ?? 'Unknown',
    user_email: userMap.get(r.user_id)?.email ?? null,
    user_phone: userMap.get(r.user_id)?.phone_number ?? null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const { ids, status, notes } = await request.json();
  if (!ids?.length || !status) return NextResponse.json({ success: false, error: 'ids[] and status required' }, { status: 400 });

  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  const supabase = createSupabaseAdminClient();

  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'approved') { updates.approved_at = new Date().toISOString(); updates.approved_by = user?.id ?? null; }
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase.from('course_registrations')
    .update(updates).in('id', ids).eq('course_id', courseId).select();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  // If rejecting, auto-promote waitlisted
  if (status === 'rejected') {
    const { data: course } = await supabase.from('courses').select('max_participants').eq('id', courseId).single();
    const { data: approved } = await supabase.from('course_registrations').select('id').eq('course_id', courseId).eq('status', 'approved');
    const spotsLeft = course?.max_participants ? course.max_participants - (approved?.length ?? 0) : null;

    if (spotsLeft && spotsLeft > 0) {
      const { data: waitlisted } = await supabase.from('course_registrations')
        .select('id').eq('course_id', courseId).eq('status', 'waitlisted')
        .order('waitlist_position').limit(spotsLeft);
      if (waitlisted?.length) {
        await supabase.from('course_registrations')
          .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user?.id, updated_at: new Date().toISOString() })
          .in('id', waitlisted.map(w => w.id));
      }
    }
  }

  return NextResponse.json({ success: true, data });
}
