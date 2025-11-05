# Duulair Database Schema - Actual Production Schema

## Overview

This document describes the **actual production database schema** currently deployed in Supabase. This schema supports the Group-Based Care Model where caregivers manage patient health activities through LINE group chats.

**Last Updated:** January 5, 2025
**Database:** PostgreSQL (Supabase)
**Total Tables:** 17

---

## 📊 Entity Relationship Overview

```
users (LINE users)
  ├─ patient_profiles (patients)
  │   ├─ activity_logs
  │   ├─ patient_medications
  │   ├─ health_goals
  │   ├─ notification_settings
  │   ├─ link_codes
  │   └─ patient_caregivers
  │
  └─ caregiver_profiles (caregivers)
      └─ patient_caregivers

groups (LINE groups)
  ├─ group_members
  ├─ patient_profiles (1:1)
  └─ caregiver_profiles (primary)

activity_logs
  ├─ patients
  └─ groups
```

---

## 📋 Table Descriptions

### Core User Tables

#### 1. `users`
**Purpose:** All LINE users (both patients and caregivers)

```sql
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id varchar NOT NULL UNIQUE,
  display_name varchar,
  picture_url text,
  role varchar NOT NULL CHECK (role IN ('patient', 'caregiver')),
  language varchar DEFAULT 'th',
  is_active boolean DEFAULT true,
  primary_group_id uuid,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  FOREIGN KEY (primary_group_id) REFERENCES groups(id)
);
```

**Key Fields:**
- `line_user_id` - LINE user identifier (unique)
- `role` - 'patient' or 'caregiver'
- `primary_group_id` - User's main group (can be NULL)

---

#### 2. `patient_profiles`
**Purpose:** Detailed patient information

```sql
CREATE TABLE public.patient_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE,
  first_name varchar NOT NULL,
  last_name varchar NOT NULL,
  nickname varchar,
  birth_date date NOT NULL,
  gender varchar CHECK (gender IN ('male', 'female', 'other')),
  weight_kg numeric,
  height_cm numeric,
  blood_type varchar,
  chronic_diseases ARRAY,
  drug_allergies ARRAY,
  food_allergies ARRAY,
  address text,
  phone_number varchar,
  emergency_contact_name varchar,
  emergency_contact_phone varchar,
  emergency_contact_relation varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Key Features:**
- Medical information (diseases, allergies)
- Emergency contact details
- Optional user_id (can be standalone)

---

#### 3. `caregiver_profiles`
**Purpose:** Caregiver information

```sql
CREATE TABLE public.caregiver_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  first_name varchar NOT NULL,
  last_name varchar NOT NULL,
  phone_number varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### Group Management Tables

#### 4. `groups`
**Purpose:** LINE groups managing patient care

```sql
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_group_id varchar NOT NULL UNIQUE,
  group_name varchar,
  patient_id uuid,
  primary_caregiver_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  FOREIGN KEY (patient_id) REFERENCES patient_profiles(id),
  FOREIGN KEY (primary_caregiver_id) REFERENCES caregiver_profiles(id)
);
```

**Key Relationships:**
- **1:1 with patient** - Each group has one patient
- **1:1 with primary caregiver** - Each group has one primary caregiver
- **1:N with members** - Each group has multiple members

---

#### 5. `group_members`
**Purpose:** Track members in each group

```sql
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  line_user_id varchar NOT NULL,
  display_name varchar,
  picture_url text,
  role varchar CHECK (role IN ('caregiver', 'patient', 'family')),
  is_active boolean DEFAULT true,
  joined_at timestamp DEFAULT now(),
  left_at timestamp,

  FOREIGN KEY (group_id) REFERENCES groups(id)
);
```

**Key Features:**
- Tracks who joins/leaves groups
- Stores role (caregiver/patient/family)
- Soft delete with `is_active` and `left_at`

---

### Patient Care Tables

#### 6. `patient_caregivers`
**Purpose:** M:N relationship between patients and caregivers

