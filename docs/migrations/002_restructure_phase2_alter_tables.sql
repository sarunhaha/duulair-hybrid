-- =====================================================
-- OONJ.AI Schema Restructure - Phase 2: Alter Existing Tables
-- Version: 002
-- Date: 2025-12-18
-- Description: ปรับ tables ที่มีอยู่เพื่อรองรับ AI extraction
-- =====================================================

-- 1. Alter conversation_logs - เพิ่ม fields สำหรับ AI extraction
-- =====================================================
ALTER TABLE public.conversation_logs
ADD COLUMN IF NOT EXISTS patient_id uuid,
ADD COLUMN IF NOT EXISTS group_id uuid,
ADD COLUMN IF NOT EXISTS message_id character varying,          -- LINE message ID
ADD COLUMN IF NOT EXISTS reply_token character varying,
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_type character varying,          -- 'image', 'audio', 'video', 'file'
ADD COLUMN IF NOT EXISTS ai_extracted_data jsonb,               -- structured data ที่ extract ได้
ADD COLUMN IF NOT EXISTS ai_confidence decimal(3,2),            -- overall confidence
ADD COLUMN IF NOT EXISTS ai_model character varying,            -- model ที่ใช้ extract
ADD COLUMN IF NOT EXISTS source character varying DEFAULT '1:1' -- '1:1' or 'group'
  CHECK (source IN ('1:1', 'group'));

-- Add foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'conversation_logs_patient_id_fkey'
  ) THEN
    ALTER TABLE public.conversation_logs
    ADD CONSTRAINT conversation_logs_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'conversation_logs_group_id_fkey'
  ) THEN
    ALTER TABLE public.conversation_logs
    ADD CONSTRAINT conversation_logs_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_conversation_logs_patient_id ON conversation_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_group_id ON conversation_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_timestamp ON conversation_logs(timestamp DESC);

COMMENT ON COLUMN public.conversation_logs.ai_extracted_data IS 'Structured JSON ที่ AI extract ได้จากข้อความ';
COMMENT ON COLUMN public.conversation_logs.ai_confidence IS 'ความมั่นใจของ AI ในการ extract (0.00-1.00)';

-- 2. Alter vitals_logs - เพิ่ม fields สำหรับ AI และ patient_id
-- =====================================================
ALTER TABLE public.vitals_logs
ADD COLUMN IF NOT EXISTS patient_id uuid,
ADD COLUMN IF NOT EXISTS conversation_log_id uuid,
ADD COLUMN IF NOT EXISTS activity_log_id uuid,
ADD COLUMN IF NOT EXISTS source character varying DEFAULT 'manual'  -- 'manual', 'text', 'image', 'device'
  CHECK (source IN ('manual', 'text', 'image', 'device')),
ADD COLUMN IF NOT EXISTS measured_at_text character varying,       -- "เมื่อเช้า 8:30 น."
ADD COLUMN IF NOT EXISTS ai_confidence decimal(3,2),
ADD COLUMN IF NOT EXISTS raw_text text,
ADD COLUMN IF NOT EXISTS logged_by_line_user_id character varying,
ADD COLUMN IF NOT EXISTS logged_by_display_name character varying;

-- Add foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'vitals_logs_patient_id_fkey'
  ) THEN
    ALTER TABLE public.vitals_logs
    ADD CONSTRAINT vitals_logs_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'vitals_logs_conversation_log_id_fkey'
  ) THEN
    ALTER TABLE public.vitals_logs
    ADD CONSTRAINT vitals_logs_conversation_log_id_fkey
    FOREIGN KEY (conversation_log_id) REFERENCES public.conversation_logs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_vitals_logs_patient_id ON vitals_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_logs_measured_at ON vitals_logs(measured_at DESC);

