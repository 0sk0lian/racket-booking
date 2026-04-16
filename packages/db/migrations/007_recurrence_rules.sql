-- Migration 007: Recurrence rules
-- Unified recurrence primitive that replaces:
--   * weekly training templates (was: trainingSessions)
--   * weekly / biweekly subscriptions (was: subscriptions / weeklyTemplates)
--   * contract repeats (was: bookings grouped by contract_id)
-- One rule can expand into many booking instances via the recurrence engine.

CREATE TABLE recurrence_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    booking_type VARCHAR(50) NOT NULL
        CHECK (booking_type IN ('regular', 'training', 'contract', 'event')),

    -- When / where
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
    start_hour SMALLINT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour   SMALLINT NOT NULL CHECK (end_hour   >= 1 AND end_hour   <= 24),
    CHECK (end_hour > start_hour),

    -- Recurrence pattern
    freq VARCHAR(20) NOT NULL
        CHECK (freq IN ('once', 'weekly', 'biweekly', 'monthly')),
    interval_n SMALLINT NOT NULL DEFAULT 1 CHECK (interval_n >= 1),
    weekdays SMALLINT[] NOT NULL DEFAULT '{}',  -- 0=Sun..6=Sat; empty only valid for freq='once'
    start_date DATE NOT NULL,
    end_date DATE,                               -- null = open-ended
    skip_dates DATE[] NOT NULL DEFAULT '{}',     -- explicit holes

    -- Roster (for training / event types)
    trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    player_ids UUID[] NOT NULL DEFAULT '{}',
    event_name VARCHAR(255),
    event_max_participants SMALLINT,

    -- Meta
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recurrence_rules_club ON recurrence_rules(club_id);
CREATE INDEX idx_recurrence_rules_court ON recurrence_rules(court_id);
CREATE INDEX idx_recurrence_rules_trainer ON recurrence_rules(trainer_id);
CREATE INDEX idx_recurrence_rules_active ON recurrence_rules(is_active) WHERE is_active;