```sql
CREATE TABLE public.patient_caregivers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL,
  caregiver_id uuid NOT NULL,
  relationship varchar,
  is_primary boolean DEFAULT false,
  access_level varchar DEFAULT 'full',
  notify_emergency boolean DEFAULT true,
  notify_medication boolean DEFAULT true,
  notify_daily_report boolean DEFAULT true,
  notify_abnormal_vitals boolean DEFAULT true,
  status varchar DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  approved_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  FOREIGN KEY (patient_id) REFERENCES patient_profiles(id),
  FOREIGN KEY (caregiver_id) REFERENCES caregiver_profiles(id)
);
```

**Key Features:**
- **Access control** - Different access levels
- **Notification preferences** - Customize what to notify
- **Approval workflow** - pending → active → rejected

---

#### 7. `patient_medications`
**Purpose:** Patient's medication list

```sql
CREATE TABLE public.patient_medications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL,
  name varchar NOT NULL,
  dosage varchar,
  frequency ARRAY,
  started_at date,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
);
```

**Note:** This overlaps with `medications` table from LIFF pages schema. Need to consolidate.

---

#### 8. `activity_logs`
**Purpose:** All patient activities and health data

```sql
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid,
  message_id varchar,
  task_type varchar NOT NULL,
  value text,
  metadata jsonb DEFAULT '{}',
  intent varchar,
  processing_result jsonb,
  timestamp timestamp DEFAULT now(),
  created_at timestamp DEFAULT now(),

  -- Group-based fields (TASK-002)
  group_id uuid,
  actor_line_user_id varchar,
  actor_display_name varchar,
  source varchar DEFAULT '1:1' CHECK (source IN ('1:1', 'group')),

  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (group_id) REFERENCES groups(id)
);
```

**Key Features:**
- **Actor tracking** - Who performed the activity
- **Source tracking** - 1:1 chat or group chat
- **Metadata** - Flexible JSONB storage

---

#### 9. `health_goals`
**Purpose:** Patient's target health metrics

```sql
CREATE TABLE public.health_goals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL UNIQUE,
  target_bp_systolic integer DEFAULT 120,
  target_bp_diastolic integer DEFAULT 80,
  target_blood_sugar_fasting integer DEFAULT 100,
  target_blood_sugar_post_meal integer DEFAULT 140,
  target_water_ml integer DEFAULT 2000,
  target_exercise_minutes integer DEFAULT 30,
  target_exercise_days_per_week integer DEFAULT 5,
  target_weight_kg numeric,
  updated_at timestamp DEFAULT now(),

  FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
);
```

---

#### 10. `notification_settings`
**Purpose:** Patient's notification preferences

```sql
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL UNIQUE,
  medication_reminder_times ARRAY,
  water_reminder_interval_hours integer DEFAULT 2,
  water_reminder_start time DEFAULT '07:00:00',
  water_reminder_end time DEFAULT '21:00:00',
  exercise_reminder_time time DEFAULT '08:00:00',
  daily_report_time time DEFAULT '20:00:00',
  medication_reminders_enabled boolean DEFAULT true,
  water_reminders_enabled boolean DEFAULT true,
  exercise_reminders_enabled boolean DEFAULT true,
  daily_reports_enabled boolean DEFAULT true,
  updated_at timestamp DEFAULT now(),

  FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
);
```

---

#### 11. `link_codes`
**Purpose:** Invitation codes for joining groups

```sql
CREATE TABLE public.link_codes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL,
  code varchar NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp DEFAULT now(),

  FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
);
```

**Key Features:**
- **6-digit codes** - Easy to type
- **Expiration** - Codes expire after set time
- **Single-use** - Marked as used after redemption

---

### Alert & Monitoring Tables

#### 12. `alerts`
**Purpose:** Critical alerts for caregivers

