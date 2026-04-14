import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import crypto from 'crypto';

export const featuresRoutes = Router();

// ═══════════════════════════════════════════════════════════════
// PRICE CALENDAR
// ═══════════════════════════════════════════════════════════════

// GET /api/features/prices?clubId=...&date=YYYY-MM-DD (returns 7 days of pricing)
featuresRoutes.get('/prices', (req: Request, res: Response) => {
  const { clubId, date } = req.query;
  if (!clubId) { res.status(400).json({ success: false, error: 'clubId required' }); return; }

  const startDate = date ? new Date(date as string) : new Date();
  const courts = store.courts.filter(c => c.club_id === clubId && c.is_active);
  const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

  const days: any[] = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + d);
    const dow = day.getDay();
    const dateStr = day.toISOString().split('T')[0];
    const dayName = day.toLocaleDateString('sv-SE', { weekday: 'short' });

    const courtPrices = courts.map(court => {
      const hourPrices = HOURS.map(h => {
        // Find matching price rule (most specific first: day-specific > general)
        const rules = store.priceRules.filter(r => r.court_id === court.id && r.is_active && h >= r.start_hour && h < r.end_hour);
        const dayRule = rules.find(r => r.day_of_week === dow);
        const genRule = rules.find(r => r.day_of_week === null);
        const rule = dayRule || genRule;

        // Check if slot is booked
        const booked = store.bookings.some(b =>
          b.court_id === court.id && b.status !== 'cancelled' &&
          new Date(b.time_slot_start) <= new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00`) &&
          new Date(b.time_slot_end) > new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00`)
        );

        return {
          hour: h,
          price: rule?.price_override ?? court.base_hourly_rate,
          label: rule?.label ?? 'Standard',
          booked,
        };
      });
      return { courtId: court.id, courtName: court.name, sportType: court.sport_type, hourPrices };
    });

    days.push({ date: dateStr, dayName, dayOfWeek: dow, courts: courtPrices });
  }

  // Find min/max prices for color scaling
  let minPrice = Infinity, maxPrice = 0;
  days.forEach(d => d.courts.forEach((c: any) => c.hourPrices.forEach((h: any) => { if (!h.booked) { minPrice = Math.min(minPrice, h.price); maxPrice = Math.max(maxPrice, h.price); } })));

  res.json({ success: true, data: { days, minPrice, maxPrice } });
});

// ═══════════════════════════════════════════════════════════════
// LOYALTY PROGRAM
// ═══════════════════════════════════════════════════════════════

featuresRoutes.get('/loyalty', (req: Request, res: Response) => {
  const { clubId } = req.query;
  let data = store.loyalty;
  if (clubId) data = data.filter(l => l.club_id === clubId);
  const enriched = data.map(l => {
    const user = store.users.find(u => u.id === l.user_id);
    return { ...l, user_name: user?.full_name ?? 'Unknown', user_email: user?.email ?? '', progress: l.total_bookings % 10, next_free_at: Math.ceil(l.total_bookings / 10) * 10 };
  });
  res.json({ success: true, data: enriched });
});

// ═══════════════════════════════════════════════════════════════
// REVENUE DASHBOARD
// ═══════════════════════════════════════════════════════════════

