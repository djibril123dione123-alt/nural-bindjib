-- =============================================================================
-- Local 400/404 Full Alignment (Supabase)
-- - RPC add_xp/remove_xp exact params: p_user_id, p_amount, p_source
-- - activity_feed compatible actor_id/user_id + RLS + trigger sync
-- - alter_ego_missions + hifz_progress + duo_messages ensure existence
-- - salat_tracking minimal columns + completed_at
-- =============================================================================

-- ---------- salat_tracking ----------
CREATE TABLE IF NOT EXISTS public.salat_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prayer_name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, prayer_name, date)
);

ALTER TABLE public.salat_tracking
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS prayer_name text,
  ADD COLUMN IF NOT EXISTS date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salat_tracking_user_prayer_date_unique'
  ) THEN
    ALTER TABLE public.salat_tracking
      ADD CONSTRAINT salat_tracking_user_prayer_date_unique UNIQUE (user_id, prayer_name, date);
  END IF;
END $$;

ALTER TABLE public.salat_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read all salat" ON public.salat_tracking;
DROP POLICY IF EXISTS "Users can read own salat" ON public.salat_tracking;
CREATE POLICY "Users can read all salat" ON public.salat_tracking
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert own salat" ON public.salat_tracking;
CREATE POLICY "Users can insert own salat" ON public.salat_tracking
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own salat" ON public.salat_tracking;
CREATE POLICY "Users can update own salat" ON public.salat_tracking
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete own salat" ON public.salat_tracking;
CREATE POLICY "Users can delete own salat" ON public.salat_tracking
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------- activity_feed ----------
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  xp_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.activity_feed
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS xp_earned integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.activity_feed SET actor_id = user_id WHERE actor_id IS NULL AND user_id IS NOT NULL;
UPDATE public.activity_feed SET user_id = actor_id WHERE user_id IS NULL AND actor_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.activity_feed_sync_ids()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.actor_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.actor_id := NEW.user_id;
  ELSIF NEW.user_id IS NULL AND NEW.actor_id IS NOT NULL THEN
    NEW.user_id := NEW.actor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_feed_sync_ids ON public.activity_feed;
CREATE TRIGGER trg_activity_feed_sync_ids
  BEFORE INSERT OR UPDATE ON public.activity_feed
  FOR EACH ROW EXECUTE FUNCTION public.activity_feed_sync_ids();

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read all activity" ON public.activity_feed;
CREATE POLICY "Authenticated can read all activity" ON public.activity_feed
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert own activity" ON public.activity_feed;
CREATE POLICY "Users can insert own activity" ON public.activity_feed
  FOR INSERT TO authenticated WITH CHECK (COALESCE(actor_id, user_id) = auth.uid());
DROP POLICY IF EXISTS "Users can delete own activity" ON public.activity_feed;
CREATE POLICY "Users can delete own activity" ON public.activity_feed
  FOR DELETE TO authenticated USING (COALESCE(actor_id, user_id) = auth.uid());

-- ---------- alter_ego_missions (404) ----------
CREATE TABLE IF NOT EXISTS public.alter_ego_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  xp integer NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'pending',
  proof_url text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.alter_ego_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own missions" ON public.alter_ego_missions;
CREATE POLICY "Users can read own missions" ON public.alter_ego_missions
  FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
DROP POLICY IF EXISTS "Users can create missions for others" ON public.alter_ego_missions;
CREATE POLICY "Users can create missions for others" ON public.alter_ego_missions
  FOR INSERT TO authenticated WITH CHECK (from_user_id = auth.uid());
DROP POLICY IF EXISTS "Recipients can update missions" ON public.alter_ego_missions;
CREATE POLICY "Recipients can update missions" ON public.alter_ego_missions
  FOR UPDATE TO authenticated USING (to_user_id = auth.uid());

