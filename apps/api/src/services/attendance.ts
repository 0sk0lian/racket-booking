/**
 * Attendance service — RSVP state transitions + waitlist auto-promotion.
 *
 * The transitional state machine has 6 statuses:
 *   invited → going / declined / waitlist
 *   going   → declined            (frees a slot — auto-promote first waitlist)
 *   any     → present / no_show   (post-session check-in by trainer)
 *
 * Waitlist ordering is by `waitlist_position` (smallest = next up). When a
 * player goes from `going` to `declined`, the earliest waitlisted entry is
 * promoted to `going` and notified (caller's job to wire push notifications).
 *
 * Capacity rules:
 *   - Training: capped by rule.player_ids.length OR booking.player_ids.length
 *     (the original roster size). When admin adds someone beyond capacity, they
 *     land on waitlist.
 *   - Event: capped by booking.event_max_participants.
 *
 * The booking's legacy `player_ids` / `event_attendee_ids` arrays stay in sync
 * with attendance for now so old UI keeps working — they're a denormalized
 * cache of "who's currently going".
 */
import { store, AttendanceRow } from '../store.js';

export type RsvpStatus = AttendanceRow['status'];

export interface PromotionResult {
  promoted: AttendanceRow | null;
}

/** Capacity for a given booking, considering type. Returns `null` if uncapped. */
function capacityFor(bookingId: string): number | null {
  const b = store.bookings.find(x => x.id === bookingId);
  if (!b) return 0;
  if (b.booking_type === 'event') return b.event_max_participants ?? null;
  if (b.booking_type === 'training') return b.player_ids.length || null;
  return null;
}

/** Count of attendance rows currently in `going` for a booking. */
function goingCount(bookingId: string): number {
  return store.attendance.filter(a => a.booking_id === bookingId && a.status === 'going').length;
}

/** Next-up waitlist row (smallest position; falls back to earliest created). */
function nextWaitlist(bookingId: string): AttendanceRow | undefined {
  return store.attendance
    .filter(a => a.booking_id === bookingId && a.status === 'waitlist')
    .sort((a, b) => {
      const ap = a.waitlist_position ?? Number.POSITIVE_INFINITY;
      const bp = b.waitlist_position ?? Number.POSITIVE_INFINITY;
      if (ap !== bp) return ap - bp;
      return a.created_at.localeCompare(b.created_at);
    })[0];
}

/** Re-pack waitlist positions so first-in-line is always position 1. */
function repackWaitlist(bookingId: string): void {
  const list = store.attendance
    .filter(a => a.booking_id === bookingId && a.status === 'waitlist')
    .sort((a, b) => {
      const ap = a.waitlist_position ?? Number.POSITIVE_INFINITY;
      const bp = b.waitlist_position ?? Number.POSITIVE_INFINITY;
      if (ap !== bp) return ap - bp;
      return a.created_at.localeCompare(b.created_at);
    });
  list.forEach((r, i) => { r.waitlist_position = i + 1; });
}

/** Sync the booking's denormalized arrays so legacy UI keeps showing the right roster. */
function syncBookingCaches(bookingId: string): void {
  const b = store.bookings.find(x => x.id === bookingId);
  if (!b) return;
  const going = store.attendance.filter(a => a.booking_id === bookingId && a.status === 'going').map(a => a.user_id);
  if (b.booking_type === 'event') {
    b.event_attendee_ids = going;
  } else if (b.booking_type === 'training') {
    // For training, player_ids represents the assigned roster (going + invited + waitlist).
    // We leave it untouched on RSVP changes and only adjust when admin explicitly adds/removes.
  }
  b.updated_at = new Date().toISOString();
}

/**
 * Set the status for (booking, user). Returns the upserted row + any auto-promoted row.
 * Caller is responsible for verifying the user has rights to change this state.
 */
