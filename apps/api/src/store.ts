/**
 * In-memory data store for development without PostgreSQL.
 * Mimics the relational structure and constraints from the SQL schema.
 * In production, swap this for the real pg-based db.ts module.
 */
import crypto from 'crypto';

// ─── Types ──────────────────────────────────────────────────────

interface ClubRow {
  id: string; name: string; organization_number: string; is_non_profit: boolean;
  timezone: string; stripe_account_id: string | null; contact_email: string | null;
  contact_phone: string | null; address: string | null; city: string | null;
  created_at: string; updated_at: string;
}

interface CourtRow {
  id: string; club_id: string; name: string; sport_type: string;
  is_indoor: boolean; base_hourly_rate: number; hardware_relay_id: string | null;
  is_active: boolean; created_at: string; updated_at: string;
}

interface UserRow {
  id: string; email: string; password_hash: string; full_name: string;
  phone_number: string | null; elo_padel: number; elo_tennis: number;
  elo_squash: number; elo_badminton: number; matches_played: number;
  avatar_url: string | null; is_active: boolean;
  // Role & trainer fields — users can be promoted to trainer by admins
  role: 'player' | 'trainer' | 'admin';
  trainer_club_id: string | null;      // which club they train at
  trainer_sport_types: string[];       // sports they can coach
  trainer_hourly_rate: number | null;  // default rate (SEK)
  trainer_rates: Record<string, number>;  // per-category rates: { junior: 450, adult: 550, camp: 500 }
  trainer_monthly_salary: number | null;
  trainer_bio: string | null;
  trainer_certifications: string | null;
  created_at: string; updated_at: string;
}

/** @deprecated — kept for backward compat, trainer data now lives on UserRow */
interface TrainerRow {
  id: string; club_id: string; full_name: string; email: string | null;
  phone_number: string | null; sport_types: string[]; hourly_rate: number;
  bio: string | null; is_active: boolean; created_at: string; updated_at: string;
  user_id: string | null; // link to user
}

interface BookingRow {
  id: string; court_id: string; booker_id: string;
  time_slot_start: string; time_slot_end: string;
  status: string; total_price: number; court_rental_vat_rate: number;
  platform_fee: number; access_pin: string | null; is_split_payment: boolean;
  booking_type: 'regular' | 'training' | 'contract' | 'event';
  // Training fields
  trainer_id: string | null;
  player_ids: string[];          // assigned players (training participants)
  training_focus: string[];      // e.g. ['grundslag', 'serve', 'nätspel']
  training_request: string | null; // free-text wish from customer
  // Contract fields
  contract_id: string | null;    // links repeating bookings together
  recurrence_day: number | null; // 0=Sun..6=Sat — the weekday this repeats on
  // Event fields
  event_name: string | null;
  event_max_participants: number | null;
  event_attendee_ids: string[];  // players who signed up
  // General
  notes: string | null;
  cancellation_reason: string | null;
  // Recurrence linkage (see migrations 007 + 010)
  recurrence_rule_id: string | null;    // rule that generated this booking
  generation_batch_id: string | null;   // apply-to-period batch id, for undo
  created_at: string; updated_at: string;
}

interface SplitPaymentRow {
  id: string; booking_id: string; user_id: string; amount_due: number;
  payment_status: string; payment_method: string | null;
  stripe_payment_intent_id: string | null; paid_at: string | null;
  created_at: string; updated_at: string;
}

interface MatchRow {
  id: string; booking_id: string | null; tournament_id: string | null;
  sport_type: string; team1_player_ids: string[]; team2_player_ids: string[];
  team1_score: number | null; team2_score: number | null;
  winner_team: number | null; elo_processed: boolean;
  played_at: string | null; created_at: string;
}

interface TournamentRow {
  id: string; club_id: string; name: string; sport_type: string;
  format: string; player_ids: string[]; points_per_match: number;
  schedule: any; standings: any; status: string;
  starts_at: string | null; created_at: string; updated_at: string;
}

// ─── Groups (vuxen, junior, läger, etc.) ────────────────────
interface GroupRow {
  id: string; club_id: string; name: string;
  category: 'junior' | 'adult' | 'senior' | 'camp' | 'competition' | 'other';
  parent_group_id: string | null;  // master category — this group belongs to a parent
  sport_type: string; player_ids: string[]; trainer_ids: string[];
  max_size: number | null; notes: string | null;
  is_active: boolean; created_at: string; updated_at: string;
}

// ─── Time Reports (trainer hour logging) ────────────────────
interface TimeReportRow {
  id: string; user_id: string; club_id: string;
  date: string; hours: number; type: 'training' | 'admin' | 'event' | 'other';
  description: string | null; booking_id: string | null;
  approved: boolean; created_at: string;
}

// ─── Sick Leave ─────────────────────────────────────────────
interface SickLeaveRow {
  id: string; user_id: string; club_id: string;
  start_date: string; end_date: string | null;
  note: string | null; coverage_needed: boolean;
  covered_by_id: string | null; status: 'active' | 'covered' | 'resolved';
  created_at: string;
}

// ─── Loyalty Program ────────────────────────────────────────
interface LoyaltyRow {
  id: string; user_id: string; club_id: string;
  total_bookings: number; free_bookings_earned: number; free_bookings_used: number;
  tier: 'bronze' | 'silver' | 'gold';
  updated_at: string;
}

// ─── Price Rules (dynamic pricing) ──────────────────────────
interface PriceRuleRow {
  id: string; court_id: string;
  day_of_week: number | null;   // null = all days
  start_hour: number; end_hour: number;
  price_override: number;       // SEK per hour
  label: string | null;         // e.g. "Happy Hour", "Peak"
  is_active: boolean;
}

// ─── Training Sessions (planner → schedule) ────────────────
// Sessions are planned by WEEKDAY, not by date.
// They are templates that get "applied" to generate real bookings across a date range.
interface TrainingSessionRow {
  id: string;
  club_id: string;
  title: string;
  court_id: string;
  trainer_id: string;
  player_ids: string[];
  // Attendance tracking per player
  going_ids: string[];     // confirmed attending
  declined_ids: string[];  // said no
  invited_ids: string[];   // invited but no response
  waitlist_ids: string[];  // on waitlist
  day_of_week: number;     // 0=Sun, 1=Mon, ..., 6=Sat
  start_hour: number;
  end_hour: number;
  notes: string | null;
  status: 'planned' | 'applied' | 'cancelled';
  applied_dates: string[];
  created_at: string;
  updated_at: string;
}

// ─── Registration Forms (term sign-ups) ─────────────────────
interface RegistrationFormRow {
  id: string; club_id: string;
  title: string;               // "Vuxentennis Vår 2026"
  description: string | null;
  sport_type: string;
  category: string;            // junior, adult, senior, camp, etc.
  season: string;              // "Vår 2026"
  target_group_id: string | null;  // auto-assign submissions to this group
  fields: FormFieldDef[];      // custom fields the member fills out
  status: 'open' | 'closed' | 'draft';
  max_submissions: number | null;
  created_at: string; updated_at: string;
}

interface FormFieldDef {
  key: string;        // unique field key
  label: string;      // display label
  type: 'text' | 'select' | 'number' | 'checkbox';
  options?: string[]; // for select fields
  required: boolean;
}

interface FormSubmissionRow {
  id: string;
  form_id: string;
  user_id: string;
  answers: Record<string, string | number | boolean>;
  submitted_at: string;
  assigned_to_group: boolean;
}

// ─── Split Payments (MATCHi-style) ──────────────────────────
interface SplitInviteRow {
  id: string; booking_id: string; inviter_id: string; invitee_id: string;
  amount: number; status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string; paid_at: string | null;
}

// ─── Public Matches (matchmaking) ───────────────────────────
interface PublicMatchRow {
  id: string; booking_id: string; host_id: string; club_id: string;
  sport_type: string; court_name: string;
  date: string; start_hour: number; end_hour: number;
  min_level: number; max_level: number;  // 1-10
  spots_total: number; spots_filled: number;
  player_ids: string[];
  status: 'open' | 'full' | 'cancelled' | 'completed';
  notes: string | null; created_at: string;
}

// ─── Waitlist ───────────────────────────────────────────────
interface WaitlistRow {
  id: string; user_id: string; booking_id: string | null;
  activity_type: string;  // 'booking' | 'event' | 'public_match'
  target_id: string;      // booking or event id
  position: number; status: 'waiting' | 'notified' | 'claimed' | 'expired';
  created_at: string;
}

