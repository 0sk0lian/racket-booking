-- Migration 029: Link public.users to Supabase auth.users
--
-- After this migration:
--   * public.users.id == auth.users.id (same UUID, FK relationship)
--   * public.users.password_hash is removed (auth.users handles credentials)
--   * public.users keeps full_name, phone_number, email, elo_*, role, trainer_*
--     fields as profile data
--
-- All FKs from other tables (bookings.booker_id, attendance.user_id, etc.) keep
-- pointing at public.users.id and continue to work because the UUID values
-- don't change shape — they just gain a constraint that enforces "every
-- public.users row has a matching auth.users row".
--
-- Migration 030 adds a trigger that auto-creates public.users on signup, so
-- the FK is always satisfied for new users.

-- 1. Drop the password_hash column — Supabase Auth owns credentials now
ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;

-- 2. Add the FK constraint. Safe to add even with rows present (after Phase B
-- begins, no public.users rows exist yet — we deleted the seeded ones).
ALTER TABLE public.users
    ADD CONSTRAINT users_id_matches_auth_users
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Drop the now-redundant default for users.id — auth.users assigns the UUID
ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;

COMMENT ON COLUMN public.users.id IS
    'Same UUID as auth.users.id. Populated by trigger in migration 030 on signup.';
