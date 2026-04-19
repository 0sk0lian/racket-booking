/**
 * GET /api/availability?clubId=&from=&to=&duration=&courtId=&sport=
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';

type OpeningHoursRow = { day?: number; open?: string; close?: string };

function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateParam(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseHour(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const hour = Number(value.split(':')[0]);
  if (!Number.isFinite(hour)) return fallback;
  return Math.min(23, Math.max(0, hour));
}

function openingWindow(openingHours: OpeningHoursRow[] | null, day: number) {
  const defaultWindow = { open: 7, close: 22 };
  const dayEntry = (openingHours ?? []).find((item) => item.day === day);
  if (!dayEntry) return defaultWindow;

  const open = parseHour(dayEntry.open, defaultWindow.open);
  const close = parseHour(dayEntry.close, defaultWindow.close);
  if (close <= open) return defaultWindow;

  return { open, close };
}

function dateHourIso(dateStr: string, hour: number) {
  return `${dateStr}T${String(hour).padStart(2, '0')}:00:00`;
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const clubId = p.get('clubId');
  if (!clubId) return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });

  const today = toDateStr(new Date());
  const from = p.get('from') ?? today;
  const to = p.get('to') ?? from;
  const duration = Math.max(1, Math.min(4, Number(p.get('duration') ?? 1)));
  const courtFilter = p.get('courtId');
  const sportFilter = p.get('sport');

  const fromDate = parseDateParam(from);
  const toDate = parseDateParam(to);
  if (!fromDate || !toDate) {
    return NextResponse.json({ success: false, error: 'Invalid from/to date format' }, { status: 400 });
  }
  if (fromDate > toDate) {
    return NextResponse.json({ success: false, error: 'from must be before or equal to to' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  let courtQuery = supabase.from('courts').select('id, name, sport_type, base_hourly_rate').eq('club_id', clubId).eq('is_active', true);
  if (courtFilter) courtQuery = courtQuery.eq('id', courtFilter);
  if (sportFilter) courtQuery = courtQuery.eq('sport_type', sportFilter);
  const { data: courts } = await courtQuery;
  if (!courts?.length) return NextResponse.json({ success: true, data: { slots: [], count: 0 } });

  const courtIds = courts.map((court) => court.id);
  const fromStart = `${from}T00:00:00`;
  const toEnd = `${to}T23:59:59`;

  const [{ data: bookings }, { data: blackouts }, { data: venueProfile }] = await Promise.all([
    supabase
      .from('bookings')
      .select('court_id, time_slot_start, time_slot_end')
      .in('court_id', courtIds)
      .neq('status', 'cancelled')
      .lt('time_slot_start', toEnd)
      .gt('time_slot_end', fromStart),
    supabase
      .from('blackout_periods')
      .select('starts_at, ends_at, court_ids')
      .eq('club_id', clubId)
      .lt('starts_at', toEnd)
      .gt('ends_at', fromStart),
    supabase.from('venue_profiles').select('opening_hours').eq('club_id', clubId).maybeSingle(),
  ]);

  const slots: Array<{
    court_id: string;
    start_iso: string;
    end_iso: string;
    start_hour: number;
    end_hour: number;
    date: string;
  }> = [];

  const cursor = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);

  while (cursor <= end) {
    const dateStr = toDateStr(cursor);
    const { open, close } = openingWindow((venueProfile?.opening_hours ?? null) as OpeningHoursRow[] | null, cursor.getDay());

    if (close - open >= duration) {
      for (const court of courts) {
        for (let hour = open; hour + duration <= close; hour++) {
          const startIso = dateHourIso(dateStr, hour);
          const endIso = dateHourIso(dateStr, hour + duration);
          const start = new Date(startIso);
          const finish = new Date(endIso);

          const blockedByBlackout = (blackouts ?? []).some((blackout) => {
            const scopedToCourts = (blackout.court_ids ?? []) as string[];
            if (scopedToCourts.length > 0 && !scopedToCourts.includes(court.id)) return false;
            return new Date(blackout.starts_at) < finish && new Date(blackout.ends_at) > start;
          });
          if (blockedByBlackout) continue;

          const blockedByBooking = (bookings ?? []).some((booking) => (
            booking.court_id === court.id &&
            new Date(booking.time_slot_start) < finish &&
            new Date(booking.time_slot_end) > start
          ));
          if (blockedByBooking) continue;

          slots.push({
            court_id: court.id,
            start_iso: startIso,
            end_iso: endIso,
            start_hour: hour,
            end_hour: hour + duration,
            date: dateStr,
          });
        }
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return NextResponse.json({ success: true, data: { slots, count: slots.length } });
}
