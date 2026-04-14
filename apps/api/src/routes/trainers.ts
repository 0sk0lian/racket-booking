import { Router, Request, Response } from 'express';
import { store } from '../store.js';

export const trainerAdminRoutes = Router();

const safe = (u: any) => {
  const { password_hash, ...rest } = u;
  return rest;
};

// GET /api/admin/trainer-management — all users with trainer info + scheduled hours
trainerAdminRoutes.get('/', (req: Request, res: Response) => {
  const { clubId } = req.query;

  let users = store.users.filter(u => u.is_active);

  // Calculate scheduled weekly hours for each trainer (from weekly templates)
  const trainerHours: Record<string, number> = {};
  const trainerSessions: Record<string, number> = {};
  store.weeklyTemplates.filter(t => t.is_active).forEach(t => {
    if (t.trainer_id) {
      // Find user linked to this trainer
      const tr = store.trainers.find(tr => tr.id === t.trainer_id);
      const userId = tr?.user_id;
      if (userId) {
        trainerHours[userId] = (trainerHours[userId] || 0) + (t.end_hour - t.start_hour);
        trainerSessions[userId] = (trainerSessions[userId] || 0) + 1;
      }
    }
  });

  // Also count upcoming booked training sessions
  const now = new Date();
  const bookedSessions: Record<string, number> = {};
  store.bookings.filter(b => b.booking_type === 'training' && b.trainer_id && b.status !== 'cancelled' && new Date(b.time_slot_start) >= now).forEach(b => {
    const tr = store.trainers.find(t => t.id === b.trainer_id);
    const userId = tr?.user_id;
    if (userId) bookedSessions[userId] = (bookedSessions[userId] || 0) + 1;
  });

  const result = users.map(u => ({
    ...safe(u),
    weeklyHours: trainerHours[u.id] || 0,
    weeklySessions: trainerSessions[u.id] || 0,
    upcomingBookedSessions: bookedSessions[u.id] || 0,
    // Link to legacy trainer record
    legacyTrainerId: store.trainers.find(t => t.user_id === u.id)?.id ?? null,
  }));

  // If clubId filter: show trainers at that club + all non-trainer users
  if (clubId) {
    const filtered = result.filter(u => u.role !== 'trainer' || u.trainer_club_id === clubId);
    res.json({ success: true, data: filtered });
  } else {
    res.json({ success: true, data: result });
  }
});

// PATCH /api/admin/trainer-management/:userId — promote/demote, set salary, etc.
trainerAdminRoutes.patch('/:userId', (req: Request, res: Response) => {
  const user = store.users.find(u => u.id === req.params.userId);
  if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

  const prev = user.role;

  if (req.body.role !== undefined) user.role = req.body.role;
  if (req.body.trainerClubId !== undefined) user.trainer_club_id = req.body.trainerClubId || null;
  if (req.body.trainerSportTypes !== undefined) user.trainer_sport_types = req.body.trainerSportTypes;
  if (req.body.trainerHourlyRate !== undefined) user.trainer_hourly_rate = req.body.trainerHourlyRate;
  if (req.body.trainerMonthlySalary !== undefined) user.trainer_monthly_salary = req.body.trainerMonthlySalary;
  if (req.body.trainerBio !== undefined) user.trainer_bio = req.body.trainerBio || null;
  if (req.body.trainerCertifications !== undefined) user.trainer_certifications = req.body.trainerCertifications || null;
  user.updated_at = new Date().toISOString();

  // If promoting to trainer, auto-create legacy trainer record if missing
  if (user.role === 'trainer' && !store.trainers.find(t => t.user_id === user.id)) {
    store.createTrainer({
      club_id: user.trainer_club_id || '',
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number,
      sport_types: user.trainer_sport_types,
      hourly_rate: user.trainer_hourly_rate || 500,
      bio: user.trainer_bio,
      user_id: user.id,
    });
  }

  // If promoting to trainer, sync the legacy trainer record
  if (user.role === 'trainer') {
    const tr = store.trainers.find(t => t.user_id === user.id);
    if (tr) {
      tr.full_name = user.full_name;
      tr.email = user.email;
      tr.phone_number = user.phone_number;
      tr.sport_types = user.trainer_sport_types;
      tr.hourly_rate = user.trainer_hourly_rate || tr.hourly_rate;
      tr.bio = user.trainer_bio;
      tr.club_id = user.trainer_club_id || tr.club_id;
      tr.is_active = true;
    }
  }

  // If demoting from trainer, deactivate legacy record
  if (prev === 'trainer' && user.role !== 'trainer') {
    const tr = store.trainers.find(t => t.user_id === user.id);
    if (tr) tr.is_active = false;
  }

  res.json({ success: true, data: safe(user) });
});
