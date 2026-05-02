-- Migration 051: course application answers, invoice links, and linked forms
--
-- Enables the Courtflow-style course flow:
-- 1. A course can point to a registration form for its application questions.
-- 2. Course registrations store the submitted answers.
-- 3. Course registrations can be linked to generated invoices.

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS registration_form_id UUID
        REFERENCES public.registration_forms(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.courses.registration_form_id IS
    'Optional registration form whose fields are reused as the course application form.';

ALTER TABLE public.course_registrations
    ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.course_registrations.answers IS
    'Answers submitted by the player when applying to the course.';

ALTER TABLE public.course_registrations
    ADD COLUMN IF NOT EXISTS invoice_id UUID
        REFERENCES public.invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.course_registrations.invoice_id IS
    'Invoice linked to this course registration, when billing is handled through invoices.';

CREATE INDEX IF NOT EXISTS idx_course_registrations_invoice
    ON public.course_registrations(invoice_id)
    WHERE invoice_id IS NOT NULL;