// ─── Leagues (Backhandsmash) ────────────────────────────────
interface LeagueRow {
  id: string; club_id: string; name: string; sport_type: string;
  season: string;         // e.g. "Höst 2026"
  division: string;       // e.g. "Division 1", "Herr A"
  format: 'singles' | 'doubles';
  player_ids: string[];
  matches_played: number; status: 'active' | 'completed' | 'draft';
  standings: { player_id: string; wins: number; losses: number; points: number; elo: number }[];
  created_at: string; updated_at: string;
}

// ─── Clip Cards / Value Cards ───────────────────────────────
interface ClipCardRow {
  id: string; club_id: string; name: string;
  type: 'clip' | 'value';   // clip = N uses, value = SEK balance
  total_clips: number | null; remaining_clips: number | null;
  total_value: number | null; remaining_value: number | null;
  price: number;             // purchase price
  valid_from: string | null; valid_until: string | null;
  restricted_hours: { start: number; end: number } | null;  // e.g. only 07-16
  restricted_sports: string[] | null;
  owner_id: string;
  is_active: boolean; created_at: string;
}

// ─── Seasons (Abonnemangssäsonger) ──────────────────────────
interface SeasonRow {
  id: string; club_id: string; name: string;  // "Hösttermin 2026"
  start_date: string; end_date: string;
  status: 'draft' | 'active' | 'completed';
  subscription_count: number;
  created_at: string;
}

interface SubscriptionRow {
  id: string; season_id: string; club_id: string;
  customer_id: string; court_id: string;
  day_of_week: number; start_hour: number; end_hour: number;
  price_per_session: number; frequency: 'weekly' | 'biweekly';
  status: 'active' | 'paused' | 'cancelled';
  created_at: string;
}

// ─── Venue Profiles ─────────────────────────────────────────
interface VenueProfileRow {
  id: string; club_id: string;
  description: string | null;
  amenities: string[];       // ['omklädningsrum', 'bastu', 'parkering', 'pro-shop', 'café', 'rackuthyrning']
  images: string[];          // URL strings
  opening_hours: { day: number; open: string; close: string }[];
  booking_rules: {
    max_days_ahead: number;
    cancellation_hours: number;
    refund_percentage: number;
    max_bookings_per_user: number | null;
    show_names_in_schedule: boolean;
  };
  social_links: { website?: string; instagram?: string; facebook?: string };
  created_at: string; updated_at: string;
}

// ─── Statements (financial reconciliation) ──────────────────
interface StatementRow {
  id: string; club_id: string; period: string;  // "2026-04"
  total_earned: number;     // Intjänat under perioden
  total_paid_out: number;   // Utbetalat till bankkonto
  online_payments: number;
  clip_card_redemptions: number;
  late_cancellation_fees: number;
  platform_fees: number;
  pending_payout: number;
  created_at: string;
}

/** A weekly recurring template — defines an activity that repeats every week */
interface WeeklyTemplateRow {
  id: string;
  club_id: string;
  court_id: string;
  day_of_week: number;      // 0=Sun, 1=Mon, ..., 6=Sat
  start_hour: number;       // 7-21
  end_hour: number;
  activity_type: 'training' | 'contract' | 'event';
  title: string;            // e.g. "Beginners Padel" or "Lisa's weekly"
  trainer_id: string | null;
  player_ids: string[];     // assigned players (training) or empty
  event_max_participants: number | null;
  notes: string | null;
  is_active: boolean;
  color: string;            // for visual display
  created_at: string;
  updated_at: string;
}

// ─── Recurrence Rules (unified scheduling primitive) ────────────
// Replaces the patchwork of training-session templates + weekly-templates +
// bookings.contract_id groups with one concept. The recurrence engine expands
// a rule into concrete booking instances, honoring blackouts + skip_dates.
// See: packages/db/migrations/007_recurrence_rules.sql
export interface RecurrenceRuleRow {
  id: string;
  club_id: string;
  title: string;
  booking_type: 'regular' | 'training' | 'contract' | 'event';

  court_id: string;
  start_hour: number;   // 0..23
  end_hour: number;     // > start_hour, up to 24

  freq: 'once' | 'weekly' | 'biweekly' | 'monthly';
  interval_n: number;           // 1 = every period, 2 = every other, etc.
  weekdays: number[];           // 0=Sun..6=Sat; empty array allowed only for freq='once'
  start_date: string;           // YYYY-MM-DD
  end_date: string | null;      // null = open-ended
  skip_dates: string[];         // YYYY-MM-DD explicit holes

  trainer_id: string | null;
  player_ids: string[];
  event_name: string | null;
  event_max_participants: number | null;

  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Blackout Periods (closures / holidays / maintenance) ──────
// First-class exclusion the recurrence engine always respects.
// See: packages/db/migrations/008_blackout_periods.sql
export interface BlackoutPeriodRow {
  id: string;
  club_id: string;
  starts_at: string;            // ISO timestamp
  ends_at: string;              // ISO timestamp, > starts_at
  reason: string | null;
  court_ids: string[];          // empty = all courts at this club
  created_by: string | null;
  created_at: string;
}

// ─── Attendance (RSVP + check-in per booking, per user) ────────
// Replaces the booking-level player_ids / event_attendee_ids arrays with a
// proper relation that carries RSVP state, waitlist order, and check-in.
// See: packages/db/migrations/009_attendance.sql
export interface AttendanceRow {
  booking_id: string;
  user_id: string;
  status: 'invited' | 'going' | 'declined' | 'waitlist' | 'present' | 'no_show';
  responded_at: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  waitlist_position: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Store ──────────────────────────────────────────────────────

function uid(): string { return crypto.randomUUID(); }
function now(): string { return new Date().toISOString(); }

class InMemoryStore {
  clubs: ClubRow[] = [];
  courts: CourtRow[] = [];
  users: UserRow[] = [];
  trainers: TrainerRow[] = [];
  weeklyTemplates: WeeklyTemplateRow[] = [];
  groups: GroupRow[] = [];
  timeReports: TimeReportRow[] = [];
  sickLeaves: SickLeaveRow[] = [];
  loyalty: LoyaltyRow[] = [];
  priceRules: PriceRuleRow[] = [];
  trainingSessions: TrainingSessionRow[] = [];
  registrationForms: RegistrationFormRow[] = [];
  formSubmissions: FormSubmissionRow[] = [];
  splitInvites: SplitInviteRow[] = [];
  publicMatches: PublicMatchRow[] = [];
  waitlists: WaitlistRow[] = [];
  leagues: LeagueRow[] = [];
  clipCards: ClipCardRow[] = [];
  seasons: SeasonRow[] = [];
  subscriptions: SubscriptionRow[] = [];
  venueProfiles: VenueProfileRow[] = [];
  statements: StatementRow[] = [];
  bookings: BookingRow[] = [];
  splitPayments: SplitPaymentRow[] = [];
  matches: MatchRow[] = [];
  recurrenceRules: RecurrenceRuleRow[] = [];
  blackoutPeriods: BlackoutPeriodRow[] = [];
  attendance: AttendanceRow[] = [];
  tournaments: TournamentRow[] = [];

  // ─── Clubs ──────────────────────────────────────────────────
  createClub(data: Partial<ClubRow>): ClubRow {
    const club: ClubRow = {
      id: uid(), name: data.name!, organization_number: data.organization_number!,
      is_non_profit: data.is_non_profit ?? false, timezone: data.timezone ?? 'Europe/Stockholm',
      stripe_account_id: data.stripe_account_id ?? null,
      contact_email: data.contact_email ?? null, contact_phone: data.contact_phone ?? null,
      address: data.address ?? null, city: data.city ?? null,
      created_at: now(), updated_at: now(),
    };
    this.clubs.push(club);
    return club;
  }

  // ─── Courts ─────────────────────────────────────────────────
  createCourt(data: Partial<CourtRow>): CourtRow {
    const court: CourtRow = {
      id: uid(), club_id: data.club_id!, name: data.name!,
      sport_type: data.sport_type!, is_indoor: data.is_indoor ?? true,
      base_hourly_rate: data.base_hourly_rate!, hardware_relay_id: data.hardware_relay_id ?? null,
      is_active: true, created_at: now(), updated_at: now(),
    };
    this.courts.push(court);
    return court;
  }

  // ─── Users ──────────────────────────────────────────────────
  createUser(data: Partial<UserRow>): UserRow {
    if (this.users.find(u => u.email === data.email)) {
      throw Object.assign(new Error('Email already registered'), { code: '23505' });
    }
    const user: UserRow = {
      id: uid(), email: data.email!, password_hash: data.password_hash!,
      full_name: data.full_name!, phone_number: data.phone_number ?? null,
      elo_padel: 1000, elo_tennis: 1000, elo_squash: 1000, elo_badminton: 1000,
      matches_played: 0, avatar_url: null, is_active: true,
      role: data.role ?? 'player',
      trainer_club_id: data.trainer_club_id ?? null,
      trainer_sport_types: data.trainer_sport_types ?? [],
      trainer_hourly_rate: data.trainer_hourly_rate ?? null,
      trainer_rates: data.trainer_rates ?? {},
      trainer_monthly_salary: data.trainer_monthly_salary ?? null,
      trainer_bio: data.trainer_bio ?? null,
      trainer_certifications: data.trainer_certifications ?? null,
      created_at: now(), updated_at: now(),
    };
    this.users.push(user);
    return user;
  }

