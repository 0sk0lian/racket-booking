/**
 * GET /api/features/employee-schedule?clubId=
 * Weekly schedule for all trainers at a club.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) {
    return NextResponse.json({ success: false, error: 'clubId is required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();

  // Fetch trainers assigned to this club
  const { data: trainers, error: trainersError } = await supabase
    .from('users')
    .select('id, full_name, email, trainer_sport_types, trainer_hourly_rate')
    .eq('trainer_club_id', clubId)
    .eq('role', 'trainer')
    .eq('is_active', true)
    .order('full_name');

  if (trainersError) {
    return NextResponse.json({ success: false, error: trainersError.message }, { status: 500 });
  }

  if (!trainers || trainers.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const trainerIds = trainers.map((t) => t.id);

  // Fetch non-cancelled training sessions (bookings with booking_type containing 'training' or trainer_id set)
  const { data: sessions, error: sessionsError } = await supabase
    .from('bookings')
    .select('id, trainer_id, court_id, start_time, end_time, event_name, status, booking_type')
    .in('trainer_id', trainerIds)
    .neq('status', 'cancelled')
    .order('start_time');

  if (sessionsError) {
    return NextResponse.json({ success: false, error: sessionsError.message }, { status: 500 });
  }

  // Fetch courts for name resolution
  const courtIds = [...new Set((sessions ?? []).map((s) => s.court_id).filter(Boolean))];
  let courtMap = new Map<string, string>();

  if (courtIds.length > 0) {
    const { data: courts } = await supabase
      .from('courts')
      .select('id, name')
      .in('id', courtIds);
    courtMap = new Map((courts ?? []).map((c) => [c.id, c.name]));
  }

  // Group sessions by trainer
  const result = trainers.map((trainer) => {
    const trainerSessions = (sessions ?? [])
      .filter((s) => s.trainer_id === trainer.id)
      .map((s) => {
        const start = new Date(s.start_time);
        return {
          id: s.id,
          day: start.getDay(), // 0=Sun
          date: s.start_time.slice(0, 10),
          startTime: s.start_time,
          endTime: s.end_time,
          title: s.event_name || s.booking_type || 'Training',
          courtName: s.court_id ? courtMap.get(s.court_id) ?? null : null,
          status: s.status,
        };
      });

    return {
      trainerId: trainer.id,
      fullName: trainer.full_name,
      email: trainer.email,
      sportTypes: trainer.trainer_sport_types ?? [],
      hourlyRate: trainer.trainer_hourly_rate ?? 0,
      sessions: trainerSessions,
    };
  });

  return NextResponse.json({ success: true, data: result });
}
