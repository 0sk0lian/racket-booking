/**
 * POST /api/matches/create — create a public match from an existing booking
 * Body: { bookingId, minLevel, maxLevel, spotsTotal, visibility: 'club'|'area'|'public', city? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../lib/supabase/server';

export async function POST(request: NextRequest) {
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

  const body = await request.json();
  const { bookingId, minLevel, maxLevel, spotsTotal, visibility, city } = body;

  if (!bookingId || !spotsTotal) {
    return NextResponse.json({ success: false, error: 'bookingId and spotsTotal required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Verify booking exists and belongs to user
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
  if (booking.booker_id !== user.id) return NextResponse.json({ success: false, error: 'Not your booking' }, { status: 403 });

  // Get court + club info
  const { data: court } = await supabase.from('courts').select('id, name, sport_type, club_id').eq('id', booking.court_id).single();
  const { data: club } = court ? await supabase.from('clubs').select('city').eq('id', court.club_id).single() : { data: null };

  const { data, error } = await supabase.from('public_matches').insert({
    booking_id: bookingId,
    host_id: user.id,
    club_id: court?.club_id,
    sport_type: court?.sport_type ?? 'padel',
    court_name: court?.name,
    date: booking.time_slot_start?.split('T')[0],
    start_hour: new Date(booking.time_slot_start).getHours(),
    end_hour: new Date(booking.time_slot_end).getHours(),
    min_level: minLevel ?? 1,
    max_level: maxLevel ?? 10,
    spots_total: spotsTotal,
    spots_filled: 1, // host is already in
    player_ids: [user.id],
    status: 'open',
    visibility: visibility ?? 'club',
    city: city ?? club?.city ?? null,
  }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
