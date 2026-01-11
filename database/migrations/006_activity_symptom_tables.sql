-- ========================================
-- Activity Logs & Symptoms Tables
-- Migration: 006
-- Created: 2026-01-11
-- Description: ตาราง Activity Logs, Symptoms, และ Health Events
-- ========================================

-- ========================================
-- Table: activity_logs
-- ========================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id),
  group_id UUID,
  message_id VARCHAR(100),
  task_type VARCHAR(50) NOT NULL,
  value TEXT,
  intent VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  processing_result JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  actor_line_user_id VARCHAR(100),
  actor_display_name VARCHAR(255),
  source VARCHAR(20) DEFAULT '1:1',
  ai_confidence NUMERIC(4,3),
  raw_text TEXT,
  conversation_log_id UUID,
  health_event_id UUID
);

-- Add missing columns to existing activity_logs table
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS message_id VARCHAR(100);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS intent VARCHAR(50);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS processing_result JSONB;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS actor_line_user_id VARCHAR(100);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS actor_display_name VARCHAR(255);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT '1:1';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS conversation_log_id UUID;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS health_event_id UUID;

COMMENT ON TABLE activity_logs IS 'บันทึกกิจกรรมสุขภาพทั้งหมด (unified activity log)';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'task_type') THEN
    COMMENT ON COLUMN activity_logs.task_type IS 'ประเภทกิจกรรม: medication, vitals, water, exercise, symptom, sleep, mood';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'source') THEN
    COMMENT ON COLUMN activity_logs.source IS 'แหล่งที่มา: 1:1 (แชทส่วนตัว), group (กลุ่ม)';
  END IF;
END $$;

-- ========================================
-- Table: symptoms
-- ========================================
CREATE TABLE IF NOT EXISTS symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  symptom_name VARCHAR(100) NOT NULL,
  symptom_name_en VARCHAR(100),
  severity_1to5 INTEGER CHECK (severity_1to5 >= 1 AND severity_1to5 <= 5),
  body_location VARCHAR(50),
  body_location_th VARCHAR(50),
  duration_text VARCHAR(100),
  duration_minutes INTEGER,
  started_at TIMESTAMP WITH TIME ZONE,
  time_of_day VARCHAR(20),
  triggers TEXT,
  associated_symptoms TEXT[],
  notes TEXT,
  ai_confidence NUMERIC(4,3),
  raw_text TEXT,
  activity_log_id UUID,
  conversation_log_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing symptoms table
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS symptom_name_en VARCHAR(100);
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS severity_1to5 INTEGER;
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS body_location VARCHAR(50);
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS body_location_th VARCHAR(50);
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS duration_text VARCHAR(100);
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS time_of_day VARCHAR(20);
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS triggers TEXT;
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS associated_symptoms TEXT[];
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3);
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS activity_log_id UUID;
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS conversation_log_id UUID;
ALTER TABLE symptoms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMENT ON TABLE symptoms IS 'บันทึกอาการผิดปกติ';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'symptoms' AND column_name = 'severity_1to5') THEN
    COMMENT ON COLUMN symptoms.severity_1to5 IS 'ความรุนแรง 1-5 (1=เบา, 5=รุนแรงมาก)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'symptoms' AND column_name = 'associated_symptoms') THEN
    COMMENT ON COLUMN symptoms.associated_symptoms IS 'อาการร่วมอื่นๆ (array)';
  END IF;
END $$;

-- ========================================
-- Table: health_events
-- ========================================
CREATE TABLE IF NOT EXISTS health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  event_type VARCHAR(50) NOT NULL,
  event_subtype VARCHAR(50),
  event_date DATE DEFAULT CURRENT_DATE,
  event_time TIME,
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reference_table VARCHAR(50),
  reference_id UUID,
  raw_text TEXT,
  ai_confidence NUMERIC(4,3),
  extraction_model VARCHAR(50),
  summary_text TEXT,
  summary_json JSONB,
  conversation_log_id UUID,
  activity_log_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing health_events table
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS event_subtype VARCHAR(50);
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS event_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS event_time TIME;
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS reference_table VARCHAR(50);
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3);
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS extraction_model VARCHAR(50);
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS summary_text TEXT;
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS summary_json JSONB;
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS conversation_log_id UUID;
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS activity_log_id UUID;

