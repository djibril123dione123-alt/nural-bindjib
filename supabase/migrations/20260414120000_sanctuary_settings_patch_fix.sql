-- =============================================================================
-- Fix PATCH 400 on sanctuary_settings
-- Ensures columns and upsert conflict target exist.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sanctuary_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_name text NOT NULL,
  custom_time text NOT NULL,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prayer_name)
);

ALTER TABLE public.sanctuary_settings
  ADD COLUMN IF NOT EXISTS prayer_name text,
  ADD COLUMN IF NOT EXISTS custom_time text,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Compatibility: if an older column exists, copy into custom_time
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sanctuary_settings' AND column_name='scheduled_time'
  ) THEN
    UPDATE public.sanctuary_settings
    SET custom_time = scheduled_time
    WHERE (custom_time IS NULL OR custom_time = '') AND scheduled_time IS NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sanctuary_settings' AND column_name='time'
  ) THEN
    UPDATE public.sanctuary_settings
    SET custom_time = time
    WHERE (custom_time IS NULL OR custom_time = '') AND time IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sanctuary_settings_prayer_name_unique'
  ) THEN
    ALTER TABLE public.sanctuary_settings
      ADD CONSTRAINT sanctuary_settings_prayer_name_unique UNIQUE (prayer_name);
  END IF;
END $$;

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

NOTIFY pgrst, 'reload schema';
