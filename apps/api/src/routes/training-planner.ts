import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { store, RecurrenceRuleRow } from '../store.js';
import { generateSecurePin } from '../utils/hardware.js';
import { materialize } from '../services/recurrence-engine.js';

export const trainingPlannerRoutes = Router();

const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
const getName = (id: string) => store.users.find(u => u.id === id)?.full_name ?? 'Okänd';

function enrichSession(s: any) {
  const court = store.courts.find(c => c.id === s.court_id);
  const trainer = store.users.find(u => u.id === s.trainer_id);
  const mapNames = (ids: string[]) => (ids || []).map((id: string) => ({ id, name: getName(id) }));
  return {
    ...s, court_name: court?.name ?? '?', sport_type: court?.sport_type ?? 'padel',
    trainer_name: trainer?.full_name ?? '?', day_name: DAY_NAMES[s.day_of_week],
    players: mapNames(s.player_ids),
    going: mapNames(s.going_ids), declined: mapNames(s.declined_ids),
    invited: mapNames(s.invited_ids), waitlist: mapNames(s.waitlist_ids),
  };
}

// GET /api/training-planner?clubId=...
trainingPlannerRoutes.get('/', (req: Request, res: Response) => {
  const { clubId, status } = req.query;
  let sessions = [...store.trainingSessions];
  if (clubId) sessions = sessions.filter(s => s.club_id === clubId);
  if (status) sessions = sessions.filter(s => s.status === status);
  sessions.sort((a, b) => a.day_of_week - b.day_of_week || a.start_hour - b.start_hour);
  res.json({ success: true, data: sessions.map(enrichSession) });
});

// POST /api/training-planner — create a new session template (by weekday)
trainingPlannerRoutes.post('/', (req: Request, res: Response) => {
  const { clubId, title, courtId, trainerId, playerIds, dayOfWeek, startHour, endHour, notes } = req.body;
  if (!clubId || !courtId || !trainerId || dayOfWeek == null || startHour == null || endHour == null) {
    res.status(400).json({ success: false, error: 'clubId, courtId, trainerId, dayOfWeek, startHour, endHour required' }); return;
  }
  const session = store.createTrainingSession({
    club_id: clubId, title: title || 'Träningspass', court_id: courtId, trainer_id: trainerId,
    player_ids: playerIds || [], day_of_week: dayOfWeek, start_hour: startHour, end_hour: endHour, notes: notes || null,
  });
  res.status(201).json({ success: true, data: enrichSession(session) });
});

// PATCH /api/training-planner/:id
trainingPlannerRoutes.patch('/:id', (req: Request, res: Response) => {
  const s = store.trainingSessions.find(s => s.id === req.params.id);
  if (!s) { res.status(404).json({ success: false, error: 'Session not found' }); return; }
  if (req.body.title !== undefined) s.title = req.body.title;
  if (req.body.courtId !== undefined) s.court_id = req.body.courtId;
  if (req.body.trainerId !== undefined) s.trainer_id = req.body.trainerId;
  if (req.body.playerIds !== undefined) s.player_ids = req.body.playerIds;
  if (req.body.dayOfWeek !== undefined) s.day_of_week = req.body.dayOfWeek;
  if (req.body.startHour !== undefined) s.start_hour = req.body.startHour;
  if (req.body.endHour !== undefined) s.end_hour = req.body.endHour;
  if (req.body.notes !== undefined) s.notes = req.body.notes || null;
  if (req.body.goingIds !== undefined) s.going_ids = req.body.goingIds;
  if (req.body.declinedIds !== undefined) s.declined_ids = req.body.declinedIds;
  if (req.body.invitedIds !== undefined) s.invited_ids = req.body.invitedIds;
  if (req.body.waitlistIds !== undefined) s.waitlist_ids = req.body.waitlistIds;
  s.updated_at = new Date().toISOString();
  res.json({ success: true, data: enrichSession(s) });
});

