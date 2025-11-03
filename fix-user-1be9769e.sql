-- ============================================================
-- Fix User: 1be9769e-0160-4993-aebb-580c69a3578b
-- LINE ID: Uf65220907317686ebc96aaf94021b2e6
-- ============================================================

-- Step 1: Check current state
SELECT
  'CURRENT STATE' as step,
  u.id as user_id,
  u.line_user_id,
  u.role,
  u.display_name,
  u.created_at as user_created,
  pp.id as profile_id,
  pp.first_name,
  pp.last_name
FROM users u
LEFT JOIN patient_profiles pp ON pp.user_id = u.id
WHERE u.id = '1be9769e-0160-4993-aebb-580c69a3578b';

-- ============================================================
-- SOLUTION: ลบ user นี้แล้วให้ลงทะเบียนใหม่
-- ============================================================

-- Step 2: Delete the orphan user
-- (CASCADE จะลบ related records อัตโนมัติ)

DELETE FROM users
WHERE id = '1be9769e-0160-4993-aebb-580c69a3578b';

-- Step 3: Verify deletion
SELECT
  'AFTER DELETION' as step,
  COUNT(*) as remaining_count
FROM users
WHERE id = '1be9769e-0160-4993-aebb-580c69a3578b';
-- Should return 0

-- ============================================================
-- AFTER RUNNING THIS:
-- 1. User ต้องเปิด LIFF อีกครั้ง
-- 2. จะถูก redirect ไป role-selection
-- 3. ลงทะเบียนใหม่ทั้งหมด 4 steps
-- 4. จะได้ profile ครบถ้วน
-- ============================================================
