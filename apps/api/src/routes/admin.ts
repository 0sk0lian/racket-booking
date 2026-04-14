import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import { generateSecurePin } from '../utils/hardware.js';

export const adminRoutes = Router();

// Helper: enrich a booking row with names
function enrichBooking(b: any) {
  const court = store.courts.find(c => c.id === b.court_id);
  const club = court ? store.clubs.find(cl => cl.id === court.club_id) : null;
  const user = store.users.find(u => u.id === b.booker_id);
  const trainer = b.trainer_id ? store.trainers.find(t => t.id === b.trainer_id) : null;
  const players = (b.player_ids || []).map((id: string) => { const u = store.users.find(u => u.id === id); return u ? { id: u.id, full_name: u.full_name } : { id, full_name: 'Unknown' }; });
  const attendees = (b.event_attendee_ids || []).map((id: string) => { const u = store.users.find(u => u.id === id); return u ? { id: u.id, full_name: u.full_name, email: u.email } : { id, full_name: 'Unknown' }; });
  return {
    ...b, court_name: court?.name, club_name: club?.name, sport_type: court?.sport_type,
    booker_name: user?.full_name ?? (b.booker_id === 'admin' ? 'Admin' : 'Unknown'),
    trainer_name: trainer?.full_name ?? null, trainer_rate: trainer?.hourly_rate ?? null,
    players, attendees,
  };
}

// GET /api/admin/schedule?clubId=...&date=YYYY-MM-DD
adminRoutes.get('/schedule', (req: Request, res: Response) => {
  const { clubId, date } = req.query;
  if (!clubId || !date) { res.status(400).json({ success: false, error: 'clubId and date required' }); return; }

  const dayStr = date as string;
  const dayStart = new Date(dayStr + 'T00:00:00');
  const dayEnd = new Date(dayStr + 'T23:59:59');

  const courts = store.courts.filter(c => c.club_id === clubId && c.is_active).sort((a, b) => a.name.localeCompare(b.name));

  const schedule = courts.map(court => {
    const bookings = store.bookings
      .filter(b => b.court_id === court.id && b.status !== 'cancelled' && new Date(b.time_slot_start) <= dayEnd && new Date(b.time_slot_end) > dayStart)
      .map(b => {
        const user = store.users.find(u => u.id === b.booker_id);
        const trainer = b.trainer_id ? store.trainers.find(t => t.id === b.trainer_id) : null;
        const playerNames = (b.player_ids || []).map(id => store.users.find(u => u.id === id)?.full_name ?? '?');
        const attendeeCount = (b.event_attendee_ids || []).length;
        return {
          id: b.id, startHour: new Date(b.time_slot_start).getHours(), endHour: new Date(b.time_slot_end).getHours(),
          status: b.status, bookingType: b.booking_type,
          bookerName: user?.full_name ?? (b.booker_id === 'admin' ? 'Admin' : 'Unknown'), bookerId: b.booker_id,
          totalPrice: b.total_price, accessPin: b.access_pin,
          trainerId: b.trainer_id, trainerName: trainer?.full_name ?? null,
          playerIds: b.player_ids, playerNames,
          contractId: b.contract_id, recurrenceDay: b.recurrence_day,
          eventName: b.event_name, eventMaxParticipants: b.event_max_participants,
          attendeeCount, eventAttendeeIds: b.event_attendee_ids,
          notes: b.notes, isSplitPayment: b.is_split_payment,
        };
      });
    return { courtId: court.id, courtName: court.name, sportType: court.sport_type, baseRate: court.base_hourly_rate, bookings };
  });

  res.json({ success: true, data: { date: dayStr, courts: schedule } });
});

// GET /api/admin/trainers?clubId=...
adminRoutes.get('/trainers', (req: Request, res: Response) => {
  let trainers = store.trainers.filter(t => t.is_active);
  if (req.query.clubId) trainers = trainers.filter(t => t.club_id === req.query.clubId);
  res.json({ success: true, data: trainers });
});

// POST /api/admin/trainers
adminRoutes.post('/trainers', (req: Request, res: Response) => {
  const { clubId, fullName, email, phoneNumber, sportTypes, hourlyRate, bio } = req.body;
  if (!clubId || !fullName) { res.status(400).json({ success: false, error: 'clubId and fullName required' }); return; }
  const trainer = store.createTrainer({ club_id: clubId, full_name: fullName, email, phone_number: phoneNumber, sport_types: sportTypes, hourly_rate: hourlyRate, bio });
  res.status(201).json({ success: true, data: trainer });
});

