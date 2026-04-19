/**
 * GET  /api/courses?clubId=&status=&visibility=  — list courses
 * POST /api/courses                                — create course
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const supabase = createSupabaseAdminClient();

  let query = supabase.from('courses').select('*');
  if (p.get('clubId')) query = query.eq('club_id', p.get('clubId'));
  if (p.get('status')) query = query.eq('status', p.get('status'));
  if (p.get('visibility')) query = query.eq('visibility', p.get('visibility'));
  query = query.order('term_start', { ascending: false });

  const { data: courses, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Enrich with counts + names
  const courseIds = (courses ?? []).map(c => c.id);
  const { data: regCounts } = courseIds.length > 0
    ? await supabase.from('course_registrations').select('course_id, status').in('course_id', courseIds)
    : { data: [] };

  const courtIds = [...new Set((courses ?? []).map(c => c.court_id))];
  const trainerIds = [...new Set((courses ?? []).filter(c => c.trainer_id).map(c => c.trainer_id))];
  const [{ data: courts }, { data: trainers }] = await Promise.all([
    courtIds.length > 0 ? supabase.from('courts').select('id, name').in('id', courtIds) : { data: [] as any[] },
    trainerIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', trainerIds) : { data: [] as any[] },
  ]);
  const courtMap = new Map((courts ?? []).map(c => [c.id, c]));
  const trainerMap = new Map((trainers ?? []).map(t => [t.id, t]));

  const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

  const enriched = (courses ?? []).map(c => {
    const regs = (regCounts ?? []).filter(r => r.course_id === c.id);
    return {
      ...c,
      court_name: courtMap.get(c.court_id)?.name ?? '?',
      trainer_name: c.trainer_id ? trainerMap.get(c.trainer_id)?.full_name ?? '?' : null,
      day_name: DAY_NAMES[c.day_of_week],
      registrations_approved: regs.filter(r => r.status === 'approved').length,
      registrations_pending: regs.filter(r => r.status === 'pending').length,
      registrations_waitlisted: regs.filter(r => r.status === 'waitlisted').length,
      registrations_total: regs.length,
    };
  });

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const b = await request.json();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.from('courses').insert({
    club_id: b.clubId,
    name: b.name,
    description: b.description ?? null,
    sport_type: b.sportType ?? 'padel',
    category: b.category ?? 'adult',
    court_id: b.courtId,
    trainer_id: b.trainerId ?? null,
    day_of_week: b.dayOfWeek,
    start_hour: b.startHour,
    end_hour: b.endHour,
    term_start: b.termStart,
    term_end: b.termEnd,
    skip_dates: b.skipDates ?? [],
    max_participants: b.maxParticipants ?? null,
    price_total: b.priceTotal ?? null,
    price_per_session: b.pricePerSession ?? null,
    registration_status: b.registrationStatus ?? 'draft',
    visibility: b.visibility ?? 'club',
    status: b.status ?? 'draft',
  }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
