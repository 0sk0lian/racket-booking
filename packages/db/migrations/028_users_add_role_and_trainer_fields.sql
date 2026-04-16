-- Migration 028: Extend users with role + trainer fields
-- The in-memory UserRow carries role + trainer_* fields ([store.ts]
-- lines 23-37) that aren't on the original users table (migration 002).
-- Adds them now so the seed + Phase B Supabase Auth migration have
-- everything they need to express the user model the app already uses.
--
-- After Phase B, `role` may move to Supabase user_metadata; for now it lives
-- on public.users.

ALTER TABLE users
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'player'
        CHECK (role IN ('player', 'trainer', 'admin')),
    ADD COLUMN trainer_club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
    ADD COLUMN trainer_sport_types TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN trainer_hourly_rate NUMERIC(10, 2),
    ADD COLUMN trainer_rates JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN trainer_monthly_salary NUMERIC(10, 2),
    ADD COLUMN trainer_bio TEXT,
    ADD COLUMN trainer_certifications TEXT;

CREATE INDEX idx_users_role ON users(role) WHERE role != 'player';
CREATE INDEX idx_users_trainer_club ON users(trainer_club_id) WHERE trainer_club_id IS NOT NULL;
