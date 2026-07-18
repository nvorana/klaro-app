-- Applied to prod 2026-07-17.
-- Per-call OpenAI usage log. Written server-side via the admin client
-- (lib/aiUsage.ts); RLS enabled with no policies = service-role only.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  route text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx ON public.ai_usage (user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON public.ai_usage (created_at);