-- ---------- hifz_progress ----------
CREATE TABLE IF NOT EXISTS public.hifz_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surah_number integer NOT NULL,
  surah_name text NOT NULL,
  start_verse integer NOT NULL DEFAULT 1,
  end_verse integer NOT NULL DEFAULT 1,
  total_verses integer NOT NULL DEFAULT 1,
  percentage numeric DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  last_reviewed timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.hifz_progress
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS surah_number integer,
  ADD COLUMN IF NOT EXISTS surah_name text,
  ADD COLUMN IF NOT EXISTS start_verse integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS end_verse integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_verses integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS percentage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hifz_progress' AND column_name = 'profile_id'
  ) THEN
    UPDATE public.hifz_progress
    SET user_id = profile_id
    WHERE user_id IS NULL AND profile_id IS NOT NULL;
  END IF;
END $$;

ALTER TABLE public.hifz_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own hifz" ON public.hifz_progress;
CREATE POLICY "Users can read own hifz" ON public.hifz_progress
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own hifz" ON public.hifz_progress;
CREATE POLICY "Users can insert own hifz" ON public.hifz_progress
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own hifz" ON public.hifz_progress;
CREATE POLICY "Users can update own hifz" ON public.hifz_progress
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete own hifz" ON public.hifz_progress;
CREATE POLICY "Users can delete own hifz" ON public.hifz_progress
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------- duo_messages ----------
CREATE TABLE IF NOT EXISTS public.duo_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.duo_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read messages" ON public.duo_messages;
CREATE POLICY "Authenticated users can read messages" ON public.duo_messages
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can send messages" ON public.duo_messages;
CREATE POLICY "Users can send messages" ON public.duo_messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- ---------- RPC add_xp/remove_xp ----------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT pg_catalog.oidvectortypes(p.proargtypes) AS args, p.proname
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('add_xp', 'remove_xp')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.proname, r.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.add_xp(
  p_user_id uuid,
  p_amount integer,
  p_source text
)
RETURNS TABLE (new_xp integer, new_level integer, leveled_up boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_xp integer;
  v_old_level integer;
  v_new_xp integer;
  v_new_level integer;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'add_xp: utilisateur non autorisé';
  END IF;

  SELECT COALESCE(total_xp, 0), COALESCE(level, 1)
  INTO v_old_xp, v_old_level
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'add_xp: profil introuvable';
  END IF;

  v_new_xp := v_old_xp + COALESCE(p_amount, 0);

  UPDATE public.profiles
  SET total_xp = v_new_xp
  WHERE id = p_user_id;

  SELECT COALESCE(total_xp, 0), COALESCE(level, 1)
  INTO v_new_xp, v_new_level
  FROM public.profiles
  WHERE id = p_user_id;

  INSERT INTO public.xp_history (user_id, amount, source)
  VALUES (p_user_id, COALESCE(p_amount, 0), COALESCE(p_source, 'add_xp'));

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_xp(
  p_user_id uuid,
  p_amount integer,
  p_source text
)
RETURNS TABLE (new_xp integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_xp integer;
  v_new_xp integer;
  v_delta integer;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'remove_xp: utilisateur non autorisé';
  END IF;

  v_delta := GREATEST(COALESCE(p_amount, 0), 0);

  SELECT COALESCE(total_xp, 0)
  INTO v_old_xp
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'remove_xp: profil introuvable';
  END IF;

  v_new_xp := GREATEST(0, v_old_xp - v_delta);

  UPDATE public.profiles
  SET total_xp = v_new_xp
  WHERE id = p_user_id;

  INSERT INTO public.xp_history (user_id, amount, source)
  VALUES (p_user_id, -v_delta, COALESCE(p_source, 'remove_xp'));

  RETURN QUERY SELECT v_new_xp;
END;
$$;

REVOKE ALL ON FUNCTION public.add_xp(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_xp(uuid, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_xp(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_xp(uuid, integer, text) TO authenticated;

-- Realtime tables (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activity_feed'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'alter_ego_missions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alter_ego_missions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'duo_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.duo_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hifz_progress'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hifz_progress;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'salat_tracking'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.salat_tracking;
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
