-- Migration 019: Statements (financial reconciliation per period)
-- One row per (club, period). period is a 'YYYY-MM' string for monthly
-- accounting. Aggregates earned, paid out, fees, and pending payout.

CREATE TABLE statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    period VARCHAR(7) NOT NULL,  -- 'YYYY-MM'

    total_earned NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_paid_out NUMERIC(12, 2) NOT NULL DEFAULT 0,
    online_payments NUMERIC(12, 2) NOT NULL DEFAULT 0,
    clip_card_redemptions NUMERIC(12, 2) NOT NULL DEFAULT 0,
    late_cancellation_fees NUMERIC(12, 2) NOT NULL DEFAULT 0,
    platform_fees NUMERIC(12, 2) NOT NULL DEFAULT 0,
    pending_payout NUMERIC(12, 2) NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (club_id, period)
);

CREATE INDEX idx_statements_club_period ON statements(club_id, period DESC);
