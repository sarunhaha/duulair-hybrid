# OONJ.AI Architecture Enhancement

## 🎯 Project Goal

ยกระดับ OONJ.AI จาก **"ระบบบันทึกข้อมูลแบบกรอก"** เป็น **"ระบบบันทึกสุขภาพผ่านบทสนทนาธรรมชาติ"** โดยใช้ AI extract ข้อมูลจากการพูดคุย

---

## 📈 Implementation Progress (Last Updated: 2025-12-20)

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1: Database** | ✅ COMPLETE | All migrations done, 4 new tables + altered existing |
| **Phase 2: AI Extraction** | ✅ COMPLETE | All code in `src/lib/ai/` and `src/lib/health/` |
| **Phase 3: Webhook** | ⏳ IN PROGRESS | Pipeline exists but NOT integrated into webhook |
| **Phase 4: Testing** | ⏳ PENDING | Waiting for Phase 3 completion |

### Quick Access - Created Files:
```
src/lib/ai/
├── index.ts              # runHealthExtractionPipeline() - MAIN ENTRY
├── extraction.ts         # extractHealthData()
├── processors/index.ts   # processExtractedData() + all processors
└── prompts/extraction.ts # EXTRACTION_SYSTEM_PROMPT

src/lib/health/
└── event-creator.ts      # createHealthEvent(), checkForAbnormalValues()

src/types/
└── health.types.ts       # All types

src/services/
└── supabase.service.ts   # All CRUD methods (saveSymptom, saveSleepLog, etc.)
```

### Next Step:
**Integrate `runHealthExtractionPipeline()` into `src/index.ts` handleTextMessage()**

---

## 📊 Current State Analysis

### Tech Stack ปัจจุบัน ✅
- **Frontend/Backend**: Next.js (API Routes)
- **Database**: Supabase (PostgreSQL)
- **Messaging**: LINE Messaging API
- **AI**: Claude API
- **Hosting**: Vercel
- **No N8N** - ใช้ Next.js API Routes + Vercel Cron

### Existing Schema (มีอยู่แล้ว - 35+ tables)

#### ✅ Core Tables ที่ใช้ได้เลย
```
users                    → LINE users (line_user_id, display_name, role)
patient_profiles         → ข้อมูลผู้ป่วย (name, birth_date, gender, chronic_diseases)
caregiver_profiles       → ข้อมูล caregiver
groups                   → LINE groups
group_members            → สมาชิกในกลุ่ม
group_patients           → ผู้ป่วยในกลุ่ม
```

#### ✅ Health Data Tables ที่มีแล้ว
```
vitals_logs              → BP, HR, glucose, weight, temperature, spo2
mood_logs                → mood, mood_score, note
medication_logs          → medication tracking
medications              → รายการยา
water_intake_logs        → การดื่มน้ำ
```

#### ✅ System Tables ที่มีแล้ว
```
activity_logs            → ทุก activity/event
conversation_logs        → บทสนทนา (role, text, intent)
daily_reports            → รายงานรายวัน
daily_patient_summaries  → สรุปข้อมูลรายวัน
alert_logs               → การแจ้งเตือน
reminders                → การเตือน
medical_history          → ประวัติการรักษา
allergies                → ข้อมูลแพ้ยา/อาหาร
```

---

## 🔴 Gap Analysis - สิ่งที่ขาด

### 1. ❌ symptoms table (อาการ)
ปัจจุบันเก็บใน `activity_logs.metadata` เป็น JSONB → ควรแยกเป็น table

### 2. ❌ sleep_logs table (การนอน)
ไม่มี table สำหรับเก็บข้อมูลการนอนโดยเฉพาะ

### 3. ❌ exercise_logs table (การออกกำลังกาย)
ไม่มี table สำหรับเก็บข้อมูลการออกกำลังกายโดยเฉพาะ

### 4. ❌ health_events table (Linking table)
ไม่มี table กลางเชื่อม conversation → structured health data

### 5. ❌ AI Extraction Pipeline
`conversation_logs` เก็บ text + intent แต่ไม่มี:
- AI confidence score
- Extracted data reference
- Link กลับไป health data ที่ถูกสร้าง

### 6. ⚠️ conversation_logs ต้องเพิ่ม fields
- `media_url` - รูปภาพ/ไฟล์
- `media_type` - ประเภท media
- `ai_extracted_data` - ข้อมูลที่ AI extract ได้
- `ai_confidence` - ความมั่นใจของ AI

---

