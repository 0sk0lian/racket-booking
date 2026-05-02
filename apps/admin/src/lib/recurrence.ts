import { createSupabaseAdminClient } from './supabase/server';

function parseLocal(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dateHour(dateStr: string, hour: number) {
  const date = parseLocal(dateStr);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

export type RecurrencePreviewResult = {
  rule_id: string;
  instances: Array<{
    date: string;
    start_iso: string;
    end_iso: string;
    start_hour: number;
    end_hour: number;
    court_id: string;
  }>;
  conflicts: Array<{
    date: string;
    start_iso: string;
    end_iso: string;
    start_hour: number;
    end_hour: number;
    court_id: string;
    conflicting_booking_id: string;
  }>;
  blackouts: Array<{
    date: string;
    start_iso: string;
    end_iso: string;
    start_hour: number;
    end_hour: number;
    court_id: string;
    blackout_id: string;
    reason: string | null;
  }>;
  skipped_dates: string[];
};

export async function buildRecurrencePreview(
  rule: any,
  options?: { from?: string | null; to?: string | null },
  supabase = createSupabaseAdminClient(),
): Promise<RecurrencePreviewResult> {
  const from = options?.from ?? rule.start_date;
  const to = options?.to ?? rule.end_date ?? rule.start_date;

  const instances: RecurrencePreviewResult['instances'] = [];
  const skipSet = new Set(rule.skip_dates ?? []);
  const weekdays = new Set(rule.weekdays ?? []);
  const ruleStart = parseLocal(rule.start_date);
  const ruleEnd = rule.end_date ? parseLocal(rule.end_date) : null;
  const windowStart = parseLocal(from) < ruleStart ? ruleStart : parseLocal(from);
  const windowEnd = ruleEnd && ruleEnd < parseLocal(to) ? ruleEnd : parseLocal(to);

  if (rule.freq === 'once') {
    if (ruleStart >= windowStart && ruleStart <= windowEnd && !skipSet.has(rule.start_date)) {
      instances.push({
        date: rule.start_date,
        start_iso: dateHour(rule.start_date, rule.start_hour),
        end_iso: dateHour(rule.start_date, rule.end_hour),
        start_hour: rule.start_hour,
        end_hour: rule.end_hour,
        court_id: rule.court_id,
      });
    }
  } else {
    const stride = rule.freq === 'biweekly' ? 2 : 1;
    const anchor = new Date(ruleStart);
    anchor.setDate(anchor.getDate() - anchor.getDay());

    for (let cursor = new Date(anchor); cursor <= windowEnd; cursor = addDays(cursor, 7)) {
      const weeksSince = Math.round((cursor.getTime() - anchor.getTime()) / (7 * 86400000));
      if (weeksSince % stride !== 0) continue;

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        if (!weekdays.has(dayOfWeek)) continue;
        const day = addDays(cursor, dayOfWeek);
        if (day < windowStart || day > windowEnd || day < ruleStart) continue;

        const dateStr = toDateString(day);
        if (skipSet.has(dateStr)) continue;

        instances.push({
          date: dateStr,
          start_iso: dateHour(dateStr, rule.start_hour),
          end_iso: dateHour(dateStr, rule.end_hour),
          start_hour: rule.start_hour,
          end_hour: rule.end_hour,
          court_id: rule.court_id,
        });
      }
    }
  }

  const [{ data: bookings }, { data: blackouts }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, court_id, time_slot_start, time_slot_end')
      .eq('court_id', rule.court_id)
      .neq('status', 'cancelled')
      .gte('time_slot_start', dateHour(from, 0))
      .lte('time_slot_end', dateHour(to, 23)),
    supabase
      .from('blackout_periods')
      .select('id, starts_at, ends_at, reason, court_ids')
      .eq('club_id', rule.club_id)
      .lt('starts_at', dateHour(to, 23))
      .gt('ends_at', dateHour(from, 0)),
  ]);

  const available: RecurrencePreviewResult['instances'] = [];
  const conflicts: RecurrencePreviewResult['conflicts'] = [];
  const blocked: RecurrencePreviewResult['blackouts'] = [];

  for (const instance of instances) {
    const blackout = (blackouts ?? []).find((entry) => {
      if ((entry.court_ids ?? []).length > 0 && !(entry.court_ids ?? []).includes(instance.court_id)) return false;
      return new Date(entry.starts_at) < new Date(instance.end_iso) && new Date(entry.ends_at) > new Date(instance.start_iso);
    });

    if (blackout) {
      blocked.push({ ...instance, blackout_id: blackout.id, reason: blackout.reason ?? null });
      continue;
    }

    const booking = (bookings ?? []).find((entry) => (
      entry.court_id === instance.court_id &&
      new Date(entry.time_slot_start) < new Date(instance.end_iso) &&
      new Date(entry.time_slot_end) > new Date(instance.start_iso)
    ));

    if (booking) {
      conflicts.push({ ...instance, conflicting_booking_id: booking.id });
      continue;
    }

    available.push(instance);
  }

  const skippedInRange = (rule.skip_dates ?? []).filter((dateStr: string) => {
    const date = parseLocal(dateStr);
    return date >= windowStart && date <= windowEnd;
  });

  return {
    rule_id: rule.id,
    instances: available,
    conflicts,
    blackouts: blocked,
    skipped_dates: skippedInRange,
  };
}
