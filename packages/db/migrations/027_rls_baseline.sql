-- Migration 027: Baseline Row-Level Security
-- Enables RLS on every public table. NO policies are created for the `anon` or
-- `authenticated` roles in this baseline — the service-role key (used by our
-- API via @supabase/supabase-js) bypasses RLS, so existing server-side access
-- continues to work. Direct browser → Supabase queries are blocked until
-- Phase B writes proper user-scoped policies (Supabase Auth migration).
--
-- Why this shape:
--   * Secure-by-default — no accidental data leak via client SDK before auth lands
--   * Trivial to verify — `\d table` shows RLS enabled, no surprises
--   * Phase B replaces this file's empty policy set with real ones (per-user reads
--     on bookings/attendance, club-admin reads on club-scoped data, etc.)
--
-- Apply order matters: this runs AFTER all entity tables exist (000–026).

-- Core
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_admins ENABLE ROW LEVEL SECURITY;

-- Scheduling primitives
ALTER TABLE recurrence_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackout_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Phase A new tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE sick_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
