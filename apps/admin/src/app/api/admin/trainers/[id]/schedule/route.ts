/**
 * GET /api/admin/trainers/:id/schedule?from=&to=
 * All bookings, training sessions, and course sessions for one trainer in a date range.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../../../lib/auth/guards';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: trainerId } = await params;
  const p = request.nextUrl.searchParams;
  const today = new Date().toISOString().split('T')[0];
  const from = p.get('from') ?? today;
  const to = p.get('to') ?? from;

  const supabase = createSupabaseAdminClient();

  // Trainer profile
  const { data: trainer } = await supabase.from('users').select('id, full_name, email, trainer_club_id, trainer_sport_types, trainer_hourly_rate, trainer_monthly_salary')
    .eq('id', trainerId).single();
  if (!trainer) return NextResponse.json({ success: false, error: 'Trainer not found' }, { status: 404 });

  const trainerClubId = trainer?.trainer_club_id as string | null;
  if (trainerClubId) {
    const access = await requireClubAccess(trainerClubId);
    if (!access.ok) return access.response;
  }

  // Bookings where this trainer is assigned
  const { data: bookings } = await supabase.from('bookings')
    .select('id, court_id, booking_type, time_slot_start, time_slot_end, status, notes, event_name')
    .eq('trainer_id', trainerId).neq('status', 'cancelled')
    .gte('time_slot_start', from + 'T00:00:00').lte('time_slot_start', to + 'T23:59:59')
    .order('time_slot_start');

  // Course sessions where this trainer is assigned
  const { data: courseSessions } = await supabase.from('course_sessions')
    .select('id, course_id, date, start_hour, end_hour, status, court_id')
    .eq('trainer_id', trainerId).eq('status', 'scheduled')
    .gte('date', from).lte('date', to)
    .order('date');

  // Enrich with court names
  const courtIds = new Set<string>();
  (bookings ?? []).forEach(b => { if (b.court_id) courtIds.add(b.court_id); });
  (courseSessions ?? []).forEach(s => { if (s.court_id) courtIds.add(s.court_id); });
  const { data: courts } = courtIds.size > 0
    ? await supabase.from('courts').select('id, name').in('id', Array.from(courtIds))
    : { data: [] };
  const courtMap = new Map((courts ?? []).map(c => [c.id, c.name]));

  // Course names
  const courseIds = [...new Set((courseSessions ?? []).map(s => s.course_id))];
  const { data: courses } = courseIds.length > 0
    ? await supabase.from('courses').select('id, name').in('id', courseIds)
    : { data: [] };
  const courseMap = new Map((courses ?? []).map(c => [c.id, c.name]));

  // Build unified schedule items
  const items = [
    ...(bookings ?? []).map(b => ({
      type: 'booking' as const,
      id: b.id,
      date: b.time_slot_start?.split('T')[0],
      start_hour: new Date(b.time_slot_start).getHours(),
      end_hour: new Date(b.time_slot_end).getHours(),
      title: b.booking_type === 'event' ? (b.event_name ?? 'Event') : b.booking_type,
      court_name: courtMap.get(b.court_id) ?? '?',
      booking_type: b.booking_type,
    })),
    ...(courseSessions ?? []).map(s => ({
      type: 'course_session' as const,
      id: s.id,
      date: s.date,
      start_hour: s.start_hour,
      end_hour: s.end_hour,
      title: courseMap.get(s.course_id) ?? 'Kurs',
      court_name: courtMap.get(s.court_id) ?? '?',
      booking_type: 'course',
    })),
  ].sort((a, b) => (a.date + String(a.start_hour).padStart(2, '0')).localeCompare(b.date + String(b.start_hour).padStart(2, '0')));

  // Detect conflicts (same date + overlapping hours)
  const conflicts: string[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].date === items[j].date && items[i].start_hour < items[j].end_hour && items[i].end_hour > items[j].start_hour) {
        conflicts.push(`${items[i].date} ${items[i].start_hour}:00: "${items[i].title}" overlaps "${items[j].title}"`);
      }
    }
  }

  // Hours + salary
  const totalHours = items.reduce((sum, i) => sum + (i.end_hour - i.start_hour), 0);
  const estimatedSalary = trainer.trainer_monthly_salary ?? (totalHours * (trainer.trainer_hourly_rate ?? 0));

  return NextResponse.json({
    success: true,
    data: {
      trainer: { id: trainer.id, name: trainer.full_name, email: trainer.email, sports: trainer.trainer_sport_types, hourly_rate: trainer.trainer_hourly_rate },
      items,
      conflicts,
      summary: { total_items: items.length, total_hours: totalHours, estimated_salary: estimatedSalary },
    },
  });
}
