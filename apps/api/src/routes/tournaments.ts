import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import { authenticate } from '../middleware/auth.js';
import { generateAmericanoSchedule } from '../services/tournament.js';

export const tournamentRoutes = Router();

tournamentRoutes.post('/', authenticate, (req: Request, res: Response) => {
  const { clubId, name, sportType, format, playerIds, pointsPerMatch, startsAt } = req.body;
  if (!playerIds?.length || playerIds.length < 4) {
    res.status(400).json({ success: false, error: 'At least 4 players required' }); return;
  }

  try {
    const schedule = format === 'americano' ? generateAmericanoSchedule(playerIds) : null;
    if (!schedule) { res.status(400).json({ success: false, error: 'Unsupported format' }); return; }

    const standings: Record<string, number> = {};
    playerIds.forEach((id: string) => { standings[id] = 0; });

    const tournament = store.createTournament({
      club_id: clubId, name, sport_type: sportType, format, player_ids: playerIds,
      points_per_match: pointsPerMatch ?? 32, schedule, standings, starts_at: startsAt,
    });
    res.status(201).json({ success: true, data: tournament });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

tournamentRoutes.get('/', (req: Request, res: Response) => {
  let tournaments = [...store.tournaments];
  if (req.query.clubId) tournaments = tournaments.filter(t => t.club_id === req.query.clubId);
  if (req.query.status) tournaments = tournaments.filter(t => t.status === req.query.status);
  res.json({ success: true, data: tournaments });
});

tournamentRoutes.get('/:id', (req: Request, res: Response) => {
  const t = store.tournaments.find(t => t.id === req.params.id);
  if (!t) { res.status(404).json({ success: false, error: 'Tournament not found' }); return; }
  // Enrich player names
  const players = t.player_ids.map((id: string) => {
    const u = store.users.find(u => u.id === id);
    return { id, name: u?.full_name ?? 'Unknown', elo: u?.elo_padel ?? 1000 };
  });
  res.json({ success: true, data: { ...t, players } });
});

tournamentRoutes.patch('/:id/start', authenticate, (req: Request, res: Response) => {
  const t = store.tournaments.find(t => t.id === req.params.id && t.status === 'draft');
  if (!t) { res.status(404).json({ success: false, error: 'Not found or not draft' }); return; }
  t.status = 'active'; t.updated_at = new Date().toISOString();
  res.json({ success: true, data: t });
});

tournamentRoutes.post('/:id/score', authenticate, (req: Request, res: Response) => {
  const { roundNumber, matchIndex, team1Score, team2Score } = req.body;
  const t = store.tournaments.find(t => t.id === req.params.id && t.status === 'active');
  if (!t) { res.status(404).json({ success: false, error: 'Active tournament not found' }); return; }

  const round = t.schedule[roundNumber - 1];
  if (!round) { res.status(400).json({ success: false, error: 'Invalid round' }); return; }
  const match = round.matches[matchIndex];
  if (!match) { res.status(400).json({ success: false, error: 'Invalid match' }); return; }

  match.team1Score = team1Score; match.team2Score = team2Score; match.played = true;
  for (const pid of match.team1) t.standings[pid] = (t.standings[pid] || 0) + team1Score;
  for (const pid of match.team2) t.standings[pid] = (t.standings[pid] || 0) + team2Score;
  t.updated_at = new Date().toISOString();
  res.json({ success: true, data: t });
});
