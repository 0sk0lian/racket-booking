-- Migration 006: Club administrators
-- Links users to clubs with role-based access for the admin portal

CREATE TABLE club_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'staff')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(club_id, user_id)
);

CREATE INDEX idx_club_admins_club_id ON club_admins(club_id);
CREATE INDEX idx_club_admins_user_id ON club_admins(user_id);