// GET /api/admin/bookings/:id
adminRoutes.get('/bookings/:id', (req: Request, res: Response) => {
  const b = store.bookings.find(b => b.id === req.params.id);
  if (!b) { res.status(404).json({ success: false, error: 'Booking not found' }); return; }
  res.json({ success: true, data: enrichBooking(b) });
});

// PATCH /api/admin/bookings/:id — edit any booking property
adminRoutes.patch('/bookings/:id', (req: Request, res: Response) => {
  const b = store.bookings.find(b => b.id === req.params.id);
  if (!b) { res.status(404).json({ success: false, error: 'Booking not found' }); return; }

  if (req.body.status !== undefined) b.status = req.body.status;
  if (req.body.bookingType !== undefined) b.booking_type = req.body.bookingType;
  if (req.body.trainerId !== undefined) b.trainer_id = req.body.trainerId || null;
  if (req.body.playerIds !== undefined) b.player_ids = req.body.playerIds;
  if (req.body.bookerId !== undefined) b.booker_id = req.body.bookerId;
  if (req.body.notes !== undefined) b.notes = req.body.notes || null;
  if (req.body.totalPrice !== undefined) b.total_price = req.body.totalPrice;
  if (req.body.accessPin !== undefined) b.access_pin = req.body.accessPin;
  if (req.body.eventName !== undefined) b.event_name = req.body.eventName || null;
  if (req.body.eventMaxParticipants !== undefined) b.event_max_participants = req.body.eventMaxParticipants;
  if (req.body.eventAttendeeIds !== undefined) b.event_attendee_ids = req.body.eventAttendeeIds;
  if (req.body.contractId !== undefined) b.contract_id = req.body.contractId;
  if (req.body.recurrenceDay !== undefined) b.recurrence_day = req.body.recurrenceDay;
  b.updated_at = new Date().toISOString();

  res.json({ success: true, data: enrichBooking(b) });
});

// POST /api/admin/bookings/:id/attend — player signs up for an event
adminRoutes.post('/bookings/:id/attend', (req: Request, res: Response) => {
  const b = store.bookings.find(b => b.id === req.params.id);
  if (!b || b.booking_type !== 'event') { res.status(404).json({ success: false, error: 'Event not found' }); return; }
  const { userId } = req.body;
  if (!userId) { res.status(400).json({ success: false, error: 'userId required' }); return; }
  if (b.event_attendee_ids.includes(userId)) { res.status(409).json({ success: false, error: 'Already signed up' }); return; }
  if (b.event_max_participants && b.event_attendee_ids.length >= b.event_max_participants) { res.status(409).json({ success: false, error: 'Event is full' }); return; }
  b.event_attendee_ids.push(userId);
  b.updated_at = new Date().toISOString();
  res.json({ success: true, data: enrichBooking(b) });
});

// POST /api/admin/bookings/:id/unattend — player leaves an event
adminRoutes.post('/bookings/:id/unattend', (req: Request, res: Response) => {
  const b = store.bookings.find(b => b.id === req.params.id);
  if (!b || b.booking_type !== 'event') { res.status(404).json({ success: false, error: 'Event not found' }); return; }
  const { userId } = req.body;
  b.event_attendee_ids = b.event_attendee_ids.filter(id => id !== userId);
  b.updated_at = new Date().toISOString();
  res.json({ success: true, data: enrichBooking(b) });
});

// DELETE /api/admin/bookings/:id
adminRoutes.delete('/bookings/:id', (req: Request, res: Response) => {
  const booking = store.bookings.find(b => b.id === req.params.id);
  if (!booking) { res.status(404).json({ success: false, error: 'Booking not found' }); return; }
  booking.status = 'cancelled';
  booking.cancellation_reason = 'Cancelled by admin';
  booking.updated_at = new Date().toISOString();
  res.json({ success: true, data: booking });
});