  // ─── Trainers ────────────────────────────────────────────────
  createTrainer(data: Partial<TrainerRow>): TrainerRow {
    const trainer: TrainerRow = {
      id: uid(), club_id: data.club_id!, full_name: data.full_name!,
      email: data.email ?? null, phone_number: data.phone_number ?? null,
      sport_types: data.sport_types ?? ['padel'], hourly_rate: data.hourly_rate ?? 500,
      bio: data.bio ?? null, is_active: true, user_id: data.user_id ?? null,
      created_at: now(), updated_at: now(),
    };
    this.trainers.push(trainer);
    return trainer;
  }

  // ─── Weekly Templates ────────────────────────────────────────
  createWeeklyTemplate(data: Partial<WeeklyTemplateRow>): WeeklyTemplateRow {
    const t: WeeklyTemplateRow = {
      id: uid(), club_id: data.club_id!, court_id: data.court_id!,
      day_of_week: data.day_of_week!, start_hour: data.start_hour!, end_hour: data.end_hour!,
      activity_type: data.activity_type ?? 'training',
      title: data.title ?? 'Untitled',
      trainer_id: data.trainer_id ?? null,
      player_ids: data.player_ids ?? [],
      event_max_participants: data.event_max_participants ?? null,
      notes: data.notes ?? null,
      is_active: true,
      color: data.color ?? '#6366f1',
      created_at: now(), updated_at: now(),
    };
    this.weeklyTemplates.push(t);
    return t;
  }

  // ─── Groups ─────────────────────────────────────────────────
  createGroup(data: Partial<GroupRow>): GroupRow {
    const g: GroupRow = {
      id: uid(), club_id: data.club_id!, name: data.name!,
      category: data.category ?? 'other', parent_group_id: data.parent_group_id ?? null,
      sport_type: data.sport_type ?? 'padel',
      player_ids: data.player_ids ?? [], trainer_ids: data.trainer_ids ?? [],
      max_size: data.max_size ?? null, notes: data.notes ?? null,
      is_active: true, created_at: now(), updated_at: now(),
    };
    this.groups.push(g);
    return g;
  }

  // ─── Time Reports ──────────────────────────────────────────
  createTimeReport(data: Partial<TimeReportRow>): TimeReportRow {
    const tr: TimeReportRow = {
      id: uid(), user_id: data.user_id!, club_id: data.club_id!,
      date: data.date!, hours: data.hours!, type: data.type ?? 'training',
      description: data.description ?? null, booking_id: data.booking_id ?? null,
      approved: false, created_at: now(),
    };
    this.timeReports.push(tr);
    return tr;
  }

  // ─── Sick Leave ────────────────────────────────────────────
  createSickLeave(data: Partial<SickLeaveRow>): SickLeaveRow {
    const sl: SickLeaveRow = {
      id: uid(), user_id: data.user_id!, club_id: data.club_id!,
      start_date: data.start_date!, end_date: data.end_date ?? null,
      note: data.note ?? null, coverage_needed: data.coverage_needed ?? true,
      covered_by_id: null, status: 'active', created_at: now(),
    };
    this.sickLeaves.push(sl);
    return sl;
  }

  // ─── Price Rules ───────────────────────────────────────────
  createPriceRule(data: Partial<PriceRuleRow>): PriceRuleRow {
    const pr: PriceRuleRow = {
      id: uid(), court_id: data.court_id!,
      day_of_week: data.day_of_week ?? null,
      start_hour: data.start_hour!, end_hour: data.end_hour!,
      price_override: data.price_override!, label: data.label ?? null,
      is_active: true,
    };
    this.priceRules.push(pr);
    return pr;
  }

  // ─── Training Sessions ──────────────────────────────────────
  createTrainingSession(data: Partial<TrainingSessionRow>): TrainingSessionRow {
    const ts: TrainingSessionRow = {
      id: uid(), club_id: data.club_id!, title: data.title ?? 'Träningspass',
      court_id: data.court_id!, trainer_id: data.trainer_id!,
      player_ids: data.player_ids ?? [],
      going_ids: data.going_ids ?? [], declined_ids: data.declined_ids ?? [],
      invited_ids: data.invited_ids ?? [], waitlist_ids: data.waitlist_ids ?? [],
      day_of_week: data.day_of_week!,
      start_hour: data.start_hour!, end_hour: data.end_hour!,
      notes: data.notes ?? null, status: 'planned',
      applied_dates: [], created_at: now(), updated_at: now(),
    };
    this.trainingSessions.push(ts);
    return ts;
  }

  // ─── Bookings ───────────────────────────────────────────────
  createBooking(data: Partial<BookingRow>): BookingRow {
    // Simulate the EXCLUDE USING gist constraint: check for temporal overlap
    const overlap = this.bookings.find(b =>
      b.court_id === data.court_id &&
      b.status !== 'cancelled' &&
      new Date(b.time_slot_start) < new Date(data.time_slot_end!) &&
      new Date(b.time_slot_end) > new Date(data.time_slot_start!)
    );
    if (overlap) {
      throw Object.assign(new Error('Exclusion constraint violation'), { code: '23P01' });
    }

    const booking: BookingRow = {
      id: uid(), court_id: data.court_id!, booker_id: data.booker_id!,
      time_slot_start: data.time_slot_start!, time_slot_end: data.time_slot_end!,
      status: data.status ?? 'pending', total_price: data.total_price!,
      court_rental_vat_rate: data.court_rental_vat_rate ?? 0.06,
      platform_fee: data.platform_fee ?? 0, access_pin: data.access_pin ?? null,
      is_split_payment: data.is_split_payment ?? false,
      booking_type: data.booking_type ?? 'regular',
      trainer_id: data.trainer_id ?? null,
      player_ids: data.player_ids ?? [],
      training_focus: data.training_focus ?? [],
      training_request: data.training_request ?? null,
      contract_id: data.contract_id ?? null,
      recurrence_day: data.recurrence_day ?? null,
      event_name: data.event_name ?? null,
      event_max_participants: data.event_max_participants ?? null,
      event_attendee_ids: data.event_attendee_ids ?? [],
      notes: data.notes ?? null,
      cancellation_reason: null,
      recurrence_rule_id: data.recurrence_rule_id ?? null,
      generation_batch_id: data.generation_batch_id ?? null,
      created_at: now(), updated_at: now(),
    };
    this.bookings.push(booking);
    return booking;
  }

  // ─── Recurrence Rules ──────────────────────────────────────
  createRecurrenceRule(data: Partial<RecurrenceRuleRow>): RecurrenceRuleRow {
    if (data.end_hour !== undefined && data.start_hour !== undefined && data.end_hour <= data.start_hour) {
      throw new Error('end_hour must be greater than start_hour');
    }
    const rule: RecurrenceRuleRow = {
      id: uid(),
      club_id: data.club_id!,
      title: data.title ?? 'Untitled',
      booking_type: data.booking_type ?? 'training',
      court_id: data.court_id!,
      start_hour: data.start_hour!,
      end_hour: data.end_hour!,
      freq: data.freq ?? 'weekly',
      interval_n: data.interval_n ?? 1,
      weekdays: data.weekdays ?? [],
      start_date: data.start_date!,
      end_date: data.end_date ?? null,
      skip_dates: data.skip_dates ?? [],
      trainer_id: data.trainer_id ?? null,
      player_ids: data.player_ids ?? [],
      event_name: data.event_name ?? null,
      event_max_participants: data.event_max_participants ?? null,
      notes: data.notes ?? null,
      is_active: data.is_active ?? true,
      created_by: data.created_by ?? null,
      created_at: now(), updated_at: now(),
    };
    this.recurrenceRules.push(rule);
    return rule;
  }

  // ─── Blackout Periods ──────────────────────────────────────
  createBlackoutPeriod(data: Partial<BlackoutPeriodRow>): BlackoutPeriodRow {
    if (data.starts_at && data.ends_at && new Date(data.ends_at) <= new Date(data.starts_at)) {
      throw new Error('ends_at must be after starts_at');
    }
    const bp: BlackoutPeriodRow = {
      id: uid(),
      club_id: data.club_id!,
      starts_at: data.starts_at!,
      ends_at: data.ends_at!,
      reason: data.reason ?? null,
      court_ids: data.court_ids ?? [],
      created_by: data.created_by ?? null,
      created_at: now(),
    };
    this.blackoutPeriods.push(bp);
    return bp;
  }