## 🆕 Schema Changes Required

### Option A: Minimal Changes (แนะนำสำหรับ MVP)

เพิ่มแค่ tables ที่จำเป็น และ extend tables ที่มีอยู่

#### 1. เพิ่ม `symptoms` table

```sql
CREATE TABLE public.symptoms (
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
    REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
  CONSTRAINT symptoms_activity_log_id_fkey FOREIGN KEY (activity_log_id) 
    REFERENCES public.activity_logs(id),
  CONSTRAINT symptoms_conversation_log_id_fkey FOREIGN KEY (conversation_log_id) 
    REFERENCES public.conversation_logs(id)
);

CREATE INDEX idx_symptoms_patient_id ON symptoms(patient_id);
CREATE INDEX idx_symptoms_name ON symptoms(symptom_name);
CREATE INDEX idx_symptoms_created_at ON symptoms(created_at DESC);
```

#### 2. เพิ่ม `sleep_logs` table

```sql
CREATE TABLE public.sleep_logs (
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

CREATE INDEX idx_sleep_logs_patient_date ON sleep_logs(patient_id, sleep_date DESC);
```

#### 3. เพิ่ม `exercise_logs` table

```sql
CREATE TABLE public.exercise_logs (
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

CREATE INDEX idx_exercise_logs_patient_date ON exercise_logs(patient_id, exercise_date DESC);
```

#### 4. เพิ่ม `health_events` table (Core Linking Table)

```sql
CREATE TABLE public.health_events (
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
    REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
  CONSTRAINT health_events_conversation_log_id_fkey FOREIGN KEY (conversation_log_id) 
    REFERENCES public.conversation_logs(id),
  CONSTRAINT health_events_activity_log_id_fkey FOREIGN KEY (activity_log_id) 
    REFERENCES public.activity_logs(id)
);

CREATE INDEX idx_health_events_patient_date ON health_events(patient_id, event_date DESC);
CREATE INDEX idx_health_events_type ON health_events(event_type);
CREATE INDEX idx_health_events_reference ON health_events(reference_table, reference_id);
```

#### 5. Alter `conversation_logs` - เพิ่ม fields

```sql
ALTER TABLE public.conversation_logs 
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_type character varying,  -- 'image', 'audio', 'video', 'file'
ADD COLUMN IF NOT EXISTS ai_extracted_data jsonb,       -- structured data ที่ extract ได้
ADD COLUMN IF NOT EXISTS ai_confidence decimal(3,2),    -- overall confidence
ADD COLUMN IF NOT EXISTS reply_token character varying,
ADD COLUMN IF NOT EXISTS message_id character varying,
ADD COLUMN IF NOT EXISTS patient_id uuid;

-- Add foreign key if not exists
ALTER TABLE public.conversation_logs
ADD CONSTRAINT conversation_logs_patient_id_fkey 
FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id);

-- Add index
CREATE INDEX IF NOT EXISTS idx_conversation_logs_patient_id 
ON conversation_logs(patient_id, timestamp DESC);
```

#### 6. Alter `vitals_logs` - เพิ่ม fields สำหรับ AI

```sql
ALTER TABLE public.vitals_logs
ADD COLUMN IF NOT EXISTS patient_id uuid,
ADD COLUMN IF NOT EXISTS conversation_log_id uuid,
ADD COLUMN IF NOT EXISTS source character varying DEFAULT 'manual',  -- 'manual', 'text', 'image', 'device'
ADD COLUMN IF NOT EXISTS measured_at_text character varying,         -- "เมื่อเช้า 8:30 น."
ADD COLUMN IF NOT EXISTS ai_confidence decimal(3,2),
ADD COLUMN IF NOT EXISTS raw_text text;

-- Add foreign keys
ALTER TABLE public.vitals_logs
ADD CONSTRAINT vitals_logs_patient_id_fkey 
FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id);

ALTER TABLE public.vitals_logs
ADD CONSTRAINT vitals_logs_conversation_log_id_fkey 
FOREIGN KEY (conversation_log_id) REFERENCES public.conversation_logs(id);
```

#### 7. Alter `mood_logs` - เพิ่ม fields

