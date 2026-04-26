-- Migration 051: add 'approved' and 'rejected' to membership status CHECK

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
          AND t.relname = 'club_memberships'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.club_memberships DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.club_memberships
    ADD CONSTRAINT club_memberships_status_check
    CHECK (status IN ('pending', 'approved', 'active', 'suspended', 'cancelled', 'rejected'));
