-- Migration 008: Blackout periods
-- First-class closures (holidays, maintenance, tournament takeovers) that the
-- recurrence engine must skip when materializing rules into bookings.

CREATE TABLE blackout_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    CHECK (ends_at > starts_at),

    reason VARCHAR(255),

    -- Scope: null means "all courts at this club"; otherwise only listed courts are closed.
    court_ids UUID[] NOT NULL DEFAULT '{}',

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blackout_periods_club ON blackout_periods(club_id);
CREATE INDEX idx_blackout_periods_range ON blackout_periods(starts_at, ends_at);