```sql
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid,
  alert_type varchar NOT NULL,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 4),
  message text NOT NULL,
  resolved boolean DEFAULT false,
  resolved_at timestamp,
  resolved_by varchar,
  metadata jsonb DEFAULT '{}',
  timestamp timestamp DEFAULT now(),
  created_at timestamp DEFAULT now(),

  FOREIGN KEY (patient_id) REFERENCES patients(id)
);
```

**Alert Levels:**
- Level 1: Info
- Level 2: Warning
- Level 3: Urgent
- Level 4: Critical/Emergency

---

### System Tables

#### 13. `patients` (Legacy)
**Purpose:** Old patient table (being phased out)

```sql
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name varchar NOT NULL,
  line_user_id varchar UNIQUE,
  birth_date date,
  medical_conditions jsonb DEFAULT '[]',
  medications jsonb DEFAULT '[]',
  caregivers jsonb DEFAULT '[]',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

**Status:** ⚠️ Legacy table. Use `patient_profiles` instead.

---

#### 14. `agent_states`
**Purpose:** Persistent state for AI agents

```sql
CREATE TABLE public.agent_states (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name varchar NOT NULL UNIQUE,
  state jsonb DEFAULT '{}',
  updated_at timestamp DEFAULT now()
);
```

---

#### 15. `agent_specs`
**Purpose:** Agent configuration

```sql
CREATE TABLE public.agent_specs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar NOT NULL UNIQUE,
  role text,
  config jsonb DEFAULT '{}',
  active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

---

#### 16. `agent_logs`
**Purpose:** Agent performance monitoring

```sql
CREATE TABLE public.agent_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name varchar NOT NULL,
  success boolean NOT NULL,
  processing_time integer,
  message_id varchar,
  intent varchar,
  metadata jsonb DEFAULT '{}',
  created_at timestamp DEFAULT now()
);
```

---

#### 17. `error_logs`
**Purpose:** System error logging

```sql
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp timestamp DEFAULT now(),
  level varchar,
  agent varchar,
  message text,
  data jsonb DEFAULT '{}',
  created_at timestamp DEFAULT now()
);
```

---

## 🔑 Key Relationships

### User → Patient/Caregiver
```
users (1) → (0..1) patient_profiles
users (1) → (0..1) caregiver_profiles
```

### Group → Patient → Caregivers
```
groups (1) → (1) patient_profiles
groups (1) → (1) caregiver_profiles (primary)
groups (1) → (N) group_members
```

### Patient → Activities
```
patient_profiles (1) → (N) activity_logs
patient_profiles (1) → (N) patient_medications
patient_profiles (1) → (1) health_goals
patient_profiles (1) → (1) notification_settings
```

### Patient ↔ Caregivers (M:N)
```
patient_profiles (N) ↔ (N) caregiver_profiles
  via patient_caregivers
```

---

## 🎯 Schema Support for Features

### ✅ Fully Supported:

1. **Group Management**
   - ✅ `groups` table
   - ✅ `group_members` table
   - ✅ Primary caregiver designation

2. **Member Management**
   - ✅ Add/remove members
   - ✅ Track join/leave dates
   - ✅ Role assignment

3. **Patient-Caregiver Relationship**
   - ✅ M:N relationship
   - ✅ Access levels
   - ✅ Notification preferences
   - ✅ Approval workflow

4. **Activity Tracking**
   - ✅ Actor attribution
   - ✅ Group context
   - ✅ Source tracking (1:1 vs group)

5. **Link Codes**
   - ✅ Code generation
   - ✅ Expiration
   - ✅ Single-use validation

6. **Health Goals & Settings**
   - ✅ Per-patient goals
   - ✅ Per-patient notification settings

### ⚠️ Partially Supported:

1. **Medications**
   - ✅ `patient_medications` table exists
   - ⚠️ Overlaps with `medications` table from LIFF schema
   - 🔧 Need to consolidate schemas

2. **Reminders**
   - ⚠️ No `reminders` table in production
   - ✅ `notification_settings` has reminder times
   - 🔧 Need to add `reminders` table

### ❌ Not Supported:

