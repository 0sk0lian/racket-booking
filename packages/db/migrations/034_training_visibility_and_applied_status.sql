-- Migration 034: Training visibility + 'applied' attendance status
--
-- Enables players to discover and apply to training sessions.
-- Training sessions gain a visibility level (private/club/public) and max_players.
-- Attendance gains an 'applied' status for pending applications.

-- 1. Extend attendance status to include 'applied'
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
    CHECK (status IN ('invited', 'going', 'declined', 'waitlist', 'applied', 'present', 'no_show'));

-- 2. Training session visibility + capacity
ALTER TABLE training_sessions
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private', 'club', 'public')),
    ADD COLUMN IF NOT EXISTS max_players INT;

-- 3. Event bookings also get visibility (for browsable events)
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private', 'club', 'public'));

CREATE INDEX IF NOT EXISTS idx_training_sessions_visibility
    ON training_sessions(club_id, visibility) WHERE status != 'cancelled';
CREATE INDEX IF NOT EXISTS idx_bookings_event_visibility
    ON bookings(court_id, visibility) WHERE booking_type = 'event' AND status != 'cancelled';
