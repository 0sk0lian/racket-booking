/**
 * GET  /api/training-planner?clubId=&status=  — list templates
 * POST /api/training-planner                   — create template
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';

const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

async function enrichSessions(supabase: ReturnType<typeof createSupabaseAdminClient>, sessions: any[]) {
  const userIds = new Set<string>();
  const courtIds = new Set<string>();
  sessions.forEach(s => {
    if (s.trainer_id) userIds.add(s.trainer_id);
    (s.player_ids ?? []).forEach((id: string) => userIds.add(id));
    (s.going_ids ?? []).forEach((id: string) => userIds.add(id));
    (s.declined_ids ?? []).forEach((id: string) => userIds.add(id));
    (s.invited_ids ?? []).forEach((id: string) => userIds.add(id));
    (s.waitlist_ids ?? []).forEach((id: string) => userIds.add(id));
    if (s.court_id) courtIds.add(s.court_id);
  });

  const [{ data: users }, { data: courts }] = await Promise.all([
    userIds.size > 0 ? supabase.from('users').select('id, full_name').in('id', Array.from(userIds)) : { data: [] as any[] },
    courtIds.size > 0 ? supabase.from('courts').select('id, name, sport_type').in('id', Array.from(courtIds)) : { data: [] as any[] },
  ]);
  const userMap = new Map((users ?? []).map(u => [u.id, u]));
  const courtMap = new Map((courts ?? []).map(c => [c.id, c]));
  const getName = (id: string) => userMap.get(id)?.full_name ?? '?';
  const mapNames = (ids: string[]) => (ids ?? []).map(id => ({ id, name: getName(id) }));

  return sessions.map(s => {
    const court = courtMap.get(s.court_id);
    return {
      ...s,
      court_name: court?.name ?? '?',
      sport_type: court?.sport_type ?? 'padel',
      trainer_name: getName(s.trainer_id),
      day_name: DAY_NAMES[s.day_of_week],
      players: mapNames(s.player_ids ?? []),
      going: mapNames(s.going_ids ?? []),
      declined: mapNames(s.declined_ids ?? []),
      invited: mapNames(s.invited_ids ?? []),
      waitlist: mapNames(s.waitlist_ids ?? []),
    };
  });
}

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  const status = request.nextUrl.searchParams.get('status');
  const supabase = createSupabaseAdminClient();

  let query = supabase.from('training_sessions').select('*');
  if (clubId) query = query.eq('club_id', clubId);
  if (status) query = query.eq('status', status);
  query = query.order('day_of_week').order('start_hour');

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const enriched = await enrichSessions(supabase, data ?? []);
  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
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
