/**
 * Recurrence rules + apply batches API.
 *
 * Endpoints:
 *   GET    /api/recurrence-rules?clubId=&type=&trainerId=       — list rules (with enrichment)
 *   POST   /api/recurrence-rules                                 — create
 *   GET    /api/recurrence-rules/:id                             — fetch one
 *   PATCH  /api/recurrence-rules/:id                             — update
 *   DELETE /api/recurrence-rules/:id                             — soft-delete (sets is_active=false)
 *   POST   /api/recurrence-rules/:id/preview?from=&to=          — dry-run
 *   POST   /api/recurrence-rules/:id/materialize?from=&to=      — commit
 *   DELETE /api/apply-batches/:batchId                          — undo a batch
 *
 * Powered by apps/api/src/services/recurrence-engine.ts.
 */
import { Router, Request, Response } from 'express';
import { store, RecurrenceRuleRow } from '../store.js';
import { preview, materialize, undoBatch } from '../services/recurrence-engine.js';
import { generateSecurePin } from '../utils/hardware.js';

export const recurrenceRoutes = Router();
export const applyBatchesRoutes = Router();

// ─── Enrichment for UI convenience ─────────────────────────────

function enrich(r: RecurrenceRuleRow) {
  const court = store.courts.find(c => c.id === r.court_id);
  const trainer = r.trainer_id ? store.users.find(u => u.id === r.trainer_id) : null;
  const playerNames = r.player_ids.map(id => store.users.find(u => u.id === id)?.full_name ?? '?');
  return {
    ...r,
    court_name: court?.name,
    sport_type: court?.sport_type,
    trainer_name: trainer?.full_name ?? null,
    player_names: playerNames,
  };
}

// ─── List / filter ───────────────────────────────────────────────

recurrenceRoutes.get('/', (req: Request, res: Response) => {
  const { clubId, type, trainerId, active } = req.query;
  let rules = [...store.recurrenceRules];
  if (clubId) rules = rules.filter(r => r.club_id === clubId);
  if (type) rules = rules.filter(r => r.booking_type === type);
  if (trainerId) rules = rules.filter(r => r.trainer_id === trainerId);
  if (active === 'true') rules = rules.filter(r => r.is_active);
  res.json({ success: true, data: rules.map(enrich) });
});

recurrenceRoutes.get('/:id', (req: Request, res: Response) => {
  const r = store.recurrenceRules.find(x => x.id === req.params.id);
  if (!r) { res.status(404).json({ success: false, error: 'Rule not found' }); return; }
  res.json({ success: true, data: enrich(r) });
});

// ─── Create / update / delete ────────────────────────────────────

