
-- Sanctuary settings: shared prayer time grid
CREATE TABLE public.sanctuary_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_name text NOT NULL,
  custom_time text NOT NULL,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(prayer_name)
);

ALTER TABLE public.sanctuary_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings" ON public.sanctuary_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert settings" ON public.sanctuary_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update settings" ON public.sanctuary_settings FOR UPDATE TO authenticated USING (true);

-- Seed default prayer times (Dakar grid)
INSERT INTO public.sanctuary_settings (prayer_name, custom_time, updated_by) VALUES
  ('fajr', '05:47', '00000000-0000-0000-0000-000000000000'),
  ('suba', '06:02', '00000000-0000-0000-0000-000000000000'),
  ('dhuhr', '14:15', '00000000-0000-0000-0000-000000000000'),
  ('asr', '17:00', '00000000-0000-0000-0000-000000000000'),
  ('maghrib', '19:30', '00000000-0000-0000-0000-000000000000'),
  ('isha', '20:30', '00000000-0000-0000-0000-000000000000');

-- Enable realtime for sanctuary_settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.sanctuary_settings;

-- Duo streaks table
CREATE TABLE public.duo_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  user_id uuid NOT NULL,
  validated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(prayer_name, date, user_id)
);

ALTER TABLE public.duo_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can read streaks" ON public.duo_streaks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert streaks" ON public.duo_streaks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Enable realtime for presence and streaks
ALTER PUBLICATION supabase_realtime ADD TABLE public.duo_streaks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
