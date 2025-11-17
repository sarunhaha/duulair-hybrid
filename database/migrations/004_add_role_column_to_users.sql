-- ========================================
-- Add role column to users table
-- Migration: 004
-- Created: 2024-11-17
-- Description: เพิ่มคอลัมน์ role กลับเข้าไปใน users table เพื่อให้ตรงกับ code
-- ========================================

-- Step 1: Add role column as NULLABLE first (to handle existing data)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20);

COMMENT ON COLUMN users.role IS 'บทบาท: patient (ผู้ป่วย) หรือ caregiver (ผู้ดูแล)';

-- Step 2: Update existing users based on their profiles
-- Set role to 'patient' for users who have patient_profiles
UPDATE users u
SET role = 'patient'
WHERE EXISTS (
  SELECT 1 FROM patient_profiles pp
  WHERE pp.user_id = u.id
)
AND role IS NULL;

-- Set role to 'caregiver' for users who have caregiver_profiles
UPDATE users u
SET role = 'caregiver'
WHERE EXISTS (
  SELECT 1 FROM caregiver_profiles cp
  WHERE cp.user_id = u.id
)
AND role IS NULL;

-- Step 3: Handle users without profiles (orphaned users)
-- Option 1: Delete orphaned users (users without any profile)
DELETE FROM users
WHERE id NOT IN (SELECT user_id FROM patient_profiles WHERE user_id IS NOT NULL)
  AND id NOT IN (SELECT user_id FROM caregiver_profiles WHERE user_id IS NOT NULL);

-- Option 2: Or set default role for remaining NULL roles (if any exist after cleanup)
UPDATE users
SET role = 'patient'
WHERE role IS NULL;

-- Step 4: Make role NOT NULL (after all existing rows have been updated)
ALTER TABLE users
ALTER COLUMN role SET NOT NULL;

-- Step 5: Add CHECK constraint
ALTER TABLE users
ADD CONSTRAINT users_role_check CHECK (role IN ('patient', 'caregiver'));

-- Step 6: Create index on role column
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Step 7: Verify the change
DO $$
BEGIN
  RAISE NOTICE 'Migration 004 completed: role column added to users table';
  RAISE NOTICE 'Total users: %', (SELECT COUNT(*) FROM users);
  RAISE NOTICE 'Patients: %', (SELECT COUNT(*) FROM users WHERE role = 'patient');
  RAISE NOTICE 'Caregivers: %', (SELECT COUNT(*) FROM users WHERE role = 'caregiver');
END $$;

-- ========================================
-- End of Migration
-- ========================================
