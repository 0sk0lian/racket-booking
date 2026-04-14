import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import { authenticate } from '../middleware/auth.js';
import { EloCalculator } from '../services/elo.js';

export const matchRoutes = Router();

matchRoutes.post('/', authenticate, (req: Request, res: Response) => {
  const { bookingId, tournamentId, sportType, team1PlayerIds, team2PlayerIds, team1Score, team2Score } = req.body;

  if (!team1PlayerIds?.length || !team2PlayerIds?.length || team1Score == null || team2Score == null) {
    res.status(400).json({ success: false, error: 'Both teams and scores required' }); return;
  }

  const team1Won = team1Score > team2Score;
  const winnerTeam = team1Score === team2Score ? null : (team1Won ? 1 : 2);

  const match = store.createMatch({
    booking_id: bookingId, tournament_id: tournamentId, sport_type: sportType,
    team1_player_ids: team1PlayerIds, team2_player_ids: team2PlayerIds,
    team1_score: team1Score, team2_score: team2Score, winner_team: winnerTeam,
  });

  // Update Elo ratings
  let eloUpdates = null;
  if (winnerTeam != null) {
    const eloKey = `elo_${sportType}` as 'elo_padel' | 'elo_tennis' | 'elo_squash' | 'elo_badminton';
    const getElo = (id: string) => store.users.find(u => u.id === id)?.[eloKey] ?? 1000;
    const setElo = (id: string, val: number) => {
      const u = store.users.find(u => u.id === id);
      if (u) { (u as any)[eloKey] = val; u.matches_played++; }
    };

    if (team1PlayerIds.length === 1 && team2PlayerIds.length === 1) {
      const result = EloCalculator.updateSinglesRatings(getElo(team1PlayerIds[0]), getElo(team2PlayerIds[0]), team1Won);
      setElo(team1PlayerIds[0], result.player1);
      setElo(team2PlayerIds[0], result.player2);
      eloUpdates = result;
    } else if (team1PlayerIds.length === 2 && team2PlayerIds.length === 2) {
      const result = EloCalculator.updateDoublesRatings(
        { p1: getElo(team1PlayerIds[0]), p2: getElo(team1PlayerIds[1]) },
        { p1: getElo(team2PlayerIds[0]), p2: getElo(team2PlayerIds[1]) },
        team1Won
      );
      setElo(team1PlayerIds[0], result.team1.p1); setElo(team1PlayerIds[1], result.team1.p2);
      setElo(team2PlayerIds[0], result.team2.p1); setElo(team2PlayerIds[1], result.team2.p2);
      eloUpdates = result;
    }
    match.elo_processed = true;
  }

  res.status(201).json({ success: true, data: { match, eloUpdates } });
});

matchRoutes.get('/', (req: Request, res: Response) => {
  let matches = [...store.matches];
  if (req.query.sportType) matches = matches.filter(m => m.sport_type === req.query.sportType);
  if (req.query.userId) {
    const uid = req.query.userId as string;
    matches = matches.filter(m => m.team1_player_ids.includes(uid) || m.team2_player_ids.includes(uid));
  }
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  res.json({ success: true, data: matches.slice(-limit).reverse() });
});
