-- Migration 041: add form fields to membership types and answers to memberships
--
-- Each membership type can define custom form fields (JSONB array).
-- When a player applies, their answers are stored on the membership row.

ALTER TABLE public.membership_types
    ADD COLUMN IF NOT EXISTS form_fields JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.membership_types.form_fields IS
    'Array of {key, label, type, required, options?}. Types: text, number, select, checkbox, date.';

ALTER TABLE public.club_memberships
    ADD COLUMN IF NOT EXISTS form_answers JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.club_memberships.form_answers IS
    'Key-value map of answers to the membership type form_fields at time of application.';
