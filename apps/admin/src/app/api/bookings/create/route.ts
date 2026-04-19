/**
 * POST /api/bookings/create — player self-service booking
 *
 * Validates:
 * - court exists
 * - slot is in the future
 * - max_days_ahead respected
 * - slot is inside opening hours
 * - slot does not overlap blackout periods
 * - slot is not already booked
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../lib/supabase/server';
import { onBookingCreated } from '../../../../lib/cascades';

type OpeningHoursRow = { day?: number; open?: string; close?: string };

function parseHour(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const hour = Number(value.split(':')[0]);
  if (!Number.isFinite(hour)) return fallback;
  return Math.min(23, Math.max(0, hour));
}

function openingWindow(openingHours: OpeningHoursRow[] | null, day: number) {
  const defaults = { open: 7, close: 22 };
  const dayEntry = (openingHours ?? []).find((item) => item.day === day);
  if (!dayEntry) return defaults;

  const open = parseHour(dayEntry.open, defaults.open);
  const close = parseHour(dayEntry.close, defaults.close);
  if (close <= open) return defaults;

  return { open, close };
}

export async function POST(request: NextRequest) {
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const { courtId, startTime, endTime } = await request.json();
  if (!courtId || !startTime || !endTime) {
    return NextResponse.json({ success: false, error: 'courtId, startTime, endTime required' }, { status: 400 });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ success: false, error: 'Invalid startTime/endTime' }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ success: false, error: 'endTime must be after startTime' }, { status: 400 });
  }
  if (start.toDateString() !== end.toDateString()) {
    return NextResponse.json({ success: false, error: 'Bookings must start and end on the same day' }, { status: 400 });
  }

  const durationHours = (end.getTime() - start.getTime()) / 3_600_000;
  if (durationHours <= 0 || durationHours > 4) {
    return NextResponse.json({ success: false, error: 'Duration must be 1-4 hours' }, { status: 400 });
  }

  if (start < new Date()) {
    return NextResponse.json({ success: false, error: 'Cannot book in the past' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: court } = await supabase.from('courts').select('id, club_id, base_hourly_rate, is_active').eq('id', courtId).single();
  if (!court || !court.is_active) {
    return NextResponse.json({ success: false, error: 'Court not found' }, { status: 404 });
  }

  const { data: venue } = await supabase
    .from('venue_profiles')
    .select('booking_rules, opening_hours')
    .eq('club_id', court.club_id)
    .maybeSingle();

  if (venue?.booking_rules?.max_days_ahead) {
    const maxDate = new Date();
    maxDate.setHours(23, 59, 59, 999);
    maxDate.setDate(maxDate.getDate() + venue.booking_rules.max_days_ahead);
    if (start > maxDate) {
      return NextResponse.json({
        success: false,
        error: `Cannot book more than ${venue.booking_rules.max_days_ahead} days ahead`,
      }, { status: 400 });
    }
  }

  const { open, close } = openingWindow((venue?.opening_hours ?? null) as OpeningHoursRow[] | null, start.getDay());
  const startHour = start.getHours();
  const endHour = end.getHours();
  const startsOnFullHour = start.getMinutes() === 0 && start.getSeconds() === 0;
  const endsOnFullHour = end.getMinutes() === 0 && end.getSeconds() === 0;
  if (!startsOnFullHour || !endsOnFullHour || startHour < open || endHour > close) {
    return NextResponse.json({
      success: false,
      error: `Selected time is outside opening hours (${String(open).padStart(2, '0')}:00-${String(close).padStart(2, '0')}:00)`,
    }, { status: 400 });
  }

  const startDb = String(startTime);
  const endDb = String(endTime);

  const { data: overlappingBlackouts } = await supabase
    .from('blackout_periods')
    .select('id, court_ids, starts_at, ends_at')
    .eq('club_id', court.club_id)
    .lt('starts_at', endDb)
    .gt('ends_at', startDb);

  const blockedByBlackout = (overlappingBlackouts ?? []).some((blackout) => {
    const scopedToCourts = (blackout.court_ids ?? []) as string[];
    if (scopedToCourts.length > 0 && !scopedToCourts.includes(courtId)) return false;
    return new Date(blackout.starts_at) < end && new Date(blackout.ends_at) > start;
  });
  if (blockedByBlackout) {
    return NextResponse.json({ success: false, error: 'Selected slot is unavailable due to a blackout period' }, { status: 409 });
  }

  const { data: conflicting } = await supabase
    .from('bookings')
    .select('id')
    .eq('court_id', courtId)
    .neq('status', 'cancelled')
    .lt('time_slot_start', endDb)
    .gt('time_slot_end', startDb)
    .limit(1);
  if ((conflicting ?? []).length > 0) {
    return NextResponse.json({ success: false, error: 'This time slot is already booked' }, { status: 409 });
  }

  const totalPrice = court.base_hourly_rate * durationHours * 1.05;

  const { data: booking, error } = await supabase.from('bookings').insert({
    court_id: courtId,
    booker_id: user.id,
    time_slot_start: startDb,
    time_slot_end: endDb,
    status: 'confirmed',
    total_price: totalPrice,
    court_rental_vat_rate: 0.06,
    platform_fee: court.base_hourly_rate * durationHours * 0.05,
    access_pin: String(Math.floor(100000 + Math.random() * 900000)),
    booking_type: 'regular',
  }).select().single();

  if (error) {
    if (error.code === '23P01') {
      return NextResponse.json({ success: false, error: 'This time slot is already booked' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  // Cascade: create attendance row for the booker
  await onBookingCreated({
    id: booking.id,
    court_id: booking.court_id,
    player_ids: booking.player_ids ?? [],
    trainer_id: booking.trainer_id ?? null,
    booker_id: booking.booker_id,
    booking_type: booking.booking_type,
  });

  return NextResponse.json({ success: true, data: booking }, { status: 201 });
}
