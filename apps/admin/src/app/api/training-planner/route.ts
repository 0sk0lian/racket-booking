/**
 * GET  /api/training-planner?clubId=&status=  — list templates
 * POST /api/training-planner                   — create template
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { requireAdmin, requireClubAccess, requireUser, scopeClubIdsForAdmin } from '../../../lib/auth/guards';

const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

async function enrichSessions(supabase: ReturnType<typeof createSupabaseAdminClient>, sessions: any[]) {
  const userIds = new Set<string>();
  const courtIds = new Set<string>();
  sessions.forEach((session) => {
    if (session.trainer_id) userIds.add(session.trainer_id);
    (session.player_ids ?? []).forEach((id: string) => userIds.add(id));
    (session.going_ids ?? []).forEach((id: string) => userIds.add(id));
    (session.declined_ids ?? []).forEach((id: string) => userIds.add(id));
    (session.invited_ids ?? []).forEach((id: string) => userIds.add(id));
    (session.waitlist_ids ?? []).forEach((id: string) => userIds.add(id));
    if (session.court_id) courtIds.add(session.court_id);
  });

  const [{ data: users }, { data: courts }] = await Promise.all([
    userIds.size > 0 ? supabase.from('users').select('id, full_name').in('id', Array.from(userIds)) : { data: [] as any[] },
    courtIds.size > 0 ? supabase.from('courts').select('id, name, sport_type').in('id', Array.from(courtIds)) : { data: [] as any[] },
  ]);
  const userMap = new Map((users ?? []).map((user) => [user.id, user]));
  const courtMap = new Map((courts ?? []).map((court) => [court.id, court]));
  const getName = (id: string) => userMap.get(id)?.full_name ?? '?';
  const mapNames = (ids: string[]) => (ids ?? []).map((id) => ({ id, name: getName(id) }));

  return sessions.map((session) => {
    const court = courtMap.get(session.court_id);
    return {
      ...session,
      court_name: court?.name ?? '?',
      sport_type: court?.sport_type ?? 'padel',
      trainer_name: getName(session.trainer_id),
      day_name: DAY_NAMES[session.day_of_week],
      players: mapNames(session.player_ids ?? []),
      going: mapNames(session.going_ids ?? []),
      declined: mapNames(session.declined_ids ?? []),
      invited: mapNames(session.invited_ids ?? []),
      waitlist: mapNames(session.waitlist_ids ?? []),
    };
  });
}

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  const status = request.nextUrl.searchParams.get('status');
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const supabase = createSupabaseAdminClient();
  let scopedClubIds: string[] | null = null;
  let trainerOnly = false;

  if (auth.role === 'trainer') {
    const { data: trainer } = await supabase
      .from('users')
      .select('trainer_club_id')
      .eq('id', auth.user.id)
      .single();

    const trainerClubId = trainer?.trainer_club_id as string | null;
    if (!trainerClubId) {
      return NextResponse.json({ success: true, data: [] });
    }
    if (clubId && clubId !== trainerClubId) {
      return NextResponse.json({ success: false, error: 'Du har inte tillgång till denna klubb' }, { status: 403 });
    }
    scopedClubIds = [trainerClubId];
    trainerOnly = true;
  } else {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
    if (clubId) {
      const access = await requireClubAccess(clubId);
      if (!access.ok) return access.response;
    }
    scopedClubIds = clubId ? [clubId] : await scopeClubIdsForAdmin(admin);
    if (scopedClubIds !== null && scopedClubIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }
  }

  let query = supabase.from('training_sessions').select('*');
  if (scopedClubIds !== null) query = query.in('club_id', scopedClubIds);
  if (trainerOnly) query = query.eq('trainer_id', auth.user.id);
  if (status) query = query.eq('status', status);
  query = query.order('day_of_week').order('start_hour');

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const enriched = await enrichSessions(supabase, data ?? []);
  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json();
  if (!body?.clubId) return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });
  const access = await requireClubAccess(body.clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('training_sessions').insert({
    club_id: body.clubId,
    title: body.title ?? 'Träningspass',
    court_id: body.courtId,
    trainer_id: body.trainerId,
    player_ids: body.playerIds ?? [],
    day_of_week: body.dayOfWeek,
    start_hour: body.startHour,
    end_hour: body.endHour,
    notes: body.notes ?? null,
  }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  const enriched = await enrichSessions(supabase, [data]);
  return NextResponse.json({ success: true, data: enriched[0] });
}