featuresRoutes.get('/revenue', (req: Request, res: Response) => {
  const { clubId, period } = req.query; // period: day, week, month, year
  const bookings = store.bookings.filter(b => {
    if (b.status === 'cancelled') return false;
    if (clubId) {
      const court = store.courts.find(c => c.id === b.court_id);
      if (court?.club_id !== clubId) return false;
    }
    return true;
  });

  const now = new Date();
  const groupBy = (period as string) || 'month';

  const getKey = (d: Date) => {
    if (groupBy === 'day') return d.toISOString().split('T')[0];
    if (groupBy === 'week') { const w = new Date(d); w.setDate(w.getDate() - w.getDay() + 1); return 'V' + Math.ceil((w.getTime() - new Date(w.getFullYear(), 0, 1).getTime()) / 604800000); }
    if (groupBy === 'year') return String(d.getFullYear());
    return d.toISOString().substring(0, 7); // month
  };

  const buckets: Record<string, { revenue: number; bookings: number; courtRental: number; platformFees: number }> = {};
  bookings.forEach(b => {
    const key = getKey(new Date(b.time_slot_start));
    if (!buckets[key]) buckets[key] = { revenue: 0, bookings: 0, courtRental: 0, platformFees: 0 };
    buckets[key].revenue += b.total_price;
    buckets[key].bookings++;
    buckets[key].courtRental += b.total_price - b.platform_fee;
    buckets[key].platformFees += b.platform_fee;
  });

  const timeline = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([period, data]) => ({ period, ...data }));

  // By type breakdown
  const byType: Record<string, number> = {};
  bookings.forEach(b => { byType[b.booking_type] = (byType[b.booking_type] || 0) + b.total_price; });

  // By court breakdown
  const byCourt: Record<string, { name: string; revenue: number; bookings: number }> = {};
  bookings.forEach(b => {
    const court = store.courts.find(c => c.id === b.court_id);
    const cn = court?.name || 'Unknown';
    if (!byCourt[cn]) byCourt[cn] = { name: cn, revenue: 0, bookings: 0 };
    byCourt[cn].revenue += b.total_price;
    byCourt[cn].bookings++;
  });

  const totalRevenue = bookings.reduce((s, b) => s + b.total_price, 0);
  const totalBookings = bookings.length;

  res.json({ success: true, data: { totalRevenue, totalBookings, timeline, byType, byCourt: Object.values(byCourt), groupBy } });
});

// ═══════════════════════════════════════════════════════════════
// GROUPS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

featuresRoutes.get('/groups', (req: Request, res: Response) => {
  const { clubId, category, sportType } = req.query;
  let groups = store.groups.filter(g => g.is_active);
  if (clubId) groups = groups.filter(g => g.club_id === clubId);
  if (category) groups = groups.filter(g => g.category === category);
  if (sportType) groups = groups.filter(g => g.sport_type === sportType);

  const enriched = groups.map(g => {
    // Get child groups if this is a master category
    const children = store.groups.filter(c => c.parent_group_id === g.id && c.is_active);
    // Aggregate all members from children into master category
    const allMemberIds = new Set([...g.player_ids, ...children.flatMap(c => c.player_ids)]);
    const parentGroup = g.parent_group_id ? store.groups.find(p => p.id === g.parent_group_id) : null;

    return {
      ...g,
      players: g.player_ids.map(id => { const u = store.users.find(u => u.id === id); return { id, full_name: u?.full_name ?? '?' }; }),
      trainers: g.trainer_ids.map(id => { const u = store.users.find(u => u.id === id); return { id, full_name: u?.full_name ?? '?' }; }),
      parent_group_name: parentGroup?.name ?? null,
      is_master_category: children.length > 0,
      child_groups: children.map(c => ({ id: c.id, name: c.name, player_count: c.player_ids.length })),
      total_members: allMemberIds.size,
    };
  });
  res.json({ success: true, data: enriched });
});

featuresRoutes.post('/groups', (req: Request, res: Response) => {
  const g = store.createGroup(req.body);
  res.status(201).json({ success: true, data: g });
});

featuresRoutes.patch('/groups/:id', (req: Request, res: Response) => {
  const g = store.groups.find(g => g.id === req.params.id);
  if (!g) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  if (req.body.name !== undefined) g.name = req.body.name;
  if (req.body.category !== undefined) g.category = req.body.category;
  if (req.body.sportType !== undefined) g.sport_type = req.body.sportType;
  if (req.body.playerIds !== undefined) g.player_ids = req.body.playerIds;
  if (req.body.trainerIds !== undefined) g.trainer_ids = req.body.trainerIds;
  if (req.body.maxSize !== undefined) g.max_size = req.body.maxSize;
  if (req.body.notes !== undefined) g.notes = req.body.notes;
  g.updated_at = new Date().toISOString();
  res.json({ success: true, data: g });
});

