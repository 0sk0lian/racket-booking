/**
 * Blackout periods API.
 *
 * Endpoints:
 *   GET    /api/blackouts?clubId=               — list
 *   POST   /api/blackouts                        — create
 *   DELETE /api/blackouts/:id                    — remove
 *
 * The recurrence engine consults this table when expanding rules into bookings;
 * an active blackout on a given court+range causes the engine to return those
 * instances in the `blackouts` bucket of a preview/materialize result rather
 * than creating bookings.
 */
import { Router, Request, Response } from 'express';
import { store } from '../store.js';

export const blackoutRoutes = Router();

function enrich(bp: ReturnType<typeof store.createBlackoutPeriod>) {
  const courts = bp.court_ids.length
    ? bp.court_ids.map(id => store.courts.find(c => c.id === id)?.name ?? id)
    : ['All courts'];
  return { ...bp, court_names: courts };
}

blackoutRoutes.get('/', (req: Request, res: Response) => {
  const { clubId } = req.query;
  let list = [...store.blackoutPeriods];
  if (clubId) list = list.filter(bp => bp.club_id === clubId);
  list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  res.json({ success: true, data: list.map(enrich) });
});

blackoutRoutes.post('/', (req: Request, res: Response) => {
  const b = req.body ?? {};
  if (!b.clubId || !b.startsAt || !b.endsAt) {
    res.status(400).json({ success: false, error: 'clubId, startsAt, endsAt required' });
    return;
  }
  if (!store.clubs.find(c => c.id === b.clubId)) {
    res.status(404).json({ success: false, error: 'Club not found' });
    return;
  }
  try {
    const bp = store.createBlackoutPeriod({
      club_id: b.clubId,
      starts_at: b.startsAt,
      ends_at: b.endsAt,
      reason: b.reason ?? null,
      court_ids: Array.isArray(b.courtIds) ? b.courtIds : [],
      created_by: b.createdBy ?? null,
    });
    res.status(201).json({ success: true, data: enrich(bp) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

blackoutRoutes.delete('/:id', (req: Request, res: Response) => {
  const idx = store.blackoutPeriods.findIndex(x => x.id === req.params.id);
  if (idx < 0) { res.status(404).json({ success: false, error: 'Blackout not found' }); return; }
  store.blackoutPeriods.splice(idx, 1);
  res.json({ success: true });
});