// POST /api/training-planner/:id/rsvp — player responds to invite
// Body: { userId, response: 'going' | 'no' | 'waitlist' }
trainingPlannerRoutes.post('/:id/rsvp', (req: Request, res: Response) => {
  const s = store.trainingSessions.find(s => s.id === req.params.id);
  if (!s) { res.status(404).json({ success: false, error: 'Session not found' }); return; }
  const { userId, response } = req.body;
  if (!userId || !response) { res.status(400).json({ success: false, error: 'userId and response required' }); return; }

  // Remove from all lists first
  s.going_ids = s.going_ids.filter(id => id !== userId);
  s.declined_ids = s.declined_ids.filter(id => id !== userId);
  s.invited_ids = s.invited_ids.filter(id => id !== userId);
  s.waitlist_ids = s.waitlist_ids.filter(id => id !== userId);

  if (response === 'going') s.going_ids.push(userId);
  else if (response === 'no') s.declined_ids.push(userId);
  else if (response === 'waitlist') s.waitlist_ids.push(userId);

  s.updated_at = new Date().toISOString();
  res.json({ success: true, data: enrichSession(s) });
});

// GET /api/training-planner/salary?clubId=...&startDate=...&endDate=...
trainingPlannerRoutes.get('/salary', (req: Request, res: Response) => {
  const { clubId, startDate, endDate } = req.query;
  if (!clubId || !startDate || !endDate) { res.status(400).json({ success: false, error: 'clubId, startDate, endDate required' }); return; }

  const start = new Date(startDate as string);
  const end = new Date(endDate as string);
  const templates = store.trainingSessions.filter(s => s.club_id === clubId && s.status !== 'cancelled');

  // Count how many occurrences of each weekday fall in the range
  const weekdayCounts: Record<number, number> = {};
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    weekdayCounts[d.getDay()] = (weekdayCounts[d.getDay()] || 0) + 1;
  }

  const trainerMap: Record<string, { trainerId: string; trainerName: string; hourlyRate: number; monthlySalary: number | null; sessions: { title: string; dayName: string; hours: number; occurrences: number }[]; totalHours: number; totalPay: number }> = {};

  for (const t of templates) {
    const user = store.users.find(u => u.id === t.trainer_id);
    if (!user) continue;
    if (!trainerMap[t.trainer_id]) {
      trainerMap[t.trainer_id] = { trainerId: t.trainer_id, trainerName: user.full_name, hourlyRate: user.trainer_hourly_rate || 0, monthlySalary: user.trainer_monthly_salary, sessions: [], totalHours: 0, totalPay: 0 };
    }
    const hrs = t.end_hour - t.start_hour;
    const occ = weekdayCounts[t.day_of_week] || 0;
    trainerMap[t.trainer_id].sessions.push({ title: t.title, dayName: DAY_NAMES[t.day_of_week], hours: hrs, occurrences: occ });
    trainerMap[t.trainer_id].totalHours += hrs * occ;
    trainerMap[t.trainer_id].totalPay += hrs * occ * (user.trainer_hourly_rate || 0);
  }

  const trainers = Object.values(trainerMap).sort((a, b) => b.totalHours - a.totalHours);
  const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;

  res.json({ success: true, data: { trainers, totalCost: trainers.reduce((s, t) => s + t.totalPay, 0), totalHours: trainers.reduce((s, t) => s + t.totalHours, 0), weeks: Math.round(days / 7 * 10) / 10, period: { start: startDate, end: endDate } } });
});

// DELETE /api/training-planner/:id
trainingPlannerRoutes.delete('/:id', (req: Request, res: Response) => {
  const s = store.trainingSessions.find(s => s.id === req.params.id);
  if (!s) { res.status(404).json({ success: false, error: 'Session not found' }); return; }
  s.status = 'cancelled'; s.updated_at = new Date().toISOString();
  res.json({ success: true, data: enrichSession(s) });
});

