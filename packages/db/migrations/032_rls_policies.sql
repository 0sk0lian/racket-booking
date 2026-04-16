-- Migration 031: Real Row-Level Security policies
--
-- Migration 027 enabled RLS but wrote no policies — that means the anon and
-- authenticated roles see NOTHING (default deny). Service role still bypasses
-- RLS (it always does). This migration adds the actual policies that govern
-- direct client-from-browser / client-from-mobile access via the publishable
-- key.
--
-- Server-side API routes (Next.js Route Handlers using the SECRET key) bypass
-- RLS automatically — these policies don't affect them.
--
-- Helper functions are SECURITY DEFINER so they execute with elevated rights;
-- they're tiny and STABLE so the planner can cache results within a query.
-- That keeps the hot path fast even when policies fire on every row.

-- ─── Helper: who is the calling user? ────────────────────────────
-- auth.uid() is provided by Supabase but expensive if called many times.
-- Wrap once in a stable helper so policies can use it cheaply.
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT auth.uid() $$;

-- ─── Helper: is the caller an admin? ────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
$$;

-- ─── Helper: is the caller an admin of a specific club? ─────────
CREATE OR REPLACE FUNCTION public.is_club_admin(target_club UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.club_admins
        WHERE user_id = auth.uid() AND club_id = target_club
    ) OR public.is_admin()
$$;

-- ─── Helper: is the caller a trainer at a specific club? ────────
CREATE OR REPLACE FUNCTION public.is_trainer_at(target_club UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role = 'trainer'
          AND trainer_club_id = target_club
    ) OR public.is_club_admin(target_club)
$$;

-- ════════════════════════════════════════════════════════════════
-- POLICIES
-- ════════════════════════════════════════════════════════════════

-- ─── public.users (profile) ─────────────────────────────────────
-- Self can read + update own profile; admins can read everyone.
CREATE POLICY users_select_self ON public.users
    FOR SELECT TO authenticated
    USING (id = public.current_user_id() OR public.is_admin());

CREATE POLICY users_update_self ON public.users
    FOR UPDATE TO authenticated
    USING (id = public.current_user_id())
    WITH CHECK (id = public.current_user_id() AND role = (SELECT role FROM public.users WHERE id = public.current_user_id()));
    -- Prevents users from self-promoting to admin via update.

CREATE POLICY users_admin_all ON public.users
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ─── clubs ──────────────────────────────────────────────────────
-- Public read for all authenticated users (so consumer app can browse clubs).
-- Only admins can write.
CREATE POLICY clubs_read_authenticated ON public.clubs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY clubs_admin_write ON public.clubs
    FOR ALL TO authenticated
    USING (public.is_club_admin(id))
    WITH CHECK (public.is_club_admin(id));

-- ─── courts ─────────────────────────────────────────────────────
CREATE POLICY courts_read_authenticated ON public.courts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY courts_admin_write ON public.courts
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

-- ─── venue_profiles ─────────────────────────────────────────────
CREATE POLICY venue_profiles_read ON public.venue_profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY venue_profiles_admin_write ON public.venue_profiles
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

-- Public read for venue profiles even unauthenticated (marketing pages)
CREATE POLICY venue_profiles_read_public ON public.venue_profiles
    FOR SELECT TO anon USING (true);

CREATE POLICY clubs_read_public ON public.clubs
    FOR SELECT TO anon USING (true);

CREATE POLICY courts_read_public ON public.courts
    FOR SELECT TO anon USING (true);

-- ─── club_admins ────────────────────────────────────────────────
CREATE POLICY club_admins_read ON public.club_admins
    FOR SELECT TO authenticated
    USING (user_id = public.current_user_id() OR public.is_admin());

CREATE POLICY club_admins_admin_write ON public.club_admins
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ─── bookings ───────────────────────────────────────────────────
-- A user can read bookings they made or that they're rostered/attending.
-- Club admins + trainers see everything at their club.
CREATE POLICY bookings_read_self_or_admin ON public.bookings
    FOR SELECT TO authenticated
    USING (
        booker_id = public.current_user_id()
        OR public.current_user_id() = ANY(player_ids)
        OR public.current_user_id() = ANY(event_attendee_ids)
        OR public.is_trainer_at((SELECT club_id FROM public.courts WHERE id = bookings.court_id))
    );

-- Users can create bookings as themselves; admins/trainers can book anyone.
CREATE POLICY bookings_insert_self ON public.bookings
    FOR INSERT TO authenticated
    WITH CHECK (
        booker_id = public.current_user_id()
        OR public.is_trainer_at((SELECT club_id FROM public.courts WHERE id = bookings.court_id))
    );

