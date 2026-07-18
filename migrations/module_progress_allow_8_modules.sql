-- Applied to prod 2026-07-17.
-- The app grew from 6 to 8 modules but the CHECK constraint was never
-- updated, so module 7/8 progress writes were silently rejected.
ALTER TABLE public.module_progress
  DROP CONSTRAINT module_progress_module_number_check;
ALTER TABLE public.module_progress
  ADD CONSTRAINT module_progress_module_number_check
  CHECK (module_number >= 1 AND module_number <= 8);
