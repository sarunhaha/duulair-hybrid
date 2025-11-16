-- Migration 004: Oonjai Feedback - Phase 2 Enhanced Features (FIXED)
-- Created: 2025-01-13
-- Updated: 2025-11-13 (Fixed for existing schema)
-- Purpose:
--   1. Enhanced patient medical information
--   2. Comprehensive allergy tracking (medication, food, other)
--   3. Hospital and doctor information
--   4. Medical history tracking

-- ============================================
-- 1. Enhanced Patient Profile - Medical Information
-- ============================================

DO $$
BEGIN
  -- Add medical_condition if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'medical_condition'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN medical_condition TEXT;
  END IF;

  -- Add hospital_name if not exists (check both spellings)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'hospital_name'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN hospital_name VARCHAR(255);
  END IF;

  -- Add hospital_address if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'hospital_address'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN hospital_address TEXT;
  END IF;

  -- Add hospital_phone if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'hospital_phone'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN hospital_phone VARCHAR(20);
  END IF;

  -- Add doctor_name if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'doctor_name'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN doctor_name VARCHAR(255);
  END IF;

  -- Add doctor_phone if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'doctor_phone'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN doctor_phone VARCHAR(20);
  END IF;

  -- Add medical_notes if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'medical_notes'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN medical_notes TEXT;
  END IF;
END $$;

COMMENT ON COLUMN patient_profiles.medical_condition IS 'ลักษณะอาการป่วย / โรคประจำตัว';
COMMENT ON COLUMN patient_profiles.hospital_name IS 'โรงพยาบาลที่รับการรักษาและมีประวัติ';
COMMENT ON COLUMN patient_profiles.hospital_address IS 'ที่อยู่โรงพยาบาล';
COMMENT ON COLUMN patient_profiles.hospital_phone IS 'เบอร์โทรโรงพยาบาล';
COMMENT ON COLUMN patient_profiles.doctor_name IS 'ชื่อแพทย์ผู้ดูแล';
COMMENT ON COLUMN patient_profiles.doctor_phone IS 'เบอร์โทรแพทย์';
COMMENT ON COLUMN patient_profiles.medical_notes IS 'บันทึกเพิ่มเติมทางการแพทย์';

-- ============================================
-- 2. Comprehensive Allergy Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS allergies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  allergy_type VARCHAR(50) NOT NULL CHECK (allergy_type IN ('medication', 'food', 'other')),
  allergen_name VARCHAR(255) NOT NULL,
  severity VARCHAR(50) CHECK (severity IN ('mild', 'moderate', 'severe')),
  reaction_symptoms TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_line_user_id VARCHAR(255) -- FIXED: removed FK to group_members (optional field)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_allergies_patient
  ON allergies(patient_id);

CREATE INDEX IF NOT EXISTS idx_allergies_type
  ON allergies(patient_id, allergy_type);

COMMENT ON TABLE allergies IS 'Patient allergy information categorized by type (medication, food, other)';
COMMENT ON COLUMN allergies.allergy_type IS 'Category: medication (ยา), food (อาหาร), other (อื่นๆ)';
COMMENT ON COLUMN allergies.allergen_name IS 'Name of allergen (e.g., Penicillin, Peanuts, Latex)';
COMMENT ON COLUMN allergies.severity IS 'Severity level: mild, moderate, severe';
COMMENT ON COLUMN allergies.reaction_symptoms IS 'Symptoms experienced during allergic reaction';
COMMENT ON COLUMN allergies.created_by_line_user_id IS 'LINE user ID of caregiver who added this allergy';

-- ============================================
-- 3. Emergency Contacts Table (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100),
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  priority INTEGER DEFAULT 1,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for emergency_contacts
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_patient
  ON emergency_contacts(patient_id);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_priority
  ON emergency_contacts(patient_id, priority);

COMMENT ON TABLE emergency_contacts IS 'Emergency contact information for patients';
COMMENT ON COLUMN emergency_contacts.priority IS 'Contact priority order (1 = highest priority)';
COMMENT ON COLUMN emergency_contacts.is_primary IS 'Mark as primary emergency contact';

-- Ensure only one primary contact per patient
CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_primary
  ON emergency_contacts(patient_id)
  WHERE is_primary = true;

-- ============================================
-- 4. Update emergency_contacts if exists
-- ============================================

