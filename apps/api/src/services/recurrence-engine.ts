/**
 * Recurrence engine — the heart of the unified scheduling system.
 *
 * Takes a RecurrenceRuleRow and a date window, returns the concrete
 * (date, start, end) instances the rule would generate, with conflicts and
 * blackouts separated from materializable slots. `materialize` commits the
 * materializable slots as bookings, tagged with a shared generation_batch_id
 * so "undo last apply" is a single lookup.
 *
 * Only local-date arithmetic is used — the engine is agnostic to timezone;
 * the caller decides how to render a given day. This keeps DST edge cases
 * out of the core logic (the day-of-week check is the only operation that
 * could shift under TZ, and it's done on an explicit local date string).
 */
import crypto from 'crypto';
import { store, RecurrenceRuleRow, BlackoutPeriodRow } from '../store.js';

export interface ExpandedInstance {
  date: string;           // YYYY-MM-DD (local date)
  start_iso: string;      // full ISO timestamp for booking creation
  end_iso: string;
  start_hour: number;
  end_hour: number;
  court_id: string;
}

export interface PreviewResult {
  rule_id: string;
  instances: ExpandedInstance[];      // eligible for materialization (no conflict / blackout)
  conflicts: Array<ExpandedInstance & { conflicting_booking_id: string }>;
  blackouts: Array<ExpandedInstance & { blackout_id: string; reason: string | null }>;
  skipped_dates: string[];            // from rule.skip_dates that fell in range
}

export interface MaterializeResult {
  rule_id: string;
  batch_id: string;
  created: number;
  created_booking_ids: string[];
  conflicts: PreviewResult['conflicts'];
  blackouts: PreviewResult['blackouts'];
  skipped_dates: string[];
}

// ─── Date utilities (local, string-based to dodge TZ drift) ───

