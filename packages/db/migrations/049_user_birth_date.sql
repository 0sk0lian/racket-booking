-- Migration 049: add birth_date to users for membership flow
-- Step 1 of "Hur blir man medlem" requires birthdate at signup.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Update the signup trigger to capture birth_date from user metadata
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
        birth_date,
        role
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'phone_number',
        (NEW.raw_user_meta_data->>'birth_date')::DATE,
        assigned_role
    );

    RETURN NEW;
END;
$$;
