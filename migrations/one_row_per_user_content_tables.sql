-- ─── One row per user on the single-output module tables ─────────────────────
--
-- Problem this fixes (found 2026-09-23 via Careen Grace Bag-ao, TOPIS 79, who
-- could not open Module 4):
--
-- Modules 1, 3, 4, 5 and 6 each produce exactly ONE artifact per student, and
-- every reader assumes that -- app/module/4/page.tsx does
--
--     .from('offers').select('*').eq('user_id', user.id).maybeSingle()
--
-- maybeSingle() ERRORS when more than one row matches. The page treats the
-- error as "no offer", and bounces the student back to Module 3. From the
-- student's side Module 4 simply refuses to open, with no message.
--
-- But no unique constraint existed, so each save worked around it with a
-- non-atomic delete-then-insert (see the "avoids needing unique constraint"
-- comments the five save handlers used to carry). Two saves firing close
-- together interleave as delete, delete, insert, insert -- and leave two rows:
--
--     A: delete    B: delete    A: insert    B: insert   ->  2 rows
--
-- 18 students had hit this. Every duplicate pair was byte-identical and
-- created 71-400 ms apart, which is the signature of a double-fired save,
-- not of a student doing the work twice.
--
-- Duplicates broke more than the module pages: /progress, /my-work/detail and
-- lib/module8/context.ts all read these tables one-row-at-a-time too.
--
-- The fix is in two halves:
--   1. this migration  -- make a second row impossible
--   2. the five save handlers move to upsert(..., { onConflict: 'user_id' }),
--      which is atomic and needs the index below to exist
--
-- Existing duplicates were removed first (backups in exports/), so these
-- indexes build clean. content_posts and ebooks are deliberately NOT included:
-- both are legitimately many-per-user.

CREATE UNIQUE INDEX IF NOT EXISTS clarity_sentences_user_id_key ON clarity_sentences (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS offers_user_id_key            ON offers            (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_pages_user_id_key       ON sales_pages       (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS email_sequences_user_id_key   ON email_sequences   (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS lead_magnets_user_id_key      ON lead_magnets      (user_id);
