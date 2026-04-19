/**
 * GET /api/users/me/courses — current user's course registrations with course details
 */
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireUser } from '../../../../../lib/auth/guards';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data: registrations, error } = await supabase
    .from('course_registrations')
    .select('*')
    .eq('user_id', auth.user.id)
    .neq('status', 'cancelled')
    .order('applied_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!registrations?.length) return NextResponse.json({ success: true, data: [] });

  const courseIds = [...new Set(registrations.map((row) => row.course_id))];
  const { data: courses } = await supabase.from('courses').select('*').in('id', courseIds);

  const courtIds = [...new Set((courses ?? []).map((course) => course.court_id).filter(Boolean))];
  const trainerIds = [...new Set((courses ?? []).map((course) => course.trainer_id).filter(Boolean))];

  const [{ data: courts }, { data: trainers }] = await Promise.all([
    courtIds.length > 0 ? supabase.from('courts').select('id, name').in('id', courtIds) : { data: [] as any[] },
    trainerIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', trainerIds) : { data: [] as any[] },
  ]);

  const courtMap = new Map((courts ?? []).map((row) => [row.id, row]));
  const trainerMap = new Map((trainers ?? []).map((row) => [row.id, row]));
  const courseMap = new Map((courses ?? []).map((course) => [course.id, course]));

  const enriched = registrations.map((registration) => {
    const course = courseMap.get(registration.course_id);
    if (!course) return registration;

    return {
      ...registration,
      course: {
        ...course,
        court_name: courtMap.get(course.court_id)?.name ?? '?',
        trainer_name: course.trainer_id ? trainerMap.get(course.trainer_id)?.full_name ?? '?' : null,
      },
    };
  });

  return NextResponse.json({ success: true, data: enriched });
}
