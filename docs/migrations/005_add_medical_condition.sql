-- =====================================================
-- OONJ.AI Schema - Add medical_condition column
-- Version: 005
-- Date: 2025-12-20
-- Description: เพิ่ม column medical_condition สำหรับโรคประจำตัว
-- =====================================================

-- Add medical_condition column to patient_profiles
ALTER TABLE public.patient_profiles
ADD COLUMN IF NOT EXISTS medical_condition TEXT;

-- Add comment
COMMENT ON COLUMN public.patient_profiles.medical_condition IS 'โรคประจำตัว (free text)';

-- =====================================================
-- Migration completed!
-- =====================================================
