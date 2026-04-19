-- Per-session training price, independent of court rate
ALTER TABLE public.training_sessions
    ADD COLUMN IF NOT EXISTS session_price NUMERIC(10,2);

COMMENT ON COLUMN public.training_sessions.session_price IS
    'Admin-set price per session. When set, overrides court rate + pricing rules for this session.';

-- Attendance: optional per booking type toggle
ALTER TABLE public.venue_profiles
    ADD COLUMN IF NOT EXISTS attendance_booking_types TEXT[] DEFAULT ARRAY['training', 'event', 'contract'];

COMMENT ON COLUMN public.venue_profiles.attendance_booking_types IS
    'Which booking types should auto-create attendance rows. Default: training, event, contract.';
