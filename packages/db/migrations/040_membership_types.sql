-- Migration 040: membership types per club
--
-- Adds a lookup table so club admins can define membership tiers
-- (name, price, billing interval, description). The existing
-- club_memberships.membership_type VARCHAR stays as-is for
-- backwards compat — it stores the type name, not an FK.

CREATE TABLE IF NOT EXISTS public.membership_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    price       NUMERIC(10,2) DEFAULT 0,
    currency    VARCHAR(3) DEFAULT 'SEK',
    interval    VARCHAR(20) DEFAULT 'month' CHECK (interval IN ('month', 'quarter', 'half_year', 'year', 'once')),
    is_active   BOOLEAN DEFAULT TRUE,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(club_id, name)
);

CREATE INDEX idx_membership_types_club ON public.membership_types(club_id, is_active);

ALTER TABLE public.membership_types ENABLE ROW LEVEL SECURITY;

-- Anyone can read active types (for consumer pages)
CREATE POLICY membership_types_read ON public.membership_types
    FOR SELECT USING (TRUE);

-- Club admins can manage their own types
CREATE POLICY membership_types_admin ON public.membership_types
    FOR ALL USING (is_club_admin(club_id))
    WITH CHECK (is_club_admin(club_id));

-- Insert a default 'Standard' type for each club that has memberships
-- but no types defined yet.
INSERT INTO public.membership_types (club_id, name, description, price, interval)
SELECT DISTINCT cm.club_id, 'Standard', 'Standardmedlemskap', 0, 'year'
FROM public.club_memberships cm
WHERE NOT EXISTS (
    SELECT 1 FROM public.membership_types mt WHERE mt.club_id = cm.club_id
)
ON CONFLICT DO NOTHING;
