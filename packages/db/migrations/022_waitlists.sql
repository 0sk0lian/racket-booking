-- Migration 022: Waitlists (booking-level queue)
-- Generic waitlist for various activity types. activity_type+target_id locates
-- the thing being queued for. Position is 1-based; smallest = next up.
--
-- For training-session waitlist this lives inside attendance.status='waitlist'
-- (see migration 009). This table is for booking / event / public_match queues
-- where the entity isn't a per-user attendance row.

CREATE TABLE waitlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,

    activity_type VARCHAR(20) NOT NULL
        CHECK (activity_type IN ('booking', 'event', 'public_match')),
    target_id UUID NOT NULL,        -- booking_id / event_id / public_match_id

    position INT NOT NULL CHECK (position > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'notified', 'claimed', 'expired')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (activity_type, target_id, user_id)
);

CREATE INDEX idx_waitlists_target ON waitlists(activity_type, target_id, position)
    WHERE status = 'waiting';
CREATE INDEX idx_waitlists_user ON waitlists(user_id);
