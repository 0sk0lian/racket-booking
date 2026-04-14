import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import crypto from 'crypto';

export const matchiRoutes = Router();
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const getName = (id: string) => store.users.find(u => u.id === id)?.full_name ?? 'Okänd';

// ═══════════════════════════════════════════════════════════════
// PUBLIC MATCHES (Matchmaking)
// ═══════════════════════════════════════════════════════════════

matchiRoutes.get('/public-matches', (req: Request, res: Response) => {
  const { clubId, sportType } = req.query;
  let matches = store.publicMatches.filter(m => m.status === 'open' || m.status === 'full');
  if (clubId) matches = matches.filter(m => m.club_id === clubId);
  if (sportType) matches = matches.filter(m => m.sport_type === sportType);
  const enriched = matches.map(m => ({
    ...m, host_name: getName(m.host_id),
    players: m.player_ids.map(id => ({ id, name: getName(id) })),
    spots_remaining: m.spots_total - m.spots_filled,
  }));
  res.json({ success: true, data: enriched });
});

matchiRoutes.post('/public-matches', (req: Request, res: Response) => {
  const { clubId, hostId, sportType, courtName, date, startHour, endHour, minLevel, maxLevel, spotsTotal, notes } = req.body;
  const pm = {
    id: uid(), booking_id: '', host_id: hostId, club_id: clubId,
    sport_type: sportType, court_name: courtName, date, start_hour: startHour, end_hour: endHour,
    min_level: minLevel || 1, max_level: maxLevel || 10,
    spots_total: spotsTotal || 4, spots_filled: 1, player_ids: [hostId],
    status: 'open' as const, notes: notes || null, created_at: now(),
  };
  store.publicMatches.push(pm);
  res.status(201).json({ success: true, data: pm });
});

matchiRoutes.post('/public-matches/:id/join', (req: Request, res: Response) => {
  const pm = store.publicMatches.find(m => m.id === req.params.id);
  if (!pm) { res.status(404).json({ success: false, error: 'Match not found' }); return; }
  if (pm.status !== 'open') { res.status(409).json({ success: false, error: 'Match is full' }); return; }
  const { userId } = req.body;
  if (pm.player_ids.includes(userId)) { res.status(409).json({ success: false, error: 'Already joined' }); return; }
  pm.player_ids.push(userId);
  pm.spots_filled++;
  if (pm.spots_filled >= pm.spots_total) pm.status = 'full';
  res.json({ success: true, data: pm });
});

matchiRoutes.post('/public-matches/:id/leave', (req: Request, res: Response) => {
  const pm = store.publicMatches.find(m => m.id === req.params.id);
  if (!pm) { res.status(404).json({ success: false, error: 'Match not found' }); return; }
  const { userId } = req.body;
  pm.player_ids = pm.player_ids.filter(id => id !== userId);
  pm.spots_filled = pm.player_ids.length;
  if (pm.spots_filled < pm.spots_total) pm.status = 'open';
  res.json({ success: true, data: pm });
});

// ═══════════════════════════════════════════════════════════════
// WAITLISTS
// ═══════════════════════════════════════════════════════════════

matchiRoutes.get('/waitlists', (req: Request, res: Response) => {
  const { targetId } = req.query;
  let wl = [...store.waitlists];
  if (targetId) wl = wl.filter(w => w.target_id === targetId);
  const enriched = wl.map(w => ({ ...w, user_name: getName(w.user_id) }));
  res.json({ success: true, data: enriched });
});

matchiRoutes.post('/waitlists', (req: Request, res: Response) => {
  const { userId, targetId, activityType } = req.body;
  const pos = store.waitlists.filter(w => w.target_id === targetId).length + 1;
  const wl = { id: uid(), user_id: userId, booking_id: null, activity_type: activityType || 'booking', target_id: targetId, position: pos, status: 'waiting' as const, created_at: now() };
  store.waitlists.push(wl);
  res.status(201).json({ success: true, data: wl });
});

// ═══════════════════════════════════════════════════════════════
// LEAGUES (Backhandsmash)
// ═══════════════════════════════════════════════════════════════

matchiRoutes.get('/leagues', (req: Request, res: Response) => {
  const { clubId, sportType } = req.query;
  let leagues = [...store.leagues];
  if (clubId) leagues = leagues.filter(l => l.club_id === clubId);
  if (sportType) leagues = leagues.filter(l => l.sport_type === sportType);
  const enriched = leagues.map(l => ({
    ...l, player_count: l.player_ids.length,
    standings: l.standings.map(s => ({ ...s, player_name: getName(s.player_id) })).sort((a, b) => b.points - a.points),
  }));
  res.json({ success: true, data: enriched });
});

matchiRoutes.get('/leagues/:id', (req: Request, res: Response) => {
  const l = store.leagues.find(l => l.id === req.params.id);
  if (!l) { res.status(404).json({ success: false, error: 'League not found' }); return; }
  res.json({ success: true, data: { ...l, standings: l.standings.map(s => ({ ...s, player_name: getName(s.player_id) })).sort((a, b) => b.points - a.points) } });
});

