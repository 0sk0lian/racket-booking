/**
 * POST /api/courses/:id/sessions/generate
 * Generates course_sessions from the course schedule × term dates.
 * Skips dates in skip_dates[] and dates that already have a session.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../../../lib/auth/guards';
import { onCourseSessionsGenerated } from '../../../../../../lib/cascades';

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id: courseId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();
  if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
  const access = await requireClubAccess(course.club_id);
  if (!access.ok) return access.response;

  // Get existing sessions to avoid duplicates
  const { data: existing } = await supabase.from('course_sessions').select('date').eq('course_id', courseId);
  const existingDates = new Set((existing ?? []).map(s => s.date));
  const skipDates = new Set(course.skip_dates ?? []);

  // Generate dates
  const start = new Date(course.term_start + 'T00:00:00');
  const end = new Date(course.term_end + 'T00:00:00');
  const sessions: any[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== course.day_of_week) continue;
    const dateStr = toDateStr(d);
    if (skipDates.has(dateStr)) continue;
    if (existingDates.has(dateStr)) continue;

    sessions.push({
      course_id: courseId,
      date: dateStr,
      start_hour: course.start_hour,
      end_hour: course.end_hour,
      court_id: course.court_id,
      trainer_id: course.trainer_id,
      status: 'scheduled',
    });
  }

  if (sessions.length === 0) {
    return NextResponse.json({ success: true, data: { generated: 0, message: 'No new sessions to generate' } });
  }

  const { data, error } = await supabase.from('course_sessions').insert(sessions).select();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  // Update course status to active if it was draft
  if (course.status === 'draft') {
    await supabase.from('courses').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', courseId);
  }

  // Cascade: create bookings + attendance for each generated session
  if (data && data.length > 0) {
    const { data: registrations } = await supabase
      .from('course_registrations')
      .select('user_id')
      .eq('course_id', courseId)
      .eq('status', 'approved');
    const registeredUserIds = (registrations ?? []).map(r => r.user_id);

    await onCourseSessionsGenerated(data, course.club_id, registeredUserIds);
  }

  return NextResponse.json({ success: true, data: { generated: data?.length ?? 0, sessions: data } });
}