// POST /api/admin/bookings/bulk — create bookings (handles all 4 types)
adminRoutes.post('/bookings/bulk', (req: Request, res: Response) => {
  const { slots, bookerId, bookingType, trainerId, playerIds, notes, eventName, eventMaxParticipants, repeatWeeks } = req.body;
  if (!slots?.length) { res.status(400).json({ success: false, error: 'slots array required' }); return; }

  const results: any[] = [];
  const errors: any[] = [];
  const contractId = bookingType === 'contract' ? crypto.randomUUID() : null;

  // For contracts: generate repeated weeks
  const weeksToCreate = bookingType === 'contract' ? Math.max(1, repeatWeeks || 4) : 1;

  for (let week = 0; week < weeksToCreate; week++) {
    for (const slot of slots) {
      const court = store.courts.find(c => c.id === slot.courtId && c.is_active);
      if (!court) { errors.push({ ...slot, error: 'Court not found' }); continue; }

      // Offset the dates by week number
      let startTime = slot.startTime;
      let endTime = slot.endTime;
      if (week > 0) {
        const s = new Date(slot.startTime); s.setDate(s.getDate() + week * 7); startTime = s.toISOString();
        const e = new Date(slot.endTime); e.setDate(e.getDate() + week * 7); endTime = e.toISOString();
      }

      const durationHours = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 3_600_000;
      let totalPrice = court.base_hourly_rate * durationHours * 1.05;
      if (bookingType === 'training' && trainerId) {
        const trainer = store.trainers.find(t => t.id === trainerId);
        if (trainer) totalPrice += trainer.hourly_rate * durationHours;
      }
      if (bookingType === 'event') totalPrice = 0;

      try {
        const booking = store.createBooking({
          court_id: slot.courtId, booker_id: bookerId || 'admin',
          time_slot_start: startTime, time_slot_end: endTime,
          status: 'confirmed', total_price: totalPrice, access_pin: generateSecurePin(),
          booking_type: bookingType || 'regular',
          trainer_id: trainerId || null, player_ids: playerIds || [],
          contract_id: contractId, recurrence_day: bookingType === 'contract' ? new Date(startTime).getDay() : null,
          event_name: eventName || null, event_max_participants: eventMaxParticipants || null,
          event_attendee_ids: [], notes: notes || null,
        });
        results.push(booking);
      } catch (err: any) {
        errors.push({ ...slot, week, error: err.code === '23P01' ? 'Slot already booked' : err.message });
      }
    }
  }

  res.json({ success: true, data: { created: results.length, failed: errors.length, results, errors } });
});

// ─── Court & Club admin (unchanged) ──────────────────

adminRoutes.patch('/courts/:id', (req: Request, res: Response) => {
  const court = store.courts.find(c => c.id === req.params.id);
  if (!court) { res.status(404).json({ success: false, error: 'Court not found' }); return; }
  if (req.body.name !== undefined) court.name = req.body.name;
  if (req.body.baseHourlyRate !== undefined) court.base_hourly_rate = req.body.baseHourlyRate;
  if (req.body.isIndoor !== undefined) court.is_indoor = req.body.isIndoor;
  if (req.body.isActive !== undefined) court.is_active = req.body.isActive;
  if (req.body.sportType !== undefined) court.sport_type = req.body.sportType;
  court.updated_at = new Date().toISOString();
  res.json({ success: true, data: court });
});

adminRoutes.post('/courts', (req: Request, res: Response) => {
  const { clubId, name, sportType, isIndoor, baseHourlyRate, hardwareRelayId } = req.body;
  if (!clubId || !name || !sportType || baseHourlyRate == null) { res.status(400).json({ success: false, error: 'Missing required fields' }); return; }
  const court = store.createCourt({ club_id: clubId, name, sport_type: sportType, is_indoor: isIndoor ?? true, base_hourly_rate: baseHourlyRate, hardware_relay_id: hardwareRelayId ?? null });
  res.status(201).json({ success: true, data: court });
});

adminRoutes.patch('/clubs/:id', (req: Request, res: Response) => {
  const club = store.clubs.find(c => c.id === req.params.id);
  if (!club) { res.status(404).json({ success: false, error: 'Club not found' }); return; }
  if (req.body.name !== undefined) club.name = req.body.name;
  if (req.body.isNonProfit !== undefined) club.is_non_profit = req.body.isNonProfit;
  if (req.body.contactEmail !== undefined) club.contact_email = req.body.contactEmail;
  if (req.body.contactPhone !== undefined) club.contact_phone = req.body.contactPhone;
  if (req.body.address !== undefined) club.address = req.body.address;
  if (req.body.city !== undefined) club.city = req.body.city;
  if (req.body.stripeAccountId !== undefined) club.stripe_account_id = req.body.stripeAccountId;
  club.updated_at = new Date().toISOString();
  res.json({ success: true, data: club });
});

import crypto from 'crypto';
