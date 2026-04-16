-- Migration 011: Groups (vuxen, junior, läger, etc.)
-- Free-form classification of players into teams / categories. A "master
-- category" is a top-level group (parent_group_id IS NULL); other groups can
-- nest under one to form e.g. Junior → Junior U12, Junior U14.

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'other'
        CHECK (category IN ('junior', 'adult', 'senior', 'camp', 'competition', 'other')),
    parent_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    sport_type VARCHAR(50) NOT NULL DEFAULT 'padel',

    -- Roster cached as arrays for read speed; the canonical source of truth
    -- for who belongs to a group will become a junction table once we hit
    -- scale and need to query "which groups is this player in" cheaply.
    player_ids UUID[] NOT NULL DEFAULT '{}',
    trainer_ids UUID[] NOT NULL DEFAULT '{}',

    max_size INT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_groups_club ON groups(club_id);
CREATE INDEX idx_groups_parent ON groups(parent_group_id) WHERE parent_group_id IS NOT NULL;
CREATE INDEX idx_groups_active ON groups(club_id, is_active) WHERE is_active;
