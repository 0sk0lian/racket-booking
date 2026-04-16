-- Migration 009: Attendance
-- Proper relational replacement for the player_ids[] / event_attendee_ids[]
-- arrays on bookings. Carries RSVP state AND post-session attendance so
-- admin, trainer, and player surfaces can all operate on the same rows.

CREATE TABLE attendance (
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'invited'
        CHECK (status IN ('invited', 'going', 'declined', 'waitlist', 'present', 'no_show')),

    -- RSVP timeline
    responded_at TIMESTAMP WITH TIME ZONE,

    -- Trainer check-in at the session
    checked_in_at TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Waitlist ordering (only meaningful when status = 'waitlist')
    waitlist_position SMALLINT,

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (booking_id, user_id)
);

CREATE INDEX idx_attendance_user ON attendance(user_id);
CREATE INDEX idx_attendance_status ON attendance(booking_id, status);
CREATE INDEX idx_attendance_waitlist ON attendance(booking_id, waitlist_position)
    WHERE status = 'waitlist';
