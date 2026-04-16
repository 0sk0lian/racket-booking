/**
 * Availability endpoint — compact query that returns every free, bookable slot
 * for a club over a date window. Backed by the recurrence engine so blackouts
 * and existing bookings are honored in one place.
 *
 * GET /api/availability
 *   ?clubId=<uuid>            (required)
 *   &from=YYYY-MM-DD          (default: today)
 *   &to=YYYY-MM-DD            (default: from)
 *   &duration=<hours>         (default: 1)
 *   &courtId=<uuid>           (optional filter)
 *   &sport=padel|tennis|...   (optional filter)
 *
 * Response: { success, data: { slots: AvailabilitySlot[], count } }
 */
import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import { availability, toLocalDateStr } from '../services/recurrence-engine.js';

export const availabilityRoutes = Router();

availabilityRoutes.get('/', (req: Request, res: Response) => {
  const clubId = String(req.query.clubId ?? '');
  if (!clubId) {
    res.status(400).json({ success: false, error: 'clubId is required' });
    return;
  }
  if (!store.clubs.find(c => c.id === clubId)) {
    res.status(404).json({ success: false, error: 'Club not found' });
    return;
  }

  const today = toLocalDateStr(new Date());
  const from = String(req.query.from ?? today);
  const to = String(req.query.to ?? from);

  const duration = Math.max(1, Math.min(4, Number(req.query.duration ?? 1)));
  if (Number.isNaN(duration)) {
    res.status(400).json({ success: false, error: 'duration must be a number (hours)' });
    return;
  }

  let slots = availability(clubId, from, to, duration);

  // Optional filters applied after the core computation — cheap because
  // availability() already scoped to one club.
  const courtFilter = req.query.courtId ? String(req.query.courtId) : null;
  const sportFilter = req.query.sport ? String(req.query.sport) : null;
  if (courtFilter || sportFilter) {
    const courtsById = new Map(store.courts.map(c => [c.id, c]));
    slots = slots.filter(s => {
      if (courtFilter && s.court_id !== courtFilter) return false;
      if (sportFilter && courtsById.get(s.court_id)?.sport_type !== sportFilter) return false;
      return true;
    });
  }

  res.json({ success: true, data: { slots, count: slots.length } });
});
