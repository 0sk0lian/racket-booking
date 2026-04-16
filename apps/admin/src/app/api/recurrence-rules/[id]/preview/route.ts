/**
 * POST /api/recurrence-rules/:id/preview?from=&to=
 * Dry-run: returns per-date instances, conflicts, blackouts, skipped dates.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';

// Simple date math helpers
function parseLocal(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function toStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function dateHour(dateStr: string, h: number) { const d = parseLocal(dateStr); d.setHours(h, 0, 0, 0); return d.toISOString(); }

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: rule, error } = await supabase.from('recurrence_rules').select('*').eq('id', id).single();
  if (error || !rule) return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const from = request.nextUrl.searchParams.get('from') ?? body.from ?? rule.start_date;
  const to = request.nextUrl.searchParams.get('to') ?? body.to ?? rule.end_date ?? rule.start_date;

  // Expand rule into dates
  const instances: any[] = [];
  const skipSet = new Set(rule.skip_dates ?? []);
  const weekdays = new Set(rule.weekdays ?? []);
  const ruleStart = parseLocal(rule.start_date);
  const ruleEnd = rule.end_date ? parseLocal(rule.end_date) : null;
  const winStart = parseLocal(from) < ruleStart ? ruleStart : parseLocal(from);
  const winEnd = ruleEnd && ruleEnd < parseLocal(to) ? ruleEnd : parseLocal(to);

  if (rule.freq === 'once') {
    if (ruleStart >= winStart && ruleStart <= winEnd && !skipSet.has(rule.start_date)) {
      instances.push({ date: rule.start_date, start_iso: dateHour(rule.start_date, rule.start_hour), end_iso: dateHour(rule.start_date, rule.end_hour), start_hour: rule.start_hour, end_hour: rule.end_hour, court_id: rule.court_id });
    }
  } else {
    const stride = rule.freq === 'biweekly' ? 2 : 1;
    const anchor = new Date(ruleStart);
    anchor.setDate(anchor.getDate() - anchor.getDay());
    for (let cursor = new Date(anchor); cursor <= winEnd; cursor = addDays(cursor, 7)) {
      const weeksSince = Math.round((cursor.getTime() - anchor.getTime()) / (7 * 86400000));
      if (weeksSince % stride !== 0) continue;
      for (let dow = 0; dow < 7; dow++) {
        if (!weekdays.has(dow)) continue;
        const day = addDays(cursor, dow);
        if (day < winStart || day > winEnd || day < ruleStart) continue;
        const ds = toStr(day);
        if (skipSet.has(ds)) continue;
        instances.push({ date: ds, start_iso: dateHour(ds, rule.start_hour), end_iso: dateHour(ds, rule.end_hour), start_hour: rule.start_hour, end_hour: rule.end_hour, court_id: rule.court_id });
      }
    }
  }

  // Check conflicts + blackouts
  const { data: bookings } = await supabase.from('bookings').select('id, court_id, time_slot_start, time_slot_end')
    .eq('court_id', rule.court_id).neq('status', 'cancelled')
    .gte('time_slot_start', dateHour(from, 0)).lte('time_slot_end', dateHour(to, 23));
  const { data: blackouts } = await supabase.from('blackout_periods').select('id, starts_at, ends_at, reason, court_ids')
    .eq('club_id', rule.club_id).lt('starts_at', dateHour(to, 23)).gt('ends_at', dateHour(from, 0));

  const good: any[] = [], conflicts: any[] = [], blacked: any[] = [];
  for (const inst of instances) {
    const bp = (blackouts ?? []).find(b => {
      if ((b.court_ids ?? []).length > 0 && !(b.court_ids ?? []).includes(inst.court_id)) return false;
      return new Date(b.starts_at) < new Date(inst.end_iso) && new Date(b.ends_at) > new Date(inst.start_iso);
    });
    if (bp) { blacked.push({ ...inst, blackout_id: bp.id, reason: bp.reason }); continue; }
    const clash = (bookings ?? []).find(b => b.court_id === inst.court_id && new Date(b.time_slot_start) < new Date(inst.end_iso) && new Date(b.time_slot_end) > new Date(inst.start_iso));
    if (clash) { conflicts.push({ ...inst, conflicting_booking_id: clash.id }); continue; }
    good.push(inst);
  }

  const skippedInRange = (rule.skip_dates ?? []).filter((sd: string) => { const d = parseLocal(sd); return d >= winStart && d <= winEnd; });

  return NextResponse.json({ success: true, data: { rule_id: id, instances: good, conflicts, blackouts: blacked, skipped_dates: skippedInRange } });
}
