-- Migration 014: Sick leave tracking (trainers calling in sick)
-- end_date null = open-ended. coverage_needed flags whether a substitute
-- trainer is required; covered_by_id points to whoever picked it up.

CREATE TABLE sick_leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    start_date DATE NOT NULL,
    end_date DATE,
    note TEXT,

    coverage_needed BOOLEAN NOT NULL DEFAULT TRUE,
    covered_by_id UUID REFERENCES users(id) ON DELETE SET NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'covered', 'resolved')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sick_leaves_user ON sick_leaves(user_id);
CREATE INDEX idx_sick_leaves_club_active ON sick_leaves(club_id, status)
    WHERE status = 'active';
