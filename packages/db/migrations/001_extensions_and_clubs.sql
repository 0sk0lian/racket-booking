-- Migration 001: Extensions, clubs, and courts
-- Enables core PostgreSQL extensions and creates facility tables

-- Enable necessary extensions for UUID generation and GiST indexing
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── Table: clubs ───────────────────────────────────────────────
-- Represents a sports facility operator.
-- is_non_profit determines VAT routing (0% for approved non-profits, 6% for commercial).
CREATE TABLE clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    organization_number VARCHAR(50) NOT NULL UNIQUE,
    is_non_profit BOOLEAN DEFAULT FALSE,
    timezone VARCHAR(50) DEFAULT 'Europe/Stockholm',
    stripe_account_id VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Table: courts ──────────────────────────────────────────────
-- Individual bookable courts within a club.
-- hardware_relay_id maps to the physical IoT device controlling lights/access.
CREATE TABLE courts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sport_type VARCHAR(50) NOT NULL CHECK (sport_type IN ('padel', 'tennis', 'squash', 'badminton')),
    is_indoor BOOLEAN DEFAULT TRUE,
    base_hourly_rate NUMERIC(10, 2) NOT NULL,
    hardware_relay_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_courts_club_id ON courts(club_id);
CREATE INDEX idx_courts_sport_type ON courts(sport_type);
