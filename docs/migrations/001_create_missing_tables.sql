-- ============================================================
-- Migration 001: Create Missing Tables for Existing Database
-- ============================================================
-- Date: 2025-11-13
-- Description: Add patient_profiles, caregiver_profiles, and related tables
--              to existing database that already has users table
-- Compatible with: Existing production schema (users table exists)

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Create patient_profiles table (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE, -- Can be NULL for patients without LINE

  -- ข้อมูลพื้นฐาน
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  nickname VARCHAR(50),
  birth_date DATE NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),

  -- ข้อมูลสุขภาพ
  weight_kg DECIMAL(5,2),
  height_cm DECIMAL(5,2),
  blood_type VARCHAR(5),
  chronic_diseases TEXT[],
  drug_allergies TEXT[],
  food_allergies TEXT[],

  -- ข้อมูลติดต่อ
  address TEXT,
  phone_number VARCHAR(20),
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relation VARCHAR(50),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key if users table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users') THEN
    ALTER TABLE patient_profiles
      ADD CONSTRAINT patient_profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE patient_profiles IS 'ข้อมูลโปรไฟล์ผู้ป่วย/ผู้สูงอายุ';

-- ============================================================
-- 2. Create caregiver_profiles table (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS caregiver_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL,

  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key if users table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users') THEN
    ALTER TABLE caregiver_profiles
      ADD CONSTRAINT caregiver_profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE caregiver_profiles IS 'ข้อมูลโปรไฟล์ผู้ดูแล/ญาติ';

-- ============================================================
-- 3. Create patient_caregivers relationship table
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_caregivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES caregiver_profiles(id) ON DELETE CASCADE,

  relationship VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,
  access_level VARCHAR(20) DEFAULT 'full',

  -- Notification settings
  notify_emergency BOOLEAN DEFAULT true,
  notify_medication BOOLEAN DEFAULT true,
  notify_daily_report BOOLEAN DEFAULT true,
  notify_abnormal_vitals BOOLEAN DEFAULT true,

  status VARCHAR(20) CHECK (status IN ('pending', 'active', 'rejected')) DEFAULT 'pending',
  approved_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(patient_id, caregiver_id)
);

COMMENT ON TABLE patient_caregivers IS 'ความสัมพันธ์ระหว่างผู้ป่วยและผู้ดูแล';

-- ============================================================
-- 4. Create link_codes table (6-digit codes)
-- ============================================================
CREATE TABLE IF NOT EXISTS link_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  code VARCHAR(6) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE link_codes IS 'รหัสเชื่อมต่อ 6 หลัก สำหรับเชื่อมต่อ patient-caregiver';

-- ============================================================
-- 5. Create patient_medications table (if not exists)
-- ============================================================
-- Note: medications table already exists in your schema
-- This is a separate table for patient-specific medications

CREATE TABLE IF NOT EXISTS patient_medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  frequency TEXT[],
  started_at DATE,
  notes TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE patient_medications IS 'ยาที่ผู้ป่วยกินประจำ';

-- ============================================================
-- 6. Create health_goals table
-- ============================================================
CREATE TABLE IF NOT EXISTS health_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID UNIQUE NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,

  target_bp_systolic INTEGER DEFAULT 120,
  target_bp_diastolic INTEGER DEFAULT 80,
  target_blood_sugar_fasting INTEGER DEFAULT 100,
  target_blood_sugar_post_meal INTEGER DEFAULT 140,
  target_water_ml INTEGER DEFAULT 2000,
  target_exercise_minutes INTEGER DEFAULT 30,
  target_exercise_days_per_week INTEGER DEFAULT 5,
  target_weight_kg DECIMAL(5,2),

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE health_goals IS 'เป้าหมายสุขภาพของผู้ป่วย';

-- ============================================================
-- 7. Create notification_settings table
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID UNIQUE NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,

  medication_reminder_times TIME[],
  water_reminder_interval_hours INTEGER DEFAULT 2,
  water_reminder_start TIME DEFAULT '07:00',
  water_reminder_end TIME DEFAULT '21:00',
  exercise_reminder_time TIME DEFAULT '08:00',
  daily_report_time TIME DEFAULT '20:00',

  medication_reminders_enabled BOOLEAN DEFAULT true,
  water_reminders_enabled BOOLEAN DEFAULT true,
  exercise_reminders_enabled BOOLEAN DEFAULT true,
  daily_reports_enabled BOOLEAN DEFAULT true,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE notification_settings IS 'การตั้งค่าการแจ้งเตือนของผู้ป่วย';

