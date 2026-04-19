/**
 * GET /api/users/leaderboard?sport=padel — Top players by Elo rating
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

const VALID_SPORTS = ['padel', 'tennis', 'badminton', 'squash', 'pickleball'] as const;
type Sport = (typeof VALID_SPORTS)[number];

function eloColumn(sport: Sport): string {
  return `elo_${sport}`;
}

export async function GET(request: NextRequest) {
  const sportParam = request.nextUrl.searchParams.get('sport') ?? 'padel';

  if (!VALID_SPORTS.includes(sportParam as Sport)) {
    return NextResponse.json(
      { success: false, error: `Invalid sport. Valid options: ${VALID_SPORTS.join(', ')}` },
      { status: 400 },
    );
  }

  const sport = sportParam as Sport;
  const column = eloColumn(sport);
  const supabase = createSupabaseAdminClient();

  // Use select('*') because Supabase TS parser cannot handle dynamic column names
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_active', true)
    .not(column, 'is', null)
    .order(column, { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const leaderboard = (data ?? []).map((user: Record<string, unknown>) => ({
    id: user.id,
    full_name: user.full_name,
    elo: (user[column] as number) ?? 0,
    matches_played: (user.matches_played as number) ?? 0,
  }));

  return NextResponse.json({ success: true, data: leaderboard });
}
