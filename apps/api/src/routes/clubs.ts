import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import { authenticate } from '../middleware/auth.js';

export const clubRoutes = Router();

clubRoutes.get('/', (_req: Request, res: Response) => {
  const clubs = store.clubs.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ success: true, data: clubs });
});

clubRoutes.get('/:id', (req: Request, res: Response) => {
  const club = store.clubs.find(c => c.id === req.params.id);
  if (!club) { res.status(404).json({ success: false, error: 'Club not found' }); return; }

  const courts = store.courts.filter(c => c.club_id === club.id && c.is_active);
  const bookingCount = store.bookings.filter(b => courts.some(c => c.id === b.court_id) && b.status !== 'cancelled').length;
  res.json({ success: true, data: { ...club, courts, bookingCount } });
});

clubRoutes.post('/', authenticate, (req: Request, res: Response) => {
  const { name, organizationNumber, isNonProfit, timezone, city, contactEmail } = req.body;
  const club = store.createClub({
    name, organization_number: organizationNumber,
    is_non_profit: isNonProfit ?? false, timezone: timezone ?? 'Europe/Stockholm',
    city: city ?? null, contact_email: contactEmail ?? null,
  });
  res.status(201).json({ success: true, data: club });
});

clubRoutes.patch('/:id', authenticate, (req: Request, res: Response) => {
  const club = store.clubs.find(c => c.id === req.params.id);
  if (!club) { res.status(404).json({ success: false, error: 'Club not found' }); return; }
  if (req.body.name) club.name = req.body.name;
  if (req.body.isNonProfit !== undefined) club.is_non_profit = req.body.isNonProfit;
  if (req.body.stripeAccountId) club.stripe_account_id = req.body.stripeAccountId;
  club.updated_at = new Date().toISOString();
  res.json({ success: true, data: club });
});
