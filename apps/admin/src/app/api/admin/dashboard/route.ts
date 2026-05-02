/**
 * GET /api/admin/dashboard?clubId=
 * Aggregated stats for the admin dashboard: today's numbers, revenue, occupancy,
 * pending actions, upcoming bookings, recent activity.
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
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const todayStart = `${today}T00:00:00`;
  const todayEnd = `${today}T23:59:59`;
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString().split('T')[0];

  // Get courts for this club
  const { data: courts } = await supabase.from('courts').select('id, name').eq('club_id', clubId).eq('is_active', true);
  const courtIds = (courts ?? []).map(c => c.id);
  const courtMap = new Map((courts ?? []).map(c => [c.id, c.name]));

  // Today's bookings
  const { data: todayBookings } = courtIds.length > 0
    ? await supabase.from('bookings').select('id, booking_type, total_price, status, court_id, time_slot_start, time_slot_end, booker_id')
        .in('court_id', courtIds).neq('status', 'cancelled')
        .gte('time_slot_start', todayStart).lte('time_slot_start', todayEnd)
        .order('time_slot_start')
    : { data: [] };

  const todayCount = (todayBookings ?? []).length;
  const todayTrainings = (todayBookings ?? []).filter(b => b.booking_type === 'training').length;
  const todayEvents = (todayBookings ?? []).filter(b => b.booking_type === 'event').length;
  const todayRevenue = (todayBookings ?? []).reduce((sum, b) => sum + (b.total_price ?? 0), 0);

  // This week revenue
  const { data: weekBookings } = courtIds.length > 0
    ? await supabase.from('bookings').select('total_price')
        .in('court_id', courtIds).neq('status', 'cancelled')
        .gte('time_slot_start', weekAgo + 'T00:00:00')
    : { data: [] };
  const weekRevenue = (weekBookings ?? []).reduce((sum, b) => sum + (b.total_price ?? 0), 0);

  // Previous week revenue (for comparison)
  const { data: prevWeekBookings } = courtIds.length > 0
    ? await supabase.from('bookings').select('total_price')
        .in('court_id', courtIds).neq('status', 'cancelled')
        .gte('time_slot_start', twoWeeksAgo + 'T00:00:00')
        .lt('time_slot_start', weekAgo + 'T00:00:00')
    : { data: [] };
  const prevWeekRevenue = (prevWeekBookings ?? []).reduce((sum, b) => sum + (b.total_price ?? 0), 0);
  const revenueTrend = prevWeekRevenue > 0 ? Math.round(((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100) : 0;

  // Occupancy (today): booked hours / total available hours
  const openHours = 15; // 07:00-22:00
  const totalSlots = courtIds.length * openHours;
  const bookedSlots = todayCount; // approximation: 1 booking ~ 1 hour
  const occupancy = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0;

  // Pending memberships
  const { data: pendingMemberships } = await supabase.from('club_memberships')
    .select('id').eq('club_id', clubId).eq('status', 'pending');
  const pendingMembershipsCount = pendingMemberships?.length ?? 0;

  // Pending course registrations
  const { data: pendingCourseRegs } = await supabase.from('course_registrations')
    .select('id, course_id').eq('status', 'pending');
  const { data: clubCourses } = await supabase.from('courses').select('id').eq('club_id', clubId);
  const clubCourseIds = new Set((clubCourses ?? []).map(c => c.id));
  const pendingCourseRegsCount = (pendingCourseRegs ?? []).filter(r => clubCourseIds.has(r.course_id)).length;

  const { data: openAbsences } = await supabase.from('trainer_absences')
    .select('id').eq('club_id', clubId).eq('status', 'open');

  // Active members count
  const { data: activeMembers } = await supabase.from('club_memberships')
    .select('id, user_id').eq('club_id', clubId).eq('status', 'active');
  const activeMembersCount = activeMembers?.length ?? 0;

  // Inactive members: haven't booked in 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const activeUserIds = (activeMembers ?? []).map(m => m.user_id);
  let inactiveCount = 0;
  if (activeUserIds.length > 0) {
    const { data: recentBookers } = await supabase
      .from('bookings')
      .select('booker_id')
      .in('booker_id', activeUserIds)
      .gt('time_slot_start', thirtyDaysAgo);
    const recentBookerIds = new Set((recentBookers ?? []).map(b => b.booker_id));
    inactiveCount = activeUserIds.filter(id => !recentBookerIds.has(id)).length;
  }

  // Memberships expiring this week
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const { data: expiring } = await supabase
    .from('club_memberships')
    .select('id')
    .eq('club_id', clubId)
    .eq('status', 'active')
    .lt('expires_at', nextWeek.toISOString())
    .gt('expires_at', new Date().toISOString());
  const expiringMembershipsCount = (expiring ?? []).length;

  // Upcoming bookings today (next 5 from now)
  const nowIso = now.toISOString();
  const upcomingRaw = (todayBookings ?? []).filter(b => b.time_slot_start && b.time_slot_start >= nowIso).slice(0, 5);
  const upcomingBookerIds = [...new Set(upcomingRaw.map(b => b.booker_id).filter(Boolean))];
  const { data: upcomingBookers } = upcomingBookerIds.length > 0
    ? await supabase.from('users').select('id, full_name').in('id', upcomingBookerIds)
    : { data: [] };
  const upcomingBookerMap = new Map((upcomingBookers ?? []).map(u => [u.id, u.full_name]));

  const upcomingBookings = upcomingRaw.map(b => ({
    id: b.id,
    type: b.booking_type,
    court_name: courtMap.get(b.court_id) ?? '?',
    time_start: b.time_slot_start,
    time_end: b.time_slot_end,
    booker_name: upcomingBookerMap.get(b.booker_id) ?? 'Admin',
  }));

  // Recent activity (last 5 bookings created)
  const { data: recentBookings } = courtIds.length > 0
    ? await supabase.from('bookings').select('id, booking_type, time_slot_start, total_price, booker_id, created_at')
        .in('court_id', courtIds).neq('status', 'cancelled')
        .order('created_at', { ascending: false }).limit(5)
    : { data: [] };

  const bookerIds = [...new Set((recentBookings ?? []).map(b => b.booker_id).filter(Boolean))];
  const { data: bookers } = bookerIds.length > 0
    ? await supabase.from('users').select('id, full_name').in('id', bookerIds)
    : { data: [] };
  const bookerMap = new Map((bookers ?? []).map(u => [u.id, u.full_name]));

  const recentActivity = (recentBookings ?? []).map(b => ({
    id: b.id,
    type: b.booking_type,
    time: b.time_slot_start,
    price: b.total_price,
    booker_name: bookerMap.get(b.booker_id) ?? 'Admin',
    created_at: b.created_at,
  }));

  return NextResponse.json({
    success: true,
    data: {
      today: { bookings: todayCount, trainings: todayTrainings, events: todayEvents, revenue: todayRevenue },
      week: { revenue: weekRevenue, trend: revenueTrend },
      occupancy,
      pending: {
        memberships: pendingMembershipsCount,
        course_registrations: pendingCourseRegsCount,
        sick_leaves: openAbsences?.length ?? 0,
        total: pendingMembershipsCount + pendingCourseRegsCount + (openAbsences?.length ?? 0),
      },
      active_members: activeMembersCount,
      inactive_members: inactiveCount,
      expiring_memberships: expiringMembershipsCount,
      upcoming_bookings: upcomingBookings,
      recent_activity: recentActivity,
    },
  });
}
