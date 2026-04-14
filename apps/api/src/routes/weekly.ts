import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import { generateSecurePin } from '../utils/hardware.js';

export const weeklyRoutes = Router();

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function enrichTemplate(t: any) {
  const court = store.courts.find(c => c.id === t.court_id);
  const trainer = t.trainer_id ? store.trainers.find(tr => tr.id === t.trainer_id) : null;
  const players = (t.player_ids || []).map((id: string) => {
    const u = store.users.find(u => u.id === id);
    return u ? { id: u.id, full_name: u.full_name } : { id, full_name: 'Unknown' };
  });
  return {
    ...t,
    court_name: court?.name ?? 'Unknown',
    sport_type: court?.sport_type ?? 'padel',
    trainer_name: trainer?.full_name ?? null,
    trainer_rate: trainer?.hourly_rate ?? null,
    day_name: DAY_NAMES[t.day_of_week],
    players,
  };
}

// GET /api/admin/weekly?clubId=...
weeklyRoutes.get('/', (req: Request, res: Response) => {
  const { clubId } = req.query;
  if (!clubId) { res.status(400).json({ success: false, error: 'clubId required' }); return; }
  const templates = store.weeklyTemplates
    .filter(t => t.club_id === clubId)
    .map(enrichTemplate);
  res.json({ success: true, data: templates });
});

// POST /api/admin/weekly — create a new weekly template
weeklyRoutes.post('/', (req: Request, res: Response) => {
  const { clubId, courtId, dayOfWeek, startHour, endHour, activityType, title, trainerId, playerIds, eventMaxParticipants, notes, color } = req.body;
  if (!clubId || !courtId || dayOfWeek == null || startHour == null || endHour == null) {
    res.status(400).json({ success: false, error: 'clubId, courtId, dayOfWeek, startHour, endHour required' }); return;
  }

  // Check for template overlap on the same court/day/time
  const overlap = store.weeklyTemplates.find(t =>
    t.club_id === clubId && t.court_id === courtId && t.day_of_week === dayOfWeek && t.is_active &&
    startHour < t.end_hour && endHour > t.start_hour
  );
  if (overlap) {
    res.status(409).json({ success: false, error: `Overlaps with "${overlap.title}" on ${DAY_NAMES[overlap.day_of_week]} ${overlap.start_hour}:00-${overlap.end_hour}:00` });
    return;
  }

  const template = store.createWeeklyTemplate({
    club_id: clubId, court_id: courtId, day_of_week: dayOfWeek,
    start_hour: startHour, end_hour: endHour,
    activity_type: activityType || 'training', title: title || 'Untitled',
    trainer_id: trainerId || null, player_ids: playerIds || [],
    event_max_participants: eventMaxParticipants || null,
    notes: notes || null, color: color || '#6366f1',
  });
  res.status(201).json({ success: true, data: enrichTemplate(template) });
});

// PATCH /api/admin/weekly/:id — update a template
weeklyRoutes.patch('/:id', (req: Request, res: Response) => {
  const t = store.weeklyTemplates.find(t => t.id === req.params.id);
  if (!t) { res.status(404).json({ success: false, error: 'Template not found' }); return; }

  if (req.body.courtId !== undefined) t.court_id = req.body.courtId;
  if (req.body.dayOfWeek !== undefined) t.day_of_week = req.body.dayOfWeek;
  if (req.body.startHour !== undefined) t.start_hour = req.body.startHour;
  if (req.body.endHour !== undefined) t.end_hour = req.body.endHour;
  if (req.body.activityType !== undefined) t.activity_type = req.body.activityType;
  if (req.body.title !== undefined) t.title = req.body.title;
  if (req.body.trainerId !== undefined) t.trainer_id = req.body.trainerId || null;
  if (req.body.playerIds !== undefined) t.player_ids = req.body.playerIds;
  if (req.body.eventMaxParticipants !== undefined) t.event_max_participants = req.body.eventMaxParticipants;
  if (req.body.notes !== undefined) t.notes = req.body.notes || null;
  if (req.body.isActive !== undefined) t.is_active = req.body.isActive;
  if (req.body.color !== undefined) t.color = req.body.color;
  t.updated_at = new Date().toISOString();

  res.json({ success: true, data: enrichTemplate(t) });
});

