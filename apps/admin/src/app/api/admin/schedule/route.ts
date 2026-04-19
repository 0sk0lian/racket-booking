/**
 * GET /api/admin/schedule?clubId=&date=YYYY-MM-DD
 * GET /api/admin/schedule?clubId=&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD  (multi-day)
 *
 * Single-day returns: { courts: [...] }
 * Multi-day returns:  { days: { "YYYY-MM-DD": { courts: [...] }, ... } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';

function enrichBooking(b: any, userMap: Map<string, any>, attendanceMap: Map<string, { present: number; total: number }>) {
  const startHour = new Date(b.time_slot_start).getHours();
  const endHour = new Date(b.time_slot_end).getHours();
  const booker = userMap.get(b.booker_id);
  const trainer = b.trainer_id ? userMap.get(b.trainer_id) : null;
  const playerNames = (b.player_ids ?? []).map((id: string) => userMap.get(id)?.full_name ?? 'Unknown');
  return {
    id: b.id,
    startHour,
    endHour,
    date: b.time_slot_start?.split('T')[0],
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
    attendancePresent: attendanceMap.get(b.id)?.present ?? 0,
    attendanceTotal: attendanceMap.get(b.id)?.total ?? 0,
  };
}

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  const singleDate = request.nextUrl.searchParams.get('date');
  const dateFrom = request.nextUrl.searchParams.get('dateFrom');
  const dateTo = request.nextUrl.searchParams.get('dateTo');

  if (!clubId || (!singleDate && (!dateFrom || !dateTo))) {
    return NextResponse.json({ success: false, error: 'clubId and (date OR dateFrom+dateTo) required' }, { status: 400 });
  }
  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

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
    return NextResponse.json({ success: true, data: singleDate ? { courts: [] } : { days: {} } });
  }

  // 2. Fetch bookings for the range
  const rangeStart = singleDate ? `${singleDate}T00:00:00` : `${dateFrom}T00:00:00`;
  const rangeEnd = singleDate ? `${singleDate}T23:59:59` : `${dateTo}T23:59:59`;

  const { data: allBookings, error: bErr } = await supabase
    .from('bookings')
    .select('*')
    .in('court_id', courtIds)
    .neq('status', 'cancelled')
    .lt('time_slot_start', rangeEnd)
    .gt('time_slot_end', rangeStart);

  if (bErr) return NextResponse.json({ success: false, error: bErr.message }, { status: 500 });

  // 3. Enrich with user names (single query for all bookings)
  const userIds = new Set<string>();
  (allBookings ?? []).forEach(b => {
    if (b.booker_id) userIds.add(b.booker_id);
    if (b.trainer_id) userIds.add(b.trainer_id);
    (b.player_ids ?? []).forEach((id: string) => userIds.add(id));
  });

  const { data: usersData } = userIds.size > 0
    ? await supabase.from('users').select('id, full_name').in('id', Array.from(userIds))
    : { data: [] };
  const userMap = new Map((usersData ?? []).map(u => [u.id, u]));

  // 3b. Fetch attendance counts for all bookings
  const bookingIds = (allBookings ?? []).map(b => b.id);
  const { data: attendanceData } = bookingIds.length > 0
    ? await supabase.from('attendance').select('booking_id, status').in('booking_id', bookingIds).not('status', 'in', '(cancelled,declined)')
    : { data: [] };

  const attendanceMap = new Map<string, { present: number; total: number }>();
  for (const a of attendanceData ?? []) {
    const entry = attendanceMap.get(a.booking_id) ?? { present: 0, total: 0 };
    entry.total++;
    if (a.status === 'present') entry.present++;
    attendanceMap.set(a.booking_id, entry);
  }

  // 4. Build response
  const buildCourtsForBookings = (bookings: any[]) =>
    (courts ?? []).map(court => ({
      courtId: court.id,
      courtName: court.name,
      sportType: court.sport_type,
      baseRate: court.base_hourly_rate,
      bookings: bookings
        .filter(b => b.court_id === court.id)
        .map(b => enrichBooking(b, userMap, attendanceMap))
        .sort((a: any, b: any) => a.startHour - b.startHour),
    }));

  if (singleDate) {
    return NextResponse.json({ success: true, data: { courts: buildCourtsForBookings(allBookings ?? []) } });
  }

  // Multi-day: group bookings by date
  const days: Record<string, { courts: any[] }> = {};
  const start = new Date(`${dateFrom}T12:00:00`);
  const end = new Date(`${dateTo}T12:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59`);
    const dayBookings = (allBookings ?? []).filter(b => {
      const bs = new Date(b.time_slot_start);
      const be = new Date(b.time_slot_end);
      return bs < dayEnd && be > dayStart;
    });
    days[dateStr] = { courts: buildCourtsForBookings(dayBookings) };
  }

  return NextResponse.json({ success: true, data: { days } });
}
