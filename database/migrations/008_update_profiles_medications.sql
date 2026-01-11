-- ========================================
-- Update Patient Profiles & Medications
-- Migration: 008
-- Created: 2026-01-11
-- Description: เพิ่ม columns ที่ขาดใน patient_profiles และ medications
-- ========================================

-- ========================================
-- Update: patient_profiles (add medical info columns)
-- ========================================
ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS medical_condition TEXT,
  ADD COLUMN IF NOT EXISTS hospital_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS hospital_address TEXT,
  ADD COLUMN IF NOT EXISTS hospital_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS doctor_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS medical_notes TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_profiles' AND column_name = 'medical_condition') THEN
    COMMENT ON COLUMN patient_profiles.medical_condition IS 'ภาวะทางการแพทย์ปัจจุบัน';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_profiles' AND column_name = 'hospital_name') THEN
    COMMENT ON COLUMN patient_profiles.hospital_name IS 'ชื่อโรงพยาบาลประจำ';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_profiles' AND column_name = 'hospital_address') THEN
    COMMENT ON COLUMN patient_profiles.hospital_address IS 'ที่อยู่โรงพยาบาล';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_profiles' AND column_name = 'hospital_phone') THEN
    COMMENT ON COLUMN patient_profiles.hospital_phone IS 'เบอร์โทรโรงพยาบาล';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_profiles' AND column_name = 'doctor_name') THEN
    COMMENT ON COLUMN patient_profiles.doctor_name IS 'ชื่อแพทย์เจ้าของไข้';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_profiles' AND column_name = 'doctor_phone') THEN
    COMMENT ON COLUMN patient_profiles.doctor_phone IS 'เบอร์โทรแพทย์';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_profiles' AND column_name = 'medical_notes') THEN
    COMMENT ON COLUMN patient_profiles.medical_notes IS 'หมายเหตุทางการแพทย์';
  END IF;
END $$;

-- ========================================
-- Table: medications (replaces patient_medications)
-- ========================================
-- Note: ถ้ามี patient_medications อยู่แล้ว ให้ migrate data ก่อน drop

CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  patient_id UUID REFERENCES patient_profiles(id),
  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  dosage_amount NUMERIC(10,2),
  dosage_unit VARCHAR(20),
  dosage_form VARCHAR(30),
  frequency VARCHAR(30),
  times TEXT[],
  days_of_week TEXT[],
  time_slots JSONB DEFAULT '[]'::jsonb,
  instructions VARCHAR(500),
  note TEXT,
  active BOOLEAN DEFAULT TRUE,
  reminder_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing medications table
ALTER TABLE medications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE medications ADD COLUMN IF NOT EXISTS dosage VARCHAR(100);
ALTER TABLE medications ADD COLUMN IF NOT EXISTS dosage_amount NUMERIC(10,2);
ALTER TABLE medications ADD COLUMN IF NOT EXISTS dosage_unit VARCHAR(20);
ALTER TABLE medications ADD COLUMN IF NOT EXISTS dosage_form VARCHAR(30);
ALTER TABLE medications ADD COLUMN IF NOT EXISTS frequency VARCHAR(30);
ALTER TABLE medications ADD COLUMN IF NOT EXISTS times TEXT[];
ALTER TABLE medications ADD COLUMN IF NOT EXISTS days_of_week TEXT[];
ALTER TABLE medications ADD COLUMN IF NOT EXISTS time_slots JSONB DEFAULT '[]'::jsonb;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS instructions VARCHAR(500);
ALTER TABLE medications ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT TRUE;

COMMENT ON TABLE medications IS 'ยาที่ผู้ป่วยกินประจำ';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'dosage_form') THEN
    COMMENT ON COLUMN medications.dosage_form IS 'รูปแบบยา: tablet (เม็ด), capsule (แคปซูล), liquid (น้ำ), injection (ฉีด)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'times') THEN
    COMMENT ON COLUMN medications.times IS 'เวลากินยา (array of TIME)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'reminder_enabled') THEN
    COMMENT ON COLUMN medications.reminder_enabled IS 'เปิดใช้การแจ้งเตือนหรือไม่';
  END IF;
END $$;