  // ─── Attendance ────────────────────────────────────────────
  // upsert-style: any given (booking, user) pair is unique.
  upsertAttendance(data: Partial<AttendanceRow> & { booking_id: string; user_id: string }): AttendanceRow {
    const existing = this.attendance.find(a => a.booking_id === data.booking_id && a.user_id === data.user_id);
    if (existing) {
      if (data.status !== undefined) existing.status = data.status;
      if (data.responded_at !== undefined) existing.responded_at = data.responded_at;
      if (data.checked_in_at !== undefined) existing.checked_in_at = data.checked_in_at;
      if (data.checked_in_by !== undefined) existing.checked_in_by = data.checked_in_by;
      if (data.waitlist_position !== undefined) existing.waitlist_position = data.waitlist_position;
      if (data.notes !== undefined) existing.notes = data.notes;
      existing.updated_at = now();
      return existing;
    }
    const row: AttendanceRow = {
      booking_id: data.booking_id,
      user_id: data.user_id,
      status: data.status ?? 'invited',
      responded_at: data.responded_at ?? null,
      checked_in_at: data.checked_in_at ?? null,
      checked_in_by: data.checked_in_by ?? null,
      waitlist_position: data.waitlist_position ?? null,
      notes: data.notes ?? null,
      created_at: now(), updated_at: now(),
    };
    this.attendance.push(row);
    return row;
  }

  // ─── Split Payments ─────────────────────────────────────────
  createSplitPayment(data: Partial<SplitPaymentRow>): SplitPaymentRow {
    const sp: SplitPaymentRow = {
      id: uid(), booking_id: data.booking_id!, user_id: data.user_id!,
      amount_due: data.amount_due!, payment_status: 'pending',
      payment_method: null, stripe_payment_intent_id: null,
      paid_at: null, created_at: now(), updated_at: now(),
    };
    this.splitPayments.push(sp);
    return sp;
  }

  // ─── Matches ────────────────────────────────────────────────
  createMatch(data: Partial<MatchRow>): MatchRow {
    const match: MatchRow = {
      id: uid(), booking_id: data.booking_id ?? null,
      tournament_id: data.tournament_id ?? null, sport_type: data.sport_type!,
      team1_player_ids: data.team1_player_ids!, team2_player_ids: data.team2_player_ids!,
      team1_score: data.team1_score ?? null, team2_score: data.team2_score ?? null,
      winner_team: data.winner_team ?? null, elo_processed: false,
      played_at: now(), created_at: now(),
    };
    this.matches.push(match);
    return match;
  }

  // ─── Tournaments ────────────────────────────────────────────
  createTournament(data: Partial<TournamentRow>): TournamentRow {
    const t: TournamentRow = {
      id: uid(), club_id: data.club_id!, name: data.name!,
      sport_type: data.sport_type!, format: data.format!,
      player_ids: data.player_ids!, points_per_match: data.points_per_match ?? 32,
      schedule: data.schedule ?? [], standings: data.standings ?? {},
      status: 'draft', starts_at: data.starts_at ?? null,
      created_at: now(), updated_at: now(),
    };
    this.tournaments.push(t);
    return t;
  }

