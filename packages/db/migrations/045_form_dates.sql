-- Add open/close dates to registration forms for auto-scheduling
ALTER TABLE public.registration_forms
    ADD COLUMN IF NOT EXISTS open_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS close_date TIMESTAMPTZ;