featuresRoutes.delete('/groups/:id', (req: Request, res: Response) => {
  const g = store.groups.find(g => g.id === req.params.id);
  if (!g) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  g.is_active = false;
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// TIME REPORTS
// ═══════════════════════════════════════════════════════════════

featuresRoutes.get('/time-reports', (req: Request, res: Response) => {
  const { clubId, userId, from, to } = req.query;
  let reports = [...store.timeReports];
  if (clubId) reports = reports.filter(r => r.club_id === clubId);
  if (userId) reports = reports.filter(r => r.user_id === userId);
  if (from) reports = reports.filter(r => r.date >= (from as string));
  if (to) reports = reports.filter(r => r.date <= (to as string));
  const enriched = reports.map(r => ({ ...r, user_name: store.users.find(u => u.id === r.user_id)?.full_name ?? '?' }));
  const totalHours = reports.reduce((s, r) => s + r.hours, 0);
  res.json({ success: true, data: { reports: enriched.sort((a, b) => b.date.localeCompare(a.date)), totalHours } });
});

featuresRoutes.post('/time-reports', (req: Request, res: Response) => {
  const tr = store.createTimeReport(req.body);
  res.status(201).json({ success: true, data: tr });
});

featuresRoutes.patch('/time-reports/:id/approve', (req: Request, res: Response) => {
  const tr = store.timeReports.find(r => r.id === req.params.id);
  if (!tr) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  tr.approved = true;
  res.json({ success: true, data: tr });
});

// POST /api/features/time-reports/sync-schedule — auto-create time reports from scheduled sessions
// Body: { userId, clubId, date }
// Looks at what training sessions the trainer is scheduled for on that weekday,
// checks if bookings exist for that date, and creates time reports with category-based rates.
featuresRoutes.post('/time-reports/sync-schedule', (req: Request, res: Response) => {
  const { userId, clubId, date } = req.body;
  if (!userId || !clubId || !date) { res.status(400).json({ success: false, error: 'userId, clubId, date required' }); return; }

  const user = store.users.find(u => u.id === userId);
  if (!user || user.role !== 'trainer') { res.status(400).json({ success: false, error: 'User is not a trainer' }); return; }

  const dow = new Date(date).getDay();
  const trainerRecord = store.trainers.find(t => t.user_id === userId);

  // Find training sessions this trainer is assigned to on this weekday
  const sessions = store.trainingSessions.filter(s =>
    s.club_id === clubId && s.trainer_id === userId && s.day_of_week === dow && s.status !== 'cancelled'
  );

  // Also check actual bookings on this date for this trainer
  const bookings = store.bookings.filter(b =>
    b.booking_type === 'training' && b.trainer_id === trainerRecord?.id && b.status !== 'cancelled' &&
    b.time_slot_start.startsWith(date)
  );

  // Check if already synced for this date
  const existing = store.timeReports.filter(r => r.user_id === userId && r.date === date);
  if (existing.length > 0) {
    res.status(409).json({ success: false, error: 'Redan synkad för detta datum', existing });
    return;
  }

  // Determine category for each session by looking at which group the session players belong to
  const created: any[] = [];
  for (const s of sessions) {
    // Try to find what category this session belongs to by checking player group memberships
    let category = 'adult'; // default
    for (const pid of s.player_ids) {
      const playerGroups = store.groups.filter(g => g.player_ids.includes(pid) && g.is_active);
      const catGroup = playerGroups.find(g => g.parent_group_id); // child group has a category
      if (catGroup) { category = catGroup.category; break; }
    }
    // Also check session title for hints
    const titleLower = s.title.toLowerCase();
    if (titleLower.includes('junior') || titleLower.includes('barn') || titleLower.includes('kids')) category = 'junior';
    else if (titleLower.includes('tävling') || titleLower.includes('match')) category = 'competition';
    else if (titleLower.includes('läger') || titleLower.includes('camp')) category = 'camp';

    const hours = s.end_hour - s.start_hour;
    const rate = user.trainer_rates?.[category] ?? user.trainer_hourly_rate ?? 0;
    const court = store.courts.find(c => c.id === s.court_id);

    const tr = store.createTimeReport({
      user_id: userId, club_id: clubId, date,
      hours, type: 'training',
      description: `${s.title} (${category}) — ${court?.name ?? '?'} ${String(s.start_hour).padStart(2, '0')}:00-${String(s.end_hour).padStart(2, '0')}:00`,
    });

    created.push({ ...tr, session_title: s.title, category, rate, pay: hours * rate, court_name: court?.name });
  }

  const totalHours = created.reduce((s, r) => s + r.hours, 0);
  const totalPay = created.reduce((s, r) => s + r.pay, 0);

  res.json({ success: true, data: { created: created.length, totalHours, totalPay, reports: created } });
});

// GET /api/features/time-reports/salary-summary?userId=...&clubId=...&from=...&to=...
// Calculates total salary for a trainer over a period based on reported hours and category rates
featuresRoutes.get('/time-reports/salary-summary', (req: Request, res: Response) => {
  const { userId, clubId, from, to } = req.query;
  if (!userId) { res.status(400).json({ success: false, error: 'userId required' }); return; }

  const user = store.users.find(u => u.id === userId);
  if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

  let reports = store.timeReports.filter(r => r.user_id === userId);
  if (clubId) reports = reports.filter(r => r.club_id === clubId);
  if (from) reports = reports.filter(r => r.date >= (from as string));
  if (to) reports = reports.filter(r => r.date <= (to as string));

  // Parse category from description and calculate pay
  const breakdown: Record<string, { hours: number; rate: number; pay: number; count: number }> = {};
  let totalHours = 0, totalPay = 0;

  for (const r of reports) {
    // Extract category from description like "Title (junior) — Court"
    const catMatch = r.description?.match(/\((\w+)\)/);
    const category = catMatch?.[1] || 'adult';
    const rate = user.trainer_rates?.[category] ?? user.trainer_hourly_rate ?? 0;
    const pay = r.hours * rate;

    if (!breakdown[category]) breakdown[category] = { hours: 0, rate, pay: 0, count: 0 };
    breakdown[category].hours += r.hours;
    breakdown[category].pay += pay;
    breakdown[category].count++;
    totalHours += r.hours;
    totalPay += pay;
  }

  res.json({ success: true, data: {
    trainer: { name: user.full_name, hourlyRate: user.trainer_hourly_rate, rates: user.trainer_rates, monthlySalary: user.trainer_monthly_salary },
    totalHours, totalPay, reportCount: reports.length,
    breakdown: Object.entries(breakdown).map(([cat, d]) => ({ category: cat, ...d })),
    period: { from, to },
  }});
});

// ═══════════════════════════════════════════════════════════════
// SICK LEAVE
// ═══════════════════════════════════════════════════════════════

featuresRoutes.get('/sick-leave', (req: Request, res: Response) => {
  const { clubId } = req.query;
  let leaves = [...store.sickLeaves];
  if (clubId) leaves = leaves.filter(l => l.club_id === clubId);
  const enriched = leaves.map(l => {
    const user = store.users.find(u => u.id === l.user_id);
    const coveredBy = l.covered_by_id ? store.users.find(u => u.id === l.covered_by_id) : null;
    // Find affected sessions (weekly templates assigned to this trainer)
    const trainerRecord = store.trainers.find(t => t.user_id === l.user_id);
    const affected = trainerRecord ? store.weeklyTemplates.filter(t => t.trainer_id === trainerRecord.id && t.is_active) : [];
    return { ...l, user_name: user?.full_name ?? '?', covered_by_name: coveredBy?.full_name ?? null, affected_sessions: affected.length };
  });
  res.json({ success: true, data: enriched });
});

featuresRoutes.post('/sick-leave', (req: Request, res: Response) => {
  const sl = store.createSickLeave(req.body);
  res.status(201).json({ success: true, data: sl });
});

featuresRoutes.patch('/sick-leave/:id/cover', (req: Request, res: Response) => {
  const sl = store.sickLeaves.find(l => l.id === req.params.id);
  if (!sl) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  sl.covered_by_id = req.body.userId;
  sl.status = 'covered';
  res.json({ success: true, data: sl });
});

// ═══════════════════════════════════════════════════════════════
// COURT OCCUPANCY
// ═══════════════════════════════════════════════════════════════

featuresRoutes.get('/occupancy', (req: Request, res: Response) => {
  const { clubId, from, to } = req.query;
  const courts = store.courts.filter(c => c.is_active && (!clubId || c.club_id === clubId));
  const fromD = from ? new Date(from as string) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  const toD = to ? new Date(to as string) : new Date();
  const totalDays = Math.max(1, Math.ceil((toD.getTime() - fromD.getTime()) / 86400000));
  const operatingHours = 14; // 7:00-21:00

  const courtData = courts.map(court => {
    const bookings = store.bookings.filter(b =>
      b.court_id === court.id && b.status !== 'cancelled' &&
      new Date(b.time_slot_start) >= fromD && new Date(b.time_slot_start) <= toD
    );
    const bookedHours = bookings.reduce((s, b) => {
      return s + (new Date(b.time_slot_end).getTime() - new Date(b.time_slot_start).getTime()) / 3600000;
    }, 0);
    const totalAvailable = totalDays * operatingHours;
    const occupancyPct = totalAvailable > 0 ? Math.round((bookedHours / totalAvailable) * 100) : 0;

    // By type
    const byType: Record<string, number> = {};
    bookings.forEach(b => { byType[b.booking_type] = (byType[b.booking_type] || 0) + 1; });

    return {
      courtId: court.id, courtName: court.name, sportType: court.sport_type,
      bookedHours: Math.round(bookedHours), totalAvailable, occupancyPct,
      totalBookings: bookings.length, byType,
    };
  });

  // By sport
  const bySport: Record<string, { hours: number; bookings: number }> = {};
  courtData.forEach(c => {
    if (!bySport[c.sportType]) bySport[c.sportType] = { hours: 0, bookings: 0 };
    bySport[c.sportType].hours += c.bookedHours;
    bySport[c.sportType].bookings += c.totalBookings;
  });

  res.json({ success: true, data: { courts: courtData, bySport, totalDays, period: { from: fromD.toISOString().split('T')[0], to: toD.toISOString().split('T')[0] } } });
});

// ═══════════════════════════════════════════════════════════════
// EMPLOYEE SCHEDULE VIEW
// ═══════════════════════════════════════════════════════════════

featuresRoutes.get('/employee-schedule', (req: Request, res: Response) => {
  const { clubId } = req.query;
  const trainersUsers = store.users.filter(u => u.role === 'trainer' && (!clubId || u.trainer_club_id === clubId));

  const schedules = trainersUsers.map(u => {
    const trainerRecord = store.trainers.find(t => t.user_id === u.id);
    const templates = trainerRecord ? store.weeklyTemplates.filter(t => t.trainer_id === trainerRecord.id && t.is_active) : [];

    // Get upcoming booked sessions
    const now = new Date();
    const upcoming = store.bookings.filter(b =>
      b.booking_type === 'training' && b.trainer_id === trainerRecord?.id &&
      b.status !== 'cancelled' && new Date(b.time_slot_start) >= now
    ).slice(0, 10).map(b => {
      const court = store.courts.find(c => c.id === b.court_id);
      return { id: b.id, date: b.time_slot_start, court: court?.name, notes: b.notes };
    });

    // Sick leave status
    const sickNow = store.sickLeaves.find(s => s.user_id === u.id && s.status === 'active');

    return {
      userId: u.id, name: u.full_name, email: u.email,
      sportTypes: u.trainer_sport_types, hourlyRate: u.trainer_hourly_rate,
      weeklyTemplates: templates.map(t => ({
        id: t.id, dayOfWeek: t.day_of_week, startHour: t.start_hour, endHour: t.end_hour,
        title: t.title, courtName: store.courts.find(c => c.id === t.court_id)?.name ?? '?',
      })),
      totalWeeklyHours: templates.reduce((s, t) => s + (t.end_hour - t.start_hour), 0),
      upcomingsessions: upcoming,
      isSick: !!sickNow,
      sickLeave: sickNow,
    };
  });

  res.json({ success: true, data: schedules });
});

// ═══════════════════════════════════════════════════════════════
// MASS EMAIL (simulated — logs to console)
// ═══════════════════════════════════════════════════════════════

featuresRoutes.post('/mass-email', (req: Request, res: Response) => {
  const { clubId, subject, body, filter } = req.body;
  // filter: { role?: string, groupId?: string, all?: boolean }
  let recipients = store.users.filter(u => u.is_active);
  if (filter?.role) recipients = recipients.filter(u => u.role === filter.role);
  if (filter?.groupId) {
    const group = store.groups.find(g => g.id === filter.groupId);
    if (group) recipients = recipients.filter(u => group.player_ids.includes(u.id));
  }

  const emails = recipients.map(u => u.email);
  console.log(`[email] Mass email to ${emails.length} recipients: "${subject}"`);
  console.log(`[email] Recipients: ${emails.join(', ')}`);

  res.json({ success: true, data: { sent: emails.length, recipients: emails, subject } });
});

// ═══════════════════════════════════════════════════════════════
// TRAINING FOCUS OPTIONS
// ═══════════════════════════════════════════════════════════════

featuresRoutes.get('/training-options', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      focus_areas: [
        { id: 'grundslag', label: 'Grundslag', icon: '🎾' },
        { id: 'serve', label: 'Serve', icon: '🚀' },
        { id: 'natspel', label: 'Nätspel / Volley', icon: '🏐' },
        { id: 'lobb', label: 'Lobb & Bandeja', icon: '🌀' },
        { id: 'taktik', label: 'Taktik & Spelförståelse', icon: '🧠' },
        { id: 'footwork', label: 'Fotarbete', icon: '👟' },
        { id: 'return', label: 'Return', icon: '↩️' },
        { id: 'lite_av_allt', label: 'Lite av allt', icon: '✨' },
        { id: 'match', label: 'Matchspel', icon: '🏆' },
        { id: 'kondition', label: 'Kondition & Fysik', icon: '💪' },
      ],
    },
  });
});

