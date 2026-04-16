/**
 * GET /api/matches/browse?clubId=&city=&sport=
 * Browse open matches. Respects visibility (club members see 'club' + 'public', others see 'public' + 'area').
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const clubId = p.get('clubId');
  const city = p.get('city');
  const sport = p.get('sport');

  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0];

  // Check membership for visibility filtering
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  let query = supabase.from('public_matches').select('*')
    .eq('status', 'open')
    .gte('date', today)
    .order('date').order('start_hour');

  if (clubId) query = query.eq('club_id', clubId);
  if (city) query = query.eq('city', city);
  if (sport) query = query.eq('sport_type', sport);

  const { data: matches, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Filter by visibility
  let memberClubIds: string[] = [];
  if (user) {
    const { data: memberships } = await supabase.from('club_memberships')
      .select('club_id').eq('user_id', user.id).eq('status', 'active');
    memberClubIds = (memberships ?? []).map(m => m.club_id);
  }

  const visible = (matches ?? []).filter(m => {
    if (m.visibility === 'public') return true;
    if (m.visibility === 'area') return true; // area matches are visible to anyone in the area
    if (m.visibility === 'club') return memberClubIds.includes(m.club_id);
    return false;
  });

  // Enrich with host name
  const hostIds = [...new Set(visible.map(m => m.host_id))];
  const { data: hosts } = hostIds.length > 0
    ? await supabase.from('users').select('id, full_name').in('id', hostIds)
    : { data: [] };
  const hostMap = new Map((hosts ?? []).map(h => [h.id, h]));

  const enriched = visible.map(m => ({
    ...m,
    host_name: hostMap.get(m.host_id)?.full_name ?? 'Unknown',
    is_host: user?.id === m.host_id,
    has_joined: user ? (m.player_ids ?? []).includes(user.id) : false,
  }));

  return NextResponse.json({ success: true, data: enriched });
}
