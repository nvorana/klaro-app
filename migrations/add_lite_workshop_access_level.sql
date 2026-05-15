-- Allow 'lite_workshop' as a valid access_level for the AutoMagically
-- workshop free tier. The existing CHECK constraint on profiles.access_level
-- didn't include this value, causing /free signups to fail with
-- "violates check constraint profiles_access_level_check".
--
-- Run in Supabase SQL Editor BEFORE the workshop.

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_access_level_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_access_level_check
CHECK (access_level IN (
  'pending',
  'enrolled',
  'full_access',
  'tier1',
  'tier2',
  'tier3',
  'tier4',
  'lite_workshop'
));

COMMENT ON CONSTRAINT profiles_access_level_check ON profiles IS
  'Allowed access_level values. lite_workshop is the AutoMagically workshop free tier (Module 1 fully accessible, Module 2 outline preview only). enrolled = TOPIS or partial-pay AP. full_access = fully paid. tier1/2/3/4 = legacy KLARO-tier funnel.';
