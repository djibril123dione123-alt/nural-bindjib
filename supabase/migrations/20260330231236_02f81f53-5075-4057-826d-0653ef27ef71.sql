
-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'Utilisateur',
  role text NOT NULL DEFAULT 'guide' CHECK (role IN ('guide', 'guardian')),
  avatar_emoji text DEFAULT '🌙',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Daily progress table
CREATE TABLE public.daily_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  completed_quests jsonb DEFAULT '{}',
  daily_xp integer DEFAULT 0,
  total_xp integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all progress" ON public.daily_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own progress" ON public.daily_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own progress" ON public.daily_progress FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Duo messages table
CREATE TABLE public.duo_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.duo_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read messages" ON public.duo_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can send messages" ON public.duo_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- Enable realtime for messages and progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.duo_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_progress;

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'guide')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
