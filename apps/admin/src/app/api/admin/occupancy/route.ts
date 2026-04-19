/**
 * GET /api/admin/occupancy?clubId=&from=&to=
 * Occupancy heatmap: courts × hours, colored by booking density over the range.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const clubId = p.get('clubId');
  if (!clubId) return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });

  const now = new Date();
  const from = p.get('from') ?? new Date(now.getTime() - 28 * 86400000).toISOString().split('T')[0];
  const to = p.get('to') ?? now.toISOString().split('T')[0];

  const supabase = createSupabaseAdminClient();

  const { data: courts } = await supabase.from('courts').select('id, name').eq('club_id', clubId).eq('is_active', true).order('name');
  const courtIds = (courts ?? []).map(c => c.id);

  if (courtIds.length === 0) return NextResponse.json({ success: true, data: { courts: [], heatmap: [], days: 0 } });

  const { data: bookings } = await supabase.from('bookings')
    .select('court_id, time_slot_start, time_slot_end')
    .in('court_id', courtIds).neq('status', 'cancelled')
    .gte('time_slot_start', from + 'T00:00:00').lte('time_slot_start', to + 'T23:59:59');

  // Count how many days are in the range
  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);

  // Build heatmap: for each (court, hour), count how many bookings covered that hour
  const OPEN = 7, CLOSE = 22;
  const heatmap: { court_id: string; court_name: string; hour: number; count: number; percentage: number }[] = [];

  for (const court of (courts ?? [])) {
    for (let h = OPEN; h < CLOSE; h++) {
      const count = (bookings ?? []).filter(b => {
        if (b.court_id !== court.id) return false;
        const startH = new Date(b.time_slot_start).getHours();
        const endH = new Date(b.time_slot_end).getHours();
        return h >= startH && h < endH;
      }).length;
      heatmap.push({
        court_id: court.id,
        court_name: court.name,
        hour: h,
        count,
        percentage: Math.round((count / days) * 100),
      });
    }
  }

  // Overall occupancy
  const totalSlots = courtIds.length * (CLOSE - OPEN) * days;
  const totalBooked = heatmap.reduce((s, h) => s + h.count, 0);
  const overallOccupancy = totalSlots > 0 ? Math.round((totalBooked / totalSlots) * 100) : 0;

  // Peak / dead hours
  const hourTotals = new Map<number, number>();
  heatmap.forEach(h => hourTotals.set(h.hour, (hourTotals.get(h.hour) ?? 0) + h.percentage));
  const hourAvgs = Array.from(hourTotals.entries()).map(([hour, total]) => ({ hour, avg: Math.round(total / courtIds.length) })).sort((a, b) => b.avg - a.avg);
  const peakHours = hourAvgs.filter(h => h.avg >= 60).map(h => h.hour);
  const deadHours = hourAvgs.filter(h => h.avg <= 20).map(h => h.hour);

  return NextResponse.json({
    success: true,
    data: {
      courts: (courts ?? []).map(c => ({ id: c.id, name: c.name })),
      heatmap,
      days,
      overall_occupancy: overallOccupancy,
      peak_hours: peakHours,
      dead_hours: deadHours,
      suggestions: [
        ...deadHours.map(h => `${String(h).padStart(2, '0')}:00 har bara ${hourAvgs.find(a => a.hour === h)?.avg}% beläggning — överväg Happy Hour-pris`),
        ...peakHours.map(h => `${String(h).padStart(2, '0')}:00 har ${hourAvgs.find(a => a.hour === h)?.avg}% beläggning — överväg höjt pris`),
      ],
    },
  });
}
