-- Migration 021: Public matches (matchmaking)
-- A booking can be "opened up" so other players in the level range can join.
-- spots_total / spots_filled track capacity. min_level / max_level are 1-10.

CREATE TABLE public_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    sport_type VARCHAR(50) NOT NULL CHECK (sport_type IN ('padel', 'tennis', 'squash', 'badminton')),
    court_name VARCHAR(255),
    date DATE NOT NULL,
    start_hour SMALLINT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour   SMALLINT NOT NULL CHECK (end_hour   >= 1 AND end_hour   <= 24),
    CHECK (end_hour > start_hour),

    min_level SMALLINT NOT NULL CHECK (min_level BETWEEN 1 AND 10),
    max_level SMALLINT NOT NULL CHECK (max_level BETWEEN 1 AND 10),
    CHECK (max_level >= min_level),

    spots_total INT NOT NULL CHECK (spots_total > 0),
    spots_filled INT NOT NULL DEFAULT 0 CHECK (spots_filled >= 0),
    CHECK (spots_filled <= spots_total),

    player_ids UUID[] NOT NULL DEFAULT '{}',

    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'full', 'cancelled', 'completed')),

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_public_matches_booking ON public_matches(booking_id);
CREATE INDEX idx_public_matches_open ON public_matches(club_id, date, status)
    WHERE status = 'open';
