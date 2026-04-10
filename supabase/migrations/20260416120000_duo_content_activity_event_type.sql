-- Alignement schéma : duo_messages.content + activity_feed.event_type (logs console)

-- ── duo_messages.content ───────────────────────────────────────────────────
ALTER TABLE public.duo_messages ADD COLUMN IF NOT EXISTS content text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'duo_messages' AND column_name = 'message'
  ) THEN
    UPDATE public.duo_messages
    SET content = message
    WHERE (content IS NULL OR trim(content) = '') AND message IS NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'duo_messages' AND column_name = 'body'
  ) THEN
    UPDATE public.duo_messages
    SET content = body
    WHERE (content IS NULL OR trim(content) = '') AND body IS NOT NULL;
  END IF;
END $$;

UPDATE public.duo_messages SET content = coalesce(content, '') WHERE content IS NULL;
ALTER TABLE public.duo_messages ALTER COLUMN content SET DEFAULT '';

-- ── activity_feed.event_type ───────────────────────────────────────────────
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS event_type text;
UPDATE public.activity_feed SET event_type = 'action' WHERE event_type IS NULL;
ALTER TABLE public.activity_feed ALTER COLUMN event_type SET DEFAULT 'action';
ALTER TABLE public.activity_feed ALTER COLUMN event_type SET NOT NULL;

NOTIFY pgrst, 'reload schema';