  // ─── Seed demo data ─────────────────────────────────────────
  seed() {
    // Demo club
    const club = this.createClub({
      name: 'Stockholm Padel Arena', organization_number: '559123-4567',
      is_non_profit: false, city: 'Stockholm',
      contact_email: 'info@stockholmpadelarena.se',
    });
    const club2 = this.createClub({
      name: 'Uppsala TK', organization_number: '802456-7890',
      is_non_profit: true, city: 'Uppsala',
      contact_email: 'kansli@uppsalatk.se',
    });

    // Demo courts
    const c1 = this.createCourt({ club_id: club.id, name: 'Padel Bana 1', sport_type: 'padel', base_hourly_rate: 400, is_indoor: true });
    const c2 = this.createCourt({ club_id: club.id, name: 'Padel Bana 2', sport_type: 'padel', base_hourly_rate: 400, is_indoor: true });
    const c3 = this.createCourt({ club_id: club.id, name: 'Padel Bana 3 (Utomhus)', sport_type: 'padel', base_hourly_rate: 300, is_indoor: false });
    const c4 = this.createCourt({ club_id: club2.id, name: 'Tennisbana 1', sport_type: 'tennis', base_hourly_rate: 250, is_indoor: true });
    const c5 = this.createCourt({ club_id: club2.id, name: 'Tennisbana 2', sport_type: 'tennis', base_hourly_rate: 250, is_indoor: true });
    this.createCourt({ club_id: club2.id, name: 'Squashbana 1', sport_type: 'squash', base_hourly_rate: 180, is_indoor: true });

    // Demo users (password: "password123" hashed with bcrypt)
    const hash = '$2a$12$LJ3m4ys3LzHNbfGAMPBQ5u7XrQZBGHHCKJLBV1v8eT3XW.KTmPFCe';
    const u1 = this.createUser({ email: 'anna@example.com', password_hash: hash, full_name: 'Anna Svensson', phone_number: '+46701234567' });
    const u2 = this.createUser({ email: 'erik@example.com', password_hash: hash, full_name: 'Erik Lindberg', phone_number: '+46709876543' });
    const u3 = this.createUser({ email: 'maja@example.com', password_hash: hash, full_name: 'Maja Andersson' });
    const u4 = this.createUser({ email: 'oscar@example.com', password_hash: hash, full_name: 'Oscar Johansson' });
    const u5 = this.createUser({ email: 'lisa@example.com', password_hash: hash, full_name: 'Lisa Nilsson' });
    const u6 = this.createUser({ email: 'karl@example.com', password_hash: hash, full_name: 'Karl Bergström' });

    // Trainer users — registered as users with trainer role
    const u7 = this.createUser({ email: 'johan@trainer.se', password_hash: hash, full_name: 'Johan Pettersson', phone_number: '+46701111111', role: 'trainer', trainer_club_id: club.id, trainer_sport_types: ['padel', 'tennis'], trainer_hourly_rate: 600, trainer_rates: { junior: 500, adult: 600, competition: 650, camp: 550 }, trainer_monthly_salary: 28000, trainer_bio: 'Certified WPT coach, 10 years experience', trainer_certifications: 'WPT Level 2, SvTF B-trainer' });
    const u8 = this.createUser({ email: 'sofia@trainer.se', password_hash: hash, full_name: 'Sofia Ekström', phone_number: '+46702222222', role: 'trainer', trainer_club_id: club.id, trainer_sport_types: ['padel'], trainer_hourly_rate: 550, trainer_rates: { junior: 450, adult: 550, camp: 480 }, trainer_monthly_salary: 24000, trainer_bio: 'Former pro player, specializing in beginners', trainer_certifications: 'SPF Coach Level 1' });
    const u9 = this.createUser({ email: 'marcus@trainer.se', password_hash: hash, full_name: 'Marcus Holm', role: 'trainer', trainer_club_id: club2.id, trainer_sport_types: ['tennis'], trainer_hourly_rate: 700, trainer_rates: { junior: 600, adult: 700, competition: 750 }, trainer_monthly_salary: 32000, trainer_bio: 'SvTF licensed A-trainer', trainer_certifications: 'SvTF A-trainer, ITF Coaching Certificate' });

    // Legacy trainer records — linked to user accounts
    const tr1 = this.createTrainer({ club_id: club.id, full_name: 'Johan Pettersson', email: 'johan@trainer.se', phone_number: '+46701111111', sport_types: ['padel', 'tennis'], hourly_rate: 600, bio: 'Certified WPT coach, 10 years experience', user_id: u7.id });
    const tr2 = this.createTrainer({ club_id: club.id, full_name: 'Sofia Ekström', email: 'sofia@trainer.se', phone_number: '+46702222222', sport_types: ['padel'], hourly_rate: 550, bio: 'Former pro player, specializing in beginners', user_id: u8.id });
    const tr3 = this.createTrainer({ club_id: club2.id, full_name: 'Marcus Holm', email: 'marcus@trainer.se', sport_types: ['tennis'], hourly_rate: 700, bio: 'SvTF licensed A-trainer', user_id: u9.id });

    // Weekly recurring templates
    this.createWeeklyTemplate({ club_id: club.id, court_id: c1.id, day_of_week: 1, start_hour: 9, end_hour: 10, activity_type: 'training', title: 'Beginners Padel', trainer_id: tr2.id, player_ids: [u3.id, u4.id], color: '#6366f1' });
    this.createWeeklyTemplate({ club_id: club.id, court_id: c1.id, day_of_week: 1, start_hour: 17, end_hour: 18, activity_type: 'training', title: 'Advanced Drills', trainer_id: tr1.id, player_ids: [u1.id, u2.id, u5.id], color: '#8b5cf6' });
    this.createWeeklyTemplate({ club_id: club.id, court_id: c2.id, day_of_week: 2, start_hour: 10, end_hour: 11, activity_type: 'training', title: 'Kids Padel (8-12)', trainer_id: tr2.id, color: '#06b6d4' });
    this.createWeeklyTemplate({ club_id: club.id, court_id: c1.id, day_of_week: 3, start_hour: 18, end_hour: 19, activity_type: 'contract', title: 'Lisa Weekly Practice', player_ids: [u5.id], color: '#f59e0b' });
    this.createWeeklyTemplate({ club_id: club.id, court_id: c2.id, day_of_week: 3, start_hour: 19, end_hour: 21, activity_type: 'event', title: 'Wednesday Americano', event_max_participants: 8, color: '#ec4899' });
    this.createWeeklyTemplate({ club_id: club.id, court_id: c1.id, day_of_week: 4, start_hour: 10, end_hour: 11, activity_type: 'training', title: 'Match Strategy', trainer_id: tr1.id, player_ids: [u1.id, u2.id], color: '#6366f1' });
    this.createWeeklyTemplate({ club_id: club.id, court_id: c3.id, day_of_week: 5, start_hour: 17, end_hour: 19, activity_type: 'event', title: 'Friday Social Padel', event_max_participants: 12, color: '#ec4899' });
    this.createWeeklyTemplate({ club_id: club.id, court_id: c2.id, day_of_week: 5, start_hour: 9, end_hour: 10, activity_type: 'training', title: 'Serve & Volley Clinic', trainer_id: tr1.id, color: '#8b5cf6' });
    this.createWeeklyTemplate({ club_id: club.id, court_id: c1.id, day_of_week: 6, start_hour: 10, end_hour: 12, activity_type: 'event', title: 'Saturday Tournament Prep', event_max_participants: 16, color: '#ec4899' });

    // Vary Elo ratings
    u1.elo_padel = 1450; u1.matches_played = 42;
    u2.elo_padel = 1320; u2.elo_tennis = 1580; u2.matches_played = 67;
    u3.elo_padel = 1180; u3.matches_played = 15;
    u4.elo_padel = 1090; u4.elo_tennis = 1250; u4.matches_played = 28;
    u5.elo_padel = 1510; u5.matches_played = 55;
    u6.elo_tennis = 1400; u6.matches_played = 33;

    // Demo bookings (today and upcoming)
    const today = new Date();
    const fmt = (d: Date, h: number) => {
      const r = new Date(d);
      r.setHours(h, 0, 0, 0);
      return r.toISOString();
    };

    // Regular bookings
    this.createBooking({ court_id: c1.id, booker_id: u1.id, time_slot_start: fmt(today, 10), time_slot_end: fmt(today, 11), status: 'confirmed', total_price: 420, access_pin: '847291', booking_type: 'regular' });
    this.createBooking({ court_id: c1.id, booker_id: u2.id, time_slot_start: fmt(today, 14), time_slot_end: fmt(today, 15), status: 'confirmed', total_price: 420, access_pin: '193847', booking_type: 'regular' });
    this.createBooking({ court_id: c2.id, booker_id: u3.id, time_slot_start: fmt(today, 11), time_slot_end: fmt(today, 12), status: 'pending', total_price: 420, is_split_payment: true, booking_type: 'regular' });

    // Training — trainer + assigned players
    this.createBooking({ court_id: c2.id, booker_id: u1.id, time_slot_start: fmt(today, 15), time_slot_end: fmt(today, 16), status: 'confirmed', total_price: 970, booking_type: 'training', trainer_id: tr1.id, player_ids: [u1.id, u3.id, u4.id], notes: 'Beginner padel technique session', access_pin: '443120' });

    // Contract — repeats every week (same weekday)
    const contractId1 = uid();
    this.createBooking({ court_id: c1.id, booker_id: u5.id, time_slot_start: fmt(today, 18), time_slot_end: fmt(today, 19), status: 'confirmed', total_price: 400, booking_type: 'contract', contract_id: contractId1, recurrence_day: today.getDay(), notes: 'Weekly practice — Lisa', access_pin: '551234' });

    // Event — players sign up to attend
    this.createBooking({ court_id: c3.id, booker_id: 'admin', time_slot_start: fmt(today, 17), time_slot_end: fmt(today, 19), status: 'confirmed', total_price: 0, booking_type: 'event', event_name: 'Friday Social Padel', event_max_participants: 8, event_attendee_ids: [u1.id, u2.id, u3.id, u5.id], access_pin: '900000' });

    this.createBooking({ court_id: c4.id, booker_id: u4.id, time_slot_start: fmt(today, 16), time_slot_end: fmt(today, 17), status: 'confirmed', total_price: 262.5, access_pin: '582034', booking_type: 'regular' });

    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    this.createBooking({ court_id: c1.id, booker_id: u5.id, time_slot_start: fmt(tomorrow, 9), time_slot_end: fmt(tomorrow, 10), status: 'confirmed', total_price: 420, access_pin: '673920', booking_type: 'regular' });
    // Training tomorrow with player assignments
    this.createBooking({ court_id: c1.id, booker_id: u2.id, time_slot_start: fmt(tomorrow, 13), time_slot_end: fmt(tomorrow, 15), status: 'confirmed', total_price: 1940, booking_type: 'training', trainer_id: tr2.id, player_ids: [u2.id, u4.id], notes: 'Advanced padel doubles tactics', access_pin: '881234' });
    // Contract repeating tomorrow too
    this.createBooking({ court_id: c1.id, booker_id: u5.id, time_slot_start: fmt(tomorrow, 18), time_slot_end: fmt(tomorrow, 19), status: 'confirmed', total_price: 400, booking_type: 'contract', contract_id: contractId1, recurrence_day: tomorrow.getDay(), notes: 'Weekly practice — Lisa', access_pin: '551235' });
    // Event tomorrow
    this.createBooking({ court_id: c2.id, booker_id: 'admin', time_slot_start: fmt(tomorrow, 17), time_slot_end: fmt(tomorrow, 19), status: 'confirmed', total_price: 0, booking_type: 'event', event_name: 'Beginners Welcome Night', event_max_participants: 12, event_attendee_ids: [u3.id, u6.id], access_pin: '900001' });
    this.createBooking({ court_id: c3.id, booker_id: u1.id, time_slot_start: fmt(tomorrow, 18), time_slot_end: fmt(tomorrow, 19), status: 'pending', total_price: 315, booking_type: 'regular' });

    // ─── Master Category Groups ─────────────────────────
    const catJunior = this.createGroup({ club_id: club.id, name: 'Juniorverksamhet', category: 'junior', sport_type: 'padel', notes: 'Alla juniorgrupper samlade' });
    const catAdult = this.createGroup({ club_id: club.id, name: 'Vuxenverksamhet', category: 'adult', sport_type: 'padel', notes: 'Alla vuxengrupper samlade' });
    const catComp = this.createGroup({ club_id: club.id, name: 'Tävlingsverksamhet', category: 'competition', sport_type: 'padel', notes: 'Tävlingsgrupper' });

    // ─── Child Groups (linked to master categories) ───────
    this.createGroup({ club_id: club.id, name: 'Junior Padel (10-14 år)', category: 'junior', parent_group_id: catJunior.id, sport_type: 'padel', player_ids: [u3.id, u4.id], trainer_ids: [u8.id], max_size: 8 });
    this.createGroup({ club_id: club.id, name: 'Vuxenträning Padel', category: 'adult', parent_group_id: catAdult.id, sport_type: 'padel', player_ids: [u1.id, u2.id, u5.id], trainer_ids: [u7.id], max_size: 12 });
    this.createGroup({ club_id: club.id, name: 'Tävlingsgrupp', category: 'competition', parent_group_id: catComp.id, sport_type: 'padel', player_ids: [u1.id, u5.id], trainer_ids: [u7.id], max_size: 6 });
    this.createGroup({ club_id: club2.id, name: 'Tennis Sommarläger', category: 'camp', sport_type: 'tennis', player_ids: [u2.id, u4.id, u6.id], trainer_ids: [u9.id], max_size: 16, notes: 'Vecka 26-27, alla nivåer' });

    // ─── Price Rules (dynamic pricing) ────────────────────
    // Stockholm Padel Arena courts
    [c1, c2, c3].forEach(c => {
      this.createPriceRule({ court_id: c.id, start_hour: 7, end_hour: 9, price_override: 280, label: 'Tidig morgon' });
      this.createPriceRule({ court_id: c.id, start_hour: 9, end_hour: 16, price_override: 350, label: 'Dagtid' });
      this.createPriceRule({ court_id: c.id, start_hour: 16, end_hour: 20, price_override: 450, label: 'Prime Time' });
      this.createPriceRule({ court_id: c.id, start_hour: 20, end_hour: 22, price_override: 380, label: 'Kväll' });
      // Weekends slightly different
      this.createPriceRule({ court_id: c.id, day_of_week: 6, start_hour: 9, end_hour: 20, price_override: 420, label: 'Lördag' });
      this.createPriceRule({ court_id: c.id, day_of_week: 0, start_hour: 9, end_hour: 20, price_override: 400, label: 'Söndag' });
    });

    // ─── Loyalty ──────────────────────────────────────────
    this.loyalty.push({ id: uid(), user_id: u1.id, club_id: club.id, total_bookings: 42, free_bookings_earned: 4, free_bookings_used: 3, tier: 'gold', updated_at: now() });
    this.loyalty.push({ id: uid(), user_id: u2.id, club_id: club.id, total_bookings: 28, free_bookings_earned: 2, free_bookings_used: 2, tier: 'silver', updated_at: now() });
    this.loyalty.push({ id: uid(), user_id: u5.id, club_id: club.id, total_bookings: 55, free_bookings_earned: 5, free_bookings_used: 4, tier: 'gold', updated_at: now() });
    this.loyalty.push({ id: uid(), user_id: u3.id, club_id: club.id, total_bookings: 7, free_bookings_earned: 0, free_bookings_used: 0, tier: 'bronze', updated_at: now() });

    // ─── Time Reports (last 2 weeks) ─────────────────────
    const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().split('T')[0]; };
    [u7, u8].forEach(trainer => {
      for (let i = 0; i < 10; i++) {
        this.createTimeReport({ user_id: trainer.id, club_id: club.id, date: d(i * 2), hours: 2 + Math.floor(Math.random() * 3), type: i % 3 === 0 ? 'admin' : 'training', description: i % 3 === 0 ? 'Planering' : 'Gruppträning' });
      }
    });

