CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    entity_type VARCHAR(30),
    entity_id UUID,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_club ON public.notifications(club_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_own ON public.notifications
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY notifications_insert ON public.notifications
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY notifications_update_own ON public.notifications
    FOR UPDATE USING (user_id = current_user_id());
