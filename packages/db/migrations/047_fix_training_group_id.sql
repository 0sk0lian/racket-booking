-- Migration 047: add group_id to training_sessions
-- Needed for the cascade that auto-invites group members to sessions.

ALTER TABLE public.training_sessions
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_training_sessions_group
    ON public.training_sessions(group_id) WHERE group_id IS NOT NULL;
