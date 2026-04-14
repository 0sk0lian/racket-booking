import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import { authenticate } from '../middleware/auth.js';

export const courtRoutes = Router();

courtRoutes.get('/', (req: Request, res: Response) => {
  let courts = store.courts.filter(c => c.is_active);
  if (req.query.clubId) courts = courts.filter(c => c.club_id === req.query.clubId);
  if (req.query.sportType) courts = courts.filter(c => c.sport_type === req.query.sportType);

  // Enrich with club name
  const enriched = courts.map(c => {
    const club = store.clubs.find(cl => cl.id === c.club_id);
    return { ...c, club_name: club?.name ?? 'Unknown' };
  });
  res.json({ success: true, data: enriched.sort((a, b) => a.name.localeCompare(b.name)) });
});

courtRoutes.get('/:id', (req: Request, res: Response) => {
  const court = store.courts.find(c => c.id === req.params.id);
  if (!court) { res.status(404).json({ success: false, error: 'Court not found' }); return; }
  const club = store.clubs.find(cl => cl.id === court.club_id);
  res.json({ success: true, data: { ...court, club_name: club?.name } });
});

courtRoutes.get('/:id/availability', (req: Request, res: Response) => {
  const { date } = req.query;
  if (!date) { res.status(400).json({ success: false, error: 'date query parameter required' }); return; }

  const dayStart = new Date(date as string);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);

  const bookings = store.bookings.filter(b =>
    b.court_id === req.params.id && b.status !== 'cancelled' &&
    new Date(b.time_slot_start) < dayEnd && new Date(b.time_slot_end) > dayStart
  ).map(b => ({
    id: b.id, start_time: b.time_slot_start, end_time: b.time_slot_end,
    status: b.status, booker: store.users.find(u => u.id === b.booker_id)?.full_name,
  })).sort((a, b) => a.start_time.localeCompare(b.start_time));

  res.json({ success: true, data: bookings });
});

courtRoutes.post('/', authenticate, (req: Request, res: Response) => {
  const { clubId, name, sportType, isIndoor, baseHourlyRate, hardwareRelayId } = req.body;
  const court = store.createCourt({
    club_id: clubId, name, sport_type: sportType,
    is_indoor: isIndoor ?? true, base_hourly_rate: baseHourlyRate,
    hardware_relay_id: hardwareRelayId ?? null,
  });
  res.status(201).json({ success: true, data: court });
});
