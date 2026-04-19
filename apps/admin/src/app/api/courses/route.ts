/**
 * GET  /api/courses?clubId=&status=&visibility=  — list courses
 * POST /api/courses                                — create course
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { getRequestUser, getUserRole, getManagedClubIds, requireAdmin, requireClubAccess } from '../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const supabase = createSupabaseAdminClient();

  let scopedClubIds: string[] | null = null;
  const requestUser = await getRequestUser();
  if (requestUser) {
    const role = await getUserRole(requestUser.id);
    if (role === 'admin') scopedClubIds = await getManagedClubIds(requestUser.id);
  }

  let query = supabase.from('courses').select('*');
  const requestedClubId = p.get('clubId');
  if (requestedClubId) {
    if (scopedClubIds !== null && !scopedClubIds.includes(requestedClubId)) {
      return NextResponse.json({ success: false, error: 'You do not have access to this venue' }, { status: 403 });
    }
    query = query.eq('club_id', requestedClubId);
  } else if (scopedClubIds !== null) {
    if (scopedClubIds.length === 0) return NextResponse.json({ success: true, data: [] });
    query = query.in('club_id', scopedClubIds);
  }
  if (p.get('status')) query = query.eq('status', p.get('status'));
  if (p.get('visibility')) query = query.eq('visibility', p.get('visibility'));
  query = query.order('term_start', { ascending: false });

  const { data: courses, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const courseIds = (courses ?? []).map((course) => course.id);
  const { data: regCounts } = courseIds.length > 0
    ? await supabase.from('course_registrations').select('course_id, status').in('course_id', courseIds)
    : { data: [] };

  const courtIds = [...new Set((courses ?? []).map((course) => course.court_id))];
  const trainerIds = [...new Set((courses ?? []).filter((course) => course.trainer_id).map((course) => course.trainer_id))];
  const [{ data: courts }, { data: trainers }] = await Promise.all([
    courtIds.length > 0 ? supabase.from('courts').select('id, name').in('id', courtIds) : { data: [] as any[] },
    trainerIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', trainerIds) : { data: [] as any[] },
  ]);
  const courtMap = new Map((courts ?? []).map((court) => [court.id, court]));
  const trainerMap = new Map((trainers ?? []).map((trainer) => [trainer.id, trainer]));

  const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

  const enriched = (courses ?? []).map((course) => {
    const registrations = (regCounts ?? []).filter((row) => row.course_id === course.id);
    return {
      ...course,
      court_name: courtMap.get(course.court_id)?.name ?? '?',
      trainer_name: course.trainer_id ? trainerMap.get(course.trainer_id)?.full_name ?? '?' : null,
      day_name: DAY_NAMES[course.day_of_week],
      registrations_approved: registrations.filter((row) => row.status === 'approved').length,
      registrations_pending: registrations.filter((row) => row.status === 'pending').length,
      registrations_waitlisted: registrations.filter((row) => row.status === 'waitlisted').length,
      registrations_total: registrations.length,
    };
  });

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

  const { data, error } = await supabase.from('courses').insert({
    club_id: body.clubId,
    name: body.name,
    description: body.description ?? null,
    sport_type: body.sportType ?? 'padel',
    category: body.category ?? 'adult',
    court_id: body.courtId,
    trainer_id: body.trainerId ?? null,
    day_of_week: body.dayOfWeek,
    start_hour: body.startHour,
    end_hour: body.endHour,
    term_start: body.termStart,
    term_end: body.termEnd,
    skip_dates: body.skipDates ?? [],
    max_participants: body.maxParticipants ?? null,
    price_total: body.priceTotal ?? null,
    price_per_session: body.pricePerSession ?? null,
    registration_status: body.registrationStatus ?? 'draft',
    visibility: body.visibility ?? 'club',
    status: body.status ?? 'draft',
  }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
