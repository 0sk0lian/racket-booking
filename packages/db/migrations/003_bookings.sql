-- Migration 003: Bookings table with exclusion constraint
-- Uses tsrange + EXCLUDE USING gist for absolute double-booking prevention

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
    booker_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    time_slot TSRANGE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    total_price NUMERIC(10, 2) NOT NULL,
    court_rental_vat_rate NUMERIC(4, 2) NOT NULL DEFAULT 0.06,
    platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    access_pin VARCHAR(10),
    is_split_payment BOOLEAN DEFAULT FALSE,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Absolute prevention of temporal overlap for active bookings.
    -- btree_gist extension required for equality ops on UUID within GiST index.
    -- [start, end) boundary: booking ending at 14:00 does NOT conflict with one starting at 14:00.
    CONSTRAINT prevent_double_booking EXCLUDE USING gist (
        court_id WITH =,
        time_slot WITH &&
    ) WHERE (status != 'cancelled')
);

CREATE INDEX idx_bookings_court_id ON bookings(court_id);
CREATE INDEX idx_bookings_booker_id ON bookings(booker_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_time_slot ON bookings USING gist(time_slot);
