/**
 * GET /api/availability?clubId=&from=&to=&duration=&courtId=&sport=
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const clubId = p.get('clubId');
  if (!clubId) return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });

  const today = new Date().toISOString().split('T')[0];
  const from = p.get('from') ?? today;
  const to = p.get('to') ?? from;
  const duration = Math.max(1, Math.min(4, Number(p.get('duration') ?? 1)));
  const courtFilter = p.get('courtId');
  const sportFilter = p.get('sport');

  const supabase = createSupabaseAdminClient();

  let courtQuery = supabase.from('courts').select('id, name, sport_type, base_hourly_rate').eq('club_id', clubId).eq('is_active', true);
  if (courtFilter) courtQuery = courtQuery.eq('id', courtFilter);
  if (sportFilter) courtQuery = courtQuery.eq('sport_type', sportFilter);
  const { data: courts } = await courtQuery;
  if (!courts?.length) return NextResponse.json({ success: true, data: { slots: [], count: 0 } });

  const courtIds = courts.map(c => c.id);
  const fromStart = `${from}T00:00:00`;
  const toEnd = `${to}T23:59:59`;

  const { data: bookings } = await supabase
    .from('bookings')
    .select('court_id, time_slot_start, time_slot_end')
    .in('court_id', courtIds)
    .neq('status', 'cancelled')
    .lt('time_slot_start', toEnd)
    .gt('time_slot_end', fromStart);

  const { data: blackouts } = await supabase
    .from('blackout_periods')
    .select('starts_at, ends_at, court_ids')
    .eq('club_id', clubId)
    .lt('starts_at', toEnd)
    .gt('ends_at', fromStart);

  const openHour = 7, closeHour = 22;
  const slots: any[] = [];
  const d = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T23:59:59');

  while (d <= end) {
    const dateStr = d.toISOString().split('T')[0];
    for (const court of courts) {
      for (let h = openHour; h + duration <= closeHour; h++) {
        const startIso = `${dateStr}T${String(h).padStart(2, '0')}:00:00`;
        const endIso = `${dateStr}T${String(h + duration).padStart(2, '0')}:00:00`;

        const startD = new Date(startIso);
        const endD = new Date(endIso);

        const isBlacked = (blackouts ?? []).some(bp => {
          if ((bp.court_ids ?? []).length > 0 && !(bp.court_ids ?? []).includes(court.id)) return false;
          return new Date(bp.starts_at) < endD && new Date(bp.ends_at) > startD;
        });
        if (isBlacked) continue;

        const isBooked = (bookings ?? []).some(b =>
          b.court_id === court.id &&
          new Date(b.time_slot_start) < endD &&
          new Date(b.time_slot_end) > startD,
        );
        if (isBooked) continue;

        slots.push({ court_id: court.id, start_iso: startIso, end_iso: endIso, start_hour: h, end_hour: h + duration, date: dateStr });
      }
    }
    d.setDate(d.getDate() + 1);
  }

  return NextResponse.json({ success: true, data: { slots, count: slots.length } });
}
