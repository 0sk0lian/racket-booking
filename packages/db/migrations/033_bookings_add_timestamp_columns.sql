-- Migration 033: Add explicit time_slot_start and time_slot_end columns
--
-- PostgREST (Supabase's auto-generated REST API) can't filter on Postgres
-- tsrange columns. The admin schedule endpoint needs to query "all bookings
-- on a given day" efficiently. These two timestamp columns mirror the existing
-- time_slot tsrange but in a format PostgREST and the Supabase JS client can
-- filter with standard .gte() / .lte() operators.
--
-- The tsrange + EXCLUDE USING gist constraint from migration 003 remains the
-- source of truth for overlap prevention. These columns are a read-optimized
-- denormalization.

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS time_slot_start TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS time_slot_end   TIMESTAMP WITH TIME ZONE;

-- Backfill from tsrange for any existing rows
UPDATE bookings SET
    time_slot_start = lower(time_slot),
    time_slot_end   = upper(time_slot)
WHERE time_slot IS NOT NULL AND time_slot_start IS NULL;

-- Index for efficient day-range queries
CREATE INDEX IF NOT EXISTS idx_bookings_time_range
    ON bookings(court_id, time_slot_start, time_slot_end)
    WHERE status != 'cancelled';

-- Trigger to keep them in sync when time_slot changes
CREATE OR REPLACE FUNCTION bookings_sync_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If time_slot was set/changed, sync the denormalized columns
    IF NEW.time_slot IS NOT NULL THEN
        NEW.time_slot_start := lower(NEW.time_slot);
        NEW.time_slot_end   := upper(NEW.time_slot);
    END IF;
    -- If start/end were set directly (from Route Handlers that don't use tsrange),
    -- build the time_slot from them
    IF NEW.time_slot IS NULL AND NEW.time_slot_start IS NOT NULL AND NEW.time_slot_end IS NOT NULL THEN
        NEW.time_slot := tsrange(NEW.time_slot_start, NEW.time_slot_end, '[)');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_sync_ts ON bookings;
CREATE TRIGGER bookings_sync_ts
    BEFORE INSERT OR UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION bookings_sync_timestamps();