```sql
ALTER TABLE public.mood_logs
ADD COLUMN IF NOT EXISTS patient_id uuid,
ADD COLUMN IF NOT EXISTS conversation_log_id uuid,
ADD COLUMN IF NOT EXISTS stress_level character varying,    -- 'low', 'medium', 'high'
ADD COLUMN IF NOT EXISTS stress_cause text,
ADD COLUMN IF NOT EXISTS energy_level character varying,    -- 'low', 'medium', 'high'
ADD COLUMN IF NOT EXISTS ai_confidence decimal(3,2),
ADD COLUMN IF NOT EXISTS raw_text text;

-- Add foreign keys
ALTER TABLE public.mood_logs
ADD CONSTRAINT mood_logs_patient_id_fkey 
FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id);
```

---

## 🔄 Data Flow Architecture

### New Conversation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. LINE Webhook receives message                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Save to conversation_logs (raw)                             │
│     - role: 'user'                                              │
│     - text: original message                                    │
│     - media_url: if image/file                                  │
│     - patient_id: resolved from line_user_id                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. AI Extraction (Claude)                                      │
│     Input: message text + conversation history                  │
│     Output: structured JSON with health data                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Update conversation_logs                                    │
│     - ai_extracted_data: extraction result                      │
│     - ai_confidence: confidence score                           │
│     - intent: classified intent                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Create health_events + Insert to specialized tables         │
│                                                                 │
│  For each extracted data type:                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ symptoms    → symptoms table                            │   │
│  │ vitals      → vitals_logs table                         │   │
│  │ mood        → mood_logs table                           │   │
│  │ sleep       → sleep_logs table                          │   │
│  │ exercise    → exercise_logs table                       │   │
│  │ medication  → medication_logs table                     │   │
│  │ water       → water_intake_logs table                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  + Create health_events record linking conversation → data     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Generate AI Response                                        │
│     - Acknowledge what was recorded                             │
│     - Ask follow-up questions if needed                         │
│     - Provide relevant health tips                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Save bot response to conversation_logs                      │
│     - role: 'assistant'                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. Send response via LINE API                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🤖 AI Extraction Prompt

```typescript
const EXTRACTION_SYSTEM_PROMPT = `
คุณคือ Health Data Extractor สำหรับระบบดูแลสุขภาพ "อุ่นใจ"
วิเคราะห์ข้อความภาษาไทยจากผู้ใช้และ extract เป็น structured data

## ข้อมูลผู้ป่วย (Context)
{{PATIENT_CONTEXT}}

## กฎการ Extract

### 1. อาการ (symptoms)
- ปวดหัว, มึนหัว, เจ็บหลัง, ไอ, หายใจลำบาก, คลื่นไส้, etc.
- severity: "นิดหน่อย/เล็กน้อย" = 1-2, "ปานกลาง" = 3, "มาก/รุนแรง" = 4-5
- duration: แปลงเป็น minutes ถ้าเป็นไปได้ (1 วัน = 1440, 1 สัปดาห์ = 10080)

### 2. ค่าชีพจร (vitals)
- ความดัน: แยก systolic/diastolic ให้ถูก (เช่น "120/80" → sys:120, dia:80)
- ชีพจร/หัวใจ: หน่วย bpm
- น้ำหนัก: หน่วย kg
- อุณหภูมิ: หน่วย °C
- SpO2: หน่วย %

### 3. อารมณ์ (mood)
- mood: 'happy', 'neutral', 'tired', 'sad', 'anxious', 'exhausted', 'stressed'
- stress_level: 'low', 'medium', 'high'
- energy_level: 'low', 'medium', 'high'

### 4. การนอน (sleep)
- คำนวณ hours จาก time range (เช่น "23:00 ตื่น 04:30" = 5.5 ชม.)
- quality: 'poor', 'fair', 'good', 'excellent'

### 5. การออกกำลังกาย (exercise)
- type: 'walk', 'run', 'gym', 'swim', 'yoga', 'bike', 'aerobic', 'other'
- intensity: 'light', 'medium', 'intense'

### 6. ยา (medication)
- taken: true/false
- ถ้าบอกว่า "กินยาแล้ว" = taken: true

### 7. น้ำ (water)
- amount_ml: แปลงเป็น ml (1 แก้ว ≈ 250ml, 1 ขวด ≈ 500ml)

## Output Format

ตอบเป็น JSON เท่านั้น:

