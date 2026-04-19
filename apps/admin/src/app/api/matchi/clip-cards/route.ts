/**
 * GET /api/matchi/clip-cards?clubId= — List clip cards for a club
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

  const { data: clipCards, error } = await supabase
    .from('clip_cards')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Collect unique owner IDs to fetch names
  const ownerIds = [...new Set((clipCards ?? []).map((c) => c.owner_id))];

  let usersMap: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', ownerIds);

    usersMap = (users ?? []).reduce<Record<string, string>>((acc, u) => {
      acc[u.id] = u.full_name ?? 'Unknown';
      return acc;
    }, {});
  }

  const enriched = (clipCards ?? []).map((card) => ({
    ...card,
    owner_name: usersMap[card.owner_id] ?? 'Unknown',
  }));

  return NextResponse.json({ success: true, data: enriched });
}
