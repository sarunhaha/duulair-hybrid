# 🗄️ Database Migration Guide - Supabase Schema Update

## 📊 Current Situation

**OLD Schema (Currently in Supabase):**
- File: `docs/database-schema.sql`
- Main table: `patients` (JSONB-based)
- Purpose: Multi-agent system logs

**NEW Schema (Required for LIFF Registration):**
- File: `database/migrations/001_user_registration.sql`
- Main tables: `users`, `patient_profiles`, `caregiver_profiles`
- Purpose: User registration & profile management

**Problem:** Code expects NEW schema, but Supabase has OLD schema

---

## ⚠️ Important: Check Existing Data

Before migrating, check if you have important data:

```sql
-- Check if patients table has data
SELECT COUNT(*) FROM patients;

-- List all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

If `patients` table is **empty** or contains **only test data** → Safe to migrate

If `patients` table has **real patient data** → Need data migration plan

---

## 🚀 Migration Option 1: Fresh Start (No Data Loss Risk)

**Use if:** No important data in current database

### Step 1: Backup Current Schema (Optional)

In Supabase SQL Editor:
```sql
-- Export table definitions
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

### Step 2: Drop Old Tables

```sql
-- Drop old tables if they exist
DROP TABLE IF EXISTS agent_logs CASCADE;
DROP TABLE IF EXISTS error_logs CASCADE;
DROP TABLE IF EXISTS agent_specs CASCADE;
DROP TABLE IF EXISTS agent_states CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS patients CASCADE;

-- Drop views
DROP VIEW IF EXISTS daily_activity_summary;
```

### Step 3: Run New Migration

Copy and run entire content from:
```
database/migrations/001_user_registration.sql
```

---

## 🔄 Migration Option 2: Keep Both Schemas

**Use if:** Need to keep existing `patients`, `alerts`, `activity_logs` for multi-agent system

### Step 1: Run New Migration (Will Add New Tables)

The migration uses `CREATE TABLE` (not `CREATE TABLE IF NOT EXISTS` for most tables), so you'll need to run the SQL for only the new tables:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create NEW tables for user registration
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

CREATE TABLE patient_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  nickname VARCHAR(50),
  birth_date DATE NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
  weight_kg DECIMAL(5,2),
  height_cm DECIMAL(5,2),
  blood_type VARCHAR(5),
  chronic_diseases TEXT[],
  drug_allergies TEXT[],
  food_allergies TEXT[],
  address TEXT,
  phone_number VARCHAR(20),
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relation VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE caregiver_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE patient_caregivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) NOT NULL,
  caregiver_id UUID REFERENCES caregiver_profiles(id) NOT NULL,
  relationship VARCHAR(50),
  is_primary BOOLEAN DEFAULT FALSE,
  access_level VARCHAR(20) DEFAULT 'full',
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

CREATE TABLE link_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) NOT NULL,
  code VARCHAR(6) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE patient_medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  frequency TEXT[],
  started_at DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE health_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) UNIQUE NOT NULL,
  target_bp_systolic INTEGER DEFAULT 120,
  target_bp_diastolic INTEGER DEFAULT 80,
  target_blood_sugar_fasting INTEGER DEFAULT 100,
  target_blood_sugar_post_meal INTEGER DEFAULT 140,
  target_water_ml INTEGER DEFAULT 2000,
  target_exercise_minutes INTEGER DEFAULT 30,
  target_exercise_days_per_week INTEGER DEFAULT 5,
  target_weight_kg DECIMAL(5,2),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) UNIQUE NOT NULL,
  medication_reminder_times TIME[],
  water_reminder_interval_hours INTEGER DEFAULT 2,
  water_reminder_start TIME DEFAULT '07:00',
  water_reminder_end TIME DEFAULT '21:00',
  exercise_reminder_time TIME DEFAULT '08:00',
  daily_report_time TIME DEFAULT '20:00',
  medication_reminders_enabled BOOLEAN DEFAULT TRUE,
  water_reminders_enabled BOOLEAN DEFAULT TRUE,
  exercise_reminders_enabled BOOLEAN DEFAULT TRUE,
  daily_reports_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_line_id ON users(line_user_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_patient_user ON patient_profiles(user_id);
CREATE INDEX idx_patient_birth_date ON patient_profiles(birth_date);
CREATE INDEX idx_caregiver_user ON caregiver_profiles(user_id);
CREATE INDEX idx_patient_caregivers_patient ON patient_caregivers(patient_id);
CREATE INDEX idx_patient_caregivers_caregiver ON patient_caregivers(caregiver_id);
CREATE INDEX idx_patient_caregivers_status ON patient_caregivers(status);
CREATE INDEX idx_link_codes_code ON link_codes(code) WHERE NOT used;
CREATE INDEX idx_link_codes_patient ON link_codes(patient_id);
CREATE INDEX idx_link_codes_expires ON link_codes(expires_at) WHERE NOT used;
CREATE INDEX idx_medications_patient ON patient_medications(patient_id);
CREATE INDEX idx_medications_active ON patient_medications(patient_id, is_active);
CREATE INDEX idx_health_goals_patient ON health_goals(patient_id);
CREATE INDEX idx_notification_settings_patient ON notification_settings(patient_id);

-- Triggers
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

-- Helper Functions
CREATE OR REPLACE FUNCTION calculate_age(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM age(birth_date));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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

CREATE OR REPLACE FUNCTION generate_link_code()
RETURNS VARCHAR(6) AS $$
DECLARE
  code VARCHAR(6);
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
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

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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
```

---

## ✅ Recommended: Option 1 (Fresh Start)

Since this is development and LIFF registration is the priority:

1. **Backup old schema if needed** (copy SQL)
2. **Drop old tables**
3. **Run new migration**
4. **Test LIFF registration**

---

## 🧪 After Migration - Verify Tables

```sql
-- Check all tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected tables:
-- ✅ users
-- ✅ patient_profiles
-- ✅ caregiver_profiles
-- ✅ patient_caregivers
-- ✅ link_codes
-- ✅ patient_medications
-- ✅ health_goals
-- ✅ notification_settings
-- (plus old tables: patients, alerts, activity_logs, etc. if using Option 2)
```

---

## 🔍 Test LIFF After Migration

1. Open LIFF URL:
   ```
   https://liff.line.me/2008278683-5k69jxNq
   ```

2. Expected Vercel logs:
   ```
   📨 POST /api/registration/check - Request body: {"line_user_id":"U123..."}
   🔍 UserService.checkUserExists() - lineUserId: U123...
   🔗 Supabase URL: Set ✅
   🔑 Supabase Key: Set ✅
   📭 User not found - returning exists: false
   ✅ Check user result: {"exists":false}
   ```

3. Should redirect to role selection page ✅

---

## 📚 References

- OLD Schema: `docs/database-schema.sql` (Multi-agent system)
- NEW Schema: `database/migrations/001_user_registration.sql` (User registration)
- Supabase Dashboard: https://supabase.com/dashboard/project/xibtslxxjxossybxisdr

---

**Last Updated:** 2025-10-26
**Status:** Schema migration required for LIFF registration
**Recommendation:** Use Option 1 (Fresh Start) if no critical data
