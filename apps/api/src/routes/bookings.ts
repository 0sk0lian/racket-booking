import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import { authenticate } from '../middleware/auth.js';
import { generateSecurePin, calculateVatBreakdown } from '../utils/hardware.js';

export const bookingRoutes = Router();

bookingRoutes.get('/', (req: Request, res: Response) => {
  let bookings = [...store.bookings];
  if (req.query.courtId) bookings = bookings.filter(b => b.court_id === req.query.courtId);
  if (req.query.status) bookings = bookings.filter(b => b.status === req.query.status);
  if (req.query.date) {
    const dayStart = new Date(req.query.date as string);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    bookings = bookings.filter(b => new Date(b.time_slot_start) < dayEnd && new Date(b.time_slot_end) > dayStart);
  }

  // Enrich with names
  const enriched = bookings.map(b => {
    const court = store.courts.find(c => c.id === b.court_id);
    const club = court ? store.clubs.find(cl => cl.id === court.club_id) : null;
    const user = store.users.find(u => u.id === b.booker_id);
    return { ...b, court_name: court?.name, club_name: club?.name, booker_name: user?.full_name };
  }).sort((a, b) => new Date(b.time_slot_start).getTime() - new Date(a.time_slot_start).getTime());

  res.json({ success: true, data: enriched });
});

bookingRoutes.get('/my', authenticate, (req: Request, res: Response) => {
  const bookings = store.bookings
    .filter(b => b.booker_id === req.user!.userId && b.status !== 'cancelled')
    .map(b => {
      const court = store.courts.find(c => c.id === b.court_id);
      const club = court ? store.clubs.find(cl => cl.id === court.club_id) : null;
      return { ...b, court_name: court?.name, club_name: club?.name };
    })
    .sort((a, b) => new Date(b.time_slot_start).getTime() - new Date(a.time_slot_start).getTime());
  res.json({ success: true, data: bookings });
});

bookingRoutes.post('/', authenticate, (req: Request, res: Response) => {
  const { courtId, startTime, endTime, isSplitPayment, splitParticipants } = req.body;
  const userId = req.user!.userId;

  const court = store.courts.find(c => c.id === courtId && c.is_active);
  if (!court) { res.status(404).json({ success: false, error: 'Court not found' }); return; }

  const club = store.clubs.find(cl => cl.id === court.club_id);
  const durationHours = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 3_600_000;
  if (durationHours <= 0 || durationHours > 4) {
    res.status(400).json({ success: false, error: 'Duration must be 0-4 hours' }); return;
  }

  const courtRental = court.base_hourly_rate * durationHours;
  const platformFee = courtRental * 0.05;
  const totalPrice = courtRental + platformFee;
  const vat = calculateVatBreakdown(courtRental, platformFee, club?.is_non_profit ?? false);

  try {
    const booking = store.createBooking({
      court_id: courtId, booker_id: userId,
      time_slot_start: startTime, time_slot_end: endTime,
      status: 'confirmed', total_price: totalPrice,
      court_rental_vat_rate: vat.courtRentalVatRate,
      platform_fee: platformFee, access_pin: generateSecurePin(),
      is_split_payment: isSplitPayment ?? false,
    });

    if (isSplitPayment && splitParticipants?.length) {
      const splitAmount = totalPrice / (splitParticipants.length + 1);
      for (const pid of [userId, ...splitParticipants]) {
        store.createSplitPayment({ booking_id: booking.id, user_id: pid, amount_due: splitAmount });
      }
    }

    res.status(201).json({ success: true, data: { booking, vat } });
  } catch (err: any) {
    if (err.code === '23P01') {
      res.status(409).json({ success: false, error: 'Time slot no longer available' }); return;
    }
    throw err;
  }
});

bookingRoutes.patch('/:id/cancel', authenticate, (req: Request, res: Response) => {
  const booking = store.bookings.find(b => b.id === req.params.id && b.status !== 'cancelled');
  if (!booking) { res.status(404).json({ success: false, error: 'Booking not found' }); return; }
  booking.status = 'cancelled';
  booking.cancellation_reason = req.body.reason ?? null;
  booking.updated_at = new Date().toISOString();
  res.json({ success: true, data: booking });
});

bookingRoutes.patch('/:id/confirm', authenticate, (req: Request, res: Response) => {
  const booking = store.bookings.find(b => b.id === req.params.id && b.status === 'pending');
  if (!booking) { res.status(404).json({ success: false, error: 'Booking not found' }); return; }
  booking.status = 'confirmed';
  booking.updated_at = new Date().toISOString();
  res.json({ success: true, data: booking });
});
