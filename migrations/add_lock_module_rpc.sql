-- Add the missing lock_module_for_student RPC.
-- Mirrors the existing unlock_module_for_student function (which appends to
-- the unlocked_modules array). This one removes a module number from the
-- array so the coach UI's "Lock this module" button actually does something.
--
-- The bug: /api/coach/lock-modules calls supabase.rpc('lock_module_for_student'),
-- but the function was never created. The route swallowed the error and
-- returned success, so the UI silently did nothing on every lock attempt.
--
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.lock_module_for_student(
  p_student_id uuid,
  p_module_number int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET unlocked_modules = (
    SELECT COALESCE(array_agg(m ORDER BY m), ARRAY[]::int[])
    FROM unnest(COALESCE(unlocked_modules, ARRAY[]::int[])) AS m
    WHERE m <> p_module_number
  )
  WHERE id = p_student_id;
END;
$$;

COMMENT ON FUNCTION public.lock_module_for_student IS
  'Removes a module number from a student''s unlocked_modules array. Coach lock action.';
