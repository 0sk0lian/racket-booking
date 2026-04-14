import { Router, Request, Response } from 'express';
import { store } from '../store.js';

export const statsRoutes = Router();

// GET /api/stats/overview — global platform analytics
statsRoutes.get('/overview', (_req: Request, res: Response) => {
  const matches = store.matches;
  const bookings = store.bookings;

  // Matches per sport
  const sportBreakdown: Record<string, number> = {};
  matches.forEach(m => { sportBreakdown[m.sport_type] = (sportBreakdown[m.sport_type] || 0) + 1; });

  // Matches per week (last 5 weeks)
  const weeksData: { week: string; matches: number; bookings: number }[] = [];
  for (let i = 4; i >= 0; i--) {
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - (i * 7 + 6));
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() - i * 7);
    const label = `${weekStart.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}`;
    const matchCount = matches.filter(m => {
      const d = new Date(m.played_at || m.created_at);
      return d >= weekStart && d <= weekEnd;
    }).length;
    const bookingCount = bookings.filter(b => {
      const d = new Date(b.created_at);
      return d >= weekStart && d <= weekEnd;
    }).length;
    weeksData.push({ week: label, matches: matchCount, bookings: bookingCount });
  }

  // Score distribution
  const scoreDiffs: number[] = matches
    .filter(m => m.team1_score != null && m.team2_score != null)
    .map(m => Math.abs(m.team1_score! - m.team2_score!));
  const closeMatches = scoreDiffs.filter(d => d <= 1).length;
  const decisiveMatches = scoreDiffs.filter(d => d >= 4).length;

  // Top players by wins
  const winCounts: Record<string, number> = {};
  matches.forEach(m => {
    if (m.winner_team === 1) m.team1_player_ids.forEach(id => { winCounts[id] = (winCounts[id] || 0) + 1; });
    if (m.winner_team === 2) m.team2_player_ids.forEach(id => { winCounts[id] = (winCounts[id] || 0) + 1; });
  });

  res.json({
    success: true,
    data: {
      totalMatches: matches.length,
      totalBookings: bookings.length,
      totalPlayers: store.users.length,
      totalCourts: store.courts.filter(c => c.is_active).length,
      sportBreakdown,
      weeksData,
      closeMatches,
      decisiveMatches,
    },
  });
});

// GET /api/stats/player/:id — individual player stats
statsRoutes.get('/player/:id', (req: Request, res: Response) => {
  const user = store.users.find(u => u.id === req.params.id);
  if (!user) { res.status(404).json({ success: false, error: 'Player not found' }); return; }

  const allMatches = store.matches.filter(m =>
    m.team1_player_ids.includes(user.id) || m.team2_player_ids.includes(user.id)
  );

  let wins = 0, losses = 0, draws = 0;
  const sportStats: Record<string, { wins: number; losses: number; draws: number }> = {};
  const matchHistory: any[] = [];
  const eloHistory: { date: string; elo: number; sport: string }[] = [];

  // Simulate Elo progression from matches in chronological order
  const eloTracker: Record<string, number> = { padel: 1000, tennis: 1000, squash: 1000, badminton: 1000 };

  const sorted = [...allMatches].sort((a, b) =>
    new Date(a.played_at || a.created_at).getTime() - new Date(b.played_at || b.created_at).getTime()
  );

  for (const m of sorted) {
    const onTeam1 = m.team1_player_ids.includes(user.id);
    const won = (onTeam1 && m.winner_team === 1) || (!onTeam1 && m.winner_team === 2);
    const lost = (onTeam1 && m.winner_team === 2) || (!onTeam1 && m.winner_team === 1);
    const draw = m.winner_team === null;

    if (won) wins++;
    else if (lost) losses++;
    else draws++;

    if (!sportStats[m.sport_type]) sportStats[m.sport_type] = { wins: 0, losses: 0, draws: 0 };
    if (won) sportStats[m.sport_type].wins++;
    else if (lost) sportStats[m.sport_type].losses++;
    else sportStats[m.sport_type].draws++;

    // Simulate Elo change
    const change = won ? Math.floor(Math.random() * 15 + 10) : lost ? -Math.floor(Math.random() * 12 + 8) : 0;
    eloTracker[m.sport_type] += change;

    eloHistory.push({
      date: new Date(m.played_at || m.created_at).toLocaleDateString('sv-SE'),
      elo: eloTracker[m.sport_type],
      sport: m.sport_type,
    });

    // Build opponent/partner names
    const teammates = (onTeam1 ? m.team1_player_ids : m.team2_player_ids).filter(id => id !== user.id);
    const opponents = onTeam1 ? m.team2_player_ids : m.team1_player_ids;
    const getName = (id: string) => store.users.find(u => u.id === id)?.full_name ?? 'Unknown';

    matchHistory.push({
      id: m.id,
      date: m.played_at || m.created_at,
      sport: m.sport_type,
      result: won ? 'win' : lost ? 'loss' : 'draw',
      score: `${m.team1_score} - ${m.team2_score}`,
      myScore: onTeam1 ? m.team1_score : m.team2_score,
      opponentScore: onTeam1 ? m.team2_score : m.team1_score,
      partner: teammates.map(getName).join(', ') || null,
      opponents: opponents.map(getName).join(' & '),
    });
  }

  const { password_hash, ...safeUser } = user;

  res.json({
    success: true,
    data: {
      player: safeUser,
      totalMatches: allMatches.length,
      wins, losses, draws,
      winRate: allMatches.length > 0 ? Math.round((wins / allMatches.length) * 100) : 0,
      sportStats,
      eloHistory,
      matchHistory: matchHistory.reverse(), // newest first
    },
  });
});