    // ─── Sick Leave ──────────────────────────────────────
    this.createSickLeave({ user_id: u8.id, club_id: club.id, start_date: d(2), end_date: d(0), note: 'Förkyld', coverage_needed: true });

    // ─── Training Sessions (planner) ───────────────────
    // Day-based: plan what happens each weekday (1=Mon..5=Fri)
    this.createTrainingSession({ club_id: club.id, title: 'Nybörjare Padel', court_id: c1.id, trainer_id: u8.id, player_ids: [u3.id, u4.id], going_ids: [u3.id], declined_ids: [], invited_ids: [u4.id], day_of_week: 1, start_hour: 9, end_hour: 10, notes: 'Fokus på grundslag' });
    this.createTrainingSession({ club_id: club.id, title: 'Avancerad Taktik', court_id: c2.id, trainer_id: u7.id, player_ids: [u1.id, u2.id, u5.id], going_ids: [u1.id, u2.id], declined_ids: [], invited_ids: [u5.id], day_of_week: 1, start_hour: 17, end_hour: 18, notes: 'Dubbeltaktik och positionering' });
    this.createTrainingSession({ club_id: club.id, title: 'Junior Morgonpass', court_id: c1.id, trainer_id: u8.id, player_ids: [u3.id, u4.id], going_ids: [u3.id, u4.id], declined_ids: [], invited_ids: [], day_of_week: 2, start_hour: 10, end_hour: 11 });
    this.createTrainingSession({ club_id: club.id, title: 'Serve & Return Klinik', court_id: c2.id, trainer_id: u7.id, player_ids: [u1.id, u5.id], going_ids: [u1.id], declined_ids: [u5.id], invited_ids: [], day_of_week: 3, start_hour: 15, end_hour: 16, notes: 'Intensivt serveträning' });
    this.createTrainingSession({ club_id: club.id, title: 'Matchförberedelse', court_id: c1.id, trainer_id: u7.id, player_ids: [u1.id, u2.id, u5.id, u3.id], going_ids: [u1.id, u5.id], declined_ids: [u2.id], invited_ids: [u3.id], day_of_week: 4, start_hour: 18, end_hour: 20, notes: 'Matchsimulering inför tävling' });
    this.createTrainingSession({ club_id: club.id, title: 'Lördagsträning', court_id: c3.id, trainer_id: u8.id, player_ids: [u1.id, u3.id, u5.id], going_ids: [u1.id, u3.id], declined_ids: [], invited_ids: [u5.id], day_of_week: 6, start_hour: 10, end_hour: 12, notes: 'Öppen träning alla nivåer' });

    // ─── Registration Forms ─────────────────────────────
    const jrGroup = this.groups.find(g => g.name.includes('Junior'));
    const adGroup = this.groups.find(g => g.name.includes('Vuxen'));

    const form1: RegistrationFormRow = {
      id: uid(), club_id: club.id, title: 'Vuxenträning Padel Vår 2026',
      description: 'Anmäl dig till vuxenträning i padel för vårterminen. Träning tisdag och torsdag kväll.',
      sport_type: 'padel', category: 'adult', season: 'Vår 2026',
      target_group_id: adGroup?.id ?? null,
      fields: [
        { key: 'level', label: 'Spelnivå', type: 'select', options: ['Nybörjare', 'Medel', 'Avancerad'], required: true },
        { key: 'preferred_day', label: 'Önskad dag', type: 'select', options: ['Tisdag', 'Torsdag', 'Båda'], required: true },
        { key: 'previous_training', label: 'Har du tränat padel förut?', type: 'checkbox', required: false },
        { key: 'notes', label: 'Övriga önskemål', type: 'text', required: false },
      ],
      status: 'open', max_submissions: 24, created_at: now(), updated_at: now(),
    };
    const form2: RegistrationFormRow = {
      id: uid(), club_id: club.id, title: 'Junior Padel (10-14 år) Vår 2026',
      description: 'Träning för juniorer 10-14 år. Måndag och onsdag eftermiddag.',
      sport_type: 'padel', category: 'junior', season: 'Vår 2026',
      target_group_id: jrGroup?.id ?? null,
      fields: [
        { key: 'age', label: 'Ålder', type: 'number', required: true },
        { key: 'level', label: 'Spelnivå', type: 'select', options: ['Nybörjare', 'Har spelat lite', 'Tävlar'], required: true },
        { key: 'parent_phone', label: 'Förälders telefon', type: 'text', required: true },
        { key: 'allergies', label: 'Allergier/Övrigt', type: 'text', required: false },
      ],
      status: 'open', max_submissions: 12, created_at: now(), updated_at: now(),
    };
    const form3: RegistrationFormRow = {
      id: uid(), club_id: club.id, title: 'Tennis Sommarläger 2026',
      description: 'Intensivt tennisläger vecka 26-27 för alla åldrar.',
      sport_type: 'tennis', category: 'camp', season: 'Sommar 2026',
      target_group_id: null,
      fields: [
        { key: 'age', label: 'Ålder', type: 'number', required: true },
        { key: 'level', label: 'Spelnivå', type: 'select', options: ['Nybörjare', 'Medel', 'Avancerad'], required: true },
        { key: 'week', label: 'Vilken vecka?', type: 'select', options: ['Vecka 26', 'Vecka 27', 'Båda'], required: true },
        { key: 'lunch', label: 'Önskar lunch?', type: 'checkbox', required: false },
      ],
      status: 'open', max_submissions: 32, created_at: now(), updated_at: now(),
    };
    this.registrationForms.push(form1, form2, form3);

    // Seed submissions
    this.formSubmissions.push(
      { id: uid(), form_id: form1.id, user_id: u1.id, answers: { level: 'Avancerad', preferred_day: 'Båda', previous_training: true, notes: '' }, submitted_at: now(), assigned_to_group: true },
      { id: uid(), form_id: form1.id, user_id: u2.id, answers: { level: 'Avancerad', preferred_day: 'Tisdag', previous_training: true, notes: 'Vill fokusera på serve' }, submitted_at: now(), assigned_to_group: true },
      { id: uid(), form_id: form1.id, user_id: u5.id, answers: { level: 'Medel', preferred_day: 'Torsdag', previous_training: true, notes: '' }, submitted_at: now(), assigned_to_group: false },
      { id: uid(), form_id: form2.id, user_id: u3.id, answers: { age: 12, level: 'Har spelat lite', parent_phone: '+46701234567', allergies: '' }, submitted_at: now(), assigned_to_group: true },
      { id: uid(), form_id: form2.id, user_id: u4.id, answers: { age: 11, level: 'Nybörjare', parent_phone: '+46709876543', allergies: 'Nötallergi' }, submitted_at: now(), assigned_to_group: true },
      { id: uid(), form_id: form3.id, user_id: u2.id, answers: { age: 35, level: 'Medel', week: 'Vecka 26', lunch: true }, submitted_at: now(), assigned_to_group: false },
      { id: uid(), form_id: form3.id, user_id: u6.id, answers: { age: 28, level: 'Avancerad', week: 'Båda', lunch: false }, submitted_at: now(), assigned_to_group: false },
    );

