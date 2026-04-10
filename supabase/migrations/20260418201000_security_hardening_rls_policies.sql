-- ============================================================================
-- Security hardening: RLS/policies for profiles, xp_history, sanctuary, duo
-- ============================================================================

-- 1) PROFILES: empêcher l'élévation de privilèges et la triche XP via UPDATE direct
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', p.policyname);
  END LOOP;
END $$;

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

-- 2) XP_HISTORY: bloquer les inserts directs client (doit passer par RPC serveur)
ALTER TABLE public.xp_history ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'xp_history'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.xp_history', p.policyname);
  END LOOP;
END $$;

-- Lecture autorisée seulement sur son historique personnel
DROP POLICY IF EXISTS xp_history_select_own ON public.xp_history;
CREATE POLICY xp_history_select_own
ON public.xp_history
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 3) SANCTUARY_SETTINGS: empêcher écriture globale par tous
ALTER TABLE public.sanctuary_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sanctuary_settings'
      AND cmd IN ('INSERT', 'UPDATE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sanctuary_settings', p.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS sanctuary_select_own ON public.sanctuary_settings;
CREATE POLICY sanctuary_select_own
ON public.sanctuary_settings
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY sanctuary_insert_own
ON public.sanctuary_settings
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND updated_by = auth.uid());

CREATE POLICY sanctuary_update_own
ON public.sanctuary_settings
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND updated_by = auth.uid());

-- 4) DUO_MESSAGES: lecture privée uniquement aux participants
ALTER TABLE public.duo_messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'duo_messages'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.duo_messages', p.policyname);
  END LOOP;
END $$;

CREATE POLICY duo_messages_select_participants
ON public.duo_messages
FOR SELECT TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- 5) JOURNAL_ENTRIES "shared": restreindre au partenaire au lieu de tous
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read shared entries" ON public.journal_entries;
DROP POLICY IF EXISTS journal_entries_shared_partner_only ON public.journal_entries;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'partner_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'journal_entries'
      AND column_name = 'visibility'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY journal_entries_shared_partner_only
      ON public.journal_entries
      FOR SELECT TO authenticated
      USING (
        visibility = 'shared'
        AND EXISTS (
          SELECT 1
          FROM public.profiles owner
          WHERE owner.id = journal_entries.user_id
            AND owner.partner_id = auth.uid()
        )
      )
    $policy$;
  END IF;
END $$;

-- 6) search_path mutable warnings (principales fonctions)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'duo_messages_body_content_sync'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.duo_messages_body_content_sync() SET search_path = public';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'add_xp'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.add_xp(uuid, integer, text) SET search_path = public';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'remove_xp'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.remove_xp(uuid, integer, text) SET search_path = public';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
