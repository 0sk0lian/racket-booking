/**
 * GET /api/admin/revenue?clubId=&from=&to=
 * Revenue breakdown by day, court, booking type.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';

function parseRateMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const rate = Number(raw);
    if (Number.isFinite(rate) && rate >= 0) out[key] = rate;
  }
  return out;
}

function categoryFromReport(report: { description?: string | null; type?: string | null }) {
  const match = report.description?.match(/\[cat:([a-zA-Z0-9_-]+)\]/);
  return match?.[1] ?? report.type ?? 'other';
}

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
    .select('hours, user_id, type, description')
    .eq('club_id', clubId)
    .eq('approved', true)
    .gte('date', from)
    .lte('date', to);

  // Look up hourly rates for trainers referenced in time reports
  const trainerUserIds = [...new Set((timeReports ?? []).map(r => r.user_id))];
  const trainerRateMap = new Map<string, { defaultRate: number; rates: Record<string, number> }>();
  if (trainerUserIds.length > 0) {
    const { data: trainers } = await supabase
      .from('users')
      .select('id, trainer_hourly_rate, trainer_rates')
      .in('id', trainerUserIds);
    for (const trainer of trainers ?? []) {
      trainerRateMap.set(trainer.id, {
        defaultRate: Number(trainer.trainer_hourly_rate ?? 0),
        rates: parseRateMap(trainer.trainer_rates),
      });
    }
  }

  const trainerCosts = (timeReports ?? []).reduce((sum, r) => {
    const config = trainerRateMap.get(r.user_id) ?? { defaultRate: 0, rates: {} };
    const category = categoryFromReport(r);
    const rate = Number(config.rates[category] ?? config.defaultRate);
    return sum + (Number(r.hours ?? 0) * rate);
  }, 0);

  // Platform fees: sum of platform_fee from bookings in range
  const platformFees = (bookings ?? []).reduce((s, b) => s + (Number(b.platform_fee ?? 0)), 0);

  const profit = total - trainerCosts - platformFees;

  // Period comparison: same length period before 'from'
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const periodDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
  const prevTo = new Date(fromDate.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (periodDays - 1) * 86400000);

  const { data: prevBookings } = await supabase.from('bookings')
    .select('total_price')
    .in('court_id', courtIds).eq('status', 'confirmed')
    .gte('time_slot_start', prevFrom.toISOString().split('T')[0] + 'T00:00:00')
    .lte('time_slot_start', prevTo.toISOString().split('T')[0] + 'T23:59:59');

  const prevTotal = (prevBookings ?? []).reduce((s, b) => s + (b.total_price ?? 0), 0);
  const prevBookingCount = prevBookings?.length ?? 0;
  const changePercent = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

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
      comparison: {
        prevTotal: Number(prevTotal.toFixed(2)),
        prevBookingCount,
        changePercent,
        prevPeriod: `${prevFrom.toISOString().split('T')[0]} – ${prevTo.toISOString().split('T')[0]}`,
      },
    },
  });
}
