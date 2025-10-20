-- ========================================
-- User Registration & Profile Management
-- Migration: 001
-- Created: 2024-01-16
-- Description: ระบบลงทะเบียนผู้ใช้ (Patient & Caregiver)
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- Table: users (Base user table)
-- ========================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  picture_url TEXT,
  role VARCHAR(20) CHECK (role IN ('patient', 'caregiver')) NOT NULL,
  language VARCHAR(10) DEFAULT 'th',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE users IS 'ข้อมูลผู้ใช้งานพื้นฐาน (Base user table)';
COMMENT ON COLUMN users.line_user_id IS 'LINE User ID จาก LINE Login';
COMMENT ON COLUMN users.role IS 'บทบาท: patient (ผู้ป่วย) หรือ caregiver (ผู้ดูแล)';
COMMENT ON COLUMN users.language IS 'ภาษาที่ใช้: th (ไทย) หรือ en (อังกฤษ)';

-- ========================================
-- Table: patient_profiles
-- ========================================
CREATE TABLE patient_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,

  -- ข้อมูลพื้นฐาน
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  nickname VARCHAR(50),
  birth_date DATE NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),

  -- ข้อมูลสุขภาพ
  weight_kg DECIMAL(5,2),
  height_cm DECIMAL(5,2),
  blood_type VARCHAR(5), -- 'A+', 'B-', etc.
  chronic_diseases TEXT[], -- ['hypertension', 'diabetes', ...]
  drug_allergies TEXT[],
  food_allergies TEXT[],

  -- ข้อมูลติดต่อ
  address TEXT,
  phone_number VARCHAR(20),
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relation VARCHAR(50),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE patient_profiles IS 'ข้อมูลโปรไฟล์ผู้ป่วย/ผู้สูงอายุ';
COMMENT ON COLUMN patient_profiles.chronic_diseases IS 'โรคประจำตัว (array)';
COMMENT ON COLUMN patient_profiles.drug_allergies IS 'ยาที่แพ้ (array)';
COMMENT ON COLUMN patient_profiles.food_allergies IS 'อาหารที่แพ้ (array)';

-- ========================================
-- Table: caregiver_profiles
-- ========================================
CREATE TABLE caregiver_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,

  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE caregiver_profiles IS 'ข้อมูลโปรไฟล์ผู้ดูแล/ญาติ';

-- ========================================
-- Table: patient_caregivers (Relationships)
-- ========================================
CREATE TABLE patient_caregivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) NOT NULL,
  caregiver_id UUID REFERENCES caregiver_profiles(id) NOT NULL,

  relationship VARCHAR(50), -- 'child', 'grandchild', 'sibling', 'caregiver'
  is_primary BOOLEAN DEFAULT FALSE,
  access_level VARCHAR(20) DEFAULT 'full', -- 'full', 'limited'

  -- Notification settings
  notify_emergency BOOLEAN DEFAULT TRUE,
  notify_medication BOOLEAN DEFAULT TRUE,
  notify_daily_report BOOLEAN DEFAULT TRUE,
  notify_abnormal_vitals BOOLEAN DEFAULT TRUE,

  status VARCHAR(20) CHECK (status IN ('pending', 'active', 'rejected')) DEFAULT 'pending',
  approved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(patient_id, caregiver_id)
);

COMMENT ON TABLE patient_caregivers IS 'ความสัมพันธ์ระหว่างผู้ป่วยและผู้ดูแล';
COMMENT ON COLUMN patient_caregivers.relationship IS 'ความสัมพันธ์: child (ลูก), grandchild (หลาน), sibling (พี่น้อง), etc.';
COMMENT ON COLUMN patient_caregivers.is_primary IS 'เป็นผู้ดูแลหลัก (primary caregiver)';
COMMENT ON COLUMN patient_caregivers.status IS 'สถานะ: pending (รอการอนุมัติ), active (เชื่อมต่อแล้ว), rejected (ปฏิเสธ)';

