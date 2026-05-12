-- Module reviews — coach-side approval / revision-request workflow.
-- The /api/coach/review endpoint upserts into this table on every coach
-- submission. Without it, the upsert returns "relation does not exist" and
-- the coach sees a silent save failure.
--
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.module_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  module_number   integer NOT NULL CHECK (module_number BETWEEN 1 AND 7),
  status          text NOT NULL CHECK (status IN ('pending', 'approved', 'needs_revision')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, module_number)
);

COMMENT ON TABLE public.module_reviews IS
  'Coach reviews of student module submissions. One row per (student, module). Upserted by /api/coach/review on each coach action; read by dashboard + coach detail page.';

CREATE INDEX IF NOT EXISTS idx_module_reviews_student
  ON module_reviews (student_id);

CREATE INDEX IF NOT EXISTS idx_module_reviews_coach
  ON module_reviews (coach_id);

-- Row-Level Security: students can read their own reviews, coaches can
-- read+write reviews for any of their assigned students, admins can do
-- anything. The API endpoints use the admin client for writes so RLS is
-- mostly an extra guard for client-side reads.
ALTER TABLE module_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS module_reviews_select_self ON module_reviews;
CREATE POLICY module_reviews_select_self ON module_reviews
  FOR SELECT USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS module_reviews_insert_coach ON module_reviews;
CREATE POLICY module_reviews_insert_coach ON module_reviews
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS module_reviews_update_coach ON module_reviews;
CREATE POLICY module_reviews_update_coach ON module_reviews
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('coach', 'admin')
    )
  );
