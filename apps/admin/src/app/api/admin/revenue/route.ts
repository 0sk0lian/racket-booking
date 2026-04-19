/**
 * GET /api/admin/revenue?clubId=&from=&to=
 * Revenue breakdown by day, court, booking type.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const clubId = p.get('clubId');
  if (!clubId) return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });

  const now = new Date();
  const from = p.get('from') ?? new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
  const to = p.get('to') ?? now.toISOString().split('T')[0];

  const supabase = createSupabaseAdminClient();

  const { data: courts } = await supabase.from('courts').select('id, name').eq('club_id', clubId);
  const courtIds = (courts ?? []).map(c => c.id);
  const courtMap = new Map((courts ?? []).map(c => [c.id, c.name]));

  if (courtIds.length === 0) return NextResponse.json({ success: true, data: { total: 0, byDay: [], byCourt: [], byType: [] } });

  const { data: bookings } = await supabase.from('bookings')
    .select('id, court_id, booking_type, total_price, time_slot_start, status')
    .in('court_id', courtIds).eq('status', 'confirmed')
    .gte('time_slot_start', from + 'T00:00:00').lte('time_slot_start', to + 'T23:59:59');

  const total = (bookings ?? []).reduce((s, b) => s + (b.total_price ?? 0), 0);

  // By day
  const dayMap = new Map<string, number>();
  (bookings ?? []).forEach(b => {
    const day = b.time_slot_start?.split('T')[0] ?? '';
    dayMap.set(day, (dayMap.get(day) ?? 0) + (b.total_price ?? 0));
  });
  const byDay = Array.from(dayMap.entries()).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date));

  // By court
  const courtRevMap = new Map<string, number>();
  (bookings ?? []).forEach(b => {
    const name = courtMap.get(b.court_id) ?? '?';
    courtRevMap.set(name, (courtRevMap.get(name) ?? 0) + (b.total_price ?? 0));
  });
  const byCourt = Array.from(courtRevMap.entries()).map(([court, revenue]) => ({ court, revenue })).sort((a, b) => b.revenue - a.revenue);

  // By type
  const typeMap = new Map<string, number>();
  (bookings ?? []).forEach(b => {
    typeMap.set(b.booking_type, (typeMap.get(b.booking_type) ?? 0) + (b.total_price ?? 0));
  });
  const byType = Array.from(typeMap.entries()).map(([type, revenue]) => ({ type, revenue })).sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({ success: true, data: { total, bookingCount: bookings?.length ?? 0, byDay, byCourt, byType } });
}
