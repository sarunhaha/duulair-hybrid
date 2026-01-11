-- ========================================
-- Health Logging Tables
-- Migration: 005
-- Created: 2026-01-11
-- Description: ตารางบันทึกสุขภาพ (Vitals, Sleep, Exercise, Mood)
-- ========================================

-- ========================================
-- Table: vitals_logs
-- ========================================
CREATE TABLE IF NOT EXISTS vitals_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  patient_id UUID REFERENCES patient_profiles(id),
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  heart_rate INTEGER,
  glucose INTEGER,
  weight NUMERIC(5,2),
  temperature NUMERIC(4,1),
  spo2 INTEGER,
  notes TEXT,
  measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  measured_at_text VARCHAR(100),
  source VARCHAR(20) DEFAULT 'manual',
  ai_confidence NUMERIC(4,3),
  raw_text TEXT,
  logged_by_line_user_id VARCHAR(100),
  logged_by_display_name VARCHAR(255),
  conversation_log_id UUID,
  activity_log_id UUID
);

-- Add missing columns to existing vitals_logs table
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS glucose INTEGER;
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS weight NUMERIC(5,2);
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS temperature NUMERIC(4,1);
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS spo2 INTEGER;
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS measured_at_text VARCHAR(100);
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3);
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS logged_by_line_user_id VARCHAR(100);
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS logged_by_display_name VARCHAR(255);
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS conversation_log_id UUID;
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS activity_log_id UUID;

COMMENT ON TABLE vitals_logs IS 'บันทึกสัญญาณชีพ (ความดัน, ชีพจร, น้ำตาล, น้ำหนัก, อุณหภูมิ, SpO2)';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vitals_logs' AND column_name = 'source') THEN
    COMMENT ON COLUMN vitals_logs.source IS 'แหล่งข้อมูล: manual (พิมพ์เอง), image_ocr (อ่านจากรูป), device (อุปกรณ์)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vitals_logs' AND column_name = 'ai_confidence') THEN
    COMMENT ON COLUMN vitals_logs.ai_confidence IS 'ความมั่นใจของ AI ในการแปลงข้อมูล (0.000-1.000)';
  END IF;
END $$;

-- ========================================
-- Table: sleep_logs
-- ========================================
CREATE TABLE IF NOT EXISTS sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  sleep_date DATE DEFAULT CURRENT_DATE,
  sleep_time TIME,
  wake_time TIME,
  sleep_hours NUMERIC(4,2),
  sleep_quality VARCHAR(20),
  sleep_quality_score INTEGER CHECK (sleep_quality_score >= 1 AND sleep_quality_score <= 5),
  wake_ups INTEGER DEFAULT 0,
  sleep_issues TEXT[],
  factors TEXT[],
  ai_confidence NUMERIC(4,3),
  raw_text TEXT,
  notes TEXT,
  activity_log_id UUID,
  conversation_log_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing sleep_logs table
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS sleep_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS sleep_time TIME;
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS wake_time TIME;
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS sleep_hours NUMERIC(4,2);
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS sleep_quality VARCHAR(20);
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS sleep_quality_score INTEGER;
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS wake_ups INTEGER DEFAULT 0;
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS sleep_issues TEXT[];
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS factors TEXT[];
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3);
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS activity_log_id UUID;
ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS conversation_log_id UUID;

COMMENT ON TABLE sleep_logs IS 'บันทึกการนอนหลับ';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sleep_logs' AND column_name = 'sleep_quality_score') THEN
    COMMENT ON COLUMN sleep_logs.sleep_quality_score IS 'คะแนนคุณภาพการนอน 1-5';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sleep_logs' AND column_name = 'sleep_issues') THEN
    COMMENT ON COLUMN sleep_logs.sleep_issues IS 'ปัญหาการนอน (array)';
  END IF;
END $$;

-- ========================================
-- Table: exercise_logs
-- ========================================
CREATE TABLE IF NOT EXISTS exercise_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  exercise_date DATE DEFAULT CURRENT_DATE,
  exercise_type VARCHAR(50),
  exercise_type_th VARCHAR(50),
  duration_minutes INTEGER,
  intensity VARCHAR(20),
  distance_meters INTEGER,
  calories_burned INTEGER,
  steps INTEGER,
  time_of_day VARCHAR(20),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  ai_confidence NUMERIC(4,3),
  raw_text TEXT,
  notes TEXT,
  activity_log_id UUID,
  conversation_log_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing exercise_logs table
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS exercise_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS exercise_type VARCHAR(50);
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS exercise_type_th VARCHAR(50);
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS intensity VARCHAR(20);
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS distance_meters INTEGER;
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS calories_burned INTEGER;
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS steps INTEGER;
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS time_of_day VARCHAR(20);
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3);
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS activity_log_id UUID;
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS conversation_log_id UUID;

COMMENT ON TABLE exercise_logs IS 'บันทึกการออกกำลังกาย';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exercise_logs' AND column_name = 'intensity') THEN
    COMMENT ON COLUMN exercise_logs.intensity IS 'ความหนัก: light (เบา), moderate (ปานกลาง), vigorous (หนัก)';
  END IF;
END $$;

-- ========================================
-- Table: mood_logs
-- ========================================
CREATE TABLE IF NOT EXISTS mood_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  patient_id UUID REFERENCES patient_profiles(id),
  mood VARCHAR(50) NOT NULL,
  mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 5),
  stress_level VARCHAR(20),
  stress_cause TEXT,
  energy_level VARCHAR(20),
  activities JSONB DEFAULT '[]'::jsonb,
  note TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ai_confidence NUMERIC(4,3),
  raw_text TEXT,
  logged_by_line_user_id VARCHAR(100),
  conversation_log_id UUID,
  activity_log_id UUID
);

-- Add missing columns to existing mood_logs table
ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS mood_score INTEGER;
ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS stress_level VARCHAR(20);
ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS stress_cause TEXT;
ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS energy_level VARCHAR(20);
ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS activities JSONB DEFAULT '[]'::jsonb;
ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3);
ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS logged_by_line_user_id VARCHAR(100);
ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS conversation_log_id UUID;
ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS activity_log_id UUID;

COMMENT ON TABLE mood_logs IS 'บันทึกอารมณ์และความรู้สึก';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mood_logs' AND column_name = 'mood_score') THEN
    COMMENT ON COLUMN mood_logs.mood_score IS 'คะแนนอารมณ์ 1-5 (1=แย่มาก, 5=ดีมาก)';
  END IF;
END $$;

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX IF NOT EXISTS idx_vitals_logs_patient ON vitals_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_logs_measured_at ON vitals_logs(measured_at);
CREATE INDEX IF NOT EXISTS idx_vitals_logs_patient_date ON vitals_logs(patient_id, measured_at);

CREATE INDEX IF NOT EXISTS idx_sleep_logs_patient ON sleep_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_date ON sleep_logs(sleep_date);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_patient_date ON sleep_logs(patient_id, sleep_date);

CREATE INDEX IF NOT EXISTS idx_exercise_logs_patient ON exercise_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_date ON exercise_logs(exercise_date);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_patient_date ON exercise_logs(patient_id, exercise_date);

CREATE INDEX IF NOT EXISTS idx_mood_logs_patient ON mood_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_mood_logs_timestamp ON mood_logs(timestamp);

-- ========================================
-- Row Level Security (RLS)
-- ========================================
ALTER TABLE vitals_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;

-- ========================================
-- End of Migration
-- ========================================
