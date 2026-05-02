-- ════════════════════════════════════════════════════════════════
-- 052: Social features — friends + club feed + push subscriptions
-- ════════════════════════════════════════════════════════════════

-- Friends
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON public.friendships(user_id, status);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'friendships' AND policyname = 'friendships_own'
    ) THEN
        CREATE POLICY friendships_own ON public.friendships FOR ALL
            USING (user_id = public.current_user_id() OR friend_id = public.current_user_id());
    END IF;
END $$;

-- Club feed posts
CREATE TABLE IF NOT EXISTS public.club_feed_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_club_feed ON public.club_feed_posts(club_id, created_at DESC);
ALTER TABLE public.club_feed_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'club_feed_posts' AND policyname = 'club_feed_read'
    ) THEN
        CREATE POLICY club_feed_read ON public.club_feed_posts FOR SELECT USING (TRUE);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'club_feed_posts' AND policyname = 'club_feed_write'
    ) THEN
        CREATE POLICY club_feed_write ON public.club_feed_posts FOR INSERT
            WITH CHECK (public.is_club_admin(club_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'club_feed_posts' AND policyname = 'club_feed_delete'
    ) THEN
        CREATE POLICY club_feed_delete ON public.club_feed_posts FOR DELETE
            USING (public.is_club_admin(club_id));
    END IF;
END $$;

-- Push subscription on user_preferences
ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS push_subscription JSONB;