    // ─── Public Matches ─────────────────────────────────
    this.publicMatches.push(
      { id: uid(), booking_id: '', host_id: u1.id, club_id: club.id, sport_type: 'padel', court_name: 'Padel Bana 1', date: fmt(tomorrow, 0).split('T')[0], start_hour: 20, end_hour: 21, min_level: 4, max_level: 7, spots_total: 4, spots_filled: 2, player_ids: [u1.id, u2.id], status: 'open', notes: 'Social match, alla välkomna!', created_at: now() },
      { id: uid(), booking_id: '', host_id: u5.id, club_id: club.id, sport_type: 'padel', court_name: 'Padel Bana 2', date: fmt(tomorrow, 0).split('T')[0], start_hour: 18, end_hour: 19, min_level: 5, max_level: 8, spots_total: 4, spots_filled: 3, player_ids: [u5.id, u1.id, u3.id], status: 'open', notes: 'Behöver en till!', created_at: now() },
    );

    // ─── Leagues (Backhandsmash) ──────────────────────────
    const league1Players = [u1, u2, u3, u4, u5].map(u => ({
      player_id: u.id, wins: Math.floor(Math.random() * 15), losses: Math.floor(Math.random() * 10), points: 0, elo: u.elo_padel
    }));
    league1Players.forEach(p => { p.points = p.wins * 3; });
    league1Players.sort((a, b) => b.points - a.points);
    this.leagues.push(
      { id: uid(), club_id: club.id, name: 'Padelserien Herr A', sport_type: 'padel', season: 'Vår 2026', division: 'Division 1', format: 'doubles', player_ids: [u1.id, u2.id, u3.id, u4.id, u5.id], matches_played: 47, status: 'active', standings: league1Players, created_at: now(), updated_at: now() },
      { id: uid(), club_id: club.id, name: 'Padelserien Mixed', sport_type: 'padel', season: 'Vår 2026', division: 'Division 2', format: 'doubles', player_ids: [u1.id, u3.id, u5.id, u6.id], matches_played: 28, status: 'active', standings: [u1, u3, u5, u6].map(u => ({ player_id: u.id, wins: Math.floor(Math.random() * 10), losses: Math.floor(Math.random() * 8), points: Math.floor(Math.random() * 30), elo: u.elo_padel })), created_at: now(), updated_at: now() },
      { id: uid(), club_id: club2.id, name: 'Tennis Singles A', sport_type: 'tennis', season: 'Vår 2026', division: 'Herr A', format: 'singles', player_ids: [u2.id, u4.id, u6.id], matches_played: 21, status: 'active', standings: [u2, u4, u6].map(u => ({ player_id: u.id, wins: Math.floor(Math.random() * 8), losses: Math.floor(Math.random() * 6), points: Math.floor(Math.random() * 24), elo: u.elo_tennis })), created_at: now(), updated_at: now() },
    );

    // ─── Clip Cards / Värdekort ────────────────────────────
    this.clipCards.push(
      { id: uid(), club_id: club.id, name: 'GLTK 10-klipp Dagtid', type: 'clip', total_clips: 10, remaining_clips: 7, total_value: null, remaining_value: null, price: 1200, valid_from: '2026-01-01', valid_until: '2026-12-31', restricted_hours: { start: 7, end: 16 }, restricted_sports: ['padel', 'tennis'], owner_id: u1.id, is_active: true, created_at: now() },
      { id: uid(), club_id: club.id, name: 'Värdekort 2000 kr', type: 'value', total_clips: null, remaining_clips: null, total_value: 2000, remaining_value: 1450, price: 2000, valid_from: '2026-01-01', valid_until: '2027-01-01', restricted_hours: null, restricted_sports: null, owner_id: u2.id, is_active: true, created_at: now() },
      { id: uid(), club_id: club.id, name: 'Sommarklipp 20st', type: 'clip', total_clips: 20, remaining_clips: 14, total_value: null, remaining_value: null, price: 3500, valid_from: '2026-06-01', valid_until: '2026-08-31', restricted_hours: null, restricted_sports: ['padel'], owner_id: u5.id, is_active: true, created_at: now() },
    );

    // ─── Seasons & Subscriptions ──────────────────────────
    const season1 = { id: uid(), club_id: club.id, name: 'Vårtermin 2026', start_date: '2026-01-13', end_date: '2026-06-15', status: 'active' as const, subscription_count: 3, created_at: now() };
    const season2 = { id: uid(), club_id: club.id, name: 'Hösttermin 2026', start_date: '2026-08-17', end_date: '2026-12-20', status: 'draft' as const, subscription_count: 0, created_at: now() };
    this.seasons.push(season1, season2);
    this.subscriptions.push(
      { id: uid(), season_id: season1.id, club_id: club.id, customer_id: u1.id, court_id: c1.id, day_of_week: 2, start_hour: 18, end_hour: 19, price_per_session: 350, frequency: 'weekly', status: 'active', created_at: now() },
      { id: uid(), season_id: season1.id, club_id: club.id, customer_id: u5.id, court_id: c1.id, day_of_week: 4, start_hour: 17, end_hour: 18, price_per_session: 350, frequency: 'weekly', status: 'active', created_at: now() },
      { id: uid(), season_id: season1.id, club_id: club.id, customer_id: u2.id, court_id: c2.id, day_of_week: 1, start_hour: 19, end_hour: 20, price_per_session: 380, frequency: 'biweekly', status: 'active', created_at: now() },
    );

    // ─── Venue Profiles ───────────────────────────────────
    this.venueProfiles.push({
      id: uid(), club_id: club.id,
      description: 'Stockholms mest moderna padelanläggning med 3 banor, café och pro-shop. Vi erbjuder träning för alla nivåer med certifierade tränare.',
      amenities: ['omklädningsrum', 'bastu', 'parkering', 'pro-shop', 'café', 'rackuthyrning', 'wifi'],
      images: ['/venue-1.jpg', '/venue-2.jpg'],
      opening_hours: [
        { day: 1, open: '07:00', close: '22:00' }, { day: 2, open: '07:00', close: '22:00' },
        { day: 3, open: '07:00', close: '22:00' }, { day: 4, open: '07:00', close: '22:00' },
        { day: 5, open: '07:00', close: '22:00' }, { day: 6, open: '08:00', close: '20:00' },
        { day: 0, open: '09:00', close: '18:00' },
      ],
      booking_rules: { max_days_ahead: 14, cancellation_hours: 24, refund_percentage: 100, max_bookings_per_user: 5, show_names_in_schedule: true },
      social_links: { website: 'https://stockholmpadelarena.se', instagram: '@stockholmpadel' },
      created_at: now(), updated_at: now(),
    });

    // ─── Statements (financial) ───────────────────────────
    this.statements.push(
      { id: uid(), club_id: club.id, period: '2026-01', total_earned: 48500, total_paid_out: 45200, online_payments: 42000, clip_card_redemptions: 4500, late_cancellation_fees: 2000, platform_fees: 3300, pending_payout: 3300, created_at: now() },
      { id: uid(), club_id: club.id, period: '2026-02', total_earned: 52100, total_paid_out: 49800, online_payments: 45600, clip_card_redemptions: 4200, late_cancellation_fees: 2300, platform_fees: 2300, pending_payout: 2300, created_at: now() },
      { id: uid(), club_id: club.id, period: '2026-03', total_earned: 61200, total_paid_out: 58900, online_payments: 53800, clip_card_redemptions: 5100, late_cancellation_fees: 2300, platform_fees: 2300, pending_payout: 2300, created_at: now() },
      { id: uid(), club_id: club.id, period: '2026-04', total_earned: 38400, total_paid_out: 32100, online_payments: 33200, clip_card_redemptions: 3600, late_cancellation_fees: 1600, platform_fees: 6300, pending_payout: 6300, created_at: now() },
    );

    // Demo matches — spread across last 30 days for chart data
    const daysAgo = (n: number) => {
      const d = new Date(); d.setDate(d.getDate() - n);
      d.setHours(12, 0, 0, 0);
      return d.toISOString();
    };