matchiRoutes.post('/leagues', (req: Request, res: Response) => {
  const { clubId, name, sportType, season, division, format, playerIds } = req.body;
  const standings = (playerIds || []).map((id: string) => ({ player_id: id, wins: 0, losses: 0, points: 0, elo: 1000 }));
  const l = { id: uid(), club_id: clubId, name, sport_type: sportType, season, division, format, player_ids: playerIds || [], matches_played: 0, status: 'draft' as const, standings, created_at: now(), updated_at: now() };
  store.leagues.push(l);
  res.status(201).json({ success: true, data: l });
});

matchiRoutes.post('/leagues/:id/result', (req: Request, res: Response) => {
  const l = store.leagues.find(l => l.id === req.params.id);
  if (!l) { res.status(404).json({ success: false, error: 'League not found' }); return; }
  const { winnerId, loserId } = req.body;
  const winner = l.standings.find(s => s.player_id === winnerId);
  const loser = l.standings.find(s => s.player_id === loserId);
  if (winner) { winner.wins++; winner.points += 3; }
  if (loser) { loser.losses++; }
  l.matches_played++;
  l.updated_at = now();
  res.json({ success: true, data: l });
});

// ═══════════════════════════════════════════════════════════════
// CLIP CARDS & VALUE CARDS
// ═══════════════════════════════════════════════════════════════

matchiRoutes.get('/clip-cards', (req: Request, res: Response) => {
  const { clubId, ownerId } = req.query;
  let cards = store.clipCards.filter(c => c.is_active);
  if (clubId) cards = cards.filter(c => c.club_id === clubId);
  if (ownerId) cards = cards.filter(c => c.owner_id === ownerId);
  const enriched = cards.map(c => ({ ...c, owner_name: getName(c.owner_id) }));
  res.json({ success: true, data: enriched });
});

matchiRoutes.post('/clip-cards', (req: Request, res: Response) => {
  const c = { id: uid(), ...req.body, is_active: true, created_at: now() };
  if (c.type === 'clip') { c.remaining_clips = c.total_clips; }
  if (c.type === 'value') { c.remaining_value = c.total_value; }
  store.clipCards.push(c);
  res.status(201).json({ success: true, data: c });
});

matchiRoutes.post('/clip-cards/:id/use', (req: Request, res: Response) => {
  const card = store.clipCards.find(c => c.id === req.params.id);
  if (!card) { res.status(404).json({ success: false, error: 'Card not found' }); return; }
  if (card.type === 'clip') {
    if (!card.remaining_clips || card.remaining_clips <= 0) { res.status(409).json({ success: false, error: 'No clips remaining' }); return; }
    card.remaining_clips--;
  } else {
    const amount = Number(req.body.amount) || 0;
    if (!card.remaining_value || card.remaining_value < amount) { res.status(409).json({ success: false, error: 'Insufficient balance' }); return; }
    card.remaining_value -= amount;
  }
  res.json({ success: true, data: card });
});

// ═══════════════════════════════════════════════════════════════
// SEASONS & SUBSCRIPTIONS (Abonnemang)
// ═══════════════════════════════════════════════════════════════

matchiRoutes.get('/seasons', (req: Request, res: Response) => {
  const { clubId } = req.query;
  let seasons = [...store.seasons];
  if (clubId) seasons = seasons.filter(s => s.club_id === clubId);
  const enriched = seasons.map(s => {
    const subs = store.subscriptions.filter(sub => sub.season_id === s.id);
    return { ...s, subscription_count: subs.length, subscriptions: subs.map(sub => ({
      ...sub, customer_name: getName(sub.customer_id),
      court_name: store.courts.find(c => c.id === sub.court_id)?.name ?? '?',
      day_name: ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'][sub.day_of_week],
    }))};
  });
  res.json({ success: true, data: enriched });
});

matchiRoutes.post('/seasons', (req: Request, res: Response) => {
  const s = { id: uid(), club_id: req.body.clubId, name: req.body.name, start_date: req.body.startDate, end_date: req.body.endDate, status: 'draft' as const, subscription_count: 0, created_at: now() };
  store.seasons.push(s);
  res.status(201).json({ success: true, data: s });
});

matchiRoutes.post('/seasons/:id/subscriptions', (req: Request, res: Response) => {
  const season = store.seasons.find(s => s.id === req.params.id);
  if (!season) { res.status(404).json({ success: false, error: 'Season not found' }); return; }
  const sub = { id: uid(), season_id: season.id, club_id: season.club_id, customer_id: req.body.customerId, court_id: req.body.courtId, day_of_week: req.body.dayOfWeek, start_hour: req.body.startHour, end_hour: req.body.endHour, price_per_session: req.body.pricePerSession || 350, frequency: req.body.frequency || 'weekly', status: 'active' as const, created_at: now() };
  store.subscriptions.push(sub);
  season.subscription_count++;
  res.status(201).json({ success: true, data: sub });
});