/** Returns YYYY-MM-DD for a Date in the local timezone */
export function toLocalDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Parse YYYY-MM-DD as local midnight (not UTC) */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Combine YYYY-MM-DD + hour (local) into an ISO timestamp */
export function dateWithHour(dateStr: string, hour: number): string {
  const d = parseLocalDate(dateStr);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function addMonths(d: Date, n: number): Date {
  const c = new Date(d);
  c.setMonth(c.getMonth() + n);
  return c;
}

// ─── Core expansion ────────────────────────────────────────────

/**
 * Expand a rule into all (date, hours) instances that fall within [fromDate, toDate]
 * inclusive. Respects rule.start_date, rule.end_date, rule.skip_dates.
 * Does NOT check conflicts or blackouts — that's the caller's job (see preview()).
 */
export function expandRule(
  rule: RecurrenceRuleRow,
  fromDate: string,
  toDate: string,
): ExpandedInstance[] {
  const winStart = parseLocalDate(fromDate);
  const winEnd = parseLocalDate(toDate);
  const ruleStart = parseLocalDate(rule.start_date);
  const ruleEnd = rule.end_date ? parseLocalDate(rule.end_date) : null;

  // Clamp the iteration window to the rule's lifespan
  const iterStart = winStart < ruleStart ? ruleStart : winStart;
  const iterEnd = ruleEnd && ruleEnd < winEnd ? ruleEnd : winEnd;
  if (iterStart > iterEnd) return [];

  const skip = new Set(rule.skip_dates);
  const weekdays = new Set(rule.weekdays);

  const out: ExpandedInstance[] = [];

  const push = (d: Date) => {
    const ds = toLocalDateStr(d);
    if (skip.has(ds)) return;
    out.push({
      date: ds,
      start_iso: dateWithHour(ds, rule.start_hour),
      end_iso: dateWithHour(ds, rule.end_hour),
      start_hour: rule.start_hour,
      end_hour: rule.end_hour,
      court_id: rule.court_id,
    });
  };

  switch (rule.freq) {
    case 'once': {
      if (ruleStart >= iterStart && ruleStart <= iterEnd && !skip.has(rule.start_date)) {
        push(ruleStart);
      }
      break;
    }
    case 'weekly':
    case 'biweekly': {
      const weekStride = (rule.freq === 'biweekly' ? 2 : 1) * Math.max(1, rule.interval_n);
      // Anchor to the ISO week that contains rule.start_date (Sunday 0 .. Saturday 6)
      // We iterate week-by-week; within each "on" week, emit every matching weekday.
      // "On" weeks are those where (weeksSinceAnchor % weekStride === 0).
      const anchor = new Date(ruleStart);
      anchor.setDate(anchor.getDate() - anchor.getDay()); // back to Sunday of rule's start week

      for (let cursor = new Date(anchor); cursor <= iterEnd; cursor = addDays(cursor, 7)) {
        const weeksSince = Math.round((cursor.getTime() - anchor.getTime()) / (7 * 86_400_000));
        if (weeksSince % weekStride !== 0) continue;
        for (let dow = 0; dow < 7; dow++) {
          if (!weekdays.has(dow)) continue;
          const day = addDays(cursor, dow);
          if (day < iterStart || day > iterEnd) continue;
          if (day < ruleStart) continue;
          push(day);
        }
      }
      break;
    }
    case 'monthly': {
      // Monthly = same day-of-month as start_date, repeating every interval_n months.
      // If rule.weekdays is non-empty, interpret as "Nth weekday of the month"
      // where N is derived from start_date. (Keeping the simple case for now:
      // plain day-of-month; we can extend to Nth-weekday later without schema change.)
      const stride = Math.max(1, rule.interval_n);
      let cursor = new Date(ruleStart);
      while (cursor <= iterEnd) {
        if (cursor >= iterStart) push(cursor);
        cursor = addMonths(cursor, stride);
      }
      break;
    }
  }

  return out.sort((a, b) => a.start_iso.localeCompare(b.start_iso));
}

// ─── Blackout / conflict resolution ────────────────────────────

/** Is a blackout period active for the given court at the given ISO window? */
function blackoutCovers(bp: BlackoutPeriodRow, courtId: string, startIso: string, endIso: string): boolean {
  if (bp.court_ids.length > 0 && !bp.court_ids.includes(courtId)) return false;
  // Temporal overlap: [bp.starts_at, bp.ends_at) overlaps [startIso, endIso)
  return new Date(bp.starts_at) < new Date(endIso) && new Date(bp.ends_at) > new Date(startIso);
}

/** Classify expanded instances into materializable / conflicting / blacked-out. */
export function preview(rule: RecurrenceRuleRow, fromDate: string, toDate: string): PreviewResult {
  const expanded = expandRule(rule, fromDate, toDate);

  // Pre-filter blackouts by club to cut work on large stores
  const clubBlackouts = store.blackoutPeriods.filter(bp => bp.club_id === rule.club_id);

  const instances: ExpandedInstance[] = [];
  const conflicts: PreviewResult['conflicts'] = [];
  const blackouts: PreviewResult['blackouts'] = [];

  for (const inst of expanded) {
    // 1. Blackout check first (closures win over conflicts — they're the reason no booking can exist there)
    const bp = clubBlackouts.find(b => blackoutCovers(b, inst.court_id, inst.start_iso, inst.end_iso));
    if (bp) {
      blackouts.push({ ...inst, blackout_id: bp.id, reason: bp.reason });
      continue;
    }

    // 2. Existing booking overlap (ignoring cancelled) — mirrors the DB's EXCLUDE constraint
    const clash = store.bookings.find(b =>
      b.court_id === inst.court_id &&
      b.status !== 'cancelled' &&
      new Date(b.time_slot_start) < new Date(inst.end_iso) &&
      new Date(b.time_slot_end) > new Date(inst.start_iso),
    );
    if (clash) {
      conflicts.push({ ...inst, conflicting_booking_id: clash.id });
      continue;
    }

    instances.push(inst);
  }

  // Skip-dates that fell in the window (just for reporting; they're already filtered out)
  const winStart = parseLocalDate(fromDate);
  const winEnd = parseLocalDate(toDate);
  const skipped_dates = rule.skip_dates.filter(sd => {
    const d = parseLocalDate(sd);
    return d >= winStart && d <= winEnd;
  });

  return { rule_id: rule.id, instances, conflicts, blackouts, skipped_dates };
}

// ─── Materialize (commit preview to bookings) ───────────────────

export interface MaterializeOpts {
  /** Pricing hook — engine doesn't know rates, caller computes totalPrice per instance. */
  priceFor(instance: ExpandedInstance, rule: RecurrenceRuleRow): {
    total_price: number;
    platform_fee: number;
    court_rental_vat_rate: number;
  };
  /** Who is recorded as the booker on generated bookings (default: rule.created_by or 'admin'). */
  booker_id?: string;
  /** Optional PIN generator */
  access_pin?: () => string;
  /**
   * Override the generated batch_id. Useful when one apply-to-period call spans
   * multiple rules and the caller wants a single undoBatch target.
   */
  batch_id?: string;
}

/**
 * Commit the materializable instances of a rule into `store.bookings`.
 * Every booking created in one call shares a generation_batch_id so the caller
 * can offer "undo last apply" later by soft-cancelling that batch.
 */
export function materialize(
  rule: RecurrenceRuleRow,
  fromDate: string,
  toDate: string,
  opts: MaterializeOpts,
): MaterializeResult {
  const pv = preview(rule, fromDate, toDate);
  const batch_id = opts.batch_id ?? crypto.randomUUID();
  const booker_id = opts.booker_id ?? rule.created_by ?? 'admin';

  const created_booking_ids: string[] = [];

  for (const inst of pv.instances) {
    const price = opts.priceFor(inst, rule);
    try {
      const booking = store.createBooking({
        court_id: inst.court_id,
        booker_id,
        time_slot_start: inst.start_iso,
        time_slot_end: inst.end_iso,
        status: 'confirmed',
        total_price: price.total_price,
        platform_fee: price.platform_fee,
        court_rental_vat_rate: price.court_rental_vat_rate,
        access_pin: opts.access_pin?.() ?? null,
        booking_type: rule.booking_type,
        trainer_id: rule.trainer_id,
        player_ids: rule.player_ids,
        event_name: rule.event_name,
        event_max_participants: rule.event_max_participants,
        notes: rule.notes,
        recurrence_rule_id: rule.id,
        generation_batch_id: batch_id,
      });
      created_booking_ids.push(booking.id);

      // Seed attendance rows for training / event rosters so RSVP and waitlist
      // state have somewhere to live from the moment the booking is created.
      if (rule.booking_type === 'training' || rule.booking_type === 'event') {
        for (const uid of rule.player_ids) {
          store.upsertAttendance({
            booking_id: booking.id,
            user_id: uid,
            status: 'invited',
          });
        }
      }
    } catch (err) {
      // If createBooking throws (e.g. race with another batch), classify as conflict.
      pv.conflicts.push({ ...inst, conflicting_booking_id: '(concurrent)' });
    }
  }

  return {
    rule_id: rule.id,
    batch_id,
    created: created_booking_ids.length,
    created_booking_ids,
    conflicts: pv.conflicts,
    blackouts: pv.blackouts,
    skipped_dates: pv.skipped_dates,
  };
}

// ─── Undo (soft-cancel a batch) ────────────────────────────────

export function undoBatch(batchId: string, reason = 'Apply batch rolled back'): number {
  let n = 0;
  for (const b of store.bookings) {
    if (b.generation_batch_id === batchId && b.status !== 'cancelled') {
      b.status = 'cancelled';
      b.cancellation_reason = reason;
      b.updated_at = new Date().toISOString();
      n++;
    }
  }
  return n;
}

// ─── Availability query ─────────────────────────────────────────

export interface AvailabilitySlot {
  court_id: string;
  start_iso: string;
  end_iso: string;
  start_hour: number;
  end_hour: number;
  date: string;
}

/**
 * For a club + date window + slot duration (hours), return every (court, hour-aligned)
 * slot that is:
 *   - inside the club's opening hours (assumed 07:00–22:00 until venueProfiles are wired in)
 *   - not overlapping an active booking
 *   - not inside a blackout period
 *
 * Duration defaults to 1 hour. Returns slots in chronological order.
 */
export function availability(
  clubId: string,
  fromDate: string,
  toDate: string,
  durationHours = 1,
  openHour = 7,
  closeHour = 22,
): AvailabilitySlot[] {
  const courts = store.courts.filter(c => c.club_id === clubId && c.is_active);
  if (courts.length === 0) return [];
  const clubBlackouts = store.blackoutPeriods.filter(bp => bp.club_id === clubId);

  const out: AvailabilitySlot[] = [];
  const from = parseLocalDate(fromDate);
  const to = parseLocalDate(toDate);

  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const dateStr = toLocalDateStr(d);
    for (const court of courts) {
      const courtBookings = store.bookings.filter(b =>
        b.court_id === court.id &&
        b.status !== 'cancelled' &&
        new Date(b.time_slot_start).toDateString() === d.toDateString(),
      );
      for (let h = openHour; h + durationHours <= closeHour; h++) {
        const startIso = dateWithHour(dateStr, h);
        const endIso = dateWithHour(dateStr, h + durationHours);

        if (clubBlackouts.some(bp => blackoutCovers(bp, court.id, startIso, endIso))) continue;

        const clash = courtBookings.some(b =>
          new Date(b.time_slot_start) < new Date(endIso) &&
          new Date(b.time_slot_end) > new Date(startIso),
        );
        if (clash) continue;

        out.push({
          court_id: court.id,
          start_iso: startIso,
          end_iso: endIso,
          start_hour: h,
          end_hour: h + durationHours,
          date: dateStr,
        });
      }
    }
  }

  return out;
}
