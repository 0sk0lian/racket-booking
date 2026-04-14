-- Migration 002: Users table
-- Players with per-sport Elo ratings

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    elo_padel INTEGER DEFAULT 1000,
    elo_tennis INTEGER DEFAULT 1000,
    elo_squash INTEGER DEFAULT 1000,
    elo_badminton INTEGER DEFAULT 1000,
    matches_played INTEGER DEFAULT 0,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_elo_padel ON users(elo_padel DESC);
CREATE INDEX idx_users_elo_tennis ON users(elo_tennis DESC);
