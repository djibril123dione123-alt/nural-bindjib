-- =============================================================================
-- Suture finale — schéma public aligné avec le front (à exécuter sur Supabase)
--
-- Résout en une fois (idempotent, IF NOT EXISTS / DROP IF EXISTS) :
--   • tazkiyah_challenges (404)
--   • duo_messages : body + content synchronisés (400 body null)
--   • journal_entries.title (optionnel si vous réintroduisez title côté app)
--   • activity_feed.event_label, hifz ayah_*, sanctuary_settings, add_xp / remove_xp
--
-- Après exécution : SQL Editor → Run, puis Dashboard → API → Reload schema (ou NOTIFY ci-dessous).
-- =============================================================================

-- ── activity_feed.event_label ────────────────────────────────────────────────
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS event_label text;
UPDATE public.activity_feed SET event_label = 'Activité' WHERE event_label IS NULL OR trim(event_label) = '';
ALTER TABLE public.activity_feed ALTER COLUMN event_label SET DEFAULT 'Activité';
DO $$
BEGIN
  ALTER TABLE public.activity_feed ALTER COLUMN event_label SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- ── tazkiyah_challenges (table absente sur certains projets) ────────────────
CREATE TABLE IF NOT EXISTS public.tazkiyah_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_type text NOT NULL,
  day_number integer NOT NULL DEFAULT 1,
  completed boolean NOT NULL DEFAULT false,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, challenge_type, date)
);

ALTER TABLE public.tazkiyah_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own challenges" ON public.tazkiyah_challenges;
CREATE POLICY "Users can read own challenges" ON public.tazkiyah_challenges
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own challenges" ON public.tazkiyah_challenges;
CREATE POLICY "Users can insert own challenges" ON public.tazkiyah_challenges
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own challenges" ON public.tazkiyah_challenges;
CREATE POLICY "Users can update own challenges" ON public.tazkiyah_challenges
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tazkiyah_challenges TO authenticated;

-- ── duo_messages : content + receiver_id + sync body ↔ content ──────────────
ALTER TABLE public.duo_messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.duo_messages ADD COLUMN IF NOT EXISTS receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.duo_messages SET content = body WHERE content IS NULL;
UPDATE public.duo_messages SET body = COALESCE(NULLIF(trim(body), ''), content) WHERE body IS NULL OR trim(body) = '';

CREATE OR REPLACE FUNCTION public.duo_messages_body_content_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.body IS NULL OR trim(COALESCE(NEW.body, '')) = '' THEN
    NEW.body := COALESCE(NULLIF(trim(NEW.content), ''), '');
  END IF;
  IF NEW.content IS NULL OR trim(COALESCE(NEW.content, '')) = '' THEN
    NEW.content := COALESCE(NULLIF(trim(NEW.body), ''), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_duo_messages_body_content ON public.duo_messages;
CREATE TRIGGER trg_duo_messages_body_content
  BEFORE INSERT OR UPDATE ON public.duo_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.duo_messages_body_content_sync();

ALTER TABLE public.duo_messages ALTER COLUMN content SET DEFAULT '';

DROP POLICY IF EXISTS "Users can send messages" ON public.duo_messages;
CREATE POLICY "Users can send messages" ON public.duo_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- ── hifz_progress.ayah_start / ayah_end ─────────────────────────────────────
ALTER TABLE public.hifz_progress ADD COLUMN IF NOT EXISTS ayah_start integer;
ALTER TABLE public.hifz_progress ADD COLUMN IF NOT EXISTS ayah_end integer;
UPDATE public.hifz_progress SET ayah_start = start_verse WHERE ayah_start IS NULL;
UPDATE public.hifz_progress SET ayah_end = COALESCE(end_verse, start_verse) WHERE ayah_end IS NULL;
UPDATE public.hifz_progress SET ayah_start = 1 WHERE ayah_start IS NULL;
UPDATE public.hifz_progress SET ayah_end = GREATEST(1, ayah_start) WHERE ayah_end IS NULL;
ALTER TABLE public.hifz_progress ALTER COLUMN ayah_start SET DEFAULT 1;
ALTER TABLE public.hifz_progress ALTER COLUMN ayah_end SET DEFAULT 1;

-- ── journal_entries.title (le front n’envoie plus title pour compat ancienne BDD) ──
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS title text;
UPDATE public.journal_entries
SET title = left(coalesce(content, ''), 120)
WHERE title IS NULL OR trim(coalesce(title, '')) = '';
ALTER TABLE public.journal_entries ALTER COLUMN title SET DEFAULT '';

-- ── sanctuary_settings (POST 400 si colonnes / contraintes manquantes) ───────
CREATE TABLE IF NOT EXISTS public.sanctuary_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_name text NOT NULL,
  custom_time text NOT NULL,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sanctuary_settings
  ADD COLUMN IF NOT EXISTS prayer_name text,
  ADD COLUMN IF NOT EXISTS custom_time text,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sanctuary_settings' AND column_name = 'scheduled_time'
  ) THEN
    UPDATE public.sanctuary_settings
    SET custom_time = scheduled_time
    WHERE (custom_time IS NULL OR custom_time = '') AND scheduled_time IS NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sanctuary_settings' AND column_name = 'time'
  ) THEN
    UPDATE public.sanctuary_settings
    SET custom_time = time
    WHERE (custom_time IS NULL OR custom_time = '') AND time IS NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sanctuary_settings_prayer_name_uidx
  ON public.sanctuary_settings (prayer_name);

ALTER TABLE public.sanctuary_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read settings" ON public.sanctuary_settings;
CREATE POLICY "Authenticated can read settings" ON public.sanctuary_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert settings" ON public.sanctuary_settings;
CREATE POLICY "Authenticated can insert settings" ON public.sanctuary_settings
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update settings" ON public.sanctuary_settings;
CREATE POLICY "Authenticated can update settings" ON public.sanctuary_settings
  FOR UPDATE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sanctuary_settings TO authenticated;

-- ── RPC add_xp / remove_xp (404 si absentes) ─────────────────────────────────
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

NOTIFY pgrst, 'reload schema';
