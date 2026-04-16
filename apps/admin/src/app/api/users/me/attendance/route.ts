/**
 * GET /api/users/me/attendance — current user's upcoming training invites
 */
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../../lib/supabase/server';

export async function GET() {
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Filter to future bookings + enrich
  const bookingIds = (rows ?? []).map(r => r.booking_id);
  const { data: bookings } = bookingIds.length > 0
    ? await supabase.from('bookings').select('id, court_id, time_slot_start, time_slot_end, booking_type, event_name, trainer_id, status').in('id', bookingIds).neq('status', 'cancelled').gte('time_slot_start', now)
    : { data: [] };

  const bookingMap = new Map((bookings ?? []).map(b => [b.id, b]));
  const courtIds = [...new Set((bookings ?? []).map(b => b.court_id))];
  const trainerIds = [...new Set((bookings ?? []).filter(b => b.trainer_id).map(b => b.trainer_id))];

  const [{ data: courts }, { data: trainers }] = await Promise.all([
    courtIds.length > 0 ? supabase.from('courts').select('id, name').in('id', courtIds) : { data: [] as any[] },
    trainerIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', trainerIds) : { data: [] as any[] },
  ]);
  const courtMap = new Map((courts ?? []).map(c => [c.id, c]));
  const trainerMap = new Map((trainers ?? []).map(t => [t.id, t]));

  const enriched = (rows ?? [])
    .map(r => {
      const b = bookingMap.get(r.booking_id);
      if (!b) return null;
      return {
        ...r,
        booking: {
          id: b.id,
          court_name: courtMap.get(b.court_id)?.name ?? null,
          start: b.time_slot_start,
          end: b.time_slot_end,
          booking_type: b.booking_type,
          event_name: b.event_name,
          trainer_name: b.trainer_id ? trainerMap.get(b.trainer_id)?.full_name ?? null : null,
        },
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.booking.start.localeCompare(b.booking.start));

  return NextResponse.json({ success: true, data: enriched });
}
