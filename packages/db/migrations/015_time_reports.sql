-- Migration 015: Time reports (trainer hour logging)
-- Tracks hours worked per day per trainer, optionally tied to a specific
-- booking. Used by Tidrapportering for salary calculation. Requires admin
-- approval before counting toward salary.

CREATE TABLE time_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    date DATE NOT NULL,
    hours NUMERIC(5, 2) NOT NULL CHECK (hours > 0),
    type VARCHAR(20) NOT NULL DEFAULT 'training'
        CHECK (type IN ('training', 'admin', 'event', 'other')),
    description TEXT,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,

    approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_time_reports_user_date ON time_reports(user_id, date);
CREATE INDEX idx_time_reports_club_pending ON time_reports(club_id, approved)
    WHERE approved = FALSE;
