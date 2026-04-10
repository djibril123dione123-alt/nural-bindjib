-- =============================================================================
-- Synchronisation « radicale » : colonnes manquantes, défauts NOT NULL, RPC XP
-- À exécuter une fois sur le projet Supabase distant (SQL Editor ou migration).
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

-- ── duo_messages : content + receiver_id ───────────────────────────────────
ALTER TABLE public.duo_messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.duo_messages ADD COLUMN IF NOT EXISTS receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.duo_messages SET content = '' WHERE content IS NULL;
-- Pas de backfill générique pour receiver_id : le client envoie l’UUID du partenaire (autre profil).

ALTER TABLE public.duo_messages ALTER COLUMN content SET DEFAULT '';

DROP POLICY IF EXISTS "Users can send messages" ON public.duo_messages;
CREATE POLICY "Users can send messages" ON public.duo_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- ── hifz_progress.ayah_start / ayah_end (alias des versets) ─────────────────
ALTER TABLE public.hifz_progress ADD COLUMN IF NOT EXISTS ayah_start integer;
ALTER TABLE public.hifz_progress ADD COLUMN IF NOT EXISTS ayah_end integer;

UPDATE public.hifz_progress SET ayah_start = start_verse WHERE ayah_start IS NULL;
UPDATE public.hifz_progress SET ayah_end = COALESCE(end_verse, start_verse) WHERE ayah_end IS NULL;
UPDATE public.hifz_progress SET ayah_start = 1 WHERE ayah_start IS NULL;
UPDATE public.hifz_progress SET ayah_end = GREATEST(1, ayah_start) WHERE ayah_end IS NULL;

ALTER TABLE public.hifz_progress ALTER COLUMN ayah_start SET DEFAULT 1;
ALTER TABLE public.hifz_progress ALTER COLUMN ayah_end SET DEFAULT 1;

-- ── journal_entries.title ───────────────────────────────────────────────────
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS title text;
UPDATE public.journal_entries
SET title = left(coalesce(content, ''), 120)
WHERE title IS NULL OR trim(title) = '';
ALTER TABLE public.journal_entries ALTER COLUMN title SET DEFAULT '';

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
