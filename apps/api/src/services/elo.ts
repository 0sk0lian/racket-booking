import {
  ELO_K_FACTOR_NEW,
  ELO_K_FACTOR_MID,
  ELO_K_FACTOR_ESTABLISHED,
  ELO_K_THRESHOLD_MID,
  ELO_K_THRESHOLD_HIGH,
} from '@racket-booking/shared';
import type { EloTeam, EloUpdateResult } from '@racket-booking/shared';

/**
 * Elo rating calculator supporting both singles and doubles formats.
 *
 * Singles: standard 1v1 Elo formula.
 * Doubles: averaged-team methodology with isolated individual updating.
 *   - Team rating = arithmetic mean of both players
 *   - Expected outcome computed from team ratings
 *   - Individual updates applied using team expected/actual values
 *
 * Dynamic K-factors:
 *   - rating < 2100  → K = 32 (new players converge fast)
 *   - 2100–2400      → K = 24
 *   - rating > 2400  → K = 16 (stable for experienced players)
 *
 * Reference: docs/ARCHITECTURE.md → "Algorithmic Matchmaking and The Elo Rating System"
 */
export class EloCalculator {
  /** Determine K-factor based on current rating */
  private static getKFactor(rating: number): number {
    if (rating < ELO_K_THRESHOLD_MID) return ELO_K_FACTOR_NEW;
    if (rating <= ELO_K_THRESHOLD_HIGH) return ELO_K_FACTOR_MID;
    return ELO_K_FACTOR_ESTABLISHED;
  }

  /** Calculate expected win probability for playerA against playerB */
  private static getExpectedProbability(ratingA: number, ratingB: number): number {
    return 1.0 / (1.0 + Math.pow(10, (ratingB - ratingA) / 400.0));
  }

  /** Update a single player's rating given expected and actual outcomes */
  private static updateRating(
    currentRating: number,
    expectedProb: number,
    actualOutcome: number // 1 = win, 0 = loss, 0.5 = draw
  ): number {
    const k = this.getKFactor(currentRating);
    return Math.round(currentRating + k * (actualOutcome - expectedProb));
  }

  /** Update Elo ratings for a 1v1 singles match */
  static updateSinglesRatings(
    player1Rating: number,
    player2Rating: number,
    player1Won: boolean
  ): { player1: number; player2: number } {
    const expected1 = this.getExpectedProbability(player1Rating, player2Rating);
    const expected2 = this.getExpectedProbability(player2Rating, player1Rating);

    const actual1 = player1Won ? 1 : 0;
    const actual2 = player1Won ? 0 : 1;

    return {
      player1: this.updateRating(player1Rating, expected1, actual1),
      player2: this.updateRating(player2Rating, expected2, actual2),
    };
  }

  /**
   * Update Elo ratings for a doubles match (e.g., padel).
   * Uses averaged-team methodology: team rating = mean of both players.
   * Each player gets an individual update based on team performance.
   */
  static updateDoublesRatings(
    team1: EloTeam,
    team2: EloTeam,
    team1Won: boolean
  ): EloUpdateResult {
    // Calculate the arithmetic mean for team ratings
    const t1Avg = (team1.p1 + team1.p2) / 2.0;
    const t2Avg = (team2.p1 + team2.p2) / 2.0;

    const expectedT1 = this.getExpectedProbability(t1Avg, t2Avg);
    const expectedT2 = this.getExpectedProbability(t2Avg, t1Avg);

    const actualT1 = team1Won ? 1 : 0;
    const actualT2 = team1Won ? 0 : 1;

    return {
      team1: {
        p1: this.updateRating(team1.p1, expectedT1, actualT1),
        p2: this.updateRating(team1.p2, expectedT1, actualT1),
      },
      team2: {
        p1: this.updateRating(team2.p1, expectedT2, actualT2),
        p2: this.updateRating(team2.p2, expectedT2, actualT2),
      },
    };
  }
}