-- 3. Alter mood_logs - เพิ่ม fields สำหรับ AI
-- =====================================================
ALTER TABLE public.mood_logs
ADD COLUMN IF NOT EXISTS patient_id uuid,
ADD COLUMN IF NOT EXISTS conversation_log_id uuid,
ADD COLUMN IF NOT EXISTS activity_log_id uuid,
ADD COLUMN IF NOT EXISTS stress_level character varying           -- 'low', 'medium', 'high'
  CHECK (stress_level IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS stress_cause text,
ADD COLUMN IF NOT EXISTS energy_level character varying           -- 'low', 'medium', 'high'
  CHECK (energy_level IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS ai_confidence decimal(3,2),
ADD COLUMN IF NOT EXISTS raw_text text,
ADD COLUMN IF NOT EXISTS logged_by_line_user_id character varying;

-- Add foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'mood_logs_patient_id_fkey'
  ) THEN
    ALTER TABLE public.mood_logs
    ADD CONSTRAINT mood_logs_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_mood_logs_patient_id ON mood_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_mood_logs_timestamp ON mood_logs(timestamp DESC);

-- 4. Alter activity_logs - เพิ่ม fields สำหรับ AI extraction
-- =====================================================
ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS conversation_log_id uuid,
ADD COLUMN IF NOT EXISTS ai_confidence decimal(3,2),
ADD COLUMN IF NOT EXISTS raw_text text,
ADD COLUMN IF NOT EXISTS health_event_id uuid;

-- Add foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activity_logs_conversation_log_id_fkey'
  ) THEN
    ALTER TABLE public.activity_logs
    ADD CONSTRAINT activity_logs_conversation_log_id_fkey
    FOREIGN KEY (conversation_log_id) REFERENCES public.conversation_logs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Alter health_goals - เพิ่ม goals สำหรับ sleep และ exercise
-- =====================================================
ALTER TABLE public.health_goals
ADD COLUMN IF NOT EXISTS target_sleep_hours decimal(3,1) DEFAULT 7,
ADD COLUMN IF NOT EXISTS target_water_glasses integer DEFAULT 8,
ADD COLUMN IF NOT EXISTS target_steps integer DEFAULT 6000;

-- 6. Add foreign keys to new tables (symptoms, sleep_logs, exercise_logs)
-- =====================================================
-- Add FK from symptoms to conversation_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'symptoms_conversation_log_id_fkey'
  ) THEN
    ALTER TABLE public.symptoms
    ADD CONSTRAINT symptoms_conversation_log_id_fkey
    FOREIGN KEY (conversation_log_id) REFERENCES public.conversation_logs(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'symptoms_activity_log_id_fkey'
  ) THEN
    ALTER TABLE public.symptoms
    ADD CONSTRAINT symptoms_activity_log_id_fkey
    FOREIGN KEY (activity_log_id) REFERENCES public.activity_logs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add FK from sleep_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sleep_logs_conversation_log_id_fkey'
  ) THEN
    ALTER TABLE public.sleep_logs
    ADD CONSTRAINT sleep_logs_conversation_log_id_fkey
    FOREIGN KEY (conversation_log_id) REFERENCES public.conversation_logs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add FK from exercise_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'exercise_logs_conversation_log_id_fkey'
  ) THEN
    ALTER TABLE public.exercise_logs
    ADD CONSTRAINT exercise_logs_conversation_log_id_fkey
    FOREIGN KEY (conversation_log_id) REFERENCES public.conversation_logs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add FK from health_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'health_events_conversation_log_id_fkey'
  ) THEN
    ALTER TABLE public.health_events
    ADD CONSTRAINT health_events_conversation_log_id_fkey
    FOREIGN KEY (conversation_log_id) REFERENCES public.conversation_logs(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'health_events_activity_log_id_fkey'
  ) THEN
    ALTER TABLE public.health_events
    ADD CONSTRAINT health_events_activity_log_id_fkey
    FOREIGN KEY (activity_log_id) REFERENCES public.activity_logs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Record migration
-- =====================================================
INSERT INTO public.schema_migrations (version, description)
VALUES ('002', 'Alter existing tables for AI extraction support')
ON CONFLICT (version) DO NOTHING;
