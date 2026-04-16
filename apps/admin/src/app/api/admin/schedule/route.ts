/**
 * GET /api/admin/schedule?clubId=&date=YYYY-MM-DD
 * Returns the day's bookings grouped by court for the schedule grid.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  const date = request.nextUrl.searchParams.get('date');
  if (!clubId || !date) {
    return NextResponse.json({ success: false, error: 'clubId and date required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // 1. Fetch courts
  const { data: courts, error: courtsErr } = await supabase
    .from('courts')
    .select('id, name, sport_type, base_hourly_rate')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('name');
  if (courtsErr) return NextResponse.json({ success: false, error: courtsErr.message }, { status: 500 });

  const courtIds = (courts ?? []).map(c => c.id);
  if (courtIds.length === 0) {
    return NextResponse.json({ success: true, data: { courts: [] } });
  }

  // 2. Fetch bookings for this day using the denormalized timestamp columns
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;

  const { data: dayBookings, error: bErr } = await supabase
    .from('bookings')
    .select('*')
    .in('court_id', courtIds)
    .neq('status', 'cancelled')
    .lt('time_slot_start', dayEnd)
    .gt('time_slot_end', dayStart);

  if (bErr) return NextResponse.json({ success: false, error: bErr.message }, { status: 500 });

  // 3. Enrich with user names
  const userIds = new Set<string>();
  (dayBookings ?? []).forEach(b => {
    if (b.booker_id) userIds.add(b.booker_id);
    if (b.trainer_id) userIds.add(b.trainer_id);
    (b.player_ids ?? []).forEach((id: string) => userIds.add(id));
  });

  const { data: usersData } = userIds.size > 0
    ? await supabase.from('users').select('id, full_name').in('id', Array.from(userIds))
    : { data: [] };
  const userMap = new Map((usersData ?? []).map(u => [u.id, u]));

  // 4. Group by court
  const result = {
    courts: (courts ?? []).map(court => ({
      courtId: court.id,
      courtName: court.name,
      sportType: court.sport_type,
      baseRate: court.base_hourly_rate,
      bookings: (dayBookings ?? [])
        .filter(b => b.court_id === court.id)
        .map(b => {
          const startHour = new Date(b.time_slot_start).getHours();
          const endHour = new Date(b.time_slot_end).getHours();
          const booker = userMap.get(b.booker_id);
          const trainer = b.trainer_id ? userMap.get(b.trainer_id) : null;
          const playerNames = (b.player_ids ?? []).map((id: string) => userMap.get(id)?.full_name ?? 'Unknown');
          return {
            id: b.id,
            startHour,
            endHour,
            status: b.status,
            bookingType: b.booking_type ?? 'regular',
            bookerName: booker?.full_name ?? (b.booker_id === 'admin' ? 'Admin' : 'Unknown'),
            bookerId: b.booker_id,
            totalPrice: b.total_price ?? 0,
            accessPin: b.access_pin,
            trainerId: b.trainer_id,
            trainerName: trainer?.full_name ?? null,
            playerIds: b.player_ids ?? [],
            playerNames,
            contractId: b.contract_id,
            recurrenceDay: b.recurrence_day,
            eventName: b.event_name,
            eventMaxParticipants: b.event_max_participants,
            attendeeCount: (b.event_attendee_ids ?? []).length,
            eventAttendeeIds: b.event_attendee_ids ?? [],
            notes: b.notes,
            isSplitPayment: b.is_split_payment ?? false,
          };
        })
        .sort((a: any, b: any) => a.startHour - b.startHour),
    })),
  };

  return NextResponse.json({ success: true, data: result });
}
