/**
 * GET /api/matchi/seasons?clubId= — List seasons with subscription counts
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) {
    return NextResponse.json({ success: false, error: 'clubId is required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();

  const { data: seasons, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('club_id', clubId)
    .order('start_date', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const seasonIds = (seasons ?? []).map((s) => s.id);

  let subscriptionCounts: Record<string, number> = {};
  if (seasonIds.length > 0) {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('season_id')
      .in('season_id', seasonIds);

    subscriptionCounts = (subs ?? []).reduce<Record<string, number>>((acc, sub) => {
      acc[sub.season_id] = (acc[sub.season_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  const enriched = (seasons ?? []).map((season) => ({
    ...season,
    subscription_count: subscriptionCounts[season.id] ?? 0,
  }));

  return NextResponse.json({ success: true, data: enriched });
}
