/**
 * GET /api/admin/dashboard?clubId=
 * Aggregated stats for the admin dashboard: today's numbers, revenue, occupancy, pending actions.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const todayStart = `${today}T00:00:00`;
  const todayEnd = `${today}T23:59:59`;
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString().split('T')[0];

  // Get courts for this club
  const { data: courts } = await supabase.from('courts').select('id').eq('club_id', clubId).eq('is_active', true);
  const courtIds = (courts ?? []).map(c => c.id);

  // Today's bookings
  const { data: todayBookings } = courtIds.length > 0
    ? await supabase.from('bookings').select('id, booking_type, total_price, status')
        .in('court_id', courtIds).neq('status', 'cancelled')
        .gte('time_slot_start', todayStart).lte('time_slot_start', todayEnd)
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
  const bookedSlots = todayCount; // approximation: 1 booking ≈ 1 hour
  const occupancy = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0;

  // Pending actions
  const { data: pendingMemberships } = await supabase.from('club_memberships')
    .select('id').eq('club_id', clubId).eq('status', 'pending');
  const { data: pendingCourseRegs } = await supabase.from('course_registrations')
    .select('id, course_id').eq('status', 'pending');
  // Filter course regs to this club's courses
  const { data: clubCourses } = await supabase.from('courses').select('id').eq('club_id', clubId);
  const clubCourseIds = new Set((clubCourses ?? []).map(c => c.id));
  const pendingCourseRegsCount = (pendingCourseRegs ?? []).filter(r => clubCourseIds.has(r.course_id)).length;

  const { data: sickLeaves } = await supabase.from('sick_leaves')
    .select('id').eq('club_id', clubId).eq('status', 'active');

  // Recent activity (last 5 bookings)
  const { data: recentBookings } = courtIds.length > 0
    ? await supabase.from('bookings').select('id, booking_type, time_slot_start, total_price, booker_id, created_at')
        .in('court_id', courtIds).neq('status', 'cancelled')
        .order('created_at', { ascending: false }).limit(5)
    : { data: [] };

  // Enrich recent with booker names
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
        memberships: pendingMemberships?.length ?? 0,
        course_registrations: pendingCourseRegsCount,
        sick_leaves: sickLeaves?.length ?? 0,
        total: (pendingMemberships?.length ?? 0) + pendingCourseRegsCount + (sickLeaves?.length ?? 0),
      },
      recent_activity: recentActivity,
    },
  });
}
