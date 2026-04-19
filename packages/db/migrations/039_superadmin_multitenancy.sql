-- Migration 039: add superadmin role and bootstrap behavior
--
-- Goal:
-- - Introduce a platform-level superadmin role.
-- - Ensure first signup becomes superadmin (not admin).
-- - Keep RLS helpers treating both admin + superadmin as platform admins.
-- - Backfill one existing admin to superadmin if none exists yet.

-- 1) Expand users.role check constraint to allow superadmin.
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'users'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%role%'
    LOOP
        EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('player', 'trainer', 'admin', 'superadmin'));

-- 2) First signup should become superadmin.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    is_first_user BOOLEAN;
    assigned_role TEXT;
BEGIN
    SELECT NOT EXISTS (SELECT 1 FROM public.users LIMIT 1) INTO is_first_user;
    assigned_role := CASE WHEN is_first_user THEN 'superadmin' ELSE 'player' END;

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

COMMENT ON FUNCTION public.handle_new_auth_user IS
    'Auto-creates a public.users profile when a new auth.users row is inserted. First user becomes superadmin, all others default to player.';

-- 3) RLS helper: superadmin should be treated as platform admin.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
$$;

COMMENT ON FUNCTION public.is_admin IS
    'Returns true if the calling auth.uid() has role=admin or role=superadmin in public.users.';

-- 4) Backfill: ensure there is exactly at least one superadmin in existing environments.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE role = 'superadmin') THEN
        UPDATE public.users
        SET role = 'superadmin',
            updated_at = NOW()
        WHERE id = (
            SELECT id
            FROM public.users
            WHERE role = 'admin'
            ORDER BY created_at ASC NULLS LAST, id ASC
            LIMIT 1
        );
    END IF;
END $$;
