/**
 * GET   /api/bookings/:id        — single booking detail
 * PATCH /api/bookings/:id/cancel — player-initiated cancellation
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
  if (error || !data) return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });

  // Enrich
  const { data: court } = await supabase.from('courts').select('name, sport_type, club_id').eq('id', data.court_id).single();
  const { data: club } = court ? await supabase.from('clubs').select('name').eq('id', court.club_id).single() : { data: null };

  return NextResponse.json({
    success: true,
    data: { ...data, court_name: court?.name, sport_type: court?.sport_type, club_name: club?.name },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', id).single();
  if (!booking) return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });

  // Only the booker or an admin can cancel
  if (booking.booker_id !== user.id) {
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }
  }

  // Check cancellation window
  const { data: court } = await supabase.from('courts').select('club_id').eq('id', booking.court_id).single();
  if (court) {
    const { data: venue } = await supabase
      .from('venue_profiles')
      .select('cancellation_hours')
      .eq('club_id', court.club_id)
      .maybeSingle();

    const cancellationHours = venue?.cancellation_hours ?? 24;
    const bookingStart = new Date(booking.time_slot_start);
    const hoursUntil = (bookingStart.getTime() - Date.now()) / 3600000;

    if (hoursUntil < cancellationHours) {
      return NextResponse.json({
        success: false,
        error: `Cannot cancel within ${cancellationHours} hours of the booking`,
      }, { status: 400 });
    }
  }

  const { error } = await supabase.from('bookings').update({
    status: 'cancelled',
    cancellation_reason: 'Cancelled by player',
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
