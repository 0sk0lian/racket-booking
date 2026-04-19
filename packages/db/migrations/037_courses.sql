-- Migration 037: Courses system
-- Groups training sessions into named, term-based offerings with registration,
-- participant management, and per-session attendance. Inspired by MATCHi's
-- Kurser model but extended with visibility and pricing.

-- ─── Courses (the catalog entry) ────────────────────────────────

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,
    sport_type VARCHAR(50) NOT NULL CHECK (sport_type IN ('padel', 'tennis', 'squash', 'badminton')),
    category VARCHAR(50) NOT NULL DEFAULT 'adult'
        CHECK (category IN ('junior', 'adult', 'senior', 'camp', 'competition', 'other')),

    -- Schedule defaults (individual sessions can override)
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
    trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_hour SMALLINT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour SMALLINT NOT NULL CHECK (end_hour >= 1 AND end_hour <= 24),
    CHECK (end_hour > start_hour),

    -- Term
    term_start DATE NOT NULL,
    term_end DATE NOT NULL,
    CHECK (term_end > term_start),
    skip_dates DATE[] NOT NULL DEFAULT '{}',

    -- Capacity + pricing
    max_participants INT,
    price_total NUMERIC(10, 2),          -- full-term price (null = free)
    price_per_session NUMERIC(10, 2),    -- drop-in price (null = term-only)

    -- Lifecycle
    registration_status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (registration_status IN ('draft', 'open', 'closed', 'waitlist')),
    visibility VARCHAR(20) NOT NULL DEFAULT 'club'
        CHECK (visibility IN ('private', 'club', 'public')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_courses_club ON courses(club_id);
CREATE INDEX idx_courses_active ON courses(club_id, status, registration_status)
    WHERE status IN ('draft', 'active');
CREATE INDEX idx_courses_trainer ON courses(trainer_id) WHERE trainer_id IS NOT NULL;

-- ─── Course Registrations ───────────────────────────────────────

CREATE TABLE course_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'waitlisted', 'cancelled')),
    waitlist_position INT,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),

    notes TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (course_id, user_id)
);

CREATE INDEX idx_course_registrations_course ON course_registrations(course_id, status);
CREATE INDEX idx_course_registrations_user ON course_registrations(user_id);
CREATE INDEX idx_course_registrations_pending ON course_registrations(course_id)
    WHERE status = 'pending';

-- ─── Course Sessions (individual occurrences) ───────────────────

CREATE TABLE course_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

    date DATE NOT NULL,
    start_hour SMALLINT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour SMALLINT NOT NULL CHECK (end_hour >= 1 AND end_hour <= 24),
    CHECK (end_hour > start_hour),

    -- Can override per-session (one-off court/trainer change)
    court_id UUID REFERENCES courts(id) ON DELETE RESTRICT,
    trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'cancelled', 'completed')),

    -- Links to a real booking once materialized
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_course_sessions_course ON course_sessions(course_id, date);
CREATE INDEX idx_course_sessions_date ON course_sessions(date, status)
    WHERE status = 'scheduled';
CREATE INDEX idx_course_sessions_booking ON course_sessions(booking_id)
    WHERE booking_id IS NOT NULL;

-- ─── RLS ────────────────────────────────────────────────────────

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_sessions ENABLE ROW LEVEL SECURITY;

-- Courses: public read (consumer catalog), admin write
CREATE POLICY courses_read ON courses
    FOR SELECT TO authenticated USING (
        visibility = 'public'
        OR (visibility = 'club' AND public.is_member_of(club_id))
        OR public.is_club_admin(club_id)
    );
CREATE POLICY courses_read_anon ON courses
    FOR SELECT TO anon USING (visibility = 'public');
CREATE POLICY courses_write ON courses
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

-- Registrations: own read + apply; admin manages
CREATE POLICY registrations_read ON course_registrations
    FOR SELECT TO authenticated
    USING (user_id = public.current_user_id()
        OR public.is_club_admin((SELECT club_id FROM courses WHERE id = course_registrations.course_id)));
CREATE POLICY registrations_apply ON course_registrations
    FOR INSERT TO authenticated
    WITH CHECK (user_id = public.current_user_id() AND status = 'pending');
CREATE POLICY registrations_admin ON course_registrations
    FOR ALL TO authenticated
    USING (public.is_club_admin((SELECT club_id FROM courses WHERE id = course_registrations.course_id)))
    WITH CHECK (public.is_club_admin((SELECT club_id FROM courses WHERE id = course_registrations.course_id)));

-- Sessions: read by registered participants + admin; write by admin
CREATE POLICY sessions_read ON course_sessions
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM course_registrations cr
            WHERE cr.course_id = course_sessions.course_id
              AND cr.user_id = public.current_user_id()
              AND cr.status = 'approved'
        )
        OR public.is_club_admin((SELECT club_id FROM courses WHERE id = course_sessions.course_id))
    );
CREATE POLICY sessions_write ON course_sessions
    FOR ALL TO authenticated
    USING (public.is_club_admin((SELECT club_id FROM courses WHERE id = course_sessions.course_id)))
    WITH CHECK (public.is_club_admin((SELECT club_id FROM courses WHERE id = course_sessions.course_id)));
