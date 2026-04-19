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
    .select('id, hours')
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

  // Look up trainer's hourly rate from trainers table
  const { data: trainer } = await supabase
    .from('trainers')
    .select('hourly_rate')
    .eq('user_id', trainerId)
    .maybeSingle();

  const hourlyRate = Number(trainer?.hourly_rate ?? 0);
  const totalPay = Number((totalHours * hourlyRate).toFixed(2));

  return NextResponse.json({
    success: true,
    data: {
      approved: reports.length,
      totalHours: Number(totalHours.toFixed(2)),
      totalPay,
    },
  });
}
