/**
 * GET /api/admin/notifications?clubId=
 * Counts of pending actions for the notification bell.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });
  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();

  const [memberships, sickLeaves, clubCourses] = await Promise.all([
    supabase.from('club_memberships').select('id', { count: 'exact' }).eq('club_id', clubId).eq('status', 'pending'),
    supabase.from('sick_leaves').select('id', { count: 'exact' }).eq('club_id', clubId).eq('status', 'active'),
    supabase.from('courses').select('id').eq('club_id', clubId),
  ]);

  const courseIds = (clubCourses.data ?? []).map(c => c.id);
  const courseRegs = courseIds.length > 0
    ? await supabase.from('course_registrations').select('id', { count: 'exact' }).in('course_id', courseIds).eq('status', 'pending')
    : { count: 0 };

  const items = [
    { type: 'memberships', label: 'Väntande medlemsansökningar', count: memberships.count ?? 0, href: '/admin/memberships', color: '#f59e0b' },
    { type: 'course_registrations', label: 'Väntande kursanmälningar', count: (courseRegs as any).count ?? 0, href: '/courses', color: '#6366f1' },
    { type: 'sick_leaves', label: 'Aktiva sjukanmälningar', count: sickLeaves.count ?? 0, href: '/sick-leave', color: '#dc2626' },
  ].filter(i => i.count > 0);

  const total = items.reduce((s, i) => s + i.count, 0);

  return NextResponse.json({ success: true, data: { total, items } });
}