COMMENT ON TABLE health_events IS 'เหตุการณ์สุขภาพ (unified health event tracking)';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_events' AND column_name = 'reference_table') THEN
    COMMENT ON COLUMN health_events.reference_table IS 'ตารางที่เก็บรายละเอียด: vitals_logs, symptoms, sleep_logs, etc.';
  END IF;
END $$;

-- ========================================
-- Table: conversation_logs
-- ========================================
CREATE TABLE IF NOT EXISTS conversation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  patient_id UUID REFERENCES patient_profiles(id),
  group_id UUID,
  role VARCHAR(20) NOT NULL,
  text TEXT NOT NULL,
  intent VARCHAR(50),
  flags JSONB DEFAULT '[]'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_id VARCHAR(100),
  reply_token VARCHAR(100),
  media_url TEXT,
  media_type VARCHAR(20),
  ai_extracted_data JSONB,
  ai_confidence NUMERIC(4,3),
  ai_model VARCHAR(50),
  source VARCHAR(20) DEFAULT '1:1'
);

-- Add missing columns to existing conversation_logs table
ALTER TABLE conversation_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE conversation_logs ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE conversation_logs ADD COLUMN IF NOT EXISTS intent VARCHAR(50);
ALTER TABLE conversation_logs ADD COLUMN IF NOT EXISTS flags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE conversation_logs ADD COLUMN IF NOT EXISTS message_id VARCHAR(100);
ALTER TABLE conversation_logs ADD COLUMN IF NOT EXISTS reply_token VARCHAR(100);
ALTER TABLE conversation_logs ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE conversation_logs ADD COLUMN IF NOT EXISTS media_type VARCHAR(20);
ALTER TABLE conversation_logs ADD COLUMN IF NOT EXISTS ai_extracted_data JSONB;
ALTER TABLE conversation_logs ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3);
ALTER TABLE conversation_logs ADD COLUMN IF NOT EXISTS ai_model VARCHAR(50);
ALTER TABLE conversation_logs ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT '1:1';

COMMENT ON TABLE conversation_logs IS 'บันทึกการสนทนาทั้งหมด';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_logs' AND column_name = 'role') THEN
    COMMENT ON COLUMN conversation_logs.role IS 'บทบาท: user (ผู้ใช้), assistant (บอท), system';
  END IF;
END $$;

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX IF NOT EXISTS idx_activity_logs_patient ON activity_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_type ON activity_logs(task_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_logs_patient_date ON activity_logs(patient_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_logs_group ON activity_logs(group_id);

CREATE INDEX IF NOT EXISTS idx_symptoms_patient ON symptoms(patient_id);
CREATE INDEX IF NOT EXISTS idx_symptoms_created ON symptoms(created_at);
CREATE INDEX IF NOT EXISTS idx_symptoms_patient_date ON symptoms(patient_id, created_at);

CREATE INDEX IF NOT EXISTS idx_health_events_patient ON health_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_health_events_type ON health_events(event_type);
CREATE INDEX IF NOT EXISTS idx_health_events_date ON health_events(event_date);
CREATE INDEX IF NOT EXISTS idx_health_events_patient_date ON health_events(patient_id, event_date);

CREATE INDEX IF NOT EXISTS idx_conversation_logs_patient ON conversation_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_user ON conversation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_timestamp ON conversation_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_group ON conversation_logs(group_id);

-- ========================================
-- Row Level Security (RLS)
-- ========================================
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_logs ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Triggers: updated_at (only create if not exists)
-- ========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_symptoms_updated_at') THEN
    CREATE TRIGGER update_symptoms_updated_at BEFORE UPDATE ON symptoms
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ========================================
-- End of Migration
-- ========================================
