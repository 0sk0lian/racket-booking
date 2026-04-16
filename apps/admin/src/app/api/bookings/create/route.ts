/**
 * POST /api/bookings/create — player self-service booking
 *
 * Validates: court exists, slot is free, max_days_ahead respected.
 * Creates a 'confirmed' booking (payment integration in Phase G).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../lib/supabase/server';

export async function POST(request: NextRequest) {
  // Get the authenticated user
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const { courtId, startTime, endTime } = await request.json();
  if (!courtId || !startTime || !endTime) {
    return NextResponse.json({ success: false, error: 'courtId, startTime, endTime required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Validate court exists
  const { data: court } = await supabase.from('courts').select('id, club_id, base_hourly_rate, is_active').eq('id', courtId).single();
  if (!court || !court.is_active) {
    return NextResponse.json({ success: false, error: 'Court not found' }, { status: 404 });
  }

  // Validate max_days_ahead
  const { data: venue } = await supabase.from('venue_profiles').select('booking_rules').eq('club_id', court.club_id).single();
  if (venue?.booking_rules?.max_days_ahead) {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + venue.booking_rules.max_days_ahead);
    if (new Date(startTime) > maxDate) {
      return NextResponse.json({ success: false, error: `Cannot book more than ${venue.booking_rules.max_days_ahead} days ahead` }, { status: 400 });
    }
  }

  // Validate time is in the future
  if (new Date(startTime) < new Date()) {
    return NextResponse.json({ success: false, error: 'Cannot book in the past' }, { status: 400 });
  }

  // Calculate price
  const durationHours = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 3_600_000;
  if (durationHours <= 0 || durationHours > 4) {
    return NextResponse.json({ success: false, error: 'Duration must be 1-4 hours' }, { status: 400 });
  }
  const totalPrice = court.base_hourly_rate * durationHours * 1.05; // 5% platform fee included

  // Create booking
  const { data: booking, error } = await supabase.from('bookings').insert({
    court_id: courtId,
    booker_id: user.id,
    time_slot_start: startTime,
    time_slot_end: endTime,
    status: 'confirmed', // In Phase G: 'pending' until payment succeeds
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

  return NextResponse.json({ success: true, data: booking }, { status: 201 });
}
