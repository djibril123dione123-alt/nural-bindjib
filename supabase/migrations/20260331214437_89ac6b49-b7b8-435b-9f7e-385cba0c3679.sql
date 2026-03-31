
-- Tazkiyah challenges tracking (7-day streaks)
CREATE TABLE public.tazkiyah_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_type text NOT NULL, -- 'purete_sonore', 'digital_detox', 'parure_sakinah'
  day_number integer NOT NULL DEFAULT 1,
  completed boolean NOT NULL DEFAULT false,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, challenge_type, date)
);

ALTER TABLE public.tazkiyah_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own challenges" ON public.tazkiyah_challenges FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own challenges" ON public.tazkiyah_challenges FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own challenges" ON public.tazkiyah_challenges FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Salat prayer tracking
CREATE TABLE public.salat_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  prayer_name text NOT NULL, -- 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha'
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  on_time boolean DEFAULT false,
  custom_time text, -- user-adjustable prayer time
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date, prayer_name)
);

ALTER TABLE public.salat_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own salat" ON public.salat_tracking FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own salat" ON public.salat_tracking FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own salat" ON public.salat_tracking FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Personal todo list
CREATE TABLE public.user_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own todos" ON public.user_todos FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
