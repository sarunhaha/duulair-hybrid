-- ========================================
-- Reminders & Groups Tables
-- Migration: 007
-- Created: 2026-01-11
-- Description: ตาราง Reminders, Groups, และความสัมพันธ์
-- ========================================

-- ========================================
-- Table: reminders
-- ========================================
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  time TIME NOT NULL,
  custom_time TIME,
  frequency VARCHAR(20) DEFAULT 'daily',
  days TEXT[] DEFAULT '{}',
  days_of_week JSONB,
  note TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing reminders table
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS custom_time TIME;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) DEFAULT 'daily';
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS days TEXT[] DEFAULT '{}';
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS days_of_week JSONB;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMENT ON TABLE reminders IS 'การตั้งค่าเตือนของผู้ป่วย';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminders' AND column_name = 'type') THEN
    COMMENT ON COLUMN reminders.type IS 'ประเภท: medication (ยา), vitals (วัดค่า), water (น้ำ), exercise (ออกกำลังกาย)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminders' AND column_name = 'frequency') THEN
    COMMENT ON COLUMN reminders.frequency IS 'ความถี่: daily (ทุกวัน), weekly (รายสัปดาห์), custom (กำหนดเอง)';
  END IF;
END $$;

-- ========================================
-- Table: groups
-- ========================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_group_id VARCHAR(100) NOT NULL UNIQUE,
  group_name VARCHAR(255),
  primary_caregiver_id UUID REFERENCES caregiver_profiles(id),
  active_patient_id UUID REFERENCES patient_profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_name VARCHAR(255);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS primary_caregiver_id UUID REFERENCES caregiver_profiles(id);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS active_patient_id UUID REFERENCES patient_profiles(id);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

COMMENT ON TABLE groups IS 'LINE Groups ที่ใช้ OONJAI';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'active_patient_id') THEN
    COMMENT ON COLUMN groups.active_patient_id IS 'ผู้ป่วยที่ active ในกลุ่ม (ใช้เมื่อกลุ่มมีหลาย patient)';
  END IF;
END $$;

-- ========================================
-- Table: group_members
-- ========================================
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id),
  line_user_id VARCHAR(100) NOT NULL,
  display_name VARCHAR(255),
  picture_url TEXT,
  role VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITHOUT TIME ZONE,
  UNIQUE(group_id, line_user_id)
);

-- Add missing columns to existing group_members table
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS picture_url TEXT;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS role VARCHAR(20);
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS left_at TIMESTAMP WITHOUT TIME ZONE;

COMMENT ON TABLE group_members IS 'สมาชิกในแต่ละ LINE Group';

-- ========================================
-- Table: group_patients
-- ========================================
CREATE TABLE IF NOT EXISTS group_patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  added_by_caregiver_id UUID REFERENCES caregiver_profiles(id),
  added_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(group_id, patient_id)
);

-- Add missing columns to existing group_patients table
ALTER TABLE group_patients ADD COLUMN IF NOT EXISTS added_by_caregiver_id UUID REFERENCES caregiver_profiles(id);
ALTER TABLE group_patients ADD COLUMN IF NOT EXISTS added_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();
ALTER TABLE group_patients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

COMMENT ON TABLE group_patients IS 'ผู้ป่วยที่เชื่อมกับแต่ละกลุ่ม';

-- ========================================
-- Update: health_goals (add missing columns)
-- ========================================
ALTER TABLE health_goals
  ADD COLUMN IF NOT EXISTS target_sleep_hours NUMERIC(3,1) DEFAULT 7,
  ADD COLUMN IF NOT EXISTS target_water_glasses INTEGER DEFAULT 8,
  ADD COLUMN IF NOT EXISTS target_steps INTEGER DEFAULT 6000;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_goals' AND column_name = 'target_sleep_hours') THEN
    COMMENT ON COLUMN health_goals.target_sleep_hours IS 'เป้าหมายชั่วโมงนอน (default: 7)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_goals' AND column_name = 'target_water_glasses') THEN
    COMMENT ON COLUMN health_goals.target_water_glasses IS 'เป้าหมายแก้วน้ำต่อวัน (default: 8)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_goals' AND column_name = 'target_steps') THEN
    COMMENT ON COLUMN health_goals.target_steps IS 'เป้าหมายก้าวเดินต่อวัน (default: 6000)';
  END IF;
END $$;

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX IF NOT EXISTS idx_reminders_patient ON reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_reminders_patient_active ON reminders(patient_id, is_active);
CREATE INDEX IF NOT EXISTS idx_reminders_type ON reminders(type);

CREATE INDEX IF NOT EXISTS idx_groups_line_id ON groups(line_group_id);
CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(is_active);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(line_user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_active ON group_members(group_id, is_active);

CREATE INDEX IF NOT EXISTS idx_group_patients_group ON group_patients(group_id);
CREATE INDEX IF NOT EXISTS idx_group_patients_patient ON group_patients(patient_id);

-- ========================================
-- Row Level Security (RLS)
-- ========================================
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_patients ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Triggers: updated_at (only create if not exists)
-- ========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_reminders_updated_at') THEN
    CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON reminders
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_groups_updated_at') THEN
    CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ========================================
-- End of Migration
-- ========================================