-- ============================================================
-- 8. Create activity_logs table (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID,
  message_id VARCHAR(255),
  task_type VARCHAR(50) NOT NULL,
  value TEXT,
  metadata JSONB DEFAULT '{}',
  intent VARCHAR(100),
  processing_result JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key if patient_profiles exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'patient_profiles') THEN
    ALTER TABLE activity_logs
      ADD CONSTRAINT activity_logs_patient_id_fkey
      FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
      ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE activity_logs IS 'บันทึกกิจกรรมทั้งหมดของผู้ป่วย';

-- ============================================================
-- 9. Create indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON patient_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_birth_date ON patient_profiles(birth_date);

CREATE INDEX IF NOT EXISTS idx_caregiver_profiles_user_id ON caregiver_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_patient_caregivers_patient ON patient_caregivers(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_caregivers_caregiver ON patient_caregivers(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_patient_caregivers_status ON patient_caregivers(status);

CREATE INDEX IF NOT EXISTS idx_link_codes_code ON link_codes(code) WHERE NOT used;
CREATE INDEX IF NOT EXISTS idx_link_codes_patient ON link_codes(patient_id);
CREATE INDEX IF NOT EXISTS idx_link_codes_expires ON link_codes(expires_at) WHERE NOT used;

CREATE INDEX IF NOT EXISTS idx_patient_medications_patient ON patient_medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_medications_active ON patient_medications(patient_id, is_active);

CREATE INDEX IF NOT EXISTS idx_health_goals_patient ON health_goals(patient_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_patient ON notification_settings(patient_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_patient ON activity_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_type ON activity_logs(task_type);

-- ============================================================
-- 10. Create update triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_patient_profiles_updated_at ON patient_profiles;
CREATE TRIGGER update_patient_profiles_updated_at
  BEFORE UPDATE ON patient_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_caregiver_profiles_updated_at ON caregiver_profiles;
CREATE TRIGGER update_caregiver_profiles_updated_at
  BEFORE UPDATE ON caregiver_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patient_caregivers_updated_at ON patient_caregivers;
CREATE TRIGGER update_patient_caregivers_updated_at
  BEFORE UPDATE ON patient_caregivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patient_medications_updated_at ON patient_medications;
CREATE TRIGGER update_patient_medications_updated_at
  BEFORE UPDATE ON patient_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_health_goals_updated_at ON health_goals;
CREATE TRIGGER update_health_goals_updated_at
  BEFORE UPDATE ON health_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON notification_settings;
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 11. Helper functions
-- ============================================================

-- Calculate age from birth_date
CREATE OR REPLACE FUNCTION calculate_age(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM age(birth_date));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate BMI
CREATE OR REPLACE FUNCTION calculate_bmi(weight_kg DECIMAL, height_cm DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  IF height_cm > 0 THEN
    RETURN ROUND((weight_kg / POWER(height_cm / 100, 2))::DECIMAL, 1);
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generate 6-digit link code
CREATE OR REPLACE FUNCTION generate_link_code()
RETURNS VARCHAR(6) AS $$
DECLARE
  code VARCHAR(6);
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

    SELECT EXISTS(
      SELECT 1 FROM link_codes
      WHERE link_codes.code = code
      AND NOT used
      AND expires_at > NOW()
    ) INTO code_exists;

    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Migration complete
-- ============================================================

-- Create schema_migrations table if not exists
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(10) PRIMARY KEY,
  description TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Log migration
INSERT INTO schema_migrations (version, description, executed_at)
VALUES (
  '001',
  'Create missing tables: patient_profiles, caregiver_profiles, and related tables',
  NOW()
)
ON CONFLICT (version) DO NOTHING;

-- Success message
SELECT 'Migration 001 completed successfully!' as status,
       'Created: patient_profiles, caregiver_profiles, patient_caregivers, link_codes, etc.' as details;
