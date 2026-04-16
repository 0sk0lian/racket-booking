import { describe, it, expect, beforeEach } from 'vitest';
import { store, RecurrenceRuleRow } from '../store.js';
import { expandRule, preview, materialize, undoBatch, availability } from './recurrence-engine.js';

// Pick the first seeded club + one of its active courts so the engine has a
// realistic scope to work against without having to bootstrap our own data.
const clubId = store.clubs[0].id;
const courtId = store.courts.find(c => c.club_id === clubId && c.is_active)!.id;

function mkRule(overrides: Partial<RecurrenceRuleRow> = {}): RecurrenceRuleRow {
  return store.createRecurrenceRule({
    club_id: clubId,
    court_id: courtId,
    title: 'Test rule',
    booking_type: 'training',
    start_hour: 8,
    end_hour: 9,
    freq: 'weekly',
    interval_n: 1,
    weekdays: [1], // Monday
    start_date: '2026-05-04', // a Monday
    end_date: '2026-05-31',
    ...overrides,
  });
}

describe('expandRule', () => {
  it('weekly on Monday produces one instance per week in range', () => {
    const rule = mkRule({ weekdays: [1] });
    const insts = expandRule(rule, '2026-05-04', '2026-05-31');
    // Mondays in May 2026: 4, 11, 18, 25 → 4 instances
    expect(insts.map(i => i.date)).toEqual(['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25']);
  });

  it('biweekly halves the cadence', () => {
    const rule = mkRule({ freq: 'biweekly', weekdays: [1] });
    const insts = expandRule(rule, '2026-05-04', '2026-05-31');
    expect(insts.map(i => i.date)).toEqual(['2026-05-04', '2026-05-18']);
  });

  it('honors skip_dates', () => {
    const rule = mkRule({ weekdays: [1], skip_dates: ['2026-05-11'] });
    const insts = expandRule(rule, '2026-05-04', '2026-05-31');
    expect(insts.map(i => i.date)).toEqual(['2026-05-04', '2026-05-18', '2026-05-25']);
  });

  it('clamps to rule.end_date', () => {
    const rule = mkRule({ weekdays: [1], end_date: '2026-05-15' });
    const insts = expandRule(rule, '2026-05-04', '2026-05-31');
    expect(insts.map(i => i.date)).toEqual(['2026-05-04', '2026-05-11']);
  });

  it('freq=once emits exactly one date (or none if out of range)', () => {
    const rule = mkRule({ freq: 'once', weekdays: [], start_date: '2026-05-20', end_date: '2026-05-20' });
    expect(expandRule(rule, '2026-05-01', '2026-05-31').map(i => i.date)).toEqual(['2026-05-20']);
    expect(expandRule(rule, '2026-06-01', '2026-06-30')).toEqual([]);
  });
});

describe('preview', () => {
  beforeEach(() => {
    // Start each test from a clean recurrence-rule / blackout slate so results
    // don't bleed between tests. Bookings persist (they're seeded).
    store.recurrenceRules.length = 0;
    store.blackoutPeriods.length = 0;
  });

  it('separates blacked-out instances from materializable ones', () => {
    const rule = mkRule({ weekdays: [1] });
    store.createBlackoutPeriod({
      club_id: clubId,
      starts_at: '2026-05-11T00:00:00.000Z',
      ends_at:   '2026-05-12T00:00:00.000Z',
      reason: 'Maintenance',
    });
    const pv = preview(rule, '2026-05-04', '2026-05-31');
    const blackoutDates = pv.blackouts.map(b => b.date);
    expect(blackoutDates).toContain('2026-05-11');
    expect(pv.instances.map(i => i.date)).not.toContain('2026-05-11');
  });

  it('conflicts reference the existing booking they clash with', () => {
    const rule = mkRule({ weekdays: [1] });
    // Create a hand-rolled booking to force a conflict on 2026-05-04 @ 08:00
    const clash = store.createBooking({
      court_id: courtId,
      booker_id: store.users[0].id,
      time_slot_start: '2026-05-04T06:00:00.000Z', // 08:00 CEST
      time_slot_end:   '2026-05-04T07:00:00.000Z',
      status: 'confirmed',
      total_price: 0,
      booking_type: 'regular',
    });
    const pv = preview(rule, '2026-05-04', '2026-05-04');
    expect(pv.conflicts).toHaveLength(1);
    expect(pv.conflicts[0].conflicting_booking_id).toBe(clash.id);
    expect(pv.instances).toHaveLength(0);
  });
});

describe('materialize + undoBatch', () => {
  beforeEach(() => {
    store.recurrenceRules.length = 0;
    store.blackoutPeriods.length = 0;
  });

  it('creates bookings sharing one generation_batch_id, and undo soft-cancels them all', () => {
    const rule = mkRule({ weekdays: [1], start_date: '2026-06-01', end_date: '2026-06-30' });
    const result = materialize(rule, '2026-06-01', '2026-06-30', {
      priceFor: () => ({ total_price: 400, platform_fee: 20, court_rental_vat_rate: 0.06 }),
      booker_id: store.users[0].id,
    });
    expect(result.created).toBeGreaterThan(0);
    expect(result.created_booking_ids.length).toBe(result.created);

    // All created bookings carry the same batch_id + the rule_id
    for (const bid of result.created_booking_ids) {
      const b = store.bookings.find(x => x.id === bid)!;
      expect(b.generation_batch_id).toBe(result.batch_id);
      expect(b.recurrence_rule_id).toBe(rule.id);
      expect(b.status).toBe('confirmed');
    }

    const undone = undoBatch(result.batch_id);
    expect(undone).toBe(result.created);
    for (const bid of result.created_booking_ids) {
      expect(store.bookings.find(x => x.id === bid)!.status).toBe('cancelled');
    }
  });

  it('seeds attendance rows for training roster', () => {
    const playerIds = store.users.slice(0, 3).map(u => u.id);
    const rule = mkRule({
      booking_type: 'training',
      weekdays: [1],
      player_ids: playerIds,
      start_date: '2026-07-06', // future Monday, clean slate
      end_date: '2026-07-06',
      freq: 'once',
    });
    const result = materialize(rule, '2026-07-06', '2026-07-06', {
      priceFor: () => ({ total_price: 0, platform_fee: 0, court_rental_vat_rate: 0 }),
      booker_id: store.users[0].id,
    });
    expect(result.created).toBe(1);
    const bookingId = result.created_booking_ids[0];
    const rsvps = store.attendance.filter(a => a.booking_id === bookingId);
    expect(rsvps).toHaveLength(3);
    expect(rsvps.every(r => r.status === 'invited')).toBe(true);
  });
});

describe('availability', () => {
  it('returns fewer slots after a booking is added', () => {
    const before = availability(clubId, '2026-08-03', '2026-08-03', 1).length;
    store.createBooking({
      court_id: courtId,
      booker_id: store.users[0].id,
      time_slot_start: '2026-08-03T08:00:00.000Z',
      time_slot_end:   '2026-08-03T09:00:00.000Z',
      status: 'confirmed',
      total_price: 0,
      booking_type: 'regular',
    });
    const after = availability(clubId, '2026-08-03', '2026-08-03', 1).length;
    expect(after).toBe(before - 1);
  });
});
