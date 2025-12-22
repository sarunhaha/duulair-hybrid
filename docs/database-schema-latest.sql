-- OONJAI Database Schema (Latest)
-- Generated: 2025-12-22
-- WARNING: This schema is for context only and is not meant to be run.

-- =============================================
-- CORE TABLES
-- =============================================

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  line_user_id character varying NOT NULL UNIQUE,
  display_name character varying,
  picture_url text,
  language character varying DEFAULT 'th'::character varying,
  persona character varying DEFAULT 'friendly'::character varying,
  conditions jsonb DEFAULT '[]'::jsonb,
  timezone character varying DEFAULT 'Asia/Bangkok'::character varying,
  opt_in boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  primary_group_id uuid,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['patient'::character varying, 'caregiver'::character varying]::text[])),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE public.patient_profiles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  nickname character varying,
  birth_date date NOT NULL,
  gender character varying CHECK (gender::text = ANY (ARRAY['male'::character varying, 'female'::character varying, 'other'::character varying]::text[])),
  weight_kg numeric,
  height_cm numeric,
  blood_type character varying,
  chronic_diseases ARRAY,
  drug_allergies ARRAY,
  food_allergies ARRAY,
  address text,
  phone_number character varying,
  emergency_contact_name character varying,
  emergency_contact_phone character varying,
  emergency_contact_relation character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  medical_condition text,
  hospital_name character varying,
  hospital_address text,
  hospital_phone character varying,
  doctor_name character varying,
  doctor_phone character varying,
  medical_notes text,
  CONSTRAINT patient_profiles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.caregiver_profiles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  phone_number character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT caregiver_profiles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  line_group_id character varying NOT NULL UNIQUE,
  group_name character varying,
  primary_caregiver_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  active_patient_id uuid,
  CONSTRAINT groups_pkey PRIMARY KEY (id)
);

-- =============================================
-- HEALTH TRACKING TABLES
-- =============================================

CREATE TABLE public.medications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  patient_id uuid,
  name character varying NOT NULL,
  dosage character varying,
  dosage_amount numeric,
  dosage_unit character varying,
  dosage_form character varying,
  frequency character varying,
  times ARRAY,
  days_of_week ARRAY,
  time_slots jsonb DEFAULT '[]'::jsonb,
  instructions character varying,
  note text,
  active boolean DEFAULT true,
  reminder_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT medications_pkey PRIMARY KEY (id)
);

CREATE TABLE public.vitals_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  patient_id uuid,
  bp_systolic integer,
  bp_diastolic integer,
  heart_rate integer,
  glucose integer,
  weight numeric,
  temperature numeric,
  spo2 integer,
  notes text,
  measured_at timestamp with time zone DEFAULT now(),
  conversation_log_id uuid,
  activity_log_id uuid,
  source character varying DEFAULT 'manual'::character varying,
  measured_at_text character varying,
  ai_confidence numeric,
  raw_text text,
  logged_by_line_user_id character varying,
  logged_by_display_name character varying,
  CONSTRAINT vitals_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  patient_id uuid,
  group_id uuid,
  message_id character varying,
  task_type character varying NOT NULL,
  value text,
  metadata jsonb DEFAULT '{}'::jsonb,
  intent character varying,
  processing_result jsonb,
  timestamp timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  actor_line_user_id character varying,
  actor_display_name character varying,
  source character varying DEFAULT '1:1'::character varying,
  conversation_log_id uuid,
  ai_confidence numeric,
  raw_text text,
  health_event_id uuid,
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.symptoms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  activity_log_id uuid,
  conversation_log_id uuid,
  symptom_name character varying NOT NULL,
  symptom_name_en character varying,
  severity_1to5 integer CHECK (severity_1to5 >= 1 AND severity_1to5 <= 5),
  body_location character varying,
  body_location_th character varying,
  duration_text character varying,
  duration_minutes integer,
  started_at timestamp with time zone,
  time_of_day character varying,
  triggers text,
  associated_symptoms ARRAY,
  ai_confidence numeric,
  raw_text text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT symptoms_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sleep_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  activity_log_id uuid,
  conversation_log_id uuid,
  sleep_date date DEFAULT CURRENT_DATE,
  sleep_time time without time zone,
  wake_time time without time zone,
  sleep_hours numeric,
  sleep_quality character varying,
  sleep_quality_score integer CHECK (sleep_quality_score >= 1 AND sleep_quality_score <= 5),
  wake_ups integer DEFAULT 0,
  sleep_issues ARRAY,
  factors ARRAY,
  ai_confidence numeric,
  raw_text text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sleep_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.exercise_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  activity_log_id uuid,
  conversation_log_id uuid,
  exercise_date date DEFAULT CURRENT_DATE,
  exercise_type character varying,
  exercise_type_th character varying,
  duration_minutes integer,
  intensity character varying,
  distance_meters integer,
  calories_burned integer,
  steps integer,
  time_of_day character varying,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  ai_confidence numeric,
  raw_text text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exercise_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.mood_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  patient_id uuid,
  mood character varying NOT NULL,
  mood_score integer CHECK (mood_score >= 1 AND mood_score <= 5),
  note text,
  activities jsonb DEFAULT '[]'::jsonb,
  timestamp timestamp with time zone DEFAULT now(),
  conversation_log_id uuid,
  activity_log_id uuid,
  stress_level character varying,
  stress_cause text,
  energy_level character varying,
  ai_confidence numeric,
  raw_text text,
  logged_by_line_user_id character varying,
  CONSTRAINT mood_logs_pkey PRIMARY KEY (id)
);

