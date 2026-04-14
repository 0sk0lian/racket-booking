-- Migration 004: Split payments
-- Tracks individual payment obligations for multi-party bookings (e.g. 4-player padel)

CREATE TABLE split_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_due NUMERIC(10, 2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'failed')),
    payment_method VARCHAR(50),  -- 'stripe', 'swish', 'klarna'
    stripe_payment_intent_id VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_split_payments_booking_id ON split_payments(booking_id);
CREATE INDEX idx_split_payments_user_id ON split_payments(user_id);
CREATE INDEX idx_split_payments_status ON split_payments(payment_status);