-- Update / cancel: own booking, or admin/trainer of the booking's club
CREATE POLICY bookings_update_self_or_admin ON public.bookings
    FOR UPDATE TO authenticated
    USING (
        booker_id = public.current_user_id()
        OR public.is_trainer_at((SELECT club_id FROM public.courts WHERE id = bookings.court_id))
    )
    WITH CHECK (
        booker_id = public.current_user_id()
        OR public.is_trainer_at((SELECT club_id FROM public.courts WHERE id = bookings.court_id))
    );

-- ─── attendance ─────────────────────────────────────────────────
-- Self can RSVP (insert + update own row); trainer/admin manages anyone.
CREATE POLICY attendance_read_self_or_admin ON public.attendance
    FOR SELECT TO authenticated
    USING (
        user_id = public.current_user_id()
        OR public.is_trainer_at((
            SELECT club_id FROM public.courts c
            JOIN public.bookings b ON b.court_id = c.id
            WHERE b.id = attendance.booking_id
        ))
    );

CREATE POLICY attendance_write_self_or_admin ON public.attendance
    FOR ALL TO authenticated
    USING (
        user_id = public.current_user_id()
        OR public.is_trainer_at((
            SELECT club_id FROM public.courts c
            JOIN public.bookings b ON b.court_id = c.id
            WHERE b.id = attendance.booking_id
        ))
    )
    WITH CHECK (
        user_id = public.current_user_id()
        OR public.is_trainer_at((
            SELECT club_id FROM public.courts c
            JOIN public.bookings b ON b.court_id = c.id
            WHERE b.id = attendance.booking_id
        ))
    );

-- ─── recurrence_rules + blackout_periods + training_sessions + weekly_templates ─
-- Authenticated users can read (so consumer app can show schedule). Only
-- club admins / trainers can write at their club.
CREATE POLICY recurrence_rules_read ON public.recurrence_rules
    FOR SELECT TO authenticated USING (true);
CREATE POLICY recurrence_rules_write ON public.recurrence_rules
    FOR ALL TO authenticated
    USING (public.is_trainer_at(club_id))
    WITH CHECK (public.is_trainer_at(club_id));

CREATE POLICY blackout_periods_read ON public.blackout_periods
    FOR SELECT TO authenticated USING (true);
CREATE POLICY blackout_periods_write ON public.blackout_periods
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

CREATE POLICY training_sessions_read ON public.training_sessions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY training_sessions_write ON public.training_sessions
    FOR ALL TO authenticated
    USING (public.is_trainer_at(club_id))
    WITH CHECK (public.is_trainer_at(club_id));

CREATE POLICY weekly_templates_read ON public.weekly_templates
    FOR SELECT TO authenticated USING (true);
CREATE POLICY weekly_templates_write ON public.weekly_templates
    FOR ALL TO authenticated
    USING (public.is_trainer_at(club_id))
    WITH CHECK (public.is_trainer_at(club_id));

-- ─── groups ─────────────────────────────────────────────────────
CREATE POLICY groups_read ON public.groups
    FOR SELECT TO authenticated USING (true);
CREATE POLICY groups_write ON public.groups
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

-- ─── price_rules ────────────────────────────────────────────────
CREATE POLICY price_rules_read ON public.price_rules
    FOR SELECT TO authenticated USING (true);
CREATE POLICY price_rules_write ON public.price_rules
    FOR ALL TO authenticated
    USING (public.is_club_admin((SELECT club_id FROM public.courts WHERE id = price_rules.court_id)))
    WITH CHECK (public.is_club_admin((SELECT club_id FROM public.courts WHERE id = price_rules.court_id)));

-- ─── loyalty (per user, per club) ───────────────────────────────
CREATE POLICY loyalty_read ON public.loyalty
    FOR SELECT TO authenticated
    USING (user_id = public.current_user_id() OR public.is_club_admin(club_id));
CREATE POLICY loyalty_write ON public.loyalty
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

