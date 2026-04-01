
-- Custom quests per user
CREATE TABLE public.custom_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'vie',
  xp integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.custom_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own custom quests" ON public.custom_quests
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Alter Ego missions (cross-user)
CREATE TABLE public.alter_ego_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  xp integer NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'pending',
  proof_url text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.alter_ego_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own missions" ON public.alter_ego_missions
  FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Users can create missions for others" ON public.alter_ego_missions
  FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Recipients can update missions" ON public.alter_ego_missions
  FOR UPDATE TO authenticated
  USING (to_user_id = auth.uid());

-- Activity feed
CREATE TABLE public.activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  xp_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all activity" ON public.activity_feed
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own activity" ON public.activity_feed
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Enable realtime for activity feed and missions
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alter_ego_missions;
