
-- XP History table for tracking all XP gains/losses
CREATE TABLE public.xp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.xp_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own xp history" ON public.xp_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own xp history" ON public.xp_history
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Add total_xp and level columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