-- =============================================
-- REMINDERS & NOTIFICATIONS
-- =============================================

CREATE TABLE public.reminders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL,
  type character varying NOT NULL,
  title character varying NOT NULL,
  time time without time zone NOT NULL,
  days ARRAY DEFAULT '{}'::text[],
  note text,
  custom_time time without time zone,
  days_of_week jsonb,
  frequency character varying DEFAULT 'daily'::character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reminders_pkey PRIMARY KEY (id)
);

CREATE TABLE public.health_goals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL UNIQUE,
  target_bp_systolic integer DEFAULT 120,
  target_bp_diastolic integer DEFAULT 80,
  target_water_ml integer DEFAULT 2000,
  target_exercise_minutes integer DEFAULT 30,
  target_sleep_hours numeric DEFAULT 7,
  target_water_glasses integer DEFAULT 8,
  target_steps integer DEFAULT 6000,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT health_goals_pkey PRIMARY KEY (id)
);

-- =============================================
-- GROUP & RELATIONSHIP TABLES
-- =============================================

CREATE TABLE public.group_members (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  line_user_id character varying NOT NULL,
  display_name character varying,
  picture_url text,
  role character varying,
  is_active boolean DEFAULT true,
  joined_at timestamp without time zone DEFAULT now(),
  left_at timestamp without time zone,
  CONSTRAINT group_members_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_patients (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  added_by_caregiver_id uuid,
  added_at timestamp without time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT group_patients_pkey PRIMARY KEY (id)
);

CREATE TABLE public.patient_caregivers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL,
  caregiver_id uuid NOT NULL,
  relationship character varying,
  is_primary boolean DEFAULT false,
  access_level character varying DEFAULT 'full'::character varying,
  status character varying DEFAULT 'pending'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT patient_caregivers_pkey PRIMARY KEY (id)
);

-- =============================================
-- CONVERSATION & LOGS
-- =============================================

CREATE TABLE public.conversation_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  patient_id uuid,
  group_id uuid,
  role character varying NOT NULL,
  text text NOT NULL,
  intent character varying,
  flags jsonb DEFAULT '[]'::jsonb,
  timestamp timestamp with time zone DEFAULT now(),
  message_id character varying,
  reply_token character varying,
  media_url text,
  media_type character varying,
  ai_extracted_data jsonb,
  ai_confidence numeric,
  ai_model character varying,
  source character varying DEFAULT '1:1'::character varying,
  CONSTRAINT conversation_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.health_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  conversation_log_id uuid,
  activity_log_id uuid,
  event_type character varying NOT NULL,
  event_subtype character varying,
  event_date date DEFAULT CURRENT_DATE,
  event_time time without time zone,
  event_timestamp timestamp with time zone DEFAULT now(),
  reference_table character varying,
  reference_id uuid,
  raw_text text,
  ai_confidence numeric,
  extraction_model character varying,
  summary_text text,
  summary_json jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT health_events_pkey PRIMARY KEY (id)
);

-- =============================================
-- REPORTS & SUMMARIES
-- =============================================

CREATE TABLE public.daily_patient_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  summary_date date NOT NULL,
  bp_readings_count integer DEFAULT 0,
  bp_systolic_avg numeric,
  medications_scheduled integer DEFAULT 0,
  medications_taken integer DEFAULT 0,
  medication_compliance_percent numeric,
  water_intake_ml integer DEFAULT 0,
  water_goal_ml integer DEFAULT 2000,
  activities_count integer DEFAULT 0,
  exercise_minutes integer DEFAULT 0,
  has_data boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_patient_summaries_pkey PRIMARY KEY (id)
);

CREATE TABLE public.daily_reports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  report_date date NOT NULL,
  mood_summary jsonb,
  medication_compliance numeric,
  vitals_summary jsonb,
  ai_insights text,
  risk_level character varying DEFAULT 'normal'::character varying,
  flex_message_json jsonb,
  sent_to_caregivers boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_reports_pkey PRIMARY KEY (id)
);

-- =============================================
-- SUPPORTING TABLES
-- =============================================

CREATE TABLE public.link_codes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL,
  code character varying NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT link_codes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.allergies (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL,
  allergy_type character varying NOT NULL,
  allergen_name character varying NOT NULL,
  severity character varying,
  reaction_symptoms text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT allergies_pkey PRIMARY KEY (id)
);

CREATE TABLE public.emergency_contacts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL,
  name character varying NOT NULL,
  relationship character varying,
  phone_number character varying NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT emergency_contacts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.medical_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL,
  event_date date NOT NULL,
  event_type character varying NOT NULL,
  description text NOT NULL,
  hospital_name character varying,
  doctor_name character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT medical_history_pkey PRIMARY KEY (id)
);

CREATE TABLE public.app_config (
  key text NOT NULL,
  value text NOT NULL,
  CONSTRAINT app_config_pkey PRIMARY KEY (key)
);

CREATE TABLE public.schema_migrations (
  version character varying NOT NULL,
  description text,
  executed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);
