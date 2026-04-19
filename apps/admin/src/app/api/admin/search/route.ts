/**
 * GET /api/admin/search?q=&clubId=
 * Multi-table search across users, bookings, courses, trainers.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ success: true, data: { users: [], courses: [], bookings: [] } });

  const supabase = createSupabaseAdminClient();
  const searchPattern = `%${q}%`;

  // Search users
  const { data: users } = await supabase.from('users')
    .select('id, full_name, email, role')
    .or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
    .limit(8);

  // Search courses
  const { data: courses } = await supabase.from('courses')
    .select('id, name, sport_type, status, club_id')
    .ilike('name', searchPattern)
    .limit(5);

  // Search bookings by access_pin or notes
  const { data: bookings } = await supabase.from('bookings')
    .select('id, booking_type, time_slot_start, access_pin, notes, status')
    .or(`access_pin.eq.${q},notes.ilike.${searchPattern}`)
    .neq('status', 'cancelled')
    .order('time_slot_start', { ascending: false })
    .limit(5);

  return NextResponse.json({
    success: true,
    data: {
      users: (users ?? []).map(u => ({ id: u.id, name: u.full_name, email: u.email, role: u.role, type: 'user' })),
      courses: (courses ?? []).map(c => ({ id: c.id, name: c.name, sport: c.sport_type, status: c.status, type: 'course' })),
      bookings: (bookings ?? []).map(b => ({
        id: b.id, type: 'booking', booking_type: b.booking_type,
        date: b.time_slot_start?.split('T')[0], pin: b.access_pin, notes: b.notes?.slice(0, 50),
      })),
    },
  });
}
