-- Migration 005: Matches and tournaments
-- Supports Elo tracking and Americano/Mexicano tournament formats

CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    tournament_id UUID,  -- FK added after tournaments table creation
    sport_type VARCHAR(50) NOT NULL CHECK (sport_type IN ('padel', 'tennis', 'squash', 'badminton')),
    team1_player_ids UUID[] NOT NULL,
    team2_player_ids UUID[] NOT NULL,
    team1_score INTEGER,
    team2_score INTEGER,
    winner_team INTEGER CHECK (winner_team IN (1, 2)),
    elo_processed BOOLEAN DEFAULT FALSE,
    played_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sport_type VARCHAR(50) NOT NULL CHECK (sport_type IN ('padel', 'tennis', 'squash', 'badminton')),
    format VARCHAR(50) NOT NULL CHECK (format IN ('americano', 'mexicano')),
    player_ids UUID[] NOT NULL,
    points_per_match INTEGER DEFAULT 32,
    schedule JSONB NOT NULL DEFAULT '[]',  -- Stores the generated round/match schedule
    standings JSONB NOT NULL DEFAULT '{}', -- Live leaderboard: { playerId: totalPoints }
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
    starts_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add FK from matches back to tournaments
ALTER TABLE matches ADD CONSTRAINT fk_matches_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;

CREATE INDEX idx_matches_booking_id ON matches(booking_id);
CREATE INDEX idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX idx_tournaments_club_id ON tournaments(club_id);
CREATE INDEX idx_tournaments_status ON tournaments(status);
