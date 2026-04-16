-- Migration 020: Leagues (Backhandsmash-style)
-- Per club + season + division leagues with player rosters and live standings.
-- Standings JSONB shape:
--   [{ player_id: uuid, wins: int, losses: int, points: int, elo: int }, ...]

CREATE TABLE leagues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    sport_type VARCHAR(50) NOT NULL CHECK (sport_type IN ('padel', 'tennis', 'squash', 'badminton')),
    season VARCHAR(64) NOT NULL,    -- 'Höst 2026'
    division VARCHAR(64) NOT NULL,  -- 'Division 1', 'Herr A'
    format VARCHAR(20) NOT NULL CHECK (format IN ('singles', 'doubles')),

    player_ids UUID[] NOT NULL DEFAULT '{}',
    matches_played INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('active', 'completed', 'draft')),

    standings JSONB NOT NULL DEFAULT '[]',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leagues_club ON leagues(club_id);
CREATE INDEX idx_leagues_active ON leagues(club_id, status) WHERE status = 'active';
