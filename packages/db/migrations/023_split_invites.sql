-- Migration 023: Split-payment invites (MATCHi-style)
-- A booker invites N other players to share a booking's cost. Each invitee
-- has an amount they owe and an RSVP-style status. paid_at marks when their
-- portion settled (Stripe payment intent succeeded).
--
-- Distinct from split_payments (migration 004) which holds the actual payment
-- intent records — split_invites is the social/UX layer that drives them.

CREATE TABLE split_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP WITH TIME ZONE,

    UNIQUE (booking_id, invitee_id)
);

CREATE INDEX idx_split_invites_booking ON split_invites(booking_id);
CREATE INDEX idx_split_invites_invitee_pending ON split_invites(invitee_id, status)
    WHERE status = 'pending';
