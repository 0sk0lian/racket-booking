-- Migration 036: Public matches visibility + area field
-- Adds a visibility column and city/area for geographic filtering.

ALTER TABLE public_matches
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'club'
        CHECK (visibility IN ('club', 'area', 'public')),
    ADD COLUMN IF NOT EXISTS city VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_public_matches_browse
    ON public_matches(club_id, visibility, date, status)
    WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_public_matches_area
    ON public_matches(city, date, status)
    WHERE status = 'open' AND visibility IN ('area', 'public');