{
  "intent": "report_symptom | report_vital | report_mood | report_sleep | report_exercise | report_medication | report_water | general_chat | greeting | question",
  
  "profile_update": {
    "display_name": "string | null",
    "birth_year": "number | null",
    "gender": "male | female | null"
  },
  
  "symptoms": [
    {
      "symptom_name": "string",
      "symptom_name_en": "string | null",
      "severity_1to5": "number | null",
      "body_location": "string | null",
      "duration_text": "string | null",
      "duration_minutes": "number | null",
      "time_of_day": "morning | afternoon | evening | night | null",
      "triggers": "string | null"
    }
  ],
  
  "vitals": {
    "bp_systolic": "number | null",
    "bp_diastolic": "number | null",
    "heart_rate": "number | null",
    "weight": "number | null",
    "temperature": "number | null",
    "glucose": "number | null",
    "spo2": "number | null",
    "measured_at_text": "string | null"
  },
  
  "mood": {
    "mood": "happy | neutral | tired | sad | anxious | exhausted | stressed | null",
    "mood_score": "1-5 | null",
    "stress_level": "low | medium | high | null",
    "stress_cause": "string | null",
    "energy_level": "low | medium | high | null"
  },
  
  "sleep": {
    "sleep_hours": "number | null",
    "sleep_time": "HH:MM | null",
    "wake_time": "HH:MM | null",
    "sleep_quality": "poor | fair | good | excellent | null",
    "wake_ups": "number | null"
  },
  
  "exercise": {
    "exercise_type": "string | null",
    "duration_minutes": "number | null",
    "intensity": "light | medium | intense | null",
    "time_of_day": "string | null"
  },
  
  "medication": {
    "medication_name": "string | null",
    "taken": "boolean | null",
    "time_taken": "string | null"
  },
  
  "water": {
    "amount_ml": "number | null"
  },
  
  "medical_info": {
    "diagnosis": "string | null",
    "doctor_note": "string | null",
    "hospital_name": "string | null"
  },
  
  "confidence": 0.0-1.0,
  
  "requires_followup": "boolean",
  "followup_question": "string | null"
}

## Important Rules
1. ถ้าไม่มีข้อมูลในหมวดใด ให้ใส่ null หรือ array ว่าง []
2. ถ้าข้อมูลไม่ชัดเจน ให้ set requires_followup: true และใส่คำถามใน followup_question
3. confidence score ควรสะท้อนความมั่นใจในการ extract (0.9+ = ชัดเจนมาก, 0.7-0.9 = ค่อนข้างชัด, <0.7 = ไม่แน่ใจ)
4. ภาษาไทยที่ใช้ควรเข้าใจง่าย เป็นธรรมชาติ
`;
```

---

## 📁 File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── line/
│   │   │   └── webhook/
│   │   │       └── route.ts              # Main webhook handler
│   │   ├── cron/
│   │   │   ├── daily-summary/
│   │   │   │   └── route.ts              # Generate daily summaries
│   │   │   ├── reminders/
│   │   │   │   └── route.ts              # Send medication reminders
│   │   │   └── alerts/
│   │   │       └── route.ts              # Check for alerts
│   │   └── health/
│   │       ├── summary/[patientId]/
│   │       │   └── route.ts              # Get patient health summary
│   │       ├── events/[patientId]/
│   │       │   └── route.ts              # Get health events
│   │       └── symptoms/[patientId]/
│   │           └── route.ts              # Get symptoms history
│   └── ...
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Supabase client
│   │   ├── types.ts                      # Generated types
│   │   └── queries/
│   │       ├── patients.ts               # Patient queries
│   │       ├── health-events.ts          # Health event queries
│   │       └── conversations.ts          # Conversation queries
│   ├── ai/
│   │   ├── extraction.ts                 # AI extraction logic
│   │   ├── prompts/
│   │   │   ├── extraction.ts             # Extraction prompt
│   │   │   └── response.ts               # Response generation prompt
│   │   └── processors/
│   │       ├── symptom-processor.ts      # Process symptoms
│   │       ├── vital-processor.ts        # Process vitals
│   │       ├── mood-processor.ts         # Process mood
│   │       ├── sleep-processor.ts        # Process sleep
│   │       └── exercise-processor.ts     # Process exercise
│   ├── line/
│   │   ├── client.ts                     # LINE API client
│   │   ├── webhook-handler.ts            # Handle webhook events
│   │   └── message-builder.ts            # Build LINE messages
│   └── health/
│       ├── event-creator.ts              # Create health events
│       ├── summary-generator.ts          # Generate summaries
│       └── validators.ts                 # Validate extracted data
└── types/
    ├── database.ts                       # Database types
    ├── extraction.ts                     # Extraction result types
    └── line.ts                           # LINE types