-- ========================================
-- Table: medication_logs (record each dose taken)
-- ========================================
CREATE TABLE IF NOT EXISTS medication_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  medication_id UUID REFERENCES medications(id),
  medication_name VARCHAR(255),
  dosage VARCHAR(100),
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_time TIME,
  status VARCHAR(20) DEFAULT 'taken',
  note TEXT,
  ai_confidence NUMERIC(4,3),
  raw_text TEXT,
  activity_log_id UUID,
  conversation_log_id UUID,
  logged_by_line_user_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing medication_logs table
-- IMPORTANT: patient_id must be added first (existing table has user_id, not patient_id)
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patient_profiles(id);
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS medication_id UUID REFERENCES medications(id);
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS medication_name VARCHAR(255);
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS dosage VARCHAR(100);
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS taken_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS scheduled_time TIME;
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'taken';
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3);
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS activity_log_id UUID;
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS conversation_log_id UUID;
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS logged_by_line_user_id VARCHAR(100);

COMMENT ON TABLE medication_logs IS 'บันทึกการกินยาแต่ละครั้ง';
-- Only add comment if column exists (wrapped in DO block for safety)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medication_logs' AND column_name = 'status') THEN
    COMMENT ON COLUMN medication_logs.status IS 'สถานะ: taken (กินแล้ว), missed (พลาด), skipped (ข้าม)';
  END IF;
END $$;

-- ========================================
-- Table: water_logs (daily water intake)
-- ========================================
CREATE TABLE IF NOT EXISTS water_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  log_date DATE DEFAULT CURRENT_DATE,
  amount_ml INTEGER NOT NULL,
  glasses INTEGER,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  note TEXT,
  ai_confidence NUMERIC(4,3),
  raw_text TEXT,
  activity_log_id UUID,
  conversation_log_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing water_logs table
ALTER TABLE water_logs ADD COLUMN IF NOT EXISTS log_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE water_logs ADD COLUMN IF NOT EXISTS glasses INTEGER;
ALTER TABLE water_logs ADD COLUMN IF NOT EXISTS logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE water_logs ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE water_logs ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3);
ALTER TABLE water_logs ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE water_logs ADD COLUMN IF NOT EXISTS activity_log_id UUID;
ALTER TABLE water_logs ADD COLUMN IF NOT EXISTS conversation_log_id UUID;

COMMENT ON TABLE water_logs IS 'บันทึกการดื่มน้ำ';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'water_logs' AND column_name = 'glasses') THEN
    COMMENT ON COLUMN water_logs.glasses IS 'จำนวนแก้ว (1 แก้ว = 250ml)';
  END IF;
END $$;

-- ========================================
-- Supporting Tables
-- ========================================

-- Table: allergies (more detailed than drug_allergies array)
CREATE TABLE IF NOT EXISTS allergies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  allergy_type VARCHAR(30) NOT NULL,
  allergen_name VARCHAR(255) NOT NULL,
  severity VARCHAR(20),
  reaction_symptoms TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing allergies table
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS allergy_type VARCHAR(30);
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS allergen_name VARCHAR(255);
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS severity VARCHAR(20);
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS reaction_symptoms TEXT;
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON TABLE allergies IS 'ประวัติการแพ้ (ยา, อาหาร, สิ่งแวดล้อม)';

-- Table: emergency_contacts (more detailed than single contact in profile)
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  name VARCHAR(100) NOT NULL,
  relationship VARCHAR(50),
  phone_number VARCHAR(20) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing emergency_contacts table
ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS relationship VARCHAR(50);
ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;

COMMENT ON TABLE emergency_contacts IS 'ผู้ติดต่อฉุกเฉิน (สามารถมีได้หลายคน)';

-- Table: medical_history
CREATE TABLE IF NOT EXISTS medical_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  event_date DATE NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  hospital_name VARCHAR(255),
  doctor_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing medical_history table
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS event_type VARCHAR(50);
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS hospital_name VARCHAR(255);
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(100);

COMMENT ON TABLE medical_history IS 'ประวัติการรักษาพยาบาล';

-- ========================================
-- Report Tables
-- ========================================

-- Table: daily_patient_summaries
CREATE TABLE IF NOT EXISTS daily_patient_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  summary_date DATE NOT NULL,
  bp_readings_count INTEGER DEFAULT 0,
  bp_systolic_avg NUMERIC(5,1),
  medications_scheduled INTEGER DEFAULT 0,
  medications_taken INTEGER DEFAULT 0,
  medication_compliance_percent NUMERIC(5,2),
  water_intake_ml INTEGER DEFAULT 0,
  water_goal_ml INTEGER DEFAULT 2000,
  activities_count INTEGER DEFAULT 0,
  exercise_minutes INTEGER DEFAULT 0,
  has_data BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(patient_id, summary_date)
);

