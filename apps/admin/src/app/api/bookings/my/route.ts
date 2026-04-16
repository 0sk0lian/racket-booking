/**
 * GET /api/bookings/my — current user's bookings
 */
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../lib/supabase/server';

export async function GET() {
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('booker_id', user.id)
    .neq('status', 'cancelled')
    .order('time_slot_start', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Enrich with court + club names
  const courtIds = [...new Set((bookings ?? []).map(b => b.court_id))];
  const { data: courts } = courtIds.length > 0
    ? await supabase.from('courts').select('id, name, sport_type, club_id').in('id', courtIds)
    : { data: [] };
  const courtMap = new Map((courts ?? []).map(c => [c.id, c]));

  const clubIds = [...new Set((courts ?? []).map(c => c.club_id))];
  const { data: clubs } = clubIds.length > 0
    ? await supabase.from('clubs').select('id, name').in('id', clubIds)
    : { data: [] };
  const clubMap = new Map((clubs ?? []).map(c => [c.id, c]));

  const enriched = (bookings ?? []).map(b => {
    const court = courtMap.get(b.court_id);
    const club = court ? clubMap.get(court.club_id) : null;
    return {
      ...b,
      court_name: court?.name ?? null,
      sport_type: court?.sport_type ?? null,
      club_name: club?.name ?? null,
    };
  });

  return NextResponse.json({ success: true, data: enriched });
}
