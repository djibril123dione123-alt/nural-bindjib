-- =============================================================================
-- Premium consolidation
-- 1) Reset RLS policies (profiles, journal_entries, sanctuary_settings,
--    duo_messages, activity_feed)
-- 2) Performance indexes
-- 3) Atomic RPC: complete_task_with_xp
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers: drop all policies on a table
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._drop_all_policies(p_schema text, p_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = p_schema AND tablename = p_table
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p_schema, p_table);
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- RLS reset
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanctuary_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duo_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

SELECT public._drop_all_policies('public', 'profiles');
SELECT public._drop_all_policies('public', 'journal_entries');
SELECT public._drop_all_policies('public', 'sanctuary_settings');
SELECT public._drop_all_policies('public', 'duo_messages');
SELECT public._drop_all_policies('public', 'activity_feed');

-- profiles: read self, update self (without elevation)
CREATE POLICY profiles_select_self
ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY profiles_update_self_safe
ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND COALESCE(total_xp, 0) = (SELECT COALESCE(p.total_xp, 0) FROM public.profiles p WHERE p.id = auth.uid())
  AND COALESCE(level, 1) = (SELECT COALESCE(p.level, 1) FROM public.profiles p WHERE p.id = auth.uid())
);

-- journal_entries: private by default
CREATE POLICY journal_entries_select_own
ON public.journal_entries
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY journal_entries_insert_own
ON public.journal_entries
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY journal_entries_update_own
ON public.journal_entries
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY journal_entries_delete_own
ON public.journal_entries
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- sanctuary_settings: scoped per user row
CREATE POLICY sanctuary_settings_select_own
ON public.sanctuary_settings
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY sanctuary_settings_insert_own
ON public.sanctuary_settings
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND updated_by = auth.uid());

CREATE POLICY sanctuary_settings_update_own
ON public.sanctuary_settings
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND updated_by = auth.uid());

-- duo_messages: only participants can read/write
CREATE POLICY duo_messages_select_participants
ON public.duo_messages
FOR SELECT TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY duo_messages_insert_sender
ON public.duo_messages
FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid());

-- activity_feed: read/write own activity
CREATE POLICY activity_feed_select_own
ON public.activity_feed
FOR SELECT TO authenticated
USING (actor_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY activity_feed_insert_own
ON public.activity_feed
FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Performance indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_created_at
  ON public.journal_entries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_duo_messages_sender_receiver
  ON public.duo_messages (sender_id, receiver_id);

CREATE INDEX IF NOT EXISTS idx_activity_feed_actor_id
  ON public.activity_feed (actor_id);

-- -----------------------------------------------------------------------------
-- Atomic RPC: complete_task_with_xp
-- p_completed=true  => coche + ajoute XP + activity "valide"
-- p_completed=false => decoche + retire XP + supprime activity "valide" correspondante
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_task_with_xp(
  p_task_id text,
  p_pillar text,
  p_xp_value integer,
  p_date date,
  p_completed boolean
)
RETURNS TABLE (new_xp integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prev_done boolean := false;
  v_old_xp integer := 0;
  v_new_xp integer := 0;
  v_delta integer := GREATEST(COALESCE(p_xp_value, 0), 0);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifie';
  END IF;

  SELECT completed
  INTO v_prev_done
  FROM public.user_tasks
  WHERE user_id = v_user_id
    AND task_id = p_task_id
    AND date = p_date
  LIMIT 1;

  INSERT INTO public.user_tasks (user_id, task_id, date, completed, xp_value, pillar, completed_at)
  VALUES (
    v_user_id,
    p_task_id,
    p_date,
    p_completed,
    COALESCE(p_xp_value, 0),
    p_pillar,
    CASE WHEN p_completed THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id, task_id, date)
  DO UPDATE
    SET completed = p_completed,
        xp_value = COALESCE(p_xp_value, 0),
        pillar = p_pillar,
        completed_at = CASE WHEN p_completed THEN now() ELSE NULL END;

  SELECT COALESCE(total_xp, 0)
  INTO v_old_xp
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF p_completed = true AND COALESCE(v_prev_done, false) = false THEN
    v_new_xp := v_old_xp + v_delta;

    UPDATE public.profiles
    SET total_xp = v_new_xp
    WHERE id = v_user_id;

    INSERT INTO public.activity_feed (actor_id, user_id, event_type, event_label, action, xp_earned)
    VALUES (
      v_user_id,
      v_user_id,
      'task',
      'Tache',
      format('validé [%s] (%s) +%s XP', COALESCE(p_pillar, 'general'), p_task_id, v_delta),
      v_delta
    );
  ELSIF p_completed = false AND COALESCE(v_prev_done, false) = true THEN
    v_new_xp := GREATEST(0, v_old_xp - v_delta);

    UPDATE public.profiles
    SET total_xp = v_new_xp
    WHERE id = v_user_id;

    DELETE FROM public.activity_feed
    WHERE actor_id = v_user_id
      AND event_type = 'task'
      AND (
        action ILIKE format('%%(%s)%%', p_task_id)
        OR action ILIKE format('%%[%s]%%', p_pillar)
      );
  ELSE
    v_new_xp := v_old_xp;
  END IF;

  RETURN QUERY SELECT v_new_xp;
END;
$$;

-- Wrapper rétro-compatible (4 params) => completed=true
CREATE OR REPLACE FUNCTION public.complete_task_with_xp(
  p_task_id text,
  p_pillar text,
  p_xp_value integer,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (new_xp integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.complete_task_with_xp(p_task_id, p_pillar, p_xp_value, p_date, true);
$$;

REVOKE ALL ON FUNCTION public.complete_task_with_xp(text, text, integer, date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_task_with_xp(text, text, integer, date, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.complete_task_with_xp(text, text, integer, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_task_with_xp(text, text, integer, date) TO authenticated;

DROP FUNCTION IF EXISTS public._drop_all_policies(text, text);

NOTIFY pgrst, 'reload schema';
