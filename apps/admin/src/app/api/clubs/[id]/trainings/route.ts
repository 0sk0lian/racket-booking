/**
 * GET /api/clubs/:id/trainings — visible training sessions at a club
 * Returns sessions where visibility='club' (for members) or 'public' (for everyone).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { resolveClubId } from '../../../../../lib/clubs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubIdentifier } = await params;
  const supabase = createSupabaseAdminClient();
  const clubId = await resolveClubId(clubIdentifier, supabase);
  if (!clubId) return NextResponse.json({ success: false, error: 'Club not found' }, { status: 404 });

  // Check if user is a member (affects which sessions they see)
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  let isMember = false;
  if (user) {
    const { data: membership } = await supabase.from('club_memberships')
      .select('status').eq('club_id', clubId).eq('user_id', user.id).single();
    isMember = membership?.status === 'active';
  }

  let query = supabase.from('training_sessions').select('*')
    .eq('club_id', clubId).neq('status', 'cancelled');

  if (isMember) {
    query = query.in('visibility', ['club', 'public']);
  } else {
    query = query.eq('visibility', 'public');
  }

  const { data: sessions, error } = await query.order('day_of_week').order('start_hour');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Enrich with court + trainer names
  const courtIds = [...new Set((sessions ?? []).map(s => s.court_id))];
  const trainerIds = [...new Set((sessions ?? []).filter(s => s.trainer_id).map(s => s.trainer_id))];
  const [{ data: courts }, { data: trainers }] = await Promise.all([
    courtIds.length > 0 ? supabase.from('courts').select('id, name').in('id', courtIds) : { data: [] as any[] },
    trainerIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', trainerIds) : { data: [] as any[] },
  ]);
  const courtMap = new Map((courts ?? []).map(c => [c.id, c]));
  const trainerMap = new Map((trainers ?? []).map(t => [t.id, t]));

  const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

  const enriched = (sessions ?? []).map(s => ({
    ...s,
    court_name: courtMap.get(s.court_id)?.name ?? '?',
    trainer_name: s.trainer_id ? trainerMap.get(s.trainer_id)?.full_name ?? '?' : null,
    day_name: DAY_NAMES[s.day_of_week],
    spots_left: s.max_players ? Math.max(0, s.max_players - (s.player_ids?.length ?? 0)) : null,
    // Check if current user has applied/is assigned
    user_status: user ? (
      (s.going_ids ?? []).includes(user.id) ? 'going' :
      (s.invited_ids ?? []).includes(user.id) ? 'invited' :
      (s.declined_ids ?? []).includes(user.id) ? 'declined' :
      (s.waitlist_ids ?? []).includes(user.id) ? 'waitlist' :
      (s.player_ids ?? []).includes(user.id) ? 'assigned' : 'none'
    ) : 'none',
  }));

  return NextResponse.json({ success: true, data: enriched });
}
