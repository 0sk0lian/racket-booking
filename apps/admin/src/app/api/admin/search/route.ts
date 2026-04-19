/**
 * GET /api/admin/search?q=&clubId=
 * Multi-table search across users, bookings, courses, trainers.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess, scopeClubIdsForAdmin } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ success: true, data: { users: [], courses: [], bookings: [] } });

  const clubId = request.nextUrl.searchParams.get('clubId');
  if (clubId) {
    const access = await requireClubAccess(clubId);
    if (!access.ok) return access.response;
  }

  const scopedClubIds = clubId ? [clubId] : await scopeClubIdsForAdmin(admin);
  if (scopedClubIds !== null && scopedClubIds.length === 0) {
    return NextResponse.json({ success: true, data: { users: [], courses: [], bookings: [] } });
  }

  const supabase = createSupabaseAdminClient();
  const searchPattern = `%${q}%`;

  // Search users: when scoped, only users linked to those clubs via memberships or trainer_club_id.
  let users: Array<{ id: string; full_name: string; email: string; role: string }> = [];
  if (scopedClubIds === null) {
    const { data } = await supabase.from('users')
      .select('id, full_name, email, role')
      .or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
      .limit(8);
    users = (data ?? []) as Array<{ id: string; full_name: string; email: string; role: string }>;
  } else {
    const [{ data: members }, { data: trainers }] = await Promise.all([
      supabase.from('club_memberships').select('user_id').in('club_id', scopedClubIds),
      supabase.from('users').select('id').in('trainer_club_id', scopedClubIds),
    ]);
    const scopedUserIds = [...new Set([
      ...(members ?? []).map((row) => row.user_id as string),
      ...(trainers ?? []).map((row) => row.id as string),
    ])];
    if (scopedUserIds.length > 0) {
      const { data } = await supabase.from('users')
        .select('id, full_name, email, role')
        .in('id', scopedUserIds)
        .or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
        .limit(8);
      users = (data ?? []) as Array<{ id: string; full_name: string; email: string; role: string }>;
    }
  }

  // Search courses
  let coursesQuery = supabase.from('courses')
    .select('id, name, sport_type, status, club_id')
    .ilike('name', searchPattern)
    .limit(5);
  if (scopedClubIds !== null) coursesQuery = coursesQuery.in('club_id', scopedClubIds);
  const { data: courses } = await coursesQuery;

  // Search bookings by access_pin or notes
  let bookingQuery = supabase.from('bookings')
    .select('id, court_id, booking_type, time_slot_start, access_pin, notes, status')
    .or(`access_pin.eq.${q},notes.ilike.${searchPattern}`)
    .neq('status', 'cancelled')
    .order('time_slot_start', { ascending: false })
    .limit(5);

  if (scopedClubIds !== null) {
    const { data: courts } = await supabase.from('courts').select('id').in('club_id', scopedClubIds);
    const courtIds = (courts ?? []).map((row) => row.id as string);
    if (courtIds.length === 0) {
      bookingQuery = supabase.from('bookings').select('id, court_id, booking_type, time_slot_start, access_pin, notes, status').eq('id', '00000000-0000-0000-0000-000000000000');
    } else {
      bookingQuery = bookingQuery.in('court_id', courtIds);
    }
  }
  const { data: bookings } = await bookingQuery;

  return NextResponse.json({
    success: true,
    data: {
      users: (users ?? []).map((user) => ({ id: user.id, name: user.full_name, email: user.email, role: user.role, type: 'user' })),
      courses: (courses ?? []).map((course) => ({ id: course.id, name: course.name, sport: course.sport_type, status: course.status, type: 'course' })),
      bookings: (bookings ?? []).map((booking) => ({
        id: booking.id,
        type: 'booking',
        booking_type: booking.booking_type,
        date: booking.time_slot_start?.split('T')[0],
        pin: booking.access_pin,
        notes: booking.notes?.slice(0, 50),
      })),
    },
  });
}
