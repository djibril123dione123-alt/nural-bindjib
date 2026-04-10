-- =============================================================================
-- Le Sanctuaire — alignement schéma / RLS / RPC (instance Supabase)
-- À exécuter dans le SQL Editor du dashboard (ou via supabase db push).
-- Idempotent autant que possible : relire les blocs OPTIONNELS avant exécution.
-- =============================================================================

-- ── 1) salat_tracking.completed_at (upsert depuis le front) ─────────────────
ALTER TABLE public.salat_tracking
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- ── 2) activity_feed : user_id → actor_id + politiques ─────────────────────
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

DROP POLICY IF EXISTS "Users can insert own activity" ON public.activity_feed;
CREATE POLICY "Users can insert own activity" ON public.activity_feed
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own activity" ON public.activity_feed;
CREATE POLICY "Users can delete own activity" ON public.activity_feed
  FOR DELETE TO authenticated
  USING (actor_id = auth.uid());

-- ── 3) profiles : RLS sur id = auth.uid() (schéma où id référence auth.users)
--    Si votre table a encore une colonne user_id séparée, migrer les données
--    AVANT de supprimer user_id (voir commentaire en fin de fichier).
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Trigger signup : une ligne profiles par utilisateur, PK = NEW.id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role, avatar_emoji)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'guide'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_emoji', '🌙')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 4) RPC add_xp / remove_xp — DROP puis CREATE (RETURNS TABLE) ────────────
DROP FUNCTION IF EXISTS public.add_xp(uuid, integer, text);
DROP FUNCTION IF EXISTS public.remove_xp(uuid, integer, text);

-- calculate_level : garder la même formule que le front (questData.ts)
CREATE OR REPLACE FUNCTION public.calculate_level(xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(1, LEAST(150, floor(sqrt(GREATEST(0, xp)::numeric / 50))::integer))
$$;

CREATE OR REPLACE FUNCTION public.add_xp(p_user_id uuid, p_amount integer, p_source text)
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

  v_new_xp := v_old_xp + p_amount;

  UPDATE public.profiles
  SET total_xp = v_new_xp
  WHERE id = p_user_id;

  SELECT COALESCE(total_xp, 0), COALESCE(level, 1)
  INTO v_new_xp, v_new_level
  FROM public.profiles
  WHERE id = p_user_id;

  INSERT INTO public.xp_history (user_id, amount, source)
  VALUES (p_user_id, p_amount, p_source);

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_xp(p_user_id uuid, p_amount integer, p_source text)
RETURNS TABLE (new_xp integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_xp integer;
  v_new_xp integer;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'remove_xp: utilisateur non autorisé';
  END IF;

  SELECT COALESCE(total_xp, 0)
  INTO v_old_xp
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'remove_xp: profil introuvable';
  END IF;

  v_new_xp := GREATEST(0, v_old_xp - p_amount);

  UPDATE public.profiles
  SET total_xp = v_new_xp
  WHERE id = p_user_id;

  INSERT INTO public.xp_history (user_id, amount, source)
  VALUES (p_user_id, -p_amount, p_source);

  RETURN QUERY SELECT v_new_xp;
END;
$$;

REVOKE ALL ON FUNCTION public.add_xp(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_xp(uuid, integer, text) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_xp(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_xp(uuid, integer, text) TO authenticated;

-- ── 5) user_tasks : contrainte UNIQUE attendue par le front (onConflict) ───
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_tasks'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_tasks_user_task_date_unique'
  ) THEN
    ALTER TABLE public.user_tasks
      ADD CONSTRAINT user_tasks_user_task_date_unique UNIQUE (user_id, task_id, date);
  END IF;
END $$;

-- =============================================================================
-- OPTIONNEL — Ancien schéma profiles (id aléatoire + user_id = auth.uid())
-- À valider manuellement après sauvegarde. Ne pas exécuter sur une DB déjà migrée.
--
-- UPDATE public.profiles SET id = user_id WHERE user_id IS NOT NULL;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS user_id;
-- =============================================================================
