-- Ré-applique add_xp / remove_xp (signatures attendues par le front : p_user_id, p_amount, p_source)
-- et GRANT EXECUTE, pour corriger les 404 /rpc/add_xp et /rpc/remove_xp si la migration
-- 20260413120000 n’a pas été exécutée sur le projet distant.

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
