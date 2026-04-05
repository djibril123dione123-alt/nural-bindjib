
-- Add unique constraint on salat_tracking to prevent duplicate prayer entries per day
ALTER TABLE public.salat_tracking ADD CONSTRAINT salat_tracking_user_prayer_date_unique UNIQUE (user_id, prayer_name, date);

-- Add unique constraint on duo_streaks
ALTER TABLE public.duo_streaks ADD CONSTRAINT duo_streaks_user_prayer_date_unique UNIQUE (user_id, prayer_name, date);

-- Allow users to delete their own salat entries (for unchecking)
CREATE POLICY "Users can delete own salat" ON public.salat_tracking FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Allow users to delete their own xp_history (for XP reversal)
CREATE POLICY "Users can delete own xp history" ON public.xp_history FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Allow users to update their own xp_history
CREATE POLICY "Users can update own xp history" ON public.xp_history FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Allow users to delete their own activity feed entries
CREATE POLICY "Users can delete own activity" ON public.activity_feed FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Allow reading all xp_history (for partner mirror)
CREATE POLICY "Users can read all xp history" ON public.xp_history FOR SELECT TO authenticated USING (true);
-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can read own xp history" ON public.xp_history;

-- Allow deleting own daily_progress
CREATE POLICY "Users can delete own progress" ON public.daily_progress FOR DELETE TO authenticated USING (user_id = auth.uid());
