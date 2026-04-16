-- Migration 031: Bring bookings table to parity with what the code expects
--
-- The original bookings table (migration 003) only had core scheduling fields
-- (court, booker, time slot, status, price, PIN). Over time the in-memory
-- store grew booking_type, trainer roster, contract grouping, event metadata,
-- and notes — but the SQL schema was never extended to match.
--
-- This migration adds those columns so:
--   * Phase C (API rewrite) can store all booking data in Postgres
--   * The recurrence engine and attendance system can persist what they need
--   * RLS policies in the next migration can reference player_ids and
--     event_attendee_ids
--
-- Defaults are picked so existing rows (if any) get safe values.

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20) NOT NULL DEFAULT 'regular'
        CHECK (booking_type IN ('regular', 'training', 'contract', 'event')),
    ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Roster cached as arrays for read speed; canonical state in attendance table.
    ADD COLUMN IF NOT EXISTS player_ids UUID[] NOT NULL DEFAULT '{}',
    -- Free-text training focus tags + customer wish, kept on the booking
    ADD COLUMN IF NOT EXISTS training_focus TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS training_request TEXT,
    -- Contract grouping (legacy; new contracts live in recurrence_rules)
    ADD COLUMN IF NOT EXISTS contract_id UUID,
    ADD COLUMN IF NOT EXISTS recurrence_day SMALLINT
        CHECK (recurrence_day IS NULL OR (recurrence_day >= 0 AND recurrence_day <= 6)),
    -- Event metadata (booking_type='event')
    ADD COLUMN IF NOT EXISTS event_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS event_max_participants INT,
    ADD COLUMN IF NOT EXISTS event_attendee_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_trainer ON bookings(trainer_id) WHERE trainer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_contract ON bookings(contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_type_status ON bookings(booking_type, status);

COMMENT ON COLUMN bookings.player_ids IS 'Cached training/event roster. Source of truth: attendance table.';
COMMENT ON COLUMN bookings.event_attendee_ids IS 'Cached event sign-ups. Source of truth: attendance table where status=going.';
