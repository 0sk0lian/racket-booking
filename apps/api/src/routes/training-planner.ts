import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import { generateSecurePin } from '../utils/hardware.js';

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
trainingPlannerRoutes.post('/apply', (req: Request, res: Response) => {
  const { clubId, startDate, endDate, sessionIds } = req.body;
  if (!clubId || !startDate || !endDate) {
    res.status(400).json({ success: false, error: 'clubId, startDate, endDate required' }); return;
  }

  let templates = store.trainingSessions.filter(s => s.club_id === clubId && s.status !== 'cancelled');
  if (sessionIds?.length) templates = templates.filter(s => sessionIds.includes(s.id));

  const start = new Date(startDate);
  const end = new Date(endDate);
  const results: { sessionTitle: string; date: string; status: string; bookingId?: string; error?: string }[] = [];

  // Iterate each day in the range
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    const dateStr = d.toISOString().split('T')[0];

    // Find templates for this weekday
    const dayTemplates = templates.filter(t => t.day_of_week === dow);

    for (const t of dayTemplates) {
      // Skip if already applied to this date
      if (t.applied_dates.includes(dateStr)) {
        results.push({ sessionTitle: t.title, date: dateStr, status: 'skipped', error: 'Redan tillämpat' });
        continue;
      }

      const court = store.courts.find(c => c.id === t.court_id);
      if (!court) { results.push({ sessionTitle: t.title, date: dateStr, status: 'failed', error: 'Bana ej hittad' }); continue; }

      const trainerRecord = store.trainers.find(tr => tr.user_id === t.trainer_id);
      const startTime = `${dateStr}T${String(t.start_hour).padStart(2, '0')}:00:00`;
      const endTime = `${dateStr}T${String(t.end_hour).padStart(2, '0')}:00:00`;

      try {
        const booking = store.createBooking({
          court_id: t.court_id, booker_id: t.trainer_id,
          time_slot_start: startTime, time_slot_end: endTime,
          status: 'confirmed', total_price: 0, // Training is free
          access_pin: generateSecurePin(), booking_type: 'training',
          trainer_id: trainerRecord?.id ?? null, player_ids: t.player_ids,
          notes: `${t.title}${t.notes ? ' — ' + t.notes : ''}`,
        });
        t.applied_dates.push(dateStr);
        t.status = 'applied';
        t.updated_at = new Date().toISOString();
        results.push({ sessionTitle: t.title, date: dateStr, status: 'created', bookingId: booking.id });
      } catch (err: any) {
        results.push({ sessionTitle: t.title, date: dateStr, status: 'failed', error: err.code === '23P01' ? 'Redan bokad' : err.message });
      }
    }
  }

  const created = results.filter(r => r.status === 'created').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed').length;

  res.json({ success: true, data: { created, skipped, failed, total: results.length, results } });
});
