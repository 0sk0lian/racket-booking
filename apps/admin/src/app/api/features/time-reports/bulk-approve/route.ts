/**
 * POST /api/features/time-reports/bulk-approve
 *
 * Bulk approve time reports for a trainer for a given month.
 * Body: { trainerId, clubId, month (YYYY-MM) }
 * Returns: { approved: count, totalHours, totalPay }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';

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

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json();
  const { trainerId, clubId, month } = body;

  if (!trainerId || !clubId || !month) {
    return NextResponse.json(
      { success: false, error: 'trainerId, clubId, and month (YYYY-MM) are required' },
      { status: 400 },
    );
  }

  // Validate month format
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { success: false, error: 'month must be in YYYY-MM format' },
      { status: 400 },
    );
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();

  // Calculate date range for the month
  const startDate = `${month}-01`;
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10);
  // Last day of the month
  const lastDay = new Date(year, mon, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  // Find all unapproved time reports for this trainer in this month and club
  const { data: reports, error: fetchErr } = await supabase
    .from('time_reports')
    .select('id, hours, type, description')
    .eq('user_id', trainerId)
    .eq('club_id', clubId)
    .eq('approved', false)
    .gte('date', startDate)
    .lte('date', endDate);

  if (fetchErr) {
    return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
  }

  if (!reports || reports.length === 0) {
    return NextResponse.json({
      success: true,
      data: { approved: 0, totalHours: 0, totalPay: 0 },
    });
  }

  const ids = reports.map((r) => r.id);

  // Bulk approve
  const { error: updateErr } = await supabase
    .from('time_reports')
    .update({ approved: true })
    .in('id', ids);

  if (updateErr) {
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
  }

  const totalHours = reports.reduce((sum, r) => sum + Number(r.hours ?? 0), 0);

  // Use the current trainer fields on public.users, including per-category overrides.
  const { data: trainer } = await supabase
    .from('users')
    .select('trainer_hourly_rate, trainer_rates')
    .eq('id', trainerId)
    .maybeSingle();

  const defaultRate = Number(trainer?.trainer_hourly_rate ?? 0);
  const rateMap = parseRateMap(trainer?.trainer_rates);
  const totalPay = Number((reports ?? []).reduce((sum, report) => {
    const hours = Number(report.hours ?? 0);
    const category = categoryFromReport(report);
    const rate = Number(rateMap[category] ?? defaultRate);
    return sum + (hours * rate);
  }, 0).toFixed(2));

  return NextResponse.json({
    success: true,
    data: {
      approved: reports.length,
      totalHours: Number(totalHours.toFixed(2)),
      totalPay,
    },
  });
}
