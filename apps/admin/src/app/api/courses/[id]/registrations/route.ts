/**
 * GET  /api/courses/:id/registrations          — list registrations
 * PATCH /api/courses/:id/registrations         — bulk approve/reject (body: { ids[], status })
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { getRequestUser, getUserRole, requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';
import { onCourseRegistrationsApproved } from '../../../../../lib/cascades';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const status = request.nextUrl.searchParams.get('status');
  const mineOnly = request.nextUrl.searchParams.get('mine') === 'true';
  const supabase = createSupabaseAdminClient();
  const { data: course } = await supabase.from('courses').select('id, club_id').eq('id', courseId).single();
  if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });

  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ success: true, data: [] });
  }

  const role = await getUserRole(user.id);
  const isAdmin = role === 'admin' || role === 'superadmin';
  if (isAdmin && !mineOnly) {
    const access = await requireClubAccess(course.club_id);
    if (!access.ok) return access.response;
  }

  let query = supabase.from('course_registrations').select('*').eq('course_id', courseId);
  if (status) query = query.eq('status', status);
  if (!isAdmin || mineOnly) query = query.eq('user_id', user.id);
  query = query.order('applied_at');

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  if (!isAdmin || mineOnly) {
    return NextResponse.json({ success: true, data: data ?? [] });
  }

  const userIds = [...new Set((data ?? []).map((row) => row.user_id))];
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, full_name, email, phone_number').in('id', userIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map((row) => [row.id, row]));

  const enriched = (data ?? []).map((row) => ({
    ...row,
    user_name: userMap.get(row.user_id)?.full_name ?? 'Unknown',
    user_email: userMap.get(row.user_id)?.email ?? null,
    user_phone: userMap.get(row.user_id)?.phone_number ?? null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id: courseId } = await params;
  const { ids, status, notes, paymentStatus } = await request.json();
  if (!ids?.length || (!status && !paymentStatus)) {
    return NextResponse.json({ success: false, error: 'ids[] and either status or paymentStatus are required' }, { status: 400 });
  }
  if (status && !['pending', 'approved', 'rejected', 'waitlisted'].includes(status)) {
    return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
  }
  if (paymentStatus && !['unpaid', 'paid', 'refunded'].includes(paymentStatus)) {
    return NextResponse.json({ success: false, error: 'Invalid paymentStatus' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: course } = await supabase.from('courses').select('id, club_id').eq('id', courseId).single();
  if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
  const access = await requireClubAccess(course.club_id);
  if (!access.ok) return access.response;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) {
    updates.status = status;
    if (status === 'approved') {
      updates.approved_at = new Date().toISOString();
      updates.approved_by = admin.user.id;
    }
  }
  if (paymentStatus) updates.payment_status = paymentStatus;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase.from('course_registrations')
    .update(updates).in('id', ids).eq('course_id', courseId).select();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  // Auto-sync approved students to the training planner
  if (status === 'approved') {
    onCourseRegistrationsApproved(courseId).catch(() => {});
  }

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
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: admin.user.id,
            updated_at: new Date().toISOString(),
          })
          .in('id', waitlisted.map((row) => row.id));
      }
    }
  }

  return NextResponse.json({ success: true, data });
}
