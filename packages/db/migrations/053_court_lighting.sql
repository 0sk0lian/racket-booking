-- ════════════════════════════════════════════════════════════════
-- 053: Court lighting automation
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.court_lighting_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    lights_on_at TIMESTAMPTZ NOT NULL,
    lights_off_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'failed')),
    hardware_relay_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lighting_court ON public.court_lighting_schedules(court_id, lights_on_at);
ALTER TABLE public.court_lighting_schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'court_lighting_schedules' AND policyname = 'lighting_admin'
    ) THEN
        CREATE POLICY lighting_admin ON public.court_lighting_schedules FOR ALL USING (public.is_admin());
    END IF;
END $$;
