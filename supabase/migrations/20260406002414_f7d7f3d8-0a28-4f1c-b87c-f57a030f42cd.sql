
-- Create level calculation function
CREATE OR REPLACE FUNCTION public.calculate_level(xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(1, LEAST(150, floor(sqrt(xp::numeric / 50))::integer))
$$;

-- Create trigger to auto-update level when total_xp changes
CREATE OR REPLACE FUNCTION public.update_profile_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.total_xp IS DISTINCT FROM OLD.total_xp THEN
    NEW.level := public.calculate_level(COALESCE(NEW.total_xp, 0));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_level ON public.profiles;
CREATE TRIGGER trigger_update_level
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_level();

-- Update all existing profiles to correct level
UPDATE public.profiles SET level = public.calculate_level(COALESCE(total_xp, 0));

-- Allow salat_tracking to be read by all authenticated (for mirror/partner view)
DROP POLICY IF EXISTS "Users can read own salat" ON public.salat_tracking;
CREATE POLICY "Users can read all salat" ON public.salat_tracking FOR SELECT TO authenticated USING (true);

-- Add unique constraint on daily_progress if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_progress_user_date_unique') THEN
    ALTER TABLE public.daily_progress ADD CONSTRAINT daily_progress_user_date_unique UNIQUE (user_id, date);
  END IF;
END $$;
