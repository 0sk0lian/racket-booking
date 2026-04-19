import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../../lib/auth/guards';

function deriveCategory(playerIds: string[] | null | undefined, playerCategoryMap: Map<string, string>) {
  const ids = playerIds ?? [];
  if (ids.length === 0) return 'other';

  const counts = new Map<string, number>();
  for (const playerId of ids) {
    const category = playerCategoryMap.get(playerId) ?? 'other';
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
}

function parseRateMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(val);
    if (Number.isFinite(n) && n >= 0) out[key] = n;
  }
  return out;
}

function hoursBetween(start: string, end: string) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const diff = (endMs - startMs) / 3_600_000;
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Number(diff.toFixed(2));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const userId = body?.userId as string | undefined;
  const clubId = body?.clubId as string | undefined;
  const date = body?.date as string | undefined;

  if (!userId || !clubId || !date) {
    return NextResponse.json({ success: false, error: 'userId, clubId and date are required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;
  const supabase = createSupabaseAdminClient();

  const { data: trainer } = await supabase
    .from('users')
    .select('id, full_name, trainer_hourly_rate, trainer_rates')
    .eq('id', userId)
    .single();
  if (!trainer) return NextResponse.json({ success: false, error: 'Trainer not found' }, { status: 404 });

  const { data: courts } = await supabase.from('courts').select('id').eq('club_id', clubId);
  const courtIds = (courts ?? []).map((court) => court.id);
  if (courtIds.length === 0) {
    return NextResponse.json({ success: true, data: { created: 0, totalHours: 0, totalPay: 0, reports: [] } });
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, booking_type, event_name, time_slot_start, time_slot_end, player_ids')
    .eq('trainer_id', userId)
    .in('court_id', courtIds)
    .neq('status', 'cancelled')
    .gte('time_slot_start', dayStart)
    .lte('time_slot_start', dayEnd)
    .order('time_slot_start', { ascending: true });

  if (bookingsError) return NextResponse.json({ success: false, error: bookingsError.message }, { status: 500 });
  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ success: true, data: { created: 0, totalHours: 0, totalPay: 0, reports: [] } });
  }

  const { data: groups } = await supabase.from('groups').select('category, player_ids').eq('club_id', clubId);
  const playerCategoryMap = new Map<string, string>();
  for (const group of groups ?? []) {
    const category = group.category ?? 'other';
    for (const playerId of group.player_ids ?? []) {
      if (!playerCategoryMap.has(playerId)) playerCategoryMap.set(playerId, category);
    }
  }

  const bookingIds = bookings.map((booking) => booking.id);
  const { data: existingReports } = await supabase
    .from('time_reports')
    .select('booking_id')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .in('booking_id', bookingIds);
  const existingBookingIds = new Set((existingReports ?? []).map((row) => row.booking_id).filter(Boolean));

  const rateMap = parseRateMap(trainer.trainer_rates);
  const defaultRate = Number(trainer.trainer_hourly_rate ?? 0);
  const inserts: any[] = [];
  const previewRows: { bookingId: string; sessionTitle: string; category: string; hours: number; rate: number; pay: number }[] = [];

  for (const booking of bookings) {
    if (existingBookingIds.has(booking.id)) continue;

    const category = deriveCategory(booking.player_ids as string[] | undefined, playerCategoryMap);
    const rate = Number(rateMap[category] ?? defaultRate ?? 0);
    const hours = hoursBetween(booking.time_slot_start, booking.time_slot_end);
    const pay = Number((hours * rate).toFixed(2));
    const title = booking.booking_type === 'event'
      ? booking.event_name || 'Event'
      : `Training ${booking.time_slot_start.slice(11, 16)}`;

    inserts.push({
      user_id: userId,
      club_id: clubId,
      date,
      hours,
      type: booking.booking_type === 'event' ? 'event' : 'training',
      description: `Synced from schedule booking ${booking.id} [cat:${category}]`,
      booking_id: booking.id,
      approved: false,
    });

    previewRows.push({
      bookingId: booking.id,
      sessionTitle: title,
      category,
      hours,
      rate,
      pay,
    });
  }

  if (inserts.length === 0) {
    return NextResponse.json({ success: true, data: { created: 0, totalHours: 0, totalPay: 0, reports: [] } });
  }

  const { data: created, error: insertError } = await supabase.from('time_reports').insert(inserts).select('id, booking_id');
  if (insertError) return NextResponse.json({ success: false, error: insertError.message }, { status: 400 });

  const createdIdByBooking = new Map((created ?? []).map((row) => [row.booking_id, row.id]));
  const reports = previewRows.map((row) => ({
    id: createdIdByBooking.get(row.bookingId) ?? row.bookingId,
    session_title: row.sessionTitle,
    category: row.category,
    hours: row.hours,
    rate: row.rate,
    pay: row.pay,
  }));

  const totalHours = reports.reduce((sum, row) => sum + row.hours, 0);
  const totalPay = reports.reduce((sum, row) => sum + row.pay, 0);

  return NextResponse.json({
    success: true,
    data: {
      created: reports.length,
      totalHours: Number(totalHours.toFixed(2)),
      totalPay: Number(totalPay.toFixed(2)),
      reports,
    },
  });
}
