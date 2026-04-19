/**
 * GET /api/matchi/public-matches?clubId= — List public matches for admin view
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

  const { data: matches, error } = await supabase
    .from('public_matches')
    .select('*')
    .eq('club_id', clubId)
    .order('date', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const rows = matches ?? [];

  // Collect all user IDs (host + players) for name enrichment
  const allUserIds = new Set<string>();
  for (const m of rows) {
    allUserIds.add(m.host_id);
    if (Array.isArray(m.player_ids)) {
      for (const pid of m.player_ids) {
        allUserIds.add(pid);
      }
    }
  }

  let usersMap: Record<string, string> = {};
  const userIdArray = [...allUserIds];
  if (userIdArray.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', userIdArray);

    usersMap = (users ?? []).reduce<Record<string, string>>((acc, u) => {
      acc[u.id] = u.full_name ?? 'Unknown';
      return acc;
    }, {});
  }

  // Collect booking IDs for enrichment
  const bookingIds = [...new Set(rows.map((m) => m.booking_id))];
  let bookingsMap: Record<string, { court_id: string; start_time: string; end_time: string }> = {};
  if (bookingIds.length > 0) {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, court_id, start_time, end_time')
      .in('id', bookingIds);

    bookingsMap = (bookings ?? []).reduce<Record<string, { court_id: string; start_time: string; end_time: string }>>((acc, b) => {
      acc[b.id] = { court_id: b.court_id, start_time: b.start_time, end_time: b.end_time };
      return acc;
    }, {});
  }

  const enriched = rows.map((match) => ({
    ...match,
    host_name: usersMap[match.host_id] ?? 'Unknown',
    player_names: (Array.isArray(match.player_ids) ? match.player_ids : []).map(
      (pid: string) => usersMap[pid] ?? 'Unknown',
    ),
    booking: bookingsMap[match.booking_id] ?? null,
    spots_remaining: match.spots_total - match.spots_filled,
  }));

  return NextResponse.json({ success: true, data: enriched });
}
