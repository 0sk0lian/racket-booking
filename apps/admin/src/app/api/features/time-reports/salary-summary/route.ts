import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../../lib/auth/guards';

function parseRateMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(val);
    if (Number.isFinite(n) && n >= 0) out[key] = n;
  }
  return out;
}

function categoryFromDescription(description: string | null | undefined, fallback: string) {
  if (!description) return fallback;
  const match = description.match(/\[cat:([a-zA-Z0-9_-]+)\]/);
  return match?.[1] ?? fallback;
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const clubId = request.nextUrl.searchParams.get('clubId');
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  if (!userId || !clubId || !from || !to) {
    return NextResponse.json({ success: false, error: 'userId, clubId, from and to are required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();
  const { data: trainer } = await supabase
    .from('users')
    .select('id, full_name, trainer_hourly_rate, trainer_monthly_salary, trainer_rates')
    .eq('id', userId)
    .single();
  if (!trainer) return NextResponse.json({ success: false, error: 'Trainer not found' }, { status: 404 });

  const { data: reports, error } = await supabase
    .from('time_reports')
    .select('id, hours, type, description, approved, date')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const defaultRate = Number(trainer.trainer_hourly_rate ?? 0);
  const rateMap = parseRateMap(trainer.trainer_rates);

  const breakdownMap = new Map<string, { category: string; hours: number; count: number; rate: number; pay: number }>();
  for (const report of reports ?? []) {
    const category = categoryFromDescription(report.description, report.type ?? 'other');
    const hours = Number(report.hours ?? 0);
    const rate = Number(rateMap[category] ?? defaultRate ?? 0);
    const pay = Number((hours * rate).toFixed(2));

    const prev = breakdownMap.get(category);
    if (prev) {
      prev.hours = Number((prev.hours + hours).toFixed(2));
      prev.count += 1;
      prev.pay = Number((prev.pay + pay).toFixed(2));
      prev.rate = rate;
    } else {
      breakdownMap.set(category, { category, hours, count: 1, rate, pay });
    }
  }

  const breakdown = [...breakdownMap.values()].sort((a, b) => a.category.localeCompare(b.category));
  const totalHours = breakdown.reduce((sum, row) => sum + row.hours, 0);
  const totalPay = breakdown.reduce((sum, row) => sum + row.pay, 0);

  return NextResponse.json({
    success: true,
    data: {
      trainer: {
        id: trainer.id,
        name: trainer.full_name,
        hourlyRate: defaultRate,
        monthlySalary: trainer.trainer_monthly_salary ?? null,
        rates: rateMap,
      },
      totalHours: Number(totalHours.toFixed(2)),
      totalPay: Number(totalPay.toFixed(2)),
      reportCount: (reports ?? []).length,
      breakdown,
    },
  });
}
