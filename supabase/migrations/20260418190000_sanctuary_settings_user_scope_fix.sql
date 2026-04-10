-- ============================================================================
-- sanctuary_settings: scope par utilisateur + dedup pour persistance stable
-- ============================================================================

ALTER TABLE public.sanctuary_settings
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill best-effort pour les lignes historiques (globales).
UPDATE public.sanctuary_settings
SET user_id = updated_by
WHERE user_id IS NULL AND updated_by IS NOT NULL;

-- Dedup par (user_id, prayer_name) en gardant la ligne la plus récente.
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, prayer_name
      ORDER BY updated_at DESC NULLS LAST, ctid DESC
    ) AS rn
  FROM public.sanctuary_settings
  WHERE user_id IS NOT NULL
)
DELETE FROM public.sanctuary_settings s
USING ranked r
WHERE s.ctid = r.ctid AND r.rn > 1;

-- Retire l'index global qui forçait une seule ligne par prière pour tous.
DROP INDEX IF EXISTS public.sanctuary_settings_prayer_name_uidx;

-- Index d'unicité attendu par le front (UPSERT user_id,prayer_name).
CREATE UNIQUE INDEX IF NOT EXISTS sanctuary_settings_user_prayer_uidx
  ON public.sanctuary_settings (user_id, prayer_name)
  WHERE user_id IS NOT NULL;

-- Index utile pour lecture rapide des horaires d'un utilisateur.
CREATE INDEX IF NOT EXISTS sanctuary_settings_user_id_idx
  ON public.sanctuary_settings (user_id);

-- RLS plus stricte pour éviter collisions inter-utilisateurs.
ALTER TABLE public.sanctuary_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read settings" ON public.sanctuary_settings;
CREATE POLICY "Authenticated can read settings" ON public.sanctuary_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Authenticated can insert settings" ON public.sanctuary_settings;
CREATE POLICY "Authenticated can insert settings" ON public.sanctuary_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated can update settings" ON public.sanctuary_settings;
CREATE POLICY "Authenticated can update settings" ON public.sanctuary_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
