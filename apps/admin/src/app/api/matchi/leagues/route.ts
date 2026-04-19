/**
 * GET /api/matchi/leagues?clubId= — List leagues with parsed standings
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

  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // standings is stored as JSONB — Supabase returns it already parsed,
  // but ensure it is an array for safety
  const enriched = (leagues ?? []).map((league) => ({
    ...league,
    standings: Array.isArray(league.standings) ? league.standings : [],
  }));

  return NextResponse.json({ success: true, data: enriched });
}
