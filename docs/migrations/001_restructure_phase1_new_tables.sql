-- =====================================================
-- OONJ.AI Schema Restructure - Phase 1: Create New Tables
-- Version: 001
-- Date: 2025-12-18
-- Description: สร้าง tables ใหม่สำหรับ AI extraction pipeline
-- =====================================================

-- 1. สร้าง symptoms table (อาการ)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.symptoms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  activity_log_id uuid,              -- link กลับไป activity_logs
  conversation_log_id uuid,          -- link กลับไป conversation_logs

  -- Symptom Data
  symptom_name character varying NOT NULL,  -- 'ปวดหัว', 'มึนหัว', 'ไอ'
  symptom_name_en character varying,        -- 'headache', 'dizziness', 'cough'
  severity_1to5 integer CHECK (severity_1to5 >= 1 AND severity_1to5 <= 5),
  body_location character varying,          -- 'head', 'back', 'chest'
  body_location_th character varying,       -- 'หัว', 'หลัง', 'หน้าอก'

  -- Duration
  duration_text character varying,          -- '2 วัน', '3-4 สัปดาห์'
  duration_minutes integer,                 -- parsed duration
  started_at timestamp with time zone,

  -- Context
  time_of_day character varying,            -- 'morning', 'afternoon', 'evening', 'night'
  triggers text,                            -- สาเหตุที่เป็นไปได้
  associated_symptoms text[],               -- อาการร่วม

  -- AI Metadata
  ai_confidence decimal(3,2),               -- 0.00 - 1.00
  raw_text text,                            -- ข้อความต้นฉบับ

  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT symptoms_pkey PRIMARY KEY (id),
  CONSTRAINT symptoms_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patient_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_symptoms_patient_id ON symptoms(patient_id);
CREATE INDEX IF NOT EXISTS idx_symptoms_name ON symptoms(symptom_name);
CREATE INDEX IF NOT EXISTS idx_symptoms_created_at ON symptoms(created_at DESC);

COMMENT ON TABLE public.symptoms IS 'เก็บข้อมูลอาการที่ extract จากบทสนทนา';

-- 2. สร้าง sleep_logs table (การนอน)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  activity_log_id uuid,
  conversation_log_id uuid,

  -- Sleep Data
  sleep_date date DEFAULT CURRENT_DATE,
  sleep_time time without time zone,        -- เวลาเข้านอน
  wake_time time without time zone,         -- เวลาตื่น
  sleep_hours decimal(3,1),                 -- ชั่วโมงนอน

  -- Quality
  sleep_quality character varying           -- 'poor', 'fair', 'good', 'excellent'
    CHECK (sleep_quality IN ('poor', 'fair', 'good', 'excellent')),
  sleep_quality_score integer               -- 1-5
    CHECK (sleep_quality_score >= 1 AND sleep_quality_score <= 5),
  wake_ups integer DEFAULT 0,               -- จำนวนครั้งที่ตื่นกลางคืน

  -- Context
  sleep_issues text[],                      -- ['นอนไม่หลับ', 'ตื่นกลางดึก', 'ฝันร้าย']
  factors text[],                           -- ['เครียด', 'กาแฟ', 'ออกกำลังกาย']

  -- AI Metadata
  ai_confidence decimal(3,2),
  raw_text text,

  notes text,
  created_at timestamp with time zone DEFAULT now(),

  CONSTRAINT sleep_logs_pkey PRIMARY KEY (id),
  CONSTRAINT sleep_logs_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patient_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sleep_logs_patient_date ON sleep_logs(patient_id, sleep_date DESC);

COMMENT ON TABLE public.sleep_logs IS 'เก็บข้อมูลการนอนหลับ';

-- 3. สร้าง exercise_logs table (การออกกำลังกาย)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.exercise_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  activity_log_id uuid,
  conversation_log_id uuid,

  -- Exercise Data
  exercise_date date DEFAULT CURRENT_DATE,
  exercise_type character varying,          -- 'walk', 'gym', 'swim', 'yoga', 'run'
  exercise_type_th character varying,       -- 'เดิน', 'ฟิตเนส', 'ว่ายน้ำ'

  -- Duration & Intensity
  duration_minutes integer,
  intensity character varying               -- 'light', 'medium', 'intense'
    CHECK (intensity IN ('light', 'medium', 'intense')),

  -- Additional Data
  distance_meters integer,                  -- ระยะทาง (ถ้ามี)
  calories_burned integer,                  -- แคลอรี่ (ถ้ามี)
  steps integer,                            -- จำนวนก้าว (ถ้ามี)

  -- Time Context
  time_of_day character varying,            -- 'morning', 'afternoon', 'evening'
  started_at timestamp with time zone,
  ended_at timestamp with time zone,

  -- AI Metadata
  ai_confidence decimal(3,2),
  raw_text text,

  notes text,
  created_at timestamp with time zone DEFAULT now(),

  CONSTRAINT exercise_logs_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_logs_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patient_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exercise_logs_patient_date ON exercise_logs(patient_id, exercise_date DESC);

COMMENT ON TABLE public.exercise_logs IS 'เก็บข้อมูลการออกกำลังกาย';

-- 4. สร้าง health_events table (Core Linking Table)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.health_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  conversation_log_id uuid,                 -- link ไป raw conversation
  activity_log_id uuid,                     -- link ไป activity_logs (ถ้ามี)

  -- Event Classification
  event_type character varying NOT NULL,
  -- 'symptom', 'vital', 'mood', 'sleep', 'exercise',
  -- 'medication', 'water', 'food', 'medical_record'

  event_subtype character varying,          -- e.g., 'blood_pressure', 'headache'

  -- Timing
  event_date date DEFAULT CURRENT_DATE,
  event_time time without time zone,
  event_timestamp timestamp with time zone DEFAULT now(),

  -- Reference to specific table
  reference_table character varying,        -- 'symptoms', 'vitals_logs', 'sleep_logs', etc.
  reference_id uuid,                        -- ID in that table

  -- AI Extraction Info
  raw_text text,                            -- ข้อความต้นฉบับที่ extract มา
  ai_confidence decimal(3,2),               -- 0.00 - 1.00
  extraction_model character varying,       -- 'claude-3-sonnet', etc.

  -- Quick Summary (denormalized for fast queries)
  summary_text text,                        -- "ปวดหัว ระดับ 3/5"
  summary_json jsonb,                       -- key values for quick access

  created_at timestamp with time zone DEFAULT now(),

  CONSTRAINT health_events_pkey PRIMARY KEY (id),
  CONSTRAINT health_events_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patient_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_health_events_patient_date ON health_events(patient_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_events_type ON health_events(event_type);
CREATE INDEX IF NOT EXISTS idx_health_events_reference ON health_events(reference_table, reference_id);
CREATE INDEX IF NOT EXISTS idx_health_events_created_at ON health_events(created_at DESC);

COMMENT ON TABLE public.health_events IS 'Linking table เชื่อม conversation กับ structured health data';

-- 5. Record migration
-- =====================================================
INSERT INTO public.schema_migrations (version, description)
VALUES ('001', 'Create new tables: symptoms, sleep_logs, exercise_logs, health_events')
ON CONFLICT (version) DO NOTHING;