export function setStatus(
  bookingId: string,
  userId: string,
  newStatus: RsvpStatus,
  meta?: { checked_in_by?: string },
): { row: AttendanceRow; promotion: PromotionResult } {
  const existing = store.attendance.find(a => a.booking_id === bookingId && a.user_id === userId);
  const wasGoing = existing?.status === 'going';
  const now = new Date().toISOString();

  // Capacity gate: switching to `going` when full bumps to `waitlist` instead.
  let effectiveStatus = newStatus;
  if (newStatus === 'going') {
    const cap = capacityFor(bookingId);
    if (cap != null && goingCount(bookingId) >= cap && (!existing || existing.status !== 'going')) {
      effectiveStatus = 'waitlist';
    }
  }

  // Position assignment when entering waitlist
  let waitlistPosition: number | null | undefined = existing?.waitlist_position;
  if (effectiveStatus === 'waitlist' && (!existing || existing.status !== 'waitlist')) {
    const max = store.attendance
      .filter(a => a.booking_id === bookingId && a.status === 'waitlist')
      .reduce((m, a) => Math.max(m, a.waitlist_position ?? 0), 0);
    waitlistPosition = max + 1;
  }
  if (effectiveStatus !== 'waitlist') waitlistPosition = null;

  const row = store.upsertAttendance({
    booking_id: bookingId,
    user_id: userId,
    status: effectiveStatus,
    responded_at: ['going', 'declined', 'waitlist'].includes(effectiveStatus) ? now : undefined,
    checked_in_at: ['present', 'no_show'].includes(effectiveStatus) ? now : undefined,
    checked_in_by: meta?.checked_in_by,
    waitlist_position: waitlistPosition,
  });

  let promotion: PromotionResult = { promoted: null };

  // Auto-promote if a `going` slot just opened up
  if (wasGoing && effectiveStatus !== 'going') {
    const next = nextWaitlist(bookingId);
    if (next) {
      next.status = 'going';
      next.waitlist_position = null;
      next.responded_at = now;
      next.updated_at = now;
      repackWaitlist(bookingId);
      promotion.promoted = next;
    }
  }

  // If we just left waitlist, repack so positions stay contiguous
  if (existing?.status === 'waitlist' && effectiveStatus !== 'waitlist') {
    repackWaitlist(bookingId);
  }

  syncBookingCaches(bookingId);
  return { row, promotion };
}

/** Bulk move users into a single target status (drag-between-columns). */
export function bulkSet(
  bookingId: string,
  userIds: string[],
  status: RsvpStatus,
): { rows: AttendanceRow[]; promotions: AttendanceRow[] } {
  const rows: AttendanceRow[] = [];
  const promotions: AttendanceRow[] = [];
  for (const uid of userIds) {
    const r = setStatus(bookingId, uid, status);
    rows.push(r.row);
    if (r.promotion.promoted) promotions.push(r.promotion.promoted);
  }
  return { rows, promotions };
}

/** Read attendance for a booking, sorted by status then name. */
export function listForBooking(bookingId: string): Array<AttendanceRow & { full_name: string; email: string | null }> {
  const rows = store.attendance.filter(a => a.booking_id === bookingId);
  return rows
    .map(r => {
      const u = store.users.find(x => x.id === r.user_id);
      return { ...r, full_name: u?.full_name ?? 'Unknown', email: u?.email ?? null };
    })
    .sort((a, b) => {
      const order: RsvpStatus[] = ['going', 'invited', 'waitlist', 'declined', 'present', 'no_show'];
      const ai = order.indexOf(a.status); const bi = order.indexOf(b.status);
      if (ai !== bi) return ai - bi;
      if (a.status === 'waitlist') return (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0);
      return a.full_name.localeCompare(b.full_name);
    });
}

/** Read all upcoming attendance rows for a user (for player mobile "Upcoming" tab). */
export function listForUser(userId: string, sinceIso?: string) {
  const since = sinceIso ?? new Date().toISOString();
  return store.attendance
    .filter(a => a.user_id === userId)
    .map(a => {
      const b = store.bookings.find(x => x.id === a.booking_id);
      if (!b || b.time_slot_start < since || b.status === 'cancelled') return null;
      const court = b ? store.courts.find(c => c.id === b.court_id) : null;
      const trainer = b?.trainer_id ? store.users.find(u => u.id === b.trainer_id) : null;
      return {
        ...a,
        booking: {
          id: b.id,
          court_id: b.court_id,
          court_name: court?.name ?? null,
          start: b.time_slot_start,
          end: b.time_slot_end,
          booking_type: b.booking_type,
          event_name: b.event_name,
          trainer_name: trainer?.full_name ?? null,
        },
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.booking.start.localeCompare(b.booking.start));
}
