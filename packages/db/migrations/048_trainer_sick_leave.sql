-- Migration 048: Trainer absences / substitution system
-- When a trainer reports sick for a specific session, other trainers
-- can claim that session. Tracks absence per booking/session.

CREATE TABLE IF NOT EXISTS public.trainer_absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    session_date DATE NOT NULL,
    session_start_hour SMALLINT,
    session_end_hour SMALLINT,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'cancelled')),
    claimed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trainer_absences_club ON public.trainer_absences(club_id, status, session_date);
ALTER TABLE public.trainer_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY trainer_absences_read ON public.trainer_absences
    FOR SELECT USING (is_admin() OR trainer_id = current_user_id() OR claimed_by = current_user_id());
CREATE POLICY trainer_absences_write ON public.trainer_absences
    FOR ALL USING (is_admin() OR trainer_id = current_user_id())
    WITH CHECK (is_admin() OR trainer_id = current_user_id());
