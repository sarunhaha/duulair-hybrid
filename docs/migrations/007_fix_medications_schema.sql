-- Migration 007: Fix medications table schema to match frontend
-- Date: 2025-01-21
-- Purpose: Add missing columns and patient_id support

-- Add missing columns
ALTER TABLE medications
ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES patient_profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS dosage_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS dosage_unit VARCHAR(50),
ADD COLUMN IF NOT EXISTS times TEXT[],
ADD COLUMN IF NOT EXISTS instructions VARCHAR(200),
ADD COLUMN IF NOT EXISTS note TEXT;

-- Migrate user_id to patient_id for existing records
UPDATE medications m
SET patient_id = (
  SELECT pp.id
  FROM patient_profiles pp
  WHERE pp.user_id = m.user_id
)
WHERE patient_id IS NULL AND user_id IS NOT NULL;

-- Create index on patient_id
CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON medications(patient_id);

-- Add comments
COMMENT ON COLUMN medications.patient_id IS 'Patient profile ID (for LIFF pages)';
COMMENT ON COLUMN medications.dosage_amount IS 'ปริมาณยา (ตัวเลข)';
COMMENT ON COLUMN medications.dosage_unit IS 'หน่วยของยา (เม็ด, มล., ช้อนชา)';
COMMENT ON COLUMN medications.times IS 'เวลาทานยา (array)';
COMMENT ON COLUMN medications.instructions IS 'วิธีรับประทาน';
COMMENT ON COLUMN medications.note IS 'หมายเหตุ';
