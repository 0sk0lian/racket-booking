-- Migration 012: Price rules (dynamic pricing per court)
-- Override the court's base_hourly_rate on specific weekday × hour windows.
-- E.g. "Padel Bana 1, weekdays 16:00-20:00 → 550 SEK/h (Peak)".

CREATE TABLE price_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,

    day_of_week SMALLINT CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
    start_hour SMALLINT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour   SMALLINT NOT NULL CHECK (end_hour   >= 1 AND end_hour   <= 24),
    CHECK (end_hour > start_hour),

    price_override NUMERIC(10, 2) NOT NULL,
    label VARCHAR(64),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_price_rules_court ON price_rules(court_id) WHERE is_active;
