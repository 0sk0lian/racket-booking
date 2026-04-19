-- Migration 042: Big scale upgrade
--
-- Adds club branding, venue configuration extras, membership expiry,
-- club announcements, booking-type colors, user preferences, and
-- backfills slugs for existing clubs.
--
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so the
-- migration is safe to re-run.

-- ════════════════════════════════════════════════════════════════
-- 1. CLUB BRANDING — new columns on clubs
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.clubs
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
    ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7) DEFAULT '#6366f1',
    ADD COLUMN IF NOT EXISTS slug VARCHAR(100);

-- Unique index on slug (partial — only non-null values must be unique,
-- so rows that haven't been backfilled yet don't collide).
CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_slug
    ON public.clubs (slug)
    WHERE slug IS NOT NULL;

-- ════════════════════════════════════════════════════════════════
-- 2. VENUE CONFIGURATION — new columns on venue_profiles
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.venue_profiles
    ADD COLUMN IF NOT EXISTS slot_duration_minutes INT DEFAULT 60,
    ADD COLUMN IF NOT EXISTS cancellation_hours INT DEFAULT 24,
    ADD COLUMN IF NOT EXISTS member_discount_percent NUMERIC(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS booking_confirmation VARCHAR(20) DEFAULT 'instant';

-- Add check constraint for booking_confirmation (safe: only if not present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'venue_profiles_booking_confirmation_check'
    ) THEN
        ALTER TABLE public.venue_profiles
            ADD CONSTRAINT venue_profiles_booking_confirmation_check
            CHECK (booking_confirmation IN ('instant', 'approval'));
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- 3. MEMBERSHIP EXPIRY — new columns on club_memberships
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.club_memberships
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS renewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';

-- Add check constraint for payment_status (safe: only if not present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'club_memberships_payment_status_check'
    ) THEN
        ALTER TABLE public.club_memberships
            ADD CONSTRAINT club_memberships_payment_status_check
            CHECK (payment_status IN ('unpaid', 'paid', 'overdue', 'free'));
    END IF;
END $$;

-- Index for finding expiring memberships
CREATE INDEX IF NOT EXISTS idx_club_memberships_expires
    ON public.club_memberships (expires_at)
    WHERE expires_at IS NOT NULL AND status = 'active';

-- ════════════════════════════════════════════════════════════════
-- 4. CLUB ANNOUNCEMENTS — new table
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.club_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    pinned BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_announcements_club
    ON public.club_announcements (club_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_club_announcements_pinned
    ON public.club_announcements (club_id)
    WHERE pinned = TRUE;

-- RLS
ALTER TABLE public.club_announcements ENABLE ROW LEVEL SECURITY;

-- Club members can read announcements for their club
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'club_announcements' AND policyname = 'announcements_read_members'
    ) THEN
        CREATE POLICY announcements_read_members ON public.club_announcements
            FOR SELECT TO authenticated
            USING (
                public.is_member_of(club_id)
                OR public.is_club_admin(club_id)
            );
    END IF;
END $$;

-- Club admins can insert / update / delete
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'club_announcements' AND policyname = 'announcements_admin_write'
    ) THEN
        CREATE POLICY announcements_admin_write ON public.club_announcements
            FOR ALL TO authenticated
            USING (public.is_club_admin(club_id))
            WITH CHECK (public.is_club_admin(club_id));
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- 5. BOOKING COLORS — new JSONB column on venue_profiles
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.venue_profiles
    ADD COLUMN IF NOT EXISTS booking_colors JSONB
        DEFAULT '{"regular":"#10b981","training":"#3b82f6","contract":"#8b5cf6","event":"#f59e0b"}'::jsonb;

-- ════════════════════════════════════════════════════════════════
-- 6. USER PREFERENCES — new table
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    theme VARCHAR(10) DEFAULT 'light',
    locale VARCHAR(5) DEFAULT 'sv',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Check constraint for theme (safe: only if not present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_preferences_theme_check'
    ) THEN
        ALTER TABLE public.user_preferences
            ADD CONSTRAINT user_preferences_theme_check
            CHECK (theme IN ('light', 'dark', 'system'));
    END IF;
END $$;

-- RLS — users can only read/write their own preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_preferences' AND policyname = 'prefs_own_select'
    ) THEN
        CREATE POLICY prefs_own_select ON public.user_preferences
            FOR SELECT TO authenticated
            USING (user_id = public.current_user_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_preferences' AND policyname = 'prefs_own_insert'
    ) THEN
        CREATE POLICY prefs_own_insert ON public.user_preferences
            FOR INSERT TO authenticated
            WITH CHECK (user_id = public.current_user_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_preferences' AND policyname = 'prefs_own_update'
    ) THEN
        CREATE POLICY prefs_own_update ON public.user_preferences
            FOR UPDATE TO authenticated
            USING (user_id = public.current_user_id())
            WITH CHECK (user_id = public.current_user_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_preferences' AND policyname = 'prefs_own_delete'
    ) THEN
        CREATE POLICY prefs_own_delete ON public.user_preferences
            FOR DELETE TO authenticated
            USING (user_id = public.current_user_id());
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- 7. BACKFILL SLUGS for existing clubs
-- ════════════════════════════════════════════════════════════════
-- Generate slug from name: lowercase, spaces to hyphens, strip
-- everything except a-z 0-9 and hyphens, collapse repeated hyphens,
-- trim leading/trailing hyphens.

UPDATE public.clubs
SET slug = trim(BOTH '-' FROM
    regexp_replace(
        regexp_replace(
            regexp_replace(
                lower(name),
                '[^a-z0-9\s-]', '', 'g'   -- remove special chars
            ),
            '\s+', '-', 'g'               -- spaces to hyphens
        ),
        '-{2,}', '-', 'g'                 -- collapse repeated hyphens
    )
)
WHERE slug IS NULL;

-- Handle duplicate slugs by appending a suffix.
-- If two clubs generate the same slug, append -2, -3, etc.
DO $$
DECLARE
    rec RECORD;
    counter INT;
BEGIN
    FOR rec IN
        SELECT slug, array_agg(id ORDER BY created_at ASC) AS ids
        FROM public.clubs
        WHERE slug IS NOT NULL
        GROUP BY slug
        HAVING count(*) > 1
    LOOP
        counter := 2;
        -- Skip the first (oldest) club — it keeps the base slug
        FOR i IN 2 .. array_length(rec.ids, 1)
        LOOP
            UPDATE public.clubs
            SET slug = rec.slug || '-' || counter
            WHERE id = rec.ids[i];
            counter := counter + 1;
        END LOOP;
    END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════════
