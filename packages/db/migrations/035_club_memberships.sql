-- Migration 035: Club memberships
-- Players can apply for membership at a club. Admins approve/reject.
-- Members get access to member-only events, pricing, and social features.

CREATE TABLE club_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'suspended', 'cancelled')),
    membership_type VARCHAR(50) NOT NULL DEFAULT 'standard',

    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (club_id, user_id)
);

CREATE INDEX idx_club_memberships_club ON club_memberships(club_id, status);
CREATE INDEX idx_club_memberships_user ON club_memberships(user_id);
CREATE INDEX idx_club_memberships_pending ON club_memberships(club_id)
    WHERE status = 'pending';

-- RLS
ALTER TABLE club_memberships ENABLE ROW LEVEL SECURITY;

-- Players can read their own memberships + apply
CREATE POLICY memberships_read_own ON club_memberships
    FOR SELECT TO authenticated
    USING (user_id = public.current_user_id() OR public.is_club_admin(club_id));

CREATE POLICY memberships_apply ON club_memberships
    FOR INSERT TO authenticated
    WITH CHECK (user_id = public.current_user_id() AND status = 'pending');

-- Admins manage
CREATE POLICY memberships_admin ON club_memberships
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

-- Helper: is user a member of a club?
CREATE OR REPLACE FUNCTION public.is_member_of(target_club UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.club_memberships
        WHERE user_id = auth.uid()
          AND club_id = target_club
          AND status = 'active'
    )
$$;
