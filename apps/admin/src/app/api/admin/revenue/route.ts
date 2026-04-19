/**
 * GET /api/admin/revenue?clubId=&from=&to=
 * Revenue breakdown by day, court, booking type.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const clubId = p.get('clubId');
  if (!clubId) return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });
  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const now = new Date();
  const from = p.get('from') ?? new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
  const to = p.get('to') ?? now.toISOString().split('T')[0];

  const supabase = createSupabaseAdminClient();

  const { data: courts } = await supabase.from('courts').select('id, name').eq('club_id', clubId);
  const courtIds = (courts ?? []).map(c => c.id);
  const courtMap = new Map((courts ?? []).map(c => [c.id, c.name]));

  if (courtIds.length === 0) return NextResponse.json({ success: true, data: { total: 0, bookingCount: 0, byDay: [], byCourt: [], byType: [], trainerCosts: 0, platformFees: 0, profit: 0 } });

  const { data: bookings } = await supabase.from('bookings')
    .select('id, court_id, booking_type, total_price, platform_fee, time_slot_start, status')
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

  // Trainer costs: sum of approved time_reports for this club in the date range
  const { data: timeReports } = await supabase
    .from('time_reports')
    .select('hours, user_id')
    .eq('club_id', clubId)
    .eq('approved', true)
    .gte('date', from)
    .lte('date', to);

  // Look up hourly rates for trainers referenced in time reports
  const trainerUserIds = [...new Set((timeReports ?? []).map(r => r.user_id))];
  let trainerRateMap = new Map<string, number>();
  if (trainerUserIds.length > 0) {
    const { data: trainers } = await supabase
      .from('trainers')
      .select('user_id, hourly_rate')
      .in('user_id', trainerUserIds);
    trainerRateMap = new Map((trainers ?? []).map(t => [t.user_id, Number(t.hourly_rate ?? 0)]));
  }

  const trainerCosts = (timeReports ?? []).reduce((sum, r) => {
    const rate = trainerRateMap.get(r.user_id) ?? 0;
    return sum + (Number(r.hours ?? 0) * rate);
  }, 0);

  // Platform fees: sum of platform_fee from bookings in range
  const platformFees = (bookings ?? []).reduce((s, b) => s + (Number(b.platform_fee ?? 0)), 0);

  const profit = total - trainerCosts - platformFees;

  return NextResponse.json({
    success: true,
    data: {
      total,
      bookingCount: bookings?.length ?? 0,
      byDay,
      byCourt,
      byType,
      trainerCosts: Number(trainerCosts.toFixed(2)),
      platformFees: Number(platformFees.toFixed(2)),
      profit: Number(profit.toFixed(2)),
    },
  });
}
