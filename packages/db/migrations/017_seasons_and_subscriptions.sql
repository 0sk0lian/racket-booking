-- Migration 017: Seasons + Subscriptions (Abonnemang)
-- A season ("Hösttermin 2026") is a date window. Inside it, customers hold
-- subscriptions: weekly/biweekly recurring slots on a specific court+hour.
--
-- Subscriptions overlap conceptually with recurrence_rules of type 'contract'
-- but are kept as a separate table because their commercial model differs
-- (per-season pricing, season-level reporting). At Phase J we may consider
-- migrating subscriptions to be a flavor of recurrence_rules.

CREATE TABLE seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    CHECK (end_date > start_date),

    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'completed')),
    subscription_count INT NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_seasons_club ON seasons(club_id);
CREATE INDEX idx_seasons_active ON seasons(club_id, status) WHERE status = 'active';

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,

    day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_hour SMALLINT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour   SMALLINT NOT NULL CHECK (end_hour   >= 1 AND end_hour   <= 24),
    CHECK (end_hour > start_hour),

    price_per_session NUMERIC(10, 2) NOT NULL,
    frequency VARCHAR(20) NOT NULL DEFAULT 'weekly'
        CHECK (frequency IN ('weekly', 'biweekly')),

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'cancelled')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_season ON subscriptions(season_id);
CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_active ON subscriptions(club_id, status)
    WHERE status = 'active';
