-- TOPIS is group-paced: 8 weeks of coaching, the class advances together.
-- Until now the weekly drip ran from each student's own enrolled_at, so a
-- cohort with a 13-day enrollment spread had 9 different unlock schedules.
--
-- cohort_start_date is the anchor the drip SHOULD use for TOPIS. drip_anchor
-- is generated so callers read one column and cannot forget the COALESCE:
-- cohort students pace off class start, everyone else (AP, tier/legacy, older
-- batches with no cohort date) keeps pacing off enrolled_at exactly as before.
--
-- AP is deliberately unaffected: its modules are opened by the coach via
-- unlocked_modules, per student, on that student's own timeline.
--
-- Note: the cast is written as `::timestamp AT TIME ZONE 'UTC'` rather than
-- `::timestamptz` because the latter depends on the session TimeZone and
-- Postgres therefore rejects it as non-immutable in a generated column.
--
-- Applied to production 2026-08-29.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cohort_start_date DATE;

ALTER TABLE profiles DROP COLUMN IF EXISTS drip_anchor;
ALTER TABLE profiles ADD COLUMN drip_anchor TIMESTAMPTZ
  GENERATED ALWAYS AS (
    COALESCE(cohort_start_date::timestamp AT TIME ZONE 'UTC', enrolled_at)
  ) STORED;

COMMENT ON COLUMN profiles.cohort_start_date IS
  'First day of class for this student cohort. Set per batch. NULL = pace from enrolled_at (AP, legacy, tier students).';
COMMENT ON COLUMN profiles.drip_anchor IS
  'Generated. Date the weekly module drip counts from: cohort_start_date when set, else enrolled_at. Read this, never enrolled_at, for unlock math.';

CREATE INDEX IF NOT EXISTS idx_profiles_cohort ON profiles(program_type, cohort_batch) WHERE cohort_batch IS NOT NULL;
