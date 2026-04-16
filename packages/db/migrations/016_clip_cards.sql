-- Migration 016: Clip cards / value cards
-- Two flavors:
--   * 'clip' — N pre-paid uses (e.g. 10-clip card = 10 court bookings)
--   * 'value' — pre-paid SEK balance, decremented by booking price
-- Optional time-of-day or sport restrictions.

CREATE TABLE clip_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('clip', 'value')),

    -- Only one set is meaningful depending on type; CHECK enforces it.
    total_clips INT,
    remaining_clips INT,
    total_value NUMERIC(10, 2),
    remaining_value NUMERIC(10, 2),
    CHECK (
        (type = 'clip'  AND total_clips IS NOT NULL AND remaining_clips IS NOT NULL) OR
        (type = 'value' AND total_value IS NOT NULL AND remaining_value IS NOT NULL)
    ),

    price NUMERIC(10, 2) NOT NULL,
    valid_from DATE,
    valid_until DATE,

    -- JSONB for flexibility — restricted_hours: { start: int, end: int }
    restricted_hours JSONB,
    restricted_sports TEXT[],

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clip_cards_owner ON clip_cards(owner_id) WHERE is_active;
CREATE INDEX idx_clip_cards_club ON clip_cards(club_id) WHERE is_active;
