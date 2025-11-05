-- Database Schema for LIFF Pages (TASK-002 Phase 4.1)
-- New tables for: reminders, medications
-- Updated fields for: patient_profiles

-- ============================================
-- 1. Update patient_profiles table
-- ============================================
ALTER TABLE patient_profiles
ADD COLUMN IF NOT EXISTS nickname VARCHAR(50),
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS blood_type VARCHAR(5),
ADD COLUMN IF NOT EXISTS weight DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS height DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS medical_conditions JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS medical_notes TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(50),
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS hospital_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS hospital_phone VARCHAR(20);

-- Add comments
COMMENT ON COLUMN patient_profiles.nickname IS 'ชื่อเล่นของผู้ป่วย';
COMMENT ON COLUMN patient_profiles.phone_number IS 'เบอร์โทรศัพท์ของผู้ป่วย';
COMMENT ON COLUMN patient_profiles.address IS 'ที่อยู่ของผู้ป่วย';
COMMENT ON COLUMN patient_profiles.blood_type IS 'กลุ่มเลือด (A, B, AB, O)';
COMMENT ON COLUMN patient_profiles.weight IS 'น้ำหนัก (kg)';
COMMENT ON COLUMN patient_profiles.height IS 'ส่วนสูง (cm)';
COMMENT ON COLUMN patient_profiles.medical_conditions IS 'โรคประจำตัว (JSONB array)';
COMMENT ON COLUMN patient_profiles.allergies IS 'ยาที่แพ้';
COMMENT ON COLUMN patient_profiles.medical_notes IS 'หมายเหตุทางการแพทย์';
COMMENT ON COLUMN patient_profiles.emergency_contact_name IS 'ชื่อผู้ติดต่อฉุกเฉิน';
COMMENT ON COLUMN patient_profiles.emergency_contact_relation IS 'ความสัมพันธ์ของผู้ติดต่อฉุกเฉิน';
COMMENT ON COLUMN patient_profiles.emergency_contact_phone IS 'เบอร์โทรผู้ติดต่อฉุกเฉิน';
COMMENT ON COLUMN patient_profiles.hospital_name IS 'โรงพยาบาลประจำ';
COMMENT ON COLUMN patient_profiles.hospital_phone IS 'เบอร์โทรโรงพยาบาล';

-- ============================================
-- 2. Create reminders table
-- ============================================
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,

  -- Reminder details
  type VARCHAR(50) NOT NULL,  -- medication, vitals, water, exercise, appointment, custom
  title VARCHAR(200) NOT NULL,
  time TIME NOT NULL,
  days TEXT[] DEFAULT '{}',  -- Array of days: mon, tue, wed, thu, fri, sat, sun
  note TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for reminders
CREATE INDEX IF NOT EXISTS idx_reminders_patient_id ON reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(time);
CREATE INDEX IF NOT EXISTS idx_reminders_is_active ON reminders(is_active);

-- Comments
COMMENT ON TABLE reminders IS 'การเตือนต่าง ๆ สำหรับผู้ป่วย';
COMMENT ON COLUMN reminders.type IS 'ประเภทการเตือน';
COMMENT ON COLUMN reminders.title IS 'หัวข้อการเตือน';
COMMENT ON COLUMN reminders.time IS 'เวลาเตือน';
COMMENT ON COLUMN reminders.days IS 'วันที่ต้องการเตือน (array)';
COMMENT ON COLUMN reminders.is_active IS 'สถานะเปิด/ปิดการเตือน';

-- ============================================
-- 3. Create medications table
-- ============================================
CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,

  -- Medication details
  name VARCHAR(200) NOT NULL,
  dosage_amount DECIMAL(10,2) NOT NULL,
  dosage_unit VARCHAR(50) NOT NULL,  -- เม็ด, แคปซูล, ช้อนชา, มล., หยด, แผ่น
  times TEXT[] DEFAULT '{}',  -- Array: morning, afternoon, evening, night
  instructions VARCHAR(200),  -- ก่อนอาหาร, หลังอาหาร, ระหว่างอาหาร, ห่างอาหาร
  note TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for medications
CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_name ON medications(name);

