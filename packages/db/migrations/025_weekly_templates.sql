-- Migration 025: Weekly templates (generic recurring activity)
-- Like training_sessions but unified for any activity_type. Was the older
-- model that's largely superseded by recurrence_rules (migration 007). Kept
-- because the legacy admin UI still references it; will be deprecated after
-- Phase C completes the API rewrite.

CREATE TABLE weekly_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,

    day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_hour SMALLINT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour   SMALLINT NOT NULL CHECK (end_hour   >= 1 AND end_hour   <= 24),
    CHECK (end_hour > start_hour),

    activity_type VARCHAR(20) NOT NULL
        CHECK (activity_type IN ('training', 'contract', 'event')),
    title VARCHAR(255) NOT NULL,

    trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    player_ids UUID[] NOT NULL DEFAULT '{}',
    event_max_participants INT,

    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    color VARCHAR(9) NOT NULL DEFAULT '#6366f1',  -- hex w/ optional alpha

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weekly_templates_club ON weekly_templates(club_id) WHERE is_active;
