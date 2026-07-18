-- Applied to prod 2026-07-17. One-time backfill.
--
-- module_progress was written divergently by each module page for two years:
--   M1 wrote rows without status; M2 wrote a nonexistent `completed` column
--   (silently failed); M3 never wrote at all; M7 was rejected by the old
--   CHECK (module_number <= 6) constraint.
-- This backfills status='complete' from the asset tables (source of truth),
-- using the earliest asset created_at as completed_at.
-- Result: M1 120, M2 98, M3 78, M4 61, M5 43, M6 35, M7 25 complete rows —
-- verified equal to per-user asset counts.

WITH assets AS (
  SELECT user_id, 1 AS module_number, MIN(created_at) AS done_at FROM clarity_sentences WHERE user_id IS NOT NULL GROUP BY user_id
  UNION ALL SELECT user_id, 2, MIN(created_at) FROM ebooks WHERE status='complete' AND user_id IS NOT NULL GROUP BY user_id
  UNION ALL SELECT user_id, 3, MIN(created_at) FROM offers WHERE user_id IS NOT NULL GROUP BY user_id
  UNION ALL SELECT user_id, 4, MIN(created_at) FROM sales_pages WHERE user_id IS NOT NULL GROUP BY user_id
  UNION ALL SELECT user_id, 5, MIN(created_at) FROM email_sequences WHERE user_id IS NOT NULL GROUP BY user_id
  UNION ALL SELECT user_id, 6, MIN(created_at) FROM lead_magnets WHERE user_id IS NOT NULL GROUP BY user_id
  UNION ALL SELECT user_id, 7, MIN(created_at) FROM content_posts WHERE user_id IS NOT NULL GROUP BY user_id
),
valid AS (
  SELECT a.* FROM assets a JOIN profiles p ON p.id = a.user_id
)
INSERT INTO module_progress (user_id, module_number, status, completed_at, updated_at)
SELECT user_id, module_number, 'complete', done_at, now() FROM valid
ON CONFLICT (user_id, module_number)
DO UPDATE SET
  status = 'complete',
  completed_at = COALESCE(module_progress.completed_at, EXCLUDED.completed_at),
  updated_at = now()
WHERE module_progress.status IS DISTINCT FROM 'complete';