-- Add missing columns to existing daily_patient_summaries table
ALTER TABLE daily_patient_summaries ADD COLUMN IF NOT EXISTS bp_readings_count INTEGER DEFAULT 0;
ALTER TABLE daily_patient_summaries ADD COLUMN IF NOT EXISTS bp_systolic_avg NUMERIC(5,1);
ALTER TABLE daily_patient_summaries ADD COLUMN IF NOT EXISTS medications_scheduled INTEGER DEFAULT 0;
ALTER TABLE daily_patient_summaries ADD COLUMN IF NOT EXISTS medications_taken INTEGER DEFAULT 0;
ALTER TABLE daily_patient_summaries ADD COLUMN IF NOT EXISTS medication_compliance_percent NUMERIC(5,2);
ALTER TABLE daily_patient_summaries ADD COLUMN IF NOT EXISTS water_intake_ml INTEGER DEFAULT 0;
ALTER TABLE daily_patient_summaries ADD COLUMN IF NOT EXISTS water_goal_ml INTEGER DEFAULT 2000;
ALTER TABLE daily_patient_summaries ADD COLUMN IF NOT EXISTS activities_count INTEGER DEFAULT 0;
ALTER TABLE daily_patient_summaries ADD COLUMN IF NOT EXISTS exercise_minutes INTEGER DEFAULT 0;
ALTER TABLE daily_patient_summaries ADD COLUMN IF NOT EXISTS has_data BOOLEAN DEFAULT FALSE;
ALTER TABLE daily_patient_summaries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMENT ON TABLE daily_patient_summaries IS 'สรุปรายวันของผู้ป่วย (precomputed for performance)';

-- Table: daily_reports
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  report_date DATE NOT NULL,
  mood_summary JSONB,
  medication_compliance NUMERIC(5,2),
  vitals_summary JSONB,
  ai_insights TEXT,
  risk_level VARCHAR(20) DEFAULT 'normal',
  flex_message_json JSONB,
  sent_to_caregivers BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing daily_reports table
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS mood_summary JSONB;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS medication_compliance NUMERIC(5,2);
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS vitals_summary JSONB;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS ai_insights TEXT;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'normal';
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS flex_message_json JSONB;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS sent_to_caregivers BOOLEAN DEFAULT FALSE;

COMMENT ON TABLE daily_reports IS 'รายงานสรุปรายวัน';

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX IF NOT EXISTS idx_medications_patient ON medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_active ON medications(patient_id, active);
CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id);

CREATE INDEX IF NOT EXISTS idx_medication_logs_patient ON medication_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_taken_at ON medication_logs(taken_at);
CREATE INDEX IF NOT EXISTS idx_medication_logs_patient_date ON medication_logs(patient_id, taken_at);
CREATE INDEX IF NOT EXISTS idx_medication_logs_medication ON medication_logs(medication_id);

CREATE INDEX IF NOT EXISTS idx_water_logs_patient ON water_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_water_logs_date ON water_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_water_logs_patient_date ON water_logs(patient_id, log_date);

CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_patient ON emergency_contacts(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_history_patient ON medical_history(patient_id);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_patient ON daily_patient_summaries(patient_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_patient_summaries(summary_date);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_patient_date ON daily_patient_summaries(patient_id, summary_date);

CREATE INDEX IF NOT EXISTS idx_daily_reports_user ON daily_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);

-- ========================================
-- Row Level Security (RLS)
-- ========================================
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_patient_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Triggers (only create if not exists)
-- ========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_daily_summaries_updated_at') THEN
    CREATE TRIGGER update_daily_summaries_updated_at BEFORE UPDATE ON daily_patient_summaries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ========================================
-- Data Migration: patient_medications → medications
-- ========================================
-- Uncomment and run if you need to migrate existing data:
/*
INSERT INTO medications (patient_id, name, dosage, frequency, note, active, created_at)
SELECT patient_id, name, dosage, frequency, notes, is_active, created_at
FROM patient_medications
ON CONFLICT DO NOTHING;
*/

-- ========================================
-- End of Migration
-- ========================================