1. **Audit Logs**
   - ❌ No table for tracking who did what
   - 🔧 Need to add `audit_logs` table

2. **Export History**
   - ❌ No table for tracking exports
   - 🔧 Need to add `export_logs` table

3. **Permissions System**
   - ⚠️ Basic support via `patient_caregivers.access_level`
   - 🔧 Could be expanded

---

## 🔄 Schema Consolidation Needed

### Issue 1: Overlapping Tables

**Production has:**
- `patients` (old)
- `patient_profiles` (new)

**LIFF schema wants:**
- `patient_profiles` (enhanced)

**Solution:** Migrate all data to `patient_profiles`, deprecate `patients`

### Issue 2: Medications

**Production has:**
- `patient_medications` (name, dosage, frequency array)

**LIFF schema wants:**
- `medications` (name, dosage_amount, dosage_unit, times array, instructions)

**Solution:** Enhance `patient_medications` or create new `medications` table

### Issue 3: Reminders

**Production has:**
- `notification_settings` (global settings)

**LIFF schema wants:**
- `reminders` (individual reminder records with days)

**Solution:** Add `reminders` table as planned in LIFF schema

---

## 📊 Migration Path

### Step 1: Add Missing Tables
```sql
-- From database-schema-liff-pages.sql
CREATE TABLE reminders (...);
-- OR enhance notification_settings

-- New tables
CREATE TABLE audit_logs (...);
CREATE TABLE export_logs (...);
```

### Step 2: Consolidate Medications
```sql
-- Option A: Enhance patient_medications
ALTER TABLE patient_medications
  ADD COLUMN dosage_amount DECIMAL(10,2),
  ADD COLUMN dosage_unit VARCHAR(50),
  ADD COLUMN times TEXT[],
  ADD COLUMN instructions VARCHAR(200);

-- Option B: Create new medications table
CREATE TABLE medications (...);
-- Migrate data from patient_medications
```

### Step 3: Deprecate Old Tables
```sql
-- Mark patients table as deprecated
COMMENT ON TABLE patients IS 'DEPRECATED: Use patient_profiles instead';
```

---

## 🎨 Schema Strengths

1. **Flexible User Model**
   - Single `users` table for all LINE users
   - Separate profile tables for patients/caregivers

2. **Group-Based Architecture**
   - Clean 1:1 group-patient relationship
   - Member tracking with roles

3. **Actor Attribution**
   - Full tracking of who did what
   - Group context preserved

4. **Notification Flexibility**
   - Per-patient settings
   - Per-caregiver preferences

5. **Access Control**
   - Patient-caregiver relationship with levels
   - Approval workflow

---

## ⚠️ Schema Limitations

1. **Multiple Patients per Group**
   - Current: 1 group = 1 patient
   - Limitation: Families with multiple elderly members
   - Solution: Change `groups.patient_id` to allow M:N

2. **Medication Schema Split**
   - Two medication tables cause confusion
   - Need to consolidate

3. **No Audit Trail**
   - Can't track who changed what settings
   - Need audit_logs table

4. **Limited Export Tracking**
   - No history of data exports
   - Compliance issue

---

## 🚀 Recommended Enhancements

### Priority 1 (Critical):
1. Add `reminders` table from LIFF schema
2. Consolidate medications tables
3. Add `audit_logs` table

### Priority 2 (Important):
1. Add `export_logs` table
2. Enhance `patient_caregivers` with more granular permissions
3. Add `group_settings` JSONB column to `groups`

### Priority 3 (Nice to have):
1. Add `subscriptions` table for packages
2. Add `billing` table
3. Add `support_tickets` table

---

## 📝 Notes

- This schema is **production-ready** for MVP
- Supports Group-Based Care Model fully
- Has room for growth and enhancement
- Clean separation of concerns
- Good indexing strategy

---

*Document Created: January 5, 2025*
*Schema Version: Production v1.0*
*Author: Claude Code (Sonnet 4.5)*
