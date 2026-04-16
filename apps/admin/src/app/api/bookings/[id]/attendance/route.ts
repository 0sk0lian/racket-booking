/**
 * GET  /api/bookings/:id/attendance       — list attendance for a booking
 * POST /api/bookings/:id/attendance/bulk  — would conflict with [userId], so bulk is separate dir
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: rows, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('booking_id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const userIds = (rows ?? []).map(r => r.user_id);
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map(u => [u.id, u]));

  const enriched = (rows ?? []).map(r => ({
    ...r,
    full_name: userMap.get(r.user_id)?.full_name ?? 'Unknown',
    email: userMap.get(r.user_id)?.email ?? null,
  })).sort((a, b) => {
    const order = ['going', 'invited', 'waitlist', 'declined', 'present', 'no_show'];
    return order.indexOf(a.status) - order.indexOf(b.status) || a.full_name.localeCompare(b.full_name);
  });

  return NextResponse.json({ success: true, data: enriched });
}
