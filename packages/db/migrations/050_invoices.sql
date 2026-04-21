-- Migration 050: invoices table for membership billing
--
-- Flow: admin approves form → invoice auto-created → sent to customer →
-- admin marks paid → membership activates.

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES public.club_memberships(id) ON DELETE SET NULL,

    -- Invoice details
    invoice_number VARCHAR(50) NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'SEK',
    description TEXT,
    line_items JSONB DEFAULT '[]',

    -- Status: draft → sent → paid → cancelled
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled', 'overdue')),
    due_date DATE,
    paid_at TIMESTAMPTZ,
    paid_method VARCHAR(50), -- 'manual', 'stripe', 'swish', etc.

    -- PDF storage
    pdf_url TEXT, -- URL or base64 data URI

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_club ON public.invoices(club_id, status);
CREATE INDEX idx_invoices_user ON public.invoices(user_id);
CREATE INDEX idx_invoices_membership ON public.invoices(membership_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Users can see their own invoices
CREATE POLICY invoices_own ON public.invoices
    FOR SELECT USING (user_id = current_user_id());

-- Club admins can see all invoices for their club
CREATE POLICY invoices_admin ON public.invoices
    FOR ALL USING (is_club_admin(club_id))
    WITH CHECK (is_club_admin(club_id));

-- Platform admins can see everything
CREATE POLICY invoices_superadmin ON public.invoices
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin());

-- Add invoice_id to memberships for linking
ALTER TABLE public.club_memberships
    ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Sequence for invoice numbers per club
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;
