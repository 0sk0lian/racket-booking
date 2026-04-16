-- Migration 018: Venue profiles
-- Per-club public profile: amenities, photos, opening hours, booking rules,
-- social links. One-to-one with clubs (could be inlined into clubs, but kept
-- separate so the clubs row stays small and admins can edit profile content
-- without locking the core club row).

CREATE TABLE venue_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL UNIQUE REFERENCES clubs(id) ON DELETE CASCADE,

    description TEXT,
    amenities TEXT[] NOT NULL DEFAULT '{}',  -- ['omklädningsrum', 'bastu', ...]
    images TEXT[] NOT NULL DEFAULT '{}',     -- public URLs (Supabase Storage)

    -- [{ day: 0..6, open: 'HH:MM', close: 'HH:MM' }, ...]
    opening_hours JSONB NOT NULL DEFAULT '[]',

    -- {
    --   max_days_ahead: int,
    --   cancellation_hours: int,
    --   refund_percentage: int (0-100),
    --   max_bookings_per_user: int | null,
    --   show_names_in_schedule: bool
    -- }
    booking_rules JSONB NOT NULL DEFAULT '{}',

    -- { website?: string, instagram?: string, facebook?: string }
    social_links JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
