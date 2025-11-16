-- ========================================
-- Fix RLS Policies for NULLABLE user_id
-- Migration: 003
-- Created: 2024-11-16
-- Description: แก้ไข RLS policies ให้รองรับ patients ที่ไม่มี user_id (NULL)
-- ========================================

-- Step 1: Drop old policy
DROP POLICY IF EXISTS patient_profiles_select_own ON patient_profiles;

-- Step 2: Create new policy that handles NULL user_id
-- Patients can see their own profile IF they have a user_id (LINE account)
-- This policy now handles NULL user_id gracefully
CREATE POLICY patient_profiles_select_own ON patient_profiles
  FOR SELECT USING (
    user_id IS NOT NULL
    AND user_id IN (SELECT id FROM users WHERE line_user_id = auth.uid()::TEXT)
  );

COMMENT ON POLICY patient_profiles_select_own ON patient_profiles IS 'Patients with LINE accounts can view their own profile';

-- Note: patient_profiles_select_by_caregiver policy already exists and handles
-- patients without LINE accounts (caregivers can view linked patients regardless of user_id)

-- Step 3: Add INSERT/UPDATE policies for patients without user_id
-- Allow service role to insert/update patient profiles without user_id
-- This is needed for quick-register flow

-- For INSERT: Allow creating patients without user_id (via service role)
CREATE POLICY patient_profiles_insert_service ON patient_profiles
  FOR INSERT WITH CHECK (
    -- Allow if user is creating their own profile (has user_id)
    (user_id IS NOT NULL AND user_id IN (SELECT id FROM users WHERE line_user_id = auth.uid()::TEXT))
    OR
    -- Allow service role to create patients without user_id
    (user_id IS NULL)
  );

COMMENT ON POLICY patient_profiles_insert_service ON patient_profiles IS 'Allow creating patient profiles with or without LINE accounts';

-- For UPDATE: Same logic as SELECT
CREATE POLICY patient_profiles_update_own ON patient_profiles
  FOR UPDATE USING (
    user_id IS NOT NULL
    AND user_id IN (SELECT id FROM users WHERE line_user_id = auth.uid()::TEXT)
  );

CREATE POLICY patient_profiles_update_by_caregiver ON patient_profiles
  FOR UPDATE USING (
    id IN (
      SELECT patient_id FROM patient_caregivers pc
      JOIN caregiver_profiles cp ON cp.id = pc.caregiver_id
      JOIN users u ON u.id = cp.user_id
      WHERE u.line_user_id = auth.uid()::TEXT
      AND pc.status = 'active'
    )
  );

COMMENT ON POLICY patient_profiles_update_own ON patient_profiles IS 'Patients can update their own profile';
COMMENT ON POLICY patient_profiles_update_by_caregiver ON patient_profiles IS 'Caregivers can update linked patient profiles';

-- Step 4: Verify the changes
DO $$
BEGIN
  RAISE NOTICE 'Migration 003 completed: RLS policies updated for NULLABLE user_id';
END $$;

-- ========================================
-- End of Migration
-- ========================================