// DELETE /api/admin/weekly/:id — deactivate a template
weeklyRoutes.delete('/:id', (req: Request, res: Response) => {
  const t = store.weeklyTemplates.find(t => t.id === req.params.id);
  if (!t) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
  t.is_active = false;
  t.updated_at = new Date().toISOString();
  res.json({ success: true, data: enrichTemplate(t) });
});

// POST /api/admin/weekly/publish — generate actual bookings from templates for a date range
// Body: { clubId, startDate: 'YYYY-MM-DD', weeks: 1-12 }
weeklyRoutes.post('/publish', (req: Request, res: Response) => {
  const { clubId, startDate, weeks } = req.body;
  if (!clubId || !startDate) { res.status(400).json({ success: false, error: 'clubId and startDate required' }); return; }

  const numWeeks = Math.min(Math.max(weeks || 1, 1), 12);
  const templates = store.weeklyTemplates.filter(t => t.club_id === clubId && t.is_active);
  const start = new Date(startDate);

  const created: any[] = [];
  const skipped: any[] = [];

  for (let w = 0; w < numWeeks; w++) {
    for (const tmpl of templates) {
      // Find the correct date for this template's day_of_week in this week
      const targetDate = new Date(start);
      targetDate.setDate(targetDate.getDate() + w * 7 + ((tmpl.day_of_week - start.getDay() + 7) % 7));

      // Skip if the date is in the past
      if (targetDate < new Date(new Date().toDateString())) { skipped.push({ template: tmpl.title, reason: 'in the past' }); continue; }

      const dateStr = targetDate.toISOString().split('T')[0];
      const startTime = `${dateStr}T${String(tmpl.start_hour).padStart(2, '0')}:00:00`;
      const endTime = `${dateStr}T${String(tmpl.end_hour).padStart(2, '0')}:00:00`;

      const court = store.courts.find(c => c.id === tmpl.court_id);
      if (!court) { skipped.push({ template: tmpl.title, reason: 'court not found' }); continue; }

      const durationHours = tmpl.end_hour - tmpl.start_hour;
      let totalPrice = court.base_hourly_rate * durationHours * 1.05;
      if (tmpl.activity_type === 'training' && tmpl.trainer_id) {
        const trainer = store.trainers.find(t => t.id === tmpl.trainer_id);
        if (trainer) totalPrice += trainer.hourly_rate * durationHours;
      }
      if (tmpl.activity_type === 'event') totalPrice = 0;

      try {
        const booking = store.createBooking({
          court_id: tmpl.court_id,
          booker_id: tmpl.player_ids?.[0] || 'admin',
          time_slot_start: startTime,
          time_slot_end: endTime,
          status: 'confirmed',
          total_price: totalPrice,
          access_pin: generateSecurePin(),
          booking_type: tmpl.activity_type,
          trainer_id: tmpl.trainer_id,
          player_ids: tmpl.player_ids || [],
          event_name: tmpl.activity_type === 'event' ? tmpl.title : null,
          event_max_participants: tmpl.event_max_participants,
          event_attendee_ids: [],
          notes: tmpl.notes || `Weekly: ${tmpl.title}`,
        });
        created.push({ id: booking.id, date: dateStr, template: tmpl.title, type: tmpl.activity_type });
      } catch (err: any) {
        skipped.push({ template: tmpl.title, date: dateStr, reason: err.code === '23P01' ? 'slot conflict' : err.message });
      }
    }
  }

  res.json({
    success: true,
    data: { created: created.length, skipped: skipped.length, details: created, conflicts: skipped },
  });
});