-- ─── time_reports + sick_leaves (trainer's own data) ────────────
CREATE POLICY time_reports_read ON public.time_reports
    FOR SELECT TO authenticated
    USING (user_id = public.current_user_id() OR public.is_club_admin(club_id));
CREATE POLICY time_reports_write_self ON public.time_reports
    FOR INSERT TO authenticated
    WITH CHECK (user_id = public.current_user_id());
CREATE POLICY time_reports_admin_approve ON public.time_reports
    FOR UPDATE TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

CREATE POLICY sick_leaves_read ON public.sick_leaves
    FOR SELECT TO authenticated
    USING (user_id = public.current_user_id() OR public.is_club_admin(club_id));
CREATE POLICY sick_leaves_write_self ON public.sick_leaves
    FOR INSERT TO authenticated
    WITH CHECK (user_id = public.current_user_id());
CREATE POLICY sick_leaves_admin_manage ON public.sick_leaves
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

-- ─── clip_cards (own) ───────────────────────────────────────────
CREATE POLICY clip_cards_read_own ON public.clip_cards
    FOR SELECT TO authenticated
    USING (owner_id = public.current_user_id() OR public.is_club_admin(club_id));
CREATE POLICY clip_cards_write_admin ON public.clip_cards
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

-- ─── seasons + subscriptions ────────────────────────────────────
CREATE POLICY seasons_read ON public.seasons
    FOR SELECT TO authenticated USING (true);
CREATE POLICY seasons_write ON public.seasons
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

CREATE POLICY subscriptions_read_own ON public.subscriptions
    FOR SELECT TO authenticated
    USING (customer_id = public.current_user_id() OR public.is_club_admin(club_id));
CREATE POLICY subscriptions_write_admin ON public.subscriptions
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

-- ─── leagues + statements (read-public-ish, write-admin) ────────
CREATE POLICY leagues_read ON public.leagues
    FOR SELECT TO authenticated USING (true);
CREATE POLICY leagues_write ON public.leagues
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

CREATE POLICY statements_read_admin ON public.statements
    FOR SELECT TO authenticated
    USING (public.is_club_admin(club_id));
CREATE POLICY statements_write_admin ON public.statements
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

-- ─── public_matches (matchmaking — anyone can browse, hosts manage) ─
CREATE POLICY public_matches_read ON public.public_matches
    FOR SELECT TO authenticated USING (true);
CREATE POLICY public_matches_create ON public.public_matches
    FOR INSERT TO authenticated
    WITH CHECK (host_id = public.current_user_id());
CREATE POLICY public_matches_update_host ON public.public_matches
    FOR UPDATE TO authenticated
    USING (host_id = public.current_user_id() OR public.is_club_admin(club_id))
    WITH CHECK (host_id = public.current_user_id() OR public.is_club_admin(club_id));

-- ─── waitlists (own queue position) ─────────────────────────────
CREATE POLICY waitlists_read_own ON public.waitlists
    FOR SELECT TO authenticated
    USING (user_id = public.current_user_id());
CREATE POLICY waitlists_write_own ON public.waitlists
    FOR ALL TO authenticated
    USING (user_id = public.current_user_id())
    WITH CHECK (user_id = public.current_user_id());

-- ─── split_invites (inviter or invitee can see) ─────────────────
CREATE POLICY split_invites_read ON public.split_invites
    FOR SELECT TO authenticated
    USING (
        inviter_id = public.current_user_id()
        OR invitee_id = public.current_user_id()
    );
CREATE POLICY split_invites_create ON public.split_invites
    FOR INSERT TO authenticated
    WITH CHECK (inviter_id = public.current_user_id());
CREATE POLICY split_invites_respond ON public.split_invites
    FOR UPDATE TO authenticated
    USING (invitee_id = public.current_user_id())
    WITH CHECK (invitee_id = public.current_user_id());

-- ─── registration_forms + form_submissions ──────────────────────
CREATE POLICY registration_forms_read ON public.registration_forms
    FOR SELECT TO authenticated USING (status = 'open' OR public.is_club_admin(club_id));
CREATE POLICY registration_forms_write ON public.registration_forms
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

CREATE POLICY form_submissions_read ON public.form_submissions
    FOR SELECT TO authenticated
    USING (
        user_id = public.current_user_id()
        OR public.is_club_admin((SELECT club_id FROM public.registration_forms WHERE id = form_submissions.form_id))
    );
CREATE POLICY form_submissions_create ON public.form_submissions
    FOR INSERT TO authenticated
    WITH CHECK (user_id = public.current_user_id());

-- ─── matches + tournaments + split_payments ─────────────────────
CREATE POLICY matches_read_authenticated ON public.matches
    FOR SELECT TO authenticated USING (true);
CREATE POLICY matches_write_admin ON public.matches
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY tournaments_read_authenticated ON public.tournaments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY tournaments_write_admin ON public.tournaments
    FOR ALL TO authenticated
    USING (public.is_club_admin(club_id))
    WITH CHECK (public.is_club_admin(club_id));

CREATE POLICY split_payments_read_own ON public.split_payments
    FOR SELECT TO authenticated
    USING (
        user_id = public.current_user_id()
        OR public.is_admin()
    );

COMMENT ON FUNCTION public.is_admin IS 'Returns true if the calling auth.uid() has role=admin in public.users.';
COMMENT ON FUNCTION public.is_club_admin IS 'Returns true if the calling user is a club_admin of the given club, or a platform admin.';
COMMENT ON FUNCTION public.is_trainer_at IS 'Returns true if the calling user is a trainer at the given club, or a club admin there.';
