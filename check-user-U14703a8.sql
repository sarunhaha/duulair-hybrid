-- ============================================================
-- Check User: U14703a8226a014ef3aefe887ab4c5a00
-- ============================================================

-- 1. Check users table
SELECT
  'USERS TABLE' as table_name,
  u.id as user_id,
  u.line_user_id,
  u.role,
  u.display_name,
  u.created_at
FROM users u
WHERE u.line_user_id = 'U14703a8226a014ef3aefe887ab4c5a00';

-- 2. Check patient_profiles
SELECT
  'PATIENT_PROFILES TABLE' as table_name,
  pp.id as profile_id,
  pp.user_id,
  pp.first_name,
  pp.last_name,
  pp.created_at
FROM patient_profiles pp
JOIN users u ON u.id = pp.user_id
WHERE u.line_user_id = 'U14703a8226a014ef3aefe887ab4c5a00';

-- 3. Check caregiver_profiles
SELECT
  'CAREGIVER_PROFILES TABLE' as table_name,
  cp.id as profile_id,
  cp.user_id,
  cp.first_name,
  cp.last_name,
  cp.created_at
FROM caregiver_profiles cp
JOIN users u ON u.id = cp.user_id
WHERE u.line_user_id = 'U14703a8226a014ef3aefe887ab4c5a00';
