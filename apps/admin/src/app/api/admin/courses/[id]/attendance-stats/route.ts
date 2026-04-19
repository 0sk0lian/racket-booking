/**
 * GET /api/admin/courses/:id/attendance-stats
 * Per-participant attendance rates + overall course stats.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../../../lib/auth/guards';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const supabase = createSupabaseAdminClient();

  // Get course + sessions
  const { data: course } = await supabase.from('courses').select('name, club_id').eq('id', courseId).single();
  if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
  if (course.club_id) {
    const access = await requireClubAccess(course.club_id);
    if (!access.ok) return access.response;
  }

  const { data: sessions } = await supabase.from('course_sessions').select('id, date, status, booking_id')
    .eq('course_id', courseId).order('date');

  const completedSessions = (sessions ?? []).filter(s => s.status === 'completed');
  const scheduledSessions = (sessions ?? []).filter(s => s.status === 'scheduled');
  const bookingIds = (sessions ?? []).map(s => s.booking_id).filter(Boolean);

  // Get attendance for all session bookings
  const { data: attendanceRows } = bookingIds.length > 0
    ? await supabase.from('attendance').select('booking_id, user_id, status').in('booking_id', bookingIds)
    : { data: [] };

  // Get approved participants
  const { data: registrations } = await supabase.from('course_registrations')
    .select('user_id').eq('course_id', courseId).eq('status', 'approved');
  const participantIds = (registrations ?? []).map(r => r.user_id);

  // Enrich with names
  const { data: users } = participantIds.length > 0
    ? await supabase.from('users').select('id, full_name').in('id', participantIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map(u => [u.id, u.full_name]));

  // Per-participant stats
  const perParticipant = participantIds.map(uid => {
    const rows = (attendanceRows ?? []).filter(a => a.user_id === uid);
    const present = rows.filter(a => a.status === 'present').length;
    const noShow = rows.filter(a => a.status === 'no_show').length;
    const going = rows.filter(a => a.status === 'going').length;
    const total = completedSessions.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : null;

    return {
      user_id: uid,
      user_name: userMap.get(uid) ?? 'Unknown',
      present,
      no_show: noShow,
      going,
      total_sessions: total,
      attendance_rate: rate,
    };
  }).sort((a, b) => (b.attendance_rate ?? 0) - (a.attendance_rate ?? 0));

  // Overall stats
  const totalPresent = perParticipant.reduce((s, p) => s + p.present, 0);
  const totalNoShow = perParticipant.reduce((s, p) => s + p.no_show, 0);
  const totalPossible = completedSessions.length * participantIds.length;
  const overallRate = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : null;

  return NextResponse.json({
    success: true,
    data: {
      course_name: course.name,
      total_sessions: sessions?.length ?? 0,
      completed_sessions: completedSessions.length,
      scheduled_sessions: scheduledSessions.length,
      participants: participantIds.length,
      overall_attendance_rate: overallRate,
      overall_present: totalPresent,
      overall_no_show: totalNoShow,
      per_participant: perParticipant,
    },
  });
}
