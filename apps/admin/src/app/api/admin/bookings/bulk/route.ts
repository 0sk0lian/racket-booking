/**
 * POST /api/admin/bookings/bulk — create bookings (all 4 types)
 * Handles regular, training, contract (via repeat), and event bookings.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';
import { onBookingCreated } from '../../../../../lib/cascades';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { slots, bookerId, bookingType, trainerId, playerIds, notes, eventName, eventMaxParticipants, repeatWeeks, totalPrice } = await request.json();
  if (!slots?.length) return NextResponse.json({ success: false, error: 'slots array required' }, { status: 400 });
  const requestedTotalPrice = typeof totalPrice === 'number' && Number.isFinite(totalPrice) ? totalPrice : null;
  if (requestedTotalPrice !== null && requestedTotalPrice < 0) {
    return NextResponse.json({ success: false, error: 'totalPrice must be >= 0' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const results: any[] = [];
  const errors: any[] = [];

  const uniqueCourtIds = [...new Set((slots ?? []).map((slot: any) => slot.courtId).filter(Boolean))];
  const { data: courts } = uniqueCourtIds.length > 0
    ? await supabase.from('courts').select('id, base_hourly_rate, club_id').in('id', uniqueCourtIds)
    : { data: [] };
  const courtMap = new Map((courts ?? []).map((court) => [court.id, court]));

  for (const courtId of uniqueCourtIds) {
    const court = courtMap.get(courtId);
    if (!court) return NextResponse.json({ success: false, error: `Court not found: ${courtId}` }, { status: 404 });
    const access = await requireClubAccess(court.club_id);
    if (!access.ok) return access.response;
  }

  const weeksToCreate = bookingType === 'contract'
    ? Math.max(1, repeatWeeks || 4)
    : bookingType === 'training'
      ? Math.max(1, repeatWeeks || 1)
      : 1;
  const contractId = bookingType === 'contract' ? crypto.randomUUID() : null;

  for (let week = 0; week < weeksToCreate; week++) {
    for (const slot of slots) {
      const court = courtMap.get(slot.courtId);
      if (!court) { errors.push({ ...slot, error: 'Court not found' }); continue; }

      let startTime = slot.startTime;
      let endTime = slot.endTime;
      if (week > 0) {
        const s = new Date(slot.startTime); s.setDate(s.getDate() + week * 7); startTime = s.toISOString();
        const e = new Date(slot.endTime); e.setDate(e.getDate() + week * 7); endTime = e.toISOString();
      }

      const durationHours = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 3_600_000;
      let totalPrice = court.base_hourly_rate * durationHours * 1.05;
      if (bookingType === 'training' && trainerId) {
        const { data: trainer } = await supabase.from('users').select('trainer_hourly_rate').eq('id', trainerId).single();
        if (trainer?.trainer_hourly_rate) totalPrice += trainer.trainer_hourly_rate * durationHours;
      }
      if (bookingType === 'event') totalPrice = 0;
      if (requestedTotalPrice !== null) totalPrice = requestedTotalPrice;

      const timeSlot = `[${startTime},${endTime})`;

      const { data: booking, error } = await supabase.from('bookings').insert({
        court_id: slot.courtId,
        booker_id: bookerId || admin.user.id,
        time_slot: timeSlot,
        time_slot_start: startTime,
        time_slot_end: endTime,
        status: 'confirmed',
        total_price: totalPrice,
        access_pin: String(Math.floor(100000 + Math.random() * 900000)),
        booking_type: bookingType || 'regular',
        trainer_id: trainerId || null,
        player_ids: playerIds || [],
        contract_id: contractId,
        recurrence_day: bookingType === 'contract' ? new Date(startTime).getDay() : null,
        event_name: eventName || null,
        event_max_participants: eventMaxParticipants || null,
        event_attendee_ids: [],
        notes: notes || null,
      }).select().single();

      if (error) {
        errors.push({ ...slot, week, error: error.code === '23P01' ? 'Slot already booked' : error.message });
      } else {
        results.push(booking);
        // Cascade: create attendance rows for players/trainer
        await onBookingCreated({
          id: booking.id,
          court_id: booking.court_id,
          player_ids: booking.player_ids,
          trainer_id: booking.trainer_id,
          booker_id: booking.booker_id,
          booking_type: booking.booking_type,
        });
      }
    }
  }

  return NextResponse.json({ success: true, data: { created: results.length, failed: errors.length, results, errors } });
}
