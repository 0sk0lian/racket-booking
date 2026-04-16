-- Migration 013: Loyalty program
-- Per (user, club) — tracks bookings, free-bookings earned/used, and a tier.
-- One row per user/club combination.

CREATE TABLE loyalty (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    total_bookings INT NOT NULL DEFAULT 0,
    free_bookings_earned INT NOT NULL DEFAULT 0,
    free_bookings_used INT NOT NULL DEFAULT 0,
    tier VARCHAR(20) NOT NULL DEFAULT 'bronze'
        CHECK (tier IN ('bronze', 'silver', 'gold')),

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, club_id)
);

CREATE INDEX idx_loyalty_club_tier ON loyalty(club_id, tier);