recurrenceRoutes.post('/', (req: Request, res: Response) => {
  const b = req.body ?? {};
  try {
    const rule = store.createRecurrenceRule({
      club_id: b.clubId,
      title: b.title,
      booking_type: b.bookingType ?? 'training',
      court_id: b.courtId,
      start_hour: Number(b.startHour),
      end_hour: Number(b.endHour),
      freq: b.freq ?? 'weekly',
      interval_n: Number(b.intervalN ?? 1),
      weekdays: Array.isArray(b.weekdays) ? b.weekdays : [],
      start_date: b.startDate,
      end_date: b.endDate ?? null,
      skip_dates: Array.isArray(b.skipDates) ? b.skipDates : [],
      trainer_id: b.trainerId ?? null,
      player_ids: Array.isArray(b.playerIds) ? b.playerIds : [],
      event_name: b.eventName ?? null,
      event_max_participants: b.eventMaxParticipants ?? null,
      notes: b.notes ?? null,
      created_by: b.createdBy ?? null,
    });
    res.status(201).json({ success: true, data: enrich(rule) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

recurrenceRoutes.patch('/:id', (req: Request, res: Response) => {
  const r = store.recurrenceRules.find(x => x.id === req.params.id);
  if (!r) { res.status(404).json({ success: false, error: 'Rule not found' }); return; }
  const b = req.body ?? {};
  if (b.title !== undefined) r.title = b.title;
  if (b.bookingType !== undefined) r.booking_type = b.bookingType;
  if (b.courtId !== undefined) r.court_id = b.courtId;
  if (b.startHour !== undefined) r.start_hour = Number(b.startHour);
  if (b.endHour !== undefined) r.end_hour = Number(b.endHour);
  if (b.freq !== undefined) r.freq = b.freq;
  if (b.intervalN !== undefined) r.interval_n = Number(b.intervalN);
  if (b.weekdays !== undefined) r.weekdays = b.weekdays;
  if (b.startDate !== undefined) r.start_date = b.startDate;
  if (b.endDate !== undefined) r.end_date = b.endDate;
  if (b.skipDates !== undefined) r.skip_dates = b.skipDates;
  if (b.trainerId !== undefined) r.trainer_id = b.trainerId;
  if (b.playerIds !== undefined) r.player_ids = b.playerIds;
  if (b.eventName !== undefined) r.event_name = b.eventName;
  if (b.eventMaxParticipants !== undefined) r.event_max_participants = b.eventMaxParticipants;
  if (b.notes !== undefined) r.notes = b.notes;
  if (b.isActive !== undefined) r.is_active = Boolean(b.isActive);
  if (r.end_hour <= r.start_hour) {
    res.status(400).json({ success: false, error: 'end_hour must be greater than start_hour' });
    return;
  }
  r.updated_at = new Date().toISOString();
  res.json({ success: true, data: enrich(r) });
});

recurrenceRoutes.delete('/:id', (req: Request, res: Response) => {
  const r = store.recurrenceRules.find(x => x.id === req.params.id);
  if (!r) { res.status(404).json({ success: false, error: 'Rule not found' }); return; }
  r.is_active = false;
  r.updated_at = new Date().toISOString();
  res.json({ success: true, data: enrich(r) });
});

// ─── Preview / materialize ───────────────────────────────────────

recurrenceRoutes.post('/:id/preview', (req: Request, res: Response) => {
  const r = store.recurrenceRules.find(x => x.id === req.params.id);
  if (!r) { res.status(404).json({ success: false, error: 'Rule not found' }); return; }
  const from = String(req.query.from ?? req.body?.from ?? r.start_date);
  const to = String(req.query.to ?? req.body?.to ?? r.end_date ?? r.start_date);
  const pv = preview(r, from, to);
  res.json({ success: true, data: pv });
});

recurrenceRoutes.post('/:id/materialize', (req: Request, res: Response) => {
  const r = store.recurrenceRules.find(x => x.id === req.params.id);
  if (!r) { res.status(404).json({ success: false, error: 'Rule not found' }); return; }
  const from = String(req.query.from ?? req.body?.from ?? r.start_date);
  const to = String(req.query.to ?? req.body?.to ?? r.end_date ?? r.start_date);

  const court = store.courts.find(c => c.id === r.court_id);
  if (!court) { res.status(400).json({ success: false, error: 'Court not found' }); return; }

  const result = materialize(r, from, to, {
    booker_id: req.body?.bookerId ?? r.created_by ?? 'admin',
    access_pin: generateSecurePin,
    priceFor: (_inst, rule) => {
      const durationHours = rule.end_hour - rule.start_hour;
      const courtRental = court.base_hourly_rate * durationHours;
      let total = 0;
      if (rule.booking_type === 'event') total = 0;
      else if (rule.booking_type === 'training') {
        const trainer = rule.trainer_id ? store.users.find(u => u.id === rule.trainer_id) : null;
        total = courtRental * 1.05 + (trainer?.trainer_hourly_rate ?? 0) * durationHours;
      } else {
        total = courtRental * 1.05;
      }
      return {
        total_price: total,
        platform_fee: courtRental * 0.05,
        court_rental_vat_rate: 0.06,
      };
    },
  });

  res.json({ success: true, data: result });
});

// ─── Apply batches (undo) ────────────────────────────────────────

applyBatchesRoutes.delete('/:batchId', (req: Request, res: Response) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
  const n = undoBatch(String(req.params.batchId), reason);
  res.json({ success: true, data: { cancelled: n } });
});

// ─── Info about a batch ──────────────────────────────────────────

applyBatchesRoutes.get('/:batchId', (req: Request, res: Response) => {
  const bookings = store.bookings.filter(b => b.generation_batch_id === req.params.batchId);
  if (bookings.length === 0) {
    res.status(404).json({ success: false, error: 'Batch not found' });
    return;
  }
  const ruleId = bookings[0].recurrence_rule_id;
  const rule = ruleId ? store.recurrenceRules.find(r => r.id === ruleId) : null;
  res.json({
    success: true,
    data: {
      batch_id: req.params.batchId,
      rule_id: ruleId,
      rule_title: rule?.title ?? null,
      total: bookings.length,
      active: bookings.filter(b => b.status !== 'cancelled').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      dates: [...new Set(bookings.map(b => b.time_slot_start.split('T')[0]))].sort(),
    },
  });
});
