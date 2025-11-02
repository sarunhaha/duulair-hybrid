-- ============================================================
-- Fix Orphan Users Script
-- แก้ปัญหา users ที่ไม่มี patient_profiles หรือ caregiver_profiles
-- ============================================================

-- 1. เช็คว่ามี orphan users หรือไม่
SELECT
  u.id,
  u.line_user_id,
  u.role,
  u.created_at,
  CASE
    WHEN u.role = 'patient' THEN (SELECT COUNT(*) FROM patient_profiles WHERE user_id = u.id)
    WHEN u.role = 'caregiver' THEN (SELECT COUNT(*) FROM caregiver_profiles WHERE user_id = u.id)
  END as profile_count
FROM users u
WHERE
  (u.role = 'patient' AND NOT EXISTS (SELECT 1 FROM patient_profiles WHERE user_id = u.id))
  OR
  (u.role = 'caregiver' AND NOT EXISTS (SELECT 1 FROM caregiver_profiles WHERE user_id = u.id));

-- ============================================================
-- Option A: ลบ orphan users (ถ้าเป็น test data)
-- ============================================================
-- UNCOMMENT เพื่อลบ orphan users

-- DELETE FROM users
-- WHERE
--   (role = 'patient' AND NOT EXISTS (SELECT 1 FROM patient_profiles WHERE user_id = users.id))
--   OR
--   (role = 'caregiver' AND NOT EXISTS (SELECT 1 FROM caregiver_profiles WHERE user_id = users.id));

-- ============================================================
-- Option B: สร้าง dummy profiles สำหรับ orphan users
-- ============================================================
-- UNCOMMENT เพื่อสร้าง dummy profiles

-- For patients
-- INSERT INTO patient_profiles (
--   user_id,
--   first_name,
--   last_name,
--   birth_date,
--   gender,
--   emergency_contact_name,
--   emergency_contact_phone,
--   emergency_contact_relation
-- )
-- SELECT
--   u.id,
--   'INCOMPLETE' as first_name,
--   'DATA' as last_name,
--   '1950-01-01'::date as birth_date,
--   'other' as gender,
--   'N/A' as emergency_contact_name,
--   '0000000000' as emergency_contact_phone,
--   'other' as emergency_contact_relation
-- FROM users u
-- WHERE u.role = 'patient'
--   AND NOT EXISTS (SELECT 1 FROM patient_profiles WHERE user_id = u.id);

-- For caregivers
-- INSERT INTO caregiver_profiles (
--   user_id,
--   first_name,
--   last_name
-- )
-- SELECT
--   u.id,
--   'INCOMPLETE' as first_name,
--   'DATA' as last_name
-- FROM users u
-- WHERE u.role = 'caregiver'
--   AND NOT EXISTS (SELECT 1 FROM caregiver_profiles WHERE user_id = u.id);

-- ============================================================
-- Verify Fix
-- ============================================================
-- Run this after fixing to verify all users have profiles

SELECT
  'Total users' as check_type,
  COUNT(*) as count
FROM users
UNION ALL
SELECT
  'Users with profiles' as check_type,
  COUNT(*) as count
FROM users u
WHERE
  (u.role = 'patient' AND EXISTS (SELECT 1 FROM patient_profiles WHERE user_id = u.id))
  OR
  (u.role = 'caregiver' AND EXISTS (SELECT 1 FROM caregiver_profiles WHERE user_id = u.id))
UNION ALL
SELECT
  'Orphan users (NO PROFILE)' as check_type,
  COUNT(*) as count
FROM users u
WHERE
  (u.role = 'patient' AND NOT EXISTS (SELECT 1 FROM patient_profiles WHERE user_id = u.id))
  OR
  (u.role = 'caregiver' AND NOT EXISTS (SELECT 1 FROM caregiver_profiles WHERE user_id = u.id));
