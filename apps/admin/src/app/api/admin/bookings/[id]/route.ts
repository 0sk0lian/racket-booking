/**
 * PATCH  /api/admin/bookings/:id — update booking
 * DELETE /api/admin/bookings/:id — cancel booking (soft-delete)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../../lib/auth/guards';
import { onBookingCancelled } from '../../../../../lib/cascades';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createSupabaseAdminClient();

  const { data: booking } = await supabase.from('bookings').select('id, court_id').eq('id', id).single();
  if (!booking) return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });

  const { data: court } = await supabase.from('courts').select('club_id').eq('id', booking.court_id).single();
  if (!court?.club_id) return NextResponse.json({ success: false, error: 'Court not found for booking' }, { status: 404 });
  const access = await requireClubAccess(court.club_id);
  if (!access.ok) return access.response;

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.bookingType !== undefined) updates.booking_type = body.bookingType;
  if (body.bookerId !== undefined) updates.booker_id = body.bookerId;
  if (body.trainerId !== undefined) updates.trainer_id = body.trainerId;
  if (body.playerIds !== undefined) updates.player_ids = body.playerIds;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.eventName !== undefined) updates.event_name = body.eventName;
  if (body.eventMaxParticipants !== undefined) updates.event_max_participants = body.eventMaxParticipants;
  if (body.eventAttendeeIds !== undefined) updates.event_attendee_ids = body.eventAttendeeIds;
  if (body.totalPrice !== undefined) {
    const totalPrice = Number(body.totalPrice);
    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      return NextResponse.json({ success: false, error: 'Invalid totalPrice' }, { status: 400 });
    }
    updates.total_price = totalPrice;
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: booking } = await supabase.from('bookings').select('id, court_id').eq('id', id).single();
  if (!booking) return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });

  const { data: court } = await supabase.from('courts').select('club_id').eq('id', booking.court_id).single();
  if (!court?.club_id) return NextResponse.json({ success: false, error: 'Court not found for booking' }, { status: 404 });
  const access = await requireClubAccess(court.club_id);
  if (!access.ok) return access.response;

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  // Cascade: cancel all attendance rows for this booking
  await onBookingCancelled(id);

  return NextResponse.json({ success: true });
}
