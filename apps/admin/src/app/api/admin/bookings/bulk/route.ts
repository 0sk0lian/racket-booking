/**
 * POST /api/admin/bookings/bulk — create bookings (all 4 types)
 * Handles regular, training, contract (via repeat), and event bookings.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const { slots, bookerId, bookingType, trainerId, playerIds, notes, eventName, eventMaxParticipants, repeatWeeks } = await request.json();
  if (!slots?.length) return NextResponse.json({ success: false, error: 'slots array required' }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const results: any[] = [];
  const errors: any[] = [];

  const weeksToCreate = bookingType === 'contract' ? Math.max(1, repeatWeeks || 4) : 1;
  const contractId = bookingType === 'contract' ? crypto.randomUUID() : null;

  for (let week = 0; week < weeksToCreate; week++) {
    for (const slot of slots) {
      // Fetch court for pricing
      const { data: court } = await supabase.from('courts').select('base_hourly_rate, club_id').eq('id', slot.courtId).single();
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

      // Generate a tsrange value for Postgres
      const timeSlot = `[${startTime},${endTime})`;

      const { data: booking, error } = await supabase.from('bookings').insert({
        court_id: slot.courtId,
        booker_id: bookerId || null,
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
      }
    }
  }

  return NextResponse.json({ success: true, data: { created: results.length, failed: errors.length, results, errors } });
}
