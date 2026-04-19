CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,  -- 'booking.created', 'membership.approved', etc.
    entity_type VARCHAR(30) NOT NULL,  -- 'booking', 'membership', 'training_session', etc.
    entity_id UUID,
    metadata JSONB DEFAULT '{}',  -- extra context (old_status, new_status, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_club ON public.activity_log(club_id, created_at DESC);
CREATE INDEX idx_activity_log_entity ON public.activity_log(entity_type, entity_id);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_log_read ON public.activity_log
    FOR SELECT USING (is_club_admin(club_id) OR is_admin());

CREATE POLICY activity_log_insert ON public.activity_log
    FOR INSERT WITH CHECK (TRUE);
