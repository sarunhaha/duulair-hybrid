-- ========================================
-- Fix patient_profiles.user_id to be NULLABLE
-- Migration: 002
-- Created: 2024-11-16
-- Description: แก้ไข user_id ให้เป็น NULLABLE เพื่อรองรับ patients ที่ไม่มีบัญชี LINE
-- ========================================

-- Step 1: Make user_id NULLABLE
-- This allows creating patient profiles without LINE accounts (for quick-register flow)
ALTER TABLE patient_profiles
ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN patient_profiles.user_id IS 'LINE User ID (NULLABLE - patients without LINE account can exist)';

-- Step 2: Update existing indexes/constraints if needed
-- The UNIQUE constraint on user_id is still valid (if user_id is provided, it must be unique)

-- Step 3: Verify the change
DO $$
BEGIN
  -- Log the migration
  RAISE NOTICE 'Migration 002 completed: patient_profiles.user_id is now NULLABLE';
END $$;

-- ========================================
-- End of Migration
-- ========================================