    // Padel doubles matches
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u1.id, u2.id], team2_player_ids: [u3.id, u4.id], team1_score: 6, team2_score: 3, winner_team: 1, played_at: daysAgo(28) });
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u5.id, u3.id], team2_player_ids: [u1.id, u4.id], team1_score: 4, team2_score: 6, winner_team: 2, played_at: daysAgo(26) });
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u2.id, u5.id], team2_player_ids: [u3.id, u4.id], team1_score: 6, team2_score: 2, winner_team: 1, played_at: daysAgo(24) });
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u1.id, u3.id], team2_player_ids: [u2.id, u5.id], team1_score: 3, team2_score: 6, winner_team: 2, played_at: daysAgo(21) });
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u4.id, u5.id], team2_player_ids: [u1.id, u2.id], team1_score: 5, team2_score: 6, winner_team: 2, played_at: daysAgo(19) });
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u1.id, u5.id], team2_player_ids: [u3.id, u4.id], team1_score: 6, team2_score: 1, winner_team: 1, played_at: daysAgo(17) });
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u2.id, u3.id], team2_player_ids: [u4.id, u5.id], team1_score: 6, team2_score: 4, winner_team: 1, played_at: daysAgo(14) });
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u1.id, u4.id], team2_player_ids: [u2.id, u3.id], team1_score: 6, team2_score: 5, winner_team: 1, played_at: daysAgo(12) });
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u3.id, u5.id], team2_player_ids: [u1.id, u2.id], team1_score: 2, team2_score: 6, winner_team: 2, played_at: daysAgo(10) });
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u1.id, u3.id], team2_player_ids: [u4.id, u5.id], team1_score: 6, team2_score: 4, winner_team: 1, played_at: daysAgo(7) });
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u2.id, u4.id], team2_player_ids: [u1.id, u5.id], team1_score: 3, team2_score: 6, winner_team: 2, played_at: daysAgo(5) });
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u1.id, u2.id], team2_player_ids: [u4.id, u5.id], team1_score: 6, team2_score: 6, winner_team: null, played_at: daysAgo(3) });
    this.createMatch({ sport_type: 'padel', team1_player_ids: [u3.id, u4.id], team2_player_ids: [u2.id, u5.id], team1_score: 4, team2_score: 6, winner_team: 2, played_at: daysAgo(1) });

    // Tennis singles matches
    this.createMatch({ sport_type: 'tennis', team1_player_ids: [u2.id], team2_player_ids: [u6.id], team1_score: 6, team2_score: 4, winner_team: 1, played_at: daysAgo(27) });
    this.createMatch({ sport_type: 'tennis', team1_player_ids: [u6.id], team2_player_ids: [u4.id], team1_score: 6, team2_score: 2, winner_team: 1, played_at: daysAgo(22) });
    this.createMatch({ sport_type: 'tennis', team1_player_ids: [u2.id], team2_player_ids: [u4.id], team1_score: 6, team2_score: 3, winner_team: 1, played_at: daysAgo(18) });
    this.createMatch({ sport_type: 'tennis', team1_player_ids: [u4.id], team2_player_ids: [u6.id], team1_score: 7, team2_score: 6, winner_team: 1, played_at: daysAgo(15) });
    this.createMatch({ sport_type: 'tennis', team1_player_ids: [u6.id], team2_player_ids: [u2.id], team1_score: 6, team2_score: 7, winner_team: 2, played_at: daysAgo(9) });
    this.createMatch({ sport_type: 'tennis', team1_player_ids: [u2.id], team2_player_ids: [u6.id], team1_score: 6, team2_score: 3, winner_team: 1, played_at: daysAgo(4) });
    this.createMatch({ sport_type: 'tennis', team1_player_ids: [u4.id], team2_player_ids: [u2.id], team1_score: 4, team2_score: 6, winner_team: 2, played_at: daysAgo(2) });

    // Set played_at on all matches
    this.matches.forEach(m => { if (!m.played_at) m.played_at = m.created_at; m.elo_processed = true; });

    console.log('[store] Seeded: 2 clubs, 6 courts, 6 users, 6 bookings, 20 matches');
  }

  /**
   * Backfill legacy scheduling structures into the unified `recurrenceRules` table.
   *
   * Three sources get folded in:
   *   1. `trainingSessions` — weekday-based training templates
   *   2. `weeklyTemplates` — generic weekly activity templates (training/contract/event)
   *   3. bookings grouped by `contract_id` — each contract group becomes one
   *      weekly rule and each constituent booking gets `recurrence_rule_id` set.
   *
   * Runs once at boot after seed(). Idempotent: checks for an existing rule
   * before inserting so re-running the backfill (e.g. in tests) is safe.
   */
  backfillRecurrenceRules(): { created: number; linked_bookings: number } {
    let created = 0;
    let linked = 0;
    const today = new Date().toISOString().split('T')[0];

    // 1. Training sessions → weekly training rules
    for (const ts of this.trainingSessions) {
      if (this.recurrenceRules.find(r => r.id === ts.id)) continue;
      const rule: RecurrenceRuleRow = {
        id: ts.id, // preserve id so applied_dates logic can still find the rule
        club_id: ts.club_id,
        title: ts.title,
        booking_type: 'training',
        court_id: ts.court_id,
        start_hour: ts.start_hour,
        end_hour: ts.end_hour,
        freq: 'weekly',
        interval_n: 1,
        weekdays: [ts.day_of_week],
        start_date: ts.created_at.split('T')[0],
        end_date: null,
        skip_dates: [],
        trainer_id: ts.trainer_id,
        player_ids: ts.player_ids,
        event_name: null,
        event_max_participants: null,
        notes: ts.notes,
        is_active: ts.status !== 'cancelled',
        created_by: null,
        created_at: ts.created_at,
        updated_at: ts.updated_at,
      };
      this.recurrenceRules.push(rule);
      created++;
    }

    // 2. Weekly templates → rules with matching booking_type
    for (const wt of this.weeklyTemplates) {
      if (this.recurrenceRules.find(r => r.id === wt.id)) continue;
      this.recurrenceRules.push({
        id: wt.id,
        club_id: wt.club_id,
        title: wt.title,
        booking_type: wt.activity_type,
        court_id: wt.court_id,
        start_hour: wt.start_hour,
        end_hour: wt.end_hour,
        freq: 'weekly',
        interval_n: 1,
        weekdays: [wt.day_of_week],
        start_date: wt.created_at.split('T')[0],
        end_date: null,
        skip_dates: [],
        trainer_id: wt.trainer_id,
        player_ids: wt.player_ids,
        event_name: wt.activity_type === 'event' ? wt.title : null,
        event_max_participants: wt.event_max_participants,
        notes: wt.notes,
        is_active: wt.is_active,
        created_by: null,
        created_at: wt.created_at,
        updated_at: wt.updated_at,
      });
      created++;
    }

    // 3. Contract-grouped bookings → one rule per contract_id, link bookings
    const contractGroups = new Map<string, BookingRow[]>();
    for (const b of this.bookings) {
      if (!b.contract_id) continue;
      if (!contractGroups.has(b.contract_id)) contractGroups.set(b.contract_id, []);
      contractGroups.get(b.contract_id)!.push(b);
    }
    for (const [contractId, bookings] of contractGroups) {
      if (this.recurrenceRules.find(r => r.id === contractId)) continue;
      bookings.sort((a, b) => a.time_slot_start.localeCompare(b.time_slot_start));
      const first = bookings[0];
      const last = bookings[bookings.length - 1];
      const court = this.courts.find(c => c.id === first.court_id);
      const rule: RecurrenceRuleRow = {
        id: contractId,
        club_id: court?.club_id ?? this.clubs[0]?.id ?? '',
        title: first.notes?.split('—')[0]?.trim() || 'Contract',
        booking_type: 'contract',
        court_id: first.court_id,
        start_hour: new Date(first.time_slot_start).getHours(),
        end_hour: new Date(first.time_slot_end).getHours(),
        freq: 'weekly',
        interval_n: 1,
        weekdays: [first.recurrence_day ?? new Date(first.time_slot_start).getDay()],
        start_date: first.time_slot_start.split('T')[0],
        end_date: last.time_slot_start.split('T')[0],
        skip_dates: [],
        trainer_id: first.trainer_id,
        player_ids: [],
        event_name: null,
        event_max_participants: null,
        notes: first.notes,
        is_active: true,
        created_by: first.booker_id,
        created_at: first.created_at,
        updated_at: first.updated_at,
      };
      this.recurrenceRules.push(rule);
      created++;

      for (const b of bookings) {
        if (!b.recurrence_rule_id) {
          b.recurrence_rule_id = contractId;
          linked++;
        }
      }
    }

    // Suppress unused-var warning on `today` — kept around for future use
    // (e.g. deciding end_date vs null) without changing the signature.
    void today;

    console.log(`[store] Backfilled: ${created} recurrence rule(s), linked ${linked} booking(s)`);
    return { created, linked_bookings: linked };
  }
}

export const store = new InMemoryStore();
store.seed();
store.backfillRecurrenceRules();
