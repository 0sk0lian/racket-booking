import type { TournamentRound, TournamentMatch } from '@racket-booking/shared';

/**
 * Padel Americano tournament schedule generator using Berger/Whist rotation.
 *
 * Format: round-robin doubles where every player partners with every other player
 * exactly once and competes against every other player twice.
 *
 * Algorithm:
 *   1. Fix Player 1 as pivot
 *   2. Remaining N-1 players form a circular array
 *   3. Each round: pair opposite ends of array for matches
 *   4. Rotate array clockwise after each round
 *   5. Handle non-multiples of 4 with "bye" system
 *
 * Optimal when N is a multiple of 4 (8, 12, 16 players).
 * Generates N-1 rounds.
 *
 * Reference: docs/ARCHITECTURE.md → "Tournament Generation Engine: Padel Americano"
 */
export function generateAmericanoSchedule(playerIds: string[]): TournamentRound[] {
  const N = playerIds.length;

  if (N < 4) {
    throw new Error('Americano requires at least 4 players.');
  }

  // If player count is odd, add a BYE placeholder to make it even
  const players = [...playerIds];
  let hasBye = false;
  if (N % 2 !== 0) {
    players.push('BYE');
    hasBye = true;
  }

  // If not a multiple of 4, pad with BYE players
  while (players.length % 4 !== 0) {
    players.push('BYE');
    hasBye = true;
  }

  const totalPlayers = players.length;
  const totalRounds = totalPlayers - 1;
  const rounds: TournamentRound[] = [];

  // Polygon rotation method: fix pivot, rotate the rest
  const rotatingArray = players.slice(1); // Remove first player as pivot
  const pivot = players[0];

  for (let r = 0; r < totalRounds; r++) {
    const currentRoundMatches: TournamentMatch[] = [];

    // Reconstruct the array with the pivot at the start
    const roundPlayers = [pivot, ...rotatingArray];

    // Pair players from opposite ends of the array into matches of 4
    for (let i = 0; i < totalPlayers / 2; i += 2) {
      const team1: string[] = [roundPlayers[i], roundPlayers[i + 1]];
      const team2: string[] = [roundPlayers[totalPlayers - 1 - i], roundPlayers[totalPlayers - 2 - i]];

      // Skip matches involving BYE players
      const hasByePlayer = [...team1, ...team2].includes('BYE');
      if (!hasByePlayer) {
        currentRoundMatches.push({ team1, team2 });
      }
    }

    if (currentRoundMatches.length > 0) {
      rounds.push({
        roundNumber: rounds.length + 1,
        matches: currentRoundMatches,
      });
    }

    // Execute the polygon rotation: shift the array elements clockwise
    const lastElement = rotatingArray.pop();
    if (lastElement) {
      rotatingArray.unshift(lastElement);
    }
  }

  return rounds;
}

/**
 * Generate a Mexicano tournament schedule.
 * Mexicano is similar to Americano but teams are re-formed each round
 * based on current standings (1st+4th vs 2nd+3rd, etc.).
 *
 * For the first round, uses random assignment. Subsequent rounds use standings.
 */
export function generateMexicanoFirstRound(playerIds: string[]): TournamentRound {
  const N = playerIds.length;
  if (N < 4 || N % 4 !== 0) {
    throw new Error('Mexicano requires a multiple of 4 players.');
  }

  // Shuffle for first round
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const matches: TournamentMatch[] = [];

  for (let i = 0; i < N; i += 4) {
    matches.push({
      team1: [shuffled[i], shuffled[i + 1]],
      team2: [shuffled[i + 2], shuffled[i + 3]],
    });
  }

  return { roundNumber: 1, matches };
}

/**
 * Generate next Mexicano round based on standings.
 * Players are grouped by rank: 1st+4th vs 2nd+3rd in each group of 4.
 */
export function generateMexicanoNextRound(
  playerIds: string[],
  standings: Record<string, number>,
  roundNumber: number
): TournamentRound {
  // Sort by points descending
  const sorted = [...playerIds].sort((a, b) => (standings[b] || 0) - (standings[a] || 0));
  const matches: TournamentMatch[] = [];

  for (let i = 0; i < sorted.length; i += 4) {
    const group = sorted.slice(i, i + 4);
    if (group.length === 4) {
      // 1st + 4th vs 2nd + 3rd
      matches.push({
        team1: [group[0], group[3]],
        team2: [group[1], group[2]],
      });
    }
  }

  return { roundNumber, matches };
}
