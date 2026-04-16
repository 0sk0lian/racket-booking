-- Migration 024: Training session templates (Träningsplanerare)
-- Weekday-based templates (NOT date-based) that get materialized into actual
-- bookings via the recurrence engine. Each template lives in the planner UI
-- and is shared by id with a recurrence_rules row for engine compatibility
-- (see migration 007 + the backfill in apps/api/src/store.ts).
--
-- Attendance for materialized bookings lives in `attendance` (migration 009).
-- The going_ids / declined_ids / invited_ids / waitlist_ids arrays here are
-- a planner-level cache used by the legacy planner UI; the source of truth
-- once Phase C lands will be `attendance`.

CREATE TABLE training_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL DEFAULT 'Träningspass',
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
    trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    player_ids UUID[] NOT NULL DEFAULT '{}',

    -- Planner cache of attendance status (see notes above)
    going_ids UUID[] NOT NULL DEFAULT '{}',
    declined_ids UUID[] NOT NULL DEFAULT '{}',
    invited_ids UUID[] NOT NULL DEFAULT '{}',
    waitlist_ids UUID[] NOT NULL DEFAULT '{}',

    day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_hour SMALLINT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour   SMALLINT NOT NULL CHECK (end_hour   >= 1 AND end_hour   <= 24),
    CHECK (end_hour > start_hour),

    notes TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'applied', 'cancelled')),
    applied_dates DATE[] NOT NULL DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_sessions_club ON training_sessions(club_id);
CREATE INDEX idx_training_sessions_trainer ON training_sessions(trainer_id);
CREATE INDEX idx_training_sessions_active ON training_sessions(club_id, day_of_week)
    WHERE status != 'cancelled';
