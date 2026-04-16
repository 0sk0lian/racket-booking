-- Migration 030: Signup trigger + first-user-becomes-admin
--
-- On every new auth.users insert (Supabase Auth signup), automatically create
-- a matching public.users profile row with the same id. The first user ever
-- to sign up becomes 'admin'; everyone after defaults to 'player'.
--
-- The trigger reads `raw_user_meta_data` from auth.users so signup forms can
-- pre-fill profile fields like full_name and phone_number by passing them in
-- the Supabase Auth signUp() options.data object.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER         -- needs to write to public.users despite RLS
SET search_path = public, pg_temp
AS $$
DECLARE
    is_first_user BOOLEAN;
    assigned_role TEXT;
BEGIN
    -- Determine role: first user gets 'admin', everyone else 'player'
    SELECT NOT EXISTS (SELECT 1 FROM public.users LIMIT 1) INTO is_first_user;
    assigned_role := CASE WHEN is_first_user THEN 'admin' ELSE 'player' END;

    INSERT INTO public.users (
        id,
        email,
        full_name,
        phone_number,
        role
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'phone_number',
        assigned_role
    );

    RETURN NEW;
END;
$$;

-- Drop existing trigger if present, then re-create. Idempotent re-runs.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON FUNCTION public.handle_new_auth_user IS
    'Auto-creates a public.users profile when a new auth.users row is inserted. First user becomes admin, all others default to player.';