DO $$
BEGIN
  -- Add priority if not exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emergency_contacts')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'emergency_contacts' AND column_name = 'priority'
     ) THEN
    ALTER TABLE emergency_contacts ADD COLUMN priority INTEGER DEFAULT 1;
  END IF;

  -- Add is_primary if not exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emergency_contacts')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'emergency_contacts' AND column_name = 'is_primary'
     ) THEN
    ALTER TABLE emergency_contacts ADD COLUMN is_primary BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================
-- 5. Medical History Log
-- ============================================

CREATE TABLE IF NOT EXISTS medical_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- 'hospitalization', 'surgery', 'diagnosis', 'treatment', 'checkup'
  description TEXT NOT NULL,
  hospital_name VARCHAR(255),
  doctor_name VARCHAR(255),
  outcome TEXT,
  documents JSONB, -- Array of document URLs/paths
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_line_user_id VARCHAR(255) -- FIXED: removed FK to group_members (optional)
);

CREATE INDEX IF NOT EXISTS idx_medical_history_patient
  ON medical_history(patient_id, event_date DESC);

COMMENT ON TABLE medical_history IS 'Timeline of significant medical events for patient';
COMMENT ON COLUMN medical_history.event_type IS 'Type: hospitalization, surgery, diagnosis, treatment, checkup';
COMMENT ON COLUMN medical_history.created_by_line_user_id IS 'LINE user ID of caregiver who logged this event';

-- ============================================
-- 6. Medication History (for reference)
-- ============================================

CREATE TABLE IF NOT EXISTS medication_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  medication_name VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE,
  reason TEXT,
  prescribed_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_history_patient
  ON medication_history(patient_id, start_date DESC);

COMMENT ON TABLE medication_history IS 'Historical record of past medications (discontinued or completed courses)';

-- ============================================
-- 7. Helper function: Get all allergies by type
-- ============================================

CREATE OR REPLACE FUNCTION get_patient_allergies(
  p_patient_id UUID,
  p_allergy_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  allergen_name VARCHAR(255),
  allergy_type VARCHAR(50),
  severity VARCHAR(50),
  reaction_symptoms TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.allergen_name,
    a.allergy_type,
    a.severity,
    a.reaction_symptoms
  FROM allergies a
  WHERE a.patient_id = p_patient_id
    AND (p_allergy_type IS NULL OR a.allergy_type = p_allergy_type)
  ORDER BY
    CASE a.severity
      WHEN 'severe' THEN 1
      WHEN 'moderate' THEN 2
      WHEN 'mild' THEN 3
      ELSE 4
    END,
    a.allergen_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_patient_allergies IS 'Get patient allergies, optionally filtered by type, ordered by severity';

-- ============================================
-- 8. Helper function: Check medication allergy
-- ============================================

CREATE OR REPLACE FUNCTION check_medication_allergy(
  p_patient_id UUID,
  p_medication_name VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
  has_allergy BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM allergies
    WHERE patient_id = p_patient_id
      AND allergy_type = 'medication'
      AND LOWER(allergen_name) = LOWER(p_medication_name)
  ) INTO has_allergy;

  RETURN has_allergy;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_medication_allergy IS 'Check if patient has allergy to specific medication';

-- ============================================
-- 9. Update triggers for updated_at
-- ============================================

-- Reuse existing trigger function if exists, or create new one
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to allergies table
DROP TRIGGER IF EXISTS update_allergies_updated_at ON allergies;
CREATE TRIGGER update_allergies_updated_at
  BEFORE UPDATE ON allergies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to emergency_contacts table
DROP TRIGGER IF EXISTS update_emergency_contacts_updated_at ON emergency_contacts;
CREATE TRIGGER update_emergency_contacts_updated_at
  BEFORE UPDATE ON emergency_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to medical_history table
DROP TRIGGER IF EXISTS update_medical_history_updated_at ON medical_history;
CREATE TRIGGER update_medical_history_updated_at
  BEFORE UPDATE ON medical_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. Row Level Security (RLS) - Optional
-- ============================================

-- Enable RLS for new tables (if using Supabase auth)
ALTER TABLE allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_history ENABLE ROW LEVEL SECURITY;

-- Note: Actual policies should be defined based on your auth setup
-- For now, allow all operations via service role

-- ============================================
-- Migration complete
-- ============================================

-- Log migration
INSERT INTO schema_migrations (version, description, executed_at)
VALUES (
  '004',
  'Oonjai Feedback Phase 2: Enhanced medical information, allergy tracking, medical history',
  NOW()
)
ON CONFLICT (version) DO NOTHING;

-- Success message
SELECT 'Migration 004 completed successfully!' as status;
