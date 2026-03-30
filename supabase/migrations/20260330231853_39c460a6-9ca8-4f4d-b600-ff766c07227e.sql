
-- Hifz progress table
CREATE TABLE public.hifz_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  surah_number integer NOT NULL CHECK (surah_number >= 1 AND surah_number <= 114),
  surah_name text NOT NULL,
  start_verse integer NOT NULL DEFAULT 1,
  end_verse integer NOT NULL DEFAULT 1,
  total_verses integer NOT NULL DEFAULT 1,
  percentage numeric(5,2) DEFAULT 0,
  last_reviewed timestamptz DEFAULT now(),
  review_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.hifz_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own hifz" ON public.hifz_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own hifz" ON public.hifz_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own hifz" ON public.hifz_progress FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own hifz" ON public.hifz_progress FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Journal entries table
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL DEFAULT '',
  mood_score integer DEFAULT 3 CHECK (mood_score >= 1 AND mood_score <= 5),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared')),
  prompt_used text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entries" ON public.journal_entries FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can read shared entries" ON public.journal_entries FOR SELECT TO authenticated USING (visibility = 'shared');
CREATE POLICY "Users can insert own entries" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own entries" ON public.journal_entries FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own entries" ON public.journal_entries FOR DELETE TO authenticated USING (user_id = auth.uid());
