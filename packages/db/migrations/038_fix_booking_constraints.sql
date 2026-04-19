-- Migration 038: Fix booking insert failures
--
-- Three issues preventing bookings from being created:
--
-- 1. The bookings_sync_timestamps trigger calls tsrange(timestamptz, timestamptz)
--    but tsrange only accepts timestamp (without tz). Fix: cast to timestamp.
--
-- 2. booker_id is NOT NULL but admin bookings don't always have a player.
--    Fix: make nullable.
--
-- 3. time_slot (TSRANGE) is NOT NULL but Route Handlers only provide
--    time_slot_start + time_slot_end (the trigger builds time_slot from them).
--    Fix: make nullable + let the trigger handle it.

-- 1. Fix the sync trigger
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
    -- If start/end were set directly, build time_slot from them
    -- Cast to timestamp (without tz) because tsrange doesn't accept timestamptz
    IF NEW.time_slot IS NULL AND NEW.time_slot_start IS NOT NULL AND NEW.time_slot_end IS NOT NULL THEN
        NEW.time_slot := tsrange(
            NEW.time_slot_start::timestamp,
            NEW.time_slot_end::timestamp,
            '[)'
        );
    END IF;
    RETURN NEW;
END;
$$;

-- 2. Make booker_id nullable (admin bookings don't always have a specific player)
ALTER TABLE bookings ALTER COLUMN booker_id DROP NOT NULL;

-- 3. Make time_slot nullable (trigger will populate it from start/end)
ALTER TABLE bookings ALTER COLUMN time_slot DROP NOT NULL;