-- ========================================
-- Table: link_codes (6-digit codes)
-- ========================================
CREATE TABLE link_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) NOT NULL,
  code VARCHAR(6) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE link_codes IS 'รหัสเชื่อมต่อ 6 หลัก สำหรับเชื่อมต่อ patient-caregiver';
COMMENT ON COLUMN link_codes.code IS 'รหัส 6 หลัก (valid 24 ชั่วโมง)';
COMMENT ON COLUMN link_codes.expires_at IS 'วันเวลาหมดอายุ (24 ชม. หลังสร้าง)';

-- ========================================
-- Table: patient_medications
-- ========================================
CREATE TABLE patient_medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) NOT NULL,

  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100), -- '500mg', '1 เม็ด'
  frequency TEXT[], -- ['morning', 'evening']
  started_at DATE,
  notes TEXT,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE patient_medications IS 'ยาที่ผู้ป่วยกินประจำ';
COMMENT ON COLUMN patient_medications.frequency IS 'เวลากินยา: morning (เช้า), afternoon (กลางวัน), evening (เย็น), bedtime (ก่อนนอน)';

-- ========================================
-- Table: health_goals
-- ========================================
CREATE TABLE health_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) UNIQUE NOT NULL,

  -- ความดัน
  target_bp_systolic INTEGER DEFAULT 120,
  target_bp_diastolic INTEGER DEFAULT 80,

  -- น้ำตาล
  target_blood_sugar_fasting INTEGER DEFAULT 100,
  target_blood_sugar_post_meal INTEGER DEFAULT 140,

  -- น้ำ
  target_water_ml INTEGER DEFAULT 2000,

  -- ออกกำลังกาย
  target_exercise_minutes INTEGER DEFAULT 30,
  target_exercise_days_per_week INTEGER DEFAULT 5,

  -- น้ำหนัก
  target_weight_kg DECIMAL(5,2),

  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE health_goals IS 'เป้าหมายสุขภาพของผู้ป่วย';
COMMENT ON COLUMN health_goals.target_bp_systolic IS 'ความดันซิสโตลิกเป้าหมาย (default: 120)';
COMMENT ON COLUMN health_goals.target_bp_diastolic IS 'ความดันไดแอสโตลิกเป้าหมาย (default: 80)';
COMMENT ON COLUMN health_goals.target_water_ml IS 'น้ำต่อวันเป้าหมาย (default: 2000ml)';

-- ========================================
-- Table: notification_settings
-- ========================================
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) UNIQUE NOT NULL,

  -- เวลาเตือน
  medication_reminder_times TIME[],
  water_reminder_interval_hours INTEGER DEFAULT 2,
  water_reminder_start TIME DEFAULT '07:00',
  water_reminder_end TIME DEFAULT '21:00',
  exercise_reminder_time TIME DEFAULT '08:00',
  daily_report_time TIME DEFAULT '20:00',

  -- เปิด/ปิด
  medication_reminders_enabled BOOLEAN DEFAULT TRUE,
  water_reminders_enabled BOOLEAN DEFAULT TRUE,
  exercise_reminders_enabled BOOLEAN DEFAULT TRUE,
  daily_reports_enabled BOOLEAN DEFAULT TRUE,

  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE notification_settings IS 'การตั้งค่าการแจ้งเตือนของผู้ป่วย';
COMMENT ON COLUMN notification_settings.medication_reminder_times IS 'เวลาเตือนกินยา (array of TIME)';
COMMENT ON COLUMN notification_settings.water_reminder_interval_hours IS 'ระยะห่างระหว่างการเตือนดื่มน้ำ (default: 2 ชม.)';

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX idx_users_line_id ON users(line_user_id);
CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_patient_user ON patient_profiles(user_id);
CREATE INDEX idx_patient_birth_date ON patient_profiles(birth_date);