```

---

## 🔧 Implementation Tasks

### Phase 1: Database Changes ✅ COMPLETE (2025-12-18)
- [x] Run migration: สร้าง `symptoms` table
- [x] Run migration: สร้าง `sleep_logs` table
- [x] Run migration: สร้าง `exercise_logs` table
- [x] Run migration: สร้าง `health_events` table
- [x] Run migration: Alter `conversation_logs` เพิ่ม fields
- [x] Run migration: Alter `vitals_logs` เพิ่ม fields
- [x] Run migration: Alter `mood_logs` เพิ่ม fields
- [x] Data migration from old tables
- [x] Backup old tables with `_backup_` prefix

### Phase 2: AI Extraction ✅ COMPLETE (2025-12-20)
- [x] สร้าง extraction prompt (`src/lib/ai/prompts/extraction.ts`)
- [x] สร้าง `lib/ai/extraction.ts` - extractHealthData()
- [x] สร้าง processors สำหรับแต่ละ data type (`src/lib/ai/processors/index.ts`)
  - [x] processSymptom → symptoms table
  - [x] processVitals → vitals_logs table
  - [x] processMood → mood_logs table
  - [x] processSleep → sleep_logs table
  - [x] processExercise → exercise_logs table
  - [x] processMedication → activity_logs table
  - [x] processWater → activity_logs table
- [x] สร้าง `lib/health/event-creator.ts` - createHealthEvent()
- [x] สร้าง `lib/ai/index.ts` - runHealthExtractionPipeline()
- [x] สร้าง `src/types/health.types.ts` - All types defined
- [x] Update `src/services/supabase.service.ts` - All CRUD methods

### Phase 3: Webhook Integration ⏳ IN PROGRESS
- [ ] Update `src/index.ts` handleTextMessage() ใช้ extraction pipeline
- [ ] Decide integration strategy (replace/hybrid/parallel)
- [ ] เพิ่ม error handling และ logging
- [ ] Test end-to-end flow

### Phase 4: Testing & Polish
- [ ] Test กับ real conversations
- [ ] ปรับ prompt ตาม feedback
- [ ] Add monitoring และ alerts
- [ ] Documentation

---

## 📝 Example: Full Extraction Flow

### User Input
```
"วันนี้ปวดหัวตั้งแต่เช้า เครียดเรื่องงาน นอนได้แค่ 5 ชม. 
ความดัน 128/84 ชีพจร 72 วัดตอน 8 โมง"
```

### AI Extraction Output
```json
{
  "intent": "report_symptom",
  "symptoms": [
    {
      "symptom_name": "ปวดหัว",
      "symptom_name_en": "headache",
      "severity_1to5": null,
      "time_of_day": "morning",
      "triggers": "นอนน้อย, เครียด"
    }
  ],
  "vitals": {
    "bp_systolic": 128,
    "bp_diastolic": 84,
    "heart_rate": 72,
    "measured_at_text": "8 โมง"
  },
  "mood": {
    "mood": "stressed",
    "stress_level": "high",
    "stress_cause": "งาน",
    "energy_level": "low"
  },
  "sleep": {
    "sleep_hours": 5,
    "sleep_quality": "poor"
  },
  "confidence": 0.92,
  "requires_followup": true,
  "followup_question": "อาการปวดหัวรุนแรงแค่ไหนคะ ถ้าให้คะแนน 1-5?"
}
```

### Database Inserts

1. **conversation_logs** (raw message)
2. **health_events** × 4 records:
   - type: 'symptom', reference: symptoms.id
   - type: 'vital', reference: vitals_logs.id
   - type: 'mood', reference: mood_logs.id
   - type: 'sleep', reference: sleep_logs.id
3. **symptoms** (ปวดหัว)
4. **vitals_logs** (BP 128/84, HR 72)
5. **mood_logs** (stressed, high stress)
6. **sleep_logs** (5 hours, poor quality)

---

## ⚠️ Important Notes

1. **Keep backward compatibility** - ไม่ลบ columns/tables เดิม
2. **Dual write period** - เขียนทั้ง activity_logs และ tables ใหม่ช่วงแรก
3. **AI confidence threshold** - ถ้า confidence < 0.7 ให้ถาม confirm
4. **Rate limiting** - ระวัง Claude API rate limits
5. **Error recovery** - ถ้า extraction fail ให้ยังตอบกลับ user ได้

---

## 🚀 Quick Start

```bash
# 1. Run migrations
npx supabase db push

# 2. Generate types
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts

# 3. Set environment variables
ANTHROPIC_API_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_key
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret

# 4. Test locally
npm run dev
```