// ═══════════════════════════════════════════════════════════════
// PLAYER DETAIL (groups + sessions)
// ═══════════════════════════════════════════════════════════════

featuresRoutes.get('/player-detail/:id', (req: Request, res: Response) => {
  const user = store.users.find(u => u.id === req.params.id);
  if (!user) { res.status(404).json({ success: false, error: 'Player not found' }); return; }

  // Groups this player is in
  const memberGroups = store.groups.filter(g => g.is_active && g.player_ids.includes(user.id)).map(g => {
    const parent = g.parent_group_id ? store.groups.find(p => p.id === g.parent_group_id) : null;
    return { id: g.id, name: g.name, category: g.category, sport_type: g.sport_type, parent_name: parent?.name ?? null };
  });

  // Training sessions this player is assigned to
  const sessions = store.trainingSessions.filter(s => s.player_ids.includes(user.id) && s.status !== 'cancelled').map(s => {
    const trainer = store.users.find(u => u.id === s.trainer_id);
    const court = store.courts.find(c => c.id === s.court_id);
    const dayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
    return { id: s.id, title: s.title, day_of_week: s.day_of_week, day_name: dayNames[s.day_of_week], start_hour: s.start_hour, end_hour: s.end_hour, status: s.status, trainer_name: trainer?.full_name ?? '?', court_name: court?.name ?? '?', applied_count: s.applied_dates.length };
  });

  // Forms submitted
  const submissions = store.formSubmissions.filter(s => s.user_id === user.id).map(s => {
    const form = store.registrationForms.find(f => f.id === s.form_id);
    return { form_id: s.form_id, form_title: form?.title ?? '?', submitted_at: s.submitted_at, assigned: s.assigned_to_group };
  });

  // Bookings as player
  const bookingCount = store.bookings.filter(b => (b.booker_id === user.id || b.player_ids.includes(user.id)) && b.status !== 'cancelled').length;

  const { password_hash, ...safe } = user;
  res.json({ success: true, data: { ...safe, groups: memberGroups, sessions, submissions, bookingCount } });
});