// POST /api/training-planner/apply — generate real bookings from templates across a date range
// Body: { clubId, startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', sessionIds?: string[] }
// If sessionIds is omitted, applies ALL planned sessions for the club.
//
// Routes through the recurrence engine so blackouts are honored and every booking
// in this apply call shares one generation_batch_id (returned as `batchId`) —
// clients can hand that id to a future `DELETE /api/apply-batches/:batchId` to
// undo the whole apply in one shot.
trainingPlannerRoutes.post('/apply', (req: Request, res: Response) => {
  const { clubId, startDate, endDate, sessionIds } = req.body;
  if (!clubId || !startDate || !endDate) {
    res.status(400).json({ success: false, error: 'clubId, startDate, endDate required' }); return;
  }

  let templates = store.trainingSessions.filter(s => s.club_id === clubId && s.status !== 'cancelled');
  if (sessionIds?.length) templates = templates.filter(s => sessionIds.includes(s.id));

  const batchId = crypto.randomUUID();
  const results: { sessionTitle: string; date: string; status: string; bookingId?: string; error?: string }[] = [];

  for (const t of templates) {
    const court = store.courts.find(c => c.id === t.court_id);
    if (!court) {
      results.push({ sessionTitle: t.title, date: startDate, status: 'failed', error: 'Bana ej hittad' });
      continue;
    }

    // Synthesize a rule mirroring this template, using applied_dates as skip_dates
    // so already-applied dates don't re-create bookings.
    const rule: RecurrenceRuleRow = {
      id: t.id,
      club_id: t.club_id,
      title: t.title,
      booking_type: 'training',
      court_id: t.court_id,
      start_hour: t.start_hour,
      end_hour: t.end_hour,
      freq: 'weekly',
      interval_n: 1,
      weekdays: [t.day_of_week],
      start_date: startDate,
      end_date: endDate,
      skip_dates: [...t.applied_dates],
      trainer_id: t.trainer_id,
      player_ids: t.player_ids,
      event_name: null,
      event_max_participants: null,
      notes: `${t.title}${t.notes ? ' — ' + t.notes : ''}`,
      is_active: true,
      created_by: t.trainer_id,
      created_at: t.created_at,
      updated_at: t.updated_at,
    };

    const trainerRecord = store.trainers.find(tr => tr.user_id === t.trainer_id);
    const result = materialize(rule, startDate, endDate, {
      booker_id: t.trainer_id,
      access_pin: generateSecurePin,
      batch_id: batchId,
      priceFor: () => ({ total_price: 0, platform_fee: 0, court_rental_vat_rate: 0 }), // training is free
    });

    // Replace booking's trainer_id with the legacy TrainerRow.id so existing
    // code that looks up store.trainers by booking.trainer_id still works.
    if (trainerRecord) {
      for (const bid of result.created_booking_ids) {
        const b = store.bookings.find(x => x.id === bid);
        if (b) b.trainer_id = trainerRecord.id;
      }
    }

    // Report per-date outcomes in the shape the legacy UI expects
    for (const bid of result.created_booking_ids) {
      const b = store.bookings.find(x => x.id === bid)!;
      const dateStr = b.time_slot_start.split('T')[0];
      if (!t.applied_dates.includes(dateStr)) t.applied_dates.push(dateStr);
      results.push({ sessionTitle: t.title, date: dateStr, status: 'created', bookingId: bid });
    }
    for (const c of result.conflicts) {
      results.push({ sessionTitle: t.title, date: c.date, status: 'failed', error: 'Redan bokad' });
    }
    for (const b of result.blackouts) {
      results.push({ sessionTitle: t.title, date: b.date, status: 'failed', error: `Stängt: ${b.reason ?? 'blackout'}` });
    }
    for (const sd of result.skipped_dates) {
      results.push({ sessionTitle: t.title, date: sd, status: 'skipped', error: 'Redan tillämpat' });
    }

    if (result.created > 0) {
      t.status = 'applied';
      t.updated_at = new Date().toISOString();
    }
  }

  const created = results.filter(r => r.status === 'created').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed').length;

  res.json({ success: true, data: { created, skipped, failed, total: results.length, batchId, results } });
});
