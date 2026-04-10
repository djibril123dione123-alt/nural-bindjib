-- =============================================================================
-- Correctifs PGRST204 /400 — colonnes manquantes, hifz_progress.user_id,
-- user_tasks complète, RPC add_xp/remove_xp (arguments = front p_*),
-- rechargement cache PostgREST.
-- =============================================================================

-- ── salat_tracking : colonnes attendues par le front ────────────────────────
ALTER TABLE public.salat_tracking
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_time text,
  ADD COLUMN IF NOT EXISTS notes text;

-- ── activity_feed : actor_id (si encore user_id seulement) ───────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_feed' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_feed' AND column_name = 'actor_id'
  ) THEN
    ALTER TABLE public.activity_feed RENAME COLUMN user_id TO actor_id;
  END IF;
END $$;

-- ── user_tasks : colonnes + contrainte UNIQUE pour upsert PostgREST ────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_tasks'
  ) THEN
    ALTER TABLE public.user_tasks
      ADD COLUMN IF NOT EXISTS user_id uuid,
      ADD COLUMN IF NOT EXISTS task_id text,
      ADD COLUMN IF NOT EXISTS date date,
      ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS completed_at timestamptz,
      ADD COLUMN IF NOT EXISTS pillar text,
      ADD COLUMN IF NOT EXISTS xp_value integer;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'user_tasks_user_task_date_unique'
    ) THEN
      ALTER TABLE public.user_tasks
        ADD CONSTRAINT user_tasks_user_task_date_unique UNIQUE (user_id, task_id, date);
    END IF;
  END IF;
END $$;

-- ── hifz_progress : colonne filtre / insert (user_id) ───────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'hifz_progress'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'hifz_progress' AND column_name = 'profile_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'hifz_progress' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.hifz_progress RENAME COLUMN profile_id TO user_id;
    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'hifz_progress' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.hifz_progress
        ADD COLUMN user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ── RPC : signatures alignées sur le client (p_user_id, p_amount, p_source) ─
-- p_amount en numeric pour éviter les erreurs de typage JSON → int4.
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
  p_amount numeric,
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
  v_delta integer;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'add_xp: utilisateur non autorisé';
  END IF;

  v_delta := COALESCE(trunc(p_amount)::integer, 0);

  SELECT COALESCE(total_xp, 0), COALESCE(level, 1)
  INTO v_old_xp, v_old_level
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'add_xp: profil introuvable';
  END IF;

  v_new_xp := v_old_xp + v_delta;

  UPDATE public.profiles
  SET total_xp = v_new_xp
  WHERE id = p_user_id;

  SELECT COALESCE(total_xp, 0), COALESCE(level, 1)
  INTO v_new_xp, v_new_level
  FROM public.profiles
  WHERE id = p_user_id;

  INSERT INTO public.xp_history (user_id, amount, source)
  VALUES (p_user_id, v_delta, COALESCE(p_source, 'add_xp'));

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_xp(
  p_user_id uuid,
  p_amount numeric,
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

  v_delta := GREATEST(COALESCE(trunc(p_amount)::integer, 0), 0);

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

REVOKE ALL ON FUNCTION public.add_xp(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_xp(uuid, numeric, text) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_xp(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_xp(uuid, numeric, text) TO authenticated;

-- Rechargement du cache schéma PostgREST (corrige PGRST204 après ALTER)
NOTIFY pgrst, 'reload schema';