-- Comments
COMMENT ON TABLE medications IS 'รายการยาของผู้ป่วย';
COMMENT ON COLUMN medications.name IS 'ชื่อยา';
COMMENT ON COLUMN medications.dosage_amount IS 'ปริมาณยา';
COMMENT ON COLUMN medications.dosage_unit IS 'หน่วยของยา';
COMMENT ON COLUMN medications.times IS 'เวลาทานยา (array)';
COMMENT ON COLUMN medications.instructions IS 'วิธีรับประทาน';

-- ============================================
-- 4. Update caregiver_groups table
-- ============================================
ALTER TABLE caregiver_groups
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
  "medication_reminders": true,
  "vitals_reminders": true,
  "water_reminders": true,
  "exercise_reminders": true,
  "activity_notifications": true,
  "emergency_notifications": true,
  "daily_report": true,
  "weekly_report": true,
  "monthly_report": false,
  "send_to_group": true,
  "send_to_primary": true
}';

-- Comments
COMMENT ON COLUMN caregiver_groups.settings IS 'การตั้งค่ากลุ่ม (JSONB)';

-- ============================================
-- 5. Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS for reminders
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reminders for their patient"
  ON reminders FOR SELECT
  USING (
    patient_id IN (
      SELECT patient_id FROM caregiver_groups cg
      JOIN group_members gm ON cg.id = gm.group_id
      WHERE gm.line_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reminders for their patient"
  ON reminders FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT patient_id FROM caregiver_groups cg
      JOIN group_members gm ON cg.id = gm.group_id
      WHERE gm.line_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update reminders for their patient"
  ON reminders FOR UPDATE
  USING (
    patient_id IN (
      SELECT patient_id FROM caregiver_groups cg
      JOIN group_members gm ON cg.id = gm.group_id
      WHERE gm.line_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete reminders for their patient"
  ON reminders FOR DELETE
  USING (
    patient_id IN (
      SELECT patient_id FROM caregiver_groups cg
      JOIN group_members gm ON cg.id = gm.group_id
      WHERE gm.line_user_id = auth.uid()
    )
  );

-- Enable RLS for medications
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view medications for their patient"
  ON medications FOR SELECT
  USING (
    patient_id IN (
      SELECT patient_id FROM caregiver_groups cg
      JOIN group_members gm ON cg.id = gm.group_id
      WHERE gm.line_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert medications for their patient"
  ON medications FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT patient_id FROM caregiver_groups cg
      JOIN group_members gm ON cg.id = gm.group_id
      WHERE gm.line_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update medications for their patient"
  ON medications FOR UPDATE
  USING (
    patient_id IN (
      SELECT patient_id FROM caregiver_groups cg
      JOIN group_members gm ON cg.id = gm.group_id
      WHERE gm.line_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete medications for their patient"
  ON medications FOR DELETE
  USING (
    patient_id IN (
      SELECT patient_id FROM caregiver_groups cg
      JOIN group_members gm ON cg.id = gm.group_id
      WHERE gm.line_user_id = auth.uid()
    )
  );

-- ============================================
-- 6. Create trigger functions for updated_at
-- ============================================

-- Trigger function for reminders
CREATE OR REPLACE FUNCTION update_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reminders_updated_at_trigger
  BEFORE UPDATE ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_reminders_updated_at();

-- Trigger function for medications
CREATE OR REPLACE FUNCTION update_medications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medications_updated_at_trigger
  BEFORE UPDATE ON medications
  FOR EACH ROW
  EXECUTE FUNCTION update_medications_updated_at();

-- ============================================
-- 7. Sample data (for testing)
-- ============================================

-- Note: Uncomment below to insert sample data for testing

/*
-- Sample reminder
INSERT INTO reminders (patient_id, type, title, time, days, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000000', -- Replace with actual patient_id
  'medication',
  'กินยาความดัน',
  '08:00:00',
  ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  true
);

-- Sample medication
INSERT INTO medications (patient_id, name, dosage_amount, dosage_unit, times, instructions)
VALUES (
  '00000000-0000-0000-0000-000000000000', -- Replace with actual patient_id
  'ยาลดความดัน',
  1,
  'เม็ด',
  ARRAY['morning', 'evening'],
  'หลังอาหาร'
);
*/

-- ============================================
-- Migration completed!
-- ============================================