// Copy subscriptions between seasons
matchiRoutes.post('/seasons/:id/copy-to/:targetId', (req: Request, res: Response) => {
  const source = store.seasons.find(s => s.id === req.params.id);
  const target = store.seasons.find(s => s.id === req.params.targetId);
  if (!source || !target) { res.status(404).json({ success: false, error: 'Season not found' }); return; }
  const sourceSubs = store.subscriptions.filter(s => s.season_id === source.id);
  let count = 0;
  for (const sub of sourceSubs) {
    store.subscriptions.push({ ...sub, id: uid(), season_id: target.id, created_at: now() });
    count++;
  }
  target.subscription_count += count;
  res.json({ success: true, data: { copied: count } });
});

// ═══════════════════════════════════════════════════════════════
// VENUE PROFILES
// ═══════════════════════════════════════════════════════════════

matchiRoutes.get('/venue-profile', (req: Request, res: Response) => {
  const { clubId } = req.query;
  const profile = store.venueProfiles.find(v => v.club_id === clubId);
  const club = store.clubs.find(c => c.id === clubId);
  const courts = store.courts.filter(c => c.club_id === clubId && c.is_active);
  res.json({ success: true, data: { profile, club, courts } });
});

matchiRoutes.patch('/venue-profile/:clubId', (req: Request, res: Response) => {
  let profile = store.venueProfiles.find(v => v.club_id === req.params.clubId);
  if (!profile) {
    profile = { id: uid(), club_id: req.params.clubId, description: null, amenities: [], images: [], opening_hours: [], booking_rules: { max_days_ahead: 14, cancellation_hours: 24, refund_percentage: 100, max_bookings_per_user: null, show_names_in_schedule: true }, social_links: {}, created_at: now(), updated_at: now() };
    store.venueProfiles.push(profile);
  }
  if (req.body.description !== undefined) profile.description = req.body.description;
  if (req.body.amenities !== undefined) profile.amenities = req.body.amenities;
  if (req.body.openingHours !== undefined) profile.opening_hours = req.body.openingHours;
  if (req.body.bookingRules !== undefined) profile.booking_rules = { ...profile.booking_rules, ...req.body.bookingRules };
  if (req.body.socialLinks !== undefined) profile.social_links = req.body.socialLinks;
  profile.updated_at = now();
  res.json({ success: true, data: profile });
});

// ═══════════════════════════════════════════════════════════════
// STATEMENTS (Financial reconciliation)
// ═══════════════════════════════════════════════════════════════

matchiRoutes.get('/statements', (req: Request, res: Response) => {
  const { clubId } = req.query;
  let stmts = [...store.statements];
  if (clubId) stmts = stmts.filter(s => s.club_id === clubId);
  stmts.sort((a, b) => b.period.localeCompare(a.period));
  const totalEarned = stmts.reduce((s, st) => s + st.total_earned, 0);
  const totalPaid = stmts.reduce((s, st) => s + st.total_paid_out, 0);
  res.json({ success: true, data: { statements: stmts, summary: { totalEarned, totalPaid, pendingTotal: totalEarned - totalPaid } } });
});

// ═══════════════════════════════════════════════════════════════
// SPLIT PAYMENT
// ═══════════════════════════════════════════════════════════════

matchiRoutes.post('/split-invite', (req: Request, res: Response) => {
  const { bookingId, inviterId, inviteeId, amount } = req.body;
  const inv = { id: uid(), booking_id: bookingId, inviter_id: inviterId, invitee_id: inviteeId, amount, status: 'pending' as const, created_at: now(), paid_at: null };
  store.splitInvites.push(inv);
  res.status(201).json({ success: true, data: { ...inv, inviter_name: getName(inviterId), invitee_name: getName(inviteeId) } });
});

matchiRoutes.get('/split-invites', (req: Request, res: Response) => {
  const { bookingId, userId } = req.query;
  let invites = [...store.splitInvites];
  if (bookingId) invites = invites.filter(i => i.booking_id === bookingId);
  if (userId) invites = invites.filter(i => i.invitee_id === userId || i.inviter_id === userId);
  const enriched = invites.map(i => ({ ...i, inviter_name: getName(i.inviter_id), invitee_name: getName(i.invitee_id) }));
  res.json({ success: true, data: enriched });
});

matchiRoutes.patch('/split-invites/:id', (req: Request, res: Response) => {
  const inv = store.splitInvites.find(i => i.id === req.params.id);
  if (!inv) { res.status(404).json({ success: false, error: 'Invite not found' }); return; }
  if (req.body.status) { inv.status = req.body.status; if (req.body.status === 'accepted') inv.paid_at = now(); }
  res.json({ success: true, data: inv });
});
