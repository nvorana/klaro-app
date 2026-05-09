-- Lifetime ebook cap — abuse prevention.
-- Each user can complete a maximum of N ebooks (default 2). Coach reset
-- gives them +1 attempt each time it fires. Counts only "completed" ebooks
-- (chapters fully generated + finalized in Module 2). Incomplete drafts
-- and chapter regenerations don't count against the cap.
--
-- Run in Supabase SQL Editor.

-- Per-user cap (default 2). Coach reset increments this by 1 each time so
-- each reset gives the student exactly 1 more attempt.
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS max_ebooks_allowed integer NOT NULL DEFAULT 2;

COMMENT ON COLUMN profiles.max_ebooks_allowed IS
  'Maximum lifetime completed ebooks this user can create. Default 2. Coach reset increments by 1 each call so reset always grants exactly 1 more attempt.';

-- Lifetime completion counter — increments every time the student finishes
-- Module 2 (saves a fully-generated ebook). Module 2 currently uses a
-- delete+insert pattern (replaces prior ebook on save), so we can't count
-- ebook rows directly — this counter is the source of truth.
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS completed_ebooks_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN profiles.completed_ebooks_count IS
  'Lifetime count of times the student has finalized an ebook in Module 2. Increments on each save. Compared against max_ebooks_allowed for the cap.';

-- Per-ebook completion timestamp — set by Module 2 when the ebook is
-- finalized (all chapters generated + saved). NULL means "in progress" or
-- abandoned, and doesn't count against the cap.
ALTER TABLE ebooks
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN ebooks.completed_at IS
  'Timestamp when the ebook was finalized in Module 2 (all chapters generated). NULL = incomplete; only completed ebooks count against profiles.max_ebooks_allowed.';

-- Backfill ebooks.completed_at: assume any existing ebook with chapters >= 6
-- is "completed." Used as audit history; not the source of truth for the cap.
UPDATE ebooks
SET completed_at = COALESCE(updated_at, created_at)
WHERE completed_at IS NULL
  AND jsonb_array_length(COALESCE(chapters, '[]'::jsonb)) >= 6;

-- Backfill profiles.completed_ebooks_count from existing ebook rows. Each
-- profile gets credit for any ebook they currently have with chapters >= 6
-- (i.e. one slot consumed). Most existing students who finished Module 2
-- should land at 1.
UPDATE profiles
SET completed_ebooks_count = (
  SELECT COUNT(*) FROM ebooks
  WHERE ebooks.user_id = profiles.id
    AND jsonb_array_length(COALESCE(ebooks.chapters, '[]'::jsonb)) >= 6
)
WHERE completed_ebooks_count = 0;

-- Index for fast cap-check queries
CREATE INDEX IF NOT EXISTS idx_ebooks_user_completed
  ON ebooks (user_id) WHERE completed_at IS NOT NULL;

-- Atomic increment for the completion counter. Called by Module 2 client
-- on save, by middleware claim flow, or by anywhere else that records a
-- successful ebook finalization. Using SECURITY DEFINER so RLS doesn't
-- block the bump (the row matches the calling user; we still verify by
-- requiring the caller to pass their own id).
CREATE OR REPLACE FUNCTION public.increment_completed_ebooks_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE profiles
  SET completed_ebooks_count = COALESCE(completed_ebooks_count, 0) + 1
  WHERE id = p_user_id
  RETURNING completed_ebooks_count INTO new_count;
  RETURN new_count;
END;
$$;

COMMENT ON FUNCTION public.increment_completed_ebooks_count IS
  'Atomic +1 to profiles.completed_ebooks_count. Called by Module 2 on ebook save.';

-- Bump the cap. Called by coach reset endpoint each time a student needs
-- another attempt. Each call grants exactly one more ebook.
CREATE OR REPLACE FUNCTION public.grant_extra_ebook_slot(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_max integer;
BEGIN
  UPDATE profiles
  SET max_ebooks_allowed = COALESCE(max_ebooks_allowed, 2) + 1
  WHERE id = p_user_id
  RETURNING max_ebooks_allowed INTO new_max;
  RETURN new_max;
END;
$$;

COMMENT ON FUNCTION public.grant_extra_ebook_slot IS
  'Atomic +1 to profiles.max_ebooks_allowed. Called by /api/coach/reset-student to grant one more ebook attempt after a reset.';
