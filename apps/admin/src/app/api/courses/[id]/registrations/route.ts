/**
 * GET  /api/courses/:id/registrations  - list registrations
 * PATCH /api/courses/:id/registrations - bulk approve/reject/payment updates
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { getRequestUser, getUserRole, requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';

function buildPassCountMap(sessions: Array<{ player_ids?: string[] | null }>) {
  const map = new Map<string, number>();
  for (const session of sessions) {
    for (const userId of session.player_ids ?? []) {
      map.set(userId, (map.get(userId) ?? 0) + 1);
    }
  }
  return map;
}

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
  const invoiceIds = [...new Set((data ?? []).map((row) => row.invoice_id).filter(Boolean))];
  const sourceTag = `[course:${courseId}]`;

  const [{ data: users }, { data: invoices }, { data: plannerSessions }] = await Promise.all([
    userIds.length > 0
      ? supabase.from('users').select('id, full_name, email, phone_number').in('id', userIds)
      : { data: [] },
    invoiceIds.length > 0
      ? supabase.from('invoices').select('id, status, due_date, amount').in('id', invoiceIds as string[])
      : { data: [] },
    supabase
      .from('training_sessions')
      .select('player_ids')
      .eq('club_id', course.club_id)
      .ilike('notes', `%${sourceTag}%`),
  ]);

  const userMap = new Map((users ?? []).map((row) => [row.id, row]));
  const invoiceMap = new Map((invoices ?? []).map((row) => [row.id, row]));
  const passCountMap = buildPassCountMap((plannerSessions ?? []) as Array<{ player_ids?: string[] | null }>);

  const enriched = (data ?? []).map((row) => ({
    ...row,
    user_name: userMap.get(row.user_id)?.full_name ?? 'Unknown',
    user_email: userMap.get(row.user_id)?.email ?? null,
    user_phone: userMap.get(row.user_id)?.phone_number ?? null,
    pass_count: passCountMap.get(row.user_id) ?? 0,
    invoice_status: row.invoice_id ? invoiceMap.get(row.invoice_id)?.status ?? null : null,
    invoice_due_date: row.invoice_id ? invoiceMap.get(row.invoice_id)?.due_date ?? null : null,
    invoice_amount: row.invoice_id ? invoiceMap.get(row.invoice_id)?.amount ?? null : null,
    answers: row.answers ?? {},
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

  const { data, error } = await supabase
    .from('course_registrations')
    .update(updates)
    .in('id', ids)
    .eq('course_id', courseId)
    .select();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  if (status === 'rejected') {
    const { data: courseData } = await supabase.from('courses').select('max_participants').eq('id', courseId).single();
    const { data: approved } = await supabase.from('course_registrations').select('id').eq('course_id', courseId).eq('status', 'approved');
    const spotsLeft = courseData?.max_participants ? courseData.max_participants - (approved?.length ?? 0) : null;

    if (spotsLeft && spotsLeft > 0) {
      const { data: waitlisted } = await supabase
        .from('course_registrations')
        .select('id')
        .eq('course_id', courseId)
        .eq('status', 'waitlisted')
        .order('waitlist_position')
        .limit(spotsLeft);
      if (waitlisted?.length) {
        await supabase
          .from('course_registrations')
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id: courseId } = await params;
  const registrationId = request.nextUrl.searchParams.get('registrationId');
  if (!registrationId) return NextResponse.json({ success: false, error: 'registrationId required' }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: course } = await supabase.from('courses').select('club_id').eq('id', courseId).single();
  if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });

  const access = await requireClubAccess(course.club_id);
  if (!access.ok) return access.response;

  const { error } = await supabase.from('course_registrations').delete().eq('id', registrationId).eq('course_id', courseId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
