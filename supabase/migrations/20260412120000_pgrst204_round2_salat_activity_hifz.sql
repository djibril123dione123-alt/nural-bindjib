-- =============================================================================
-- PGRST204 round 2 : salat_tracking.on_time, activity_feed (actor_id + user_id),
-- hifz_progress (user_id, updated_at, tri), xp_earned négatif.
-- =============================================================================

-- ── salat_tracking : on_time (upsert SalatContent) ──────────────────────────
ALTER TABLE public.salat_tracking
  ADD COLUMN IF NOT EXISTS on_time boolean DEFAULT false;

-- ── activity_feed : les deux colonnes + trigger (front envoie souvent actor_id seul)
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.activity_feed
SET actor_id = user_id
WHERE actor_id IS NULL AND user_id IS NOT NULL;

UPDATE public.activity_feed
SET user_id = actor_id
WHERE user_id IS NULL AND actor_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.activity_feed_sync_actor_user()
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

DROP TRIGGER IF EXISTS trg_activity_feed_sync_actor_user ON public.activity_feed;
CREATE TRIGGER trg_activity_feed_sync_actor_user
  BEFORE INSERT OR UPDATE ON public.activity_feed
  FOR EACH ROW
  EXECUTE FUNCTION public.activity_feed_sync_actor_user();

ALTER TABLE public.activity_feed DROP CONSTRAINT IF EXISTS activity_feed_xp_earned_check;

DROP POLICY IF EXISTS "Users can insert own activity" ON public.activity_feed;
CREATE POLICY "Users can insert own activity" ON public.activity_feed
  FOR INSERT TO authenticated
  WITH CHECK (COALESCE(actor_id, user_id) = auth.uid());

DROP POLICY IF EXISTS "Users can delete own activity" ON public.activity_feed;
CREATE POLICY "Users can delete own activity" ON public.activity_feed
  FOR DELETE TO authenticated
  USING (COALESCE(actor_id, user_id) = auth.uid());

-- ── hifz_progress : colonnes pour GET (?user_id= & order=updated_at) + insert ─
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'hifz_progress'
  ) THEN
    ALTER TABLE public.hifz_progress
      ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS last_reviewed timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS percentage numeric DEFAULT 0;
  END IF;
END $$;

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

NOTIFY pgrst, 'reload schema';