CREATE INDEX idx_caregiver_user ON caregiver_profiles(user_id);

CREATE INDEX idx_patient_caregivers_patient ON patient_caregivers(patient_id);
CREATE INDEX idx_patient_caregivers_caregiver ON patient_caregivers(caregiver_id);
CREATE INDEX idx_patient_caregivers_status ON patient_caregivers(status);

CREATE INDEX idx_link_codes_code ON link_codes(code) WHERE NOT used AND expires_at > NOW();
CREATE INDEX idx_link_codes_patient ON link_codes(patient_id);

CREATE INDEX idx_medications_patient ON patient_medications(patient_id);
CREATE INDEX idx_medications_active ON patient_medications(patient_id, is_active);

CREATE INDEX idx_health_goals_patient ON health_goals(patient_id);
CREATE INDEX idx_notification_settings_patient ON notification_settings(patient_id);

-- ========================================
-- Triggers: updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_profiles_updated_at BEFORE UPDATE ON patient_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_caregiver_profiles_updated_at BEFORE UPDATE ON caregiver_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_caregivers_updated_at BEFORE UPDATE ON patient_caregivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_medications_updated_at BEFORE UPDATE ON patient_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_goals_updated_at BEFORE UPDATE ON health_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Functions: Helper functions
-- ========================================

-- Function: Calculate age from birth_date
CREATE OR REPLACE FUNCTION calculate_age(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM age(birth_date));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Calculate BMI
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

-- Function: Generate 6-digit link code
CREATE OR REPLACE FUNCTION generate_link_code()
RETURNS VARCHAR(6) AS $$
DECLARE
  code VARCHAR(6);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate random 6-digit code
    code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

    -- Check if code already exists and not expired
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

-- ========================================
-- Row Level Security (RLS)
-- ========================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Policies: Users can read their own data
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid()::TEXT = line_user_id);

CREATE POLICY patient_profiles_select_own ON patient_profiles
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE line_user_id = auth.uid()::TEXT)
  );

CREATE POLICY caregiver_profiles_select_own ON caregiver_profiles
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE line_user_id = auth.uid()::TEXT)
  );

-- Caregivers can view their linked patients
CREATE POLICY patient_profiles_select_by_caregiver ON patient_profiles
  FOR SELECT USING (
    id IN (
      SELECT patient_id FROM patient_caregivers pc
      JOIN caregiver_profiles cp ON cp.id = pc.caregiver_id
      JOIN users u ON u.id = cp.user_id
      WHERE u.line_user_id = auth.uid()::TEXT
      AND pc.status = 'active'
    )
  );

-- ========================================
-- Sample Data (for development)
-- ========================================
-- Uncomment for testing

/*
INSERT INTO users (line_user_id, display_name, role, language) VALUES
  ('U1234567890', 'สมศรี ใจดี', 'patient', 'th'),
  ('U0987654321', 'สมชาย ใจดี', 'caregiver', 'th');

INSERT INTO patient_profiles (
  user_id, first_name, last_name, nickname, birth_date, gender,
  weight_kg, height_cm, blood_type,
  chronic_diseases, drug_allergies,
  address, phone_number,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relation
) VALUES (
  (SELECT id FROM users WHERE line_user_id = 'U1234567890'),
  'สมศรี', 'ใจดี', 'ศรี', '1959-03-15', 'female',
  65, 155, 'A+',
  ARRAY['hypertension', 'diabetes'], ARRAY['Penicillin'],
  '123 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กทม. 10110', '081-234-5678',
  'สมชาย ใจดี', '082-345-6789', 'ลูก'
);

INSERT INTO caregiver_profiles (user_id, first_name, last_name, phone_number) VALUES (
  (SELECT id FROM users WHERE line_user_id = 'U0987654321'),
  'สมชาย', 'ใจดี', '082-345-6789'
);
*/

-- ========================================
-- End of Migration
-- ========================================
