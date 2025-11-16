-- Migration 003: Oonjai Feedback - Phase 1 Critical Improvements (FIXED)
-- Created: 2025-01-13
-- Updated: 2025-11-13 (Fixed for existing schema)
-- Purpose:
--   1. Flexible reminder system with custom times
--   2. Water tracking separate from medications
--   3. Medication scheduling (days of week)
--   4. Support for fractional dosages (½ tablet)
--   5. Liquid medication support (ml)

-- ============================================
-- 1. CREATE reminders table (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,

  -- Reminder details
  type VARCHAR(50) NOT NULL,  -- medication, vitals, water, exercise, appointment, custom
  title VARCHAR(200) NOT NULL,
  time TIME NOT NULL,
  days TEXT[] DEFAULT '{}',  -- Array of days: mon, tue, wed, thu, fri, sat, sun
  note TEXT,

  -- Flexible scheduling (NEW from Oonjai feedback)
  custom_time TIME,
  days_of_week JSONB, -- ['monday', 'wednesday', 'friday']
  frequency VARCHAR(50) DEFAULT 'daily', -- 'daily', 'weekly', 'specific_days'
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for reminders
CREATE INDEX IF NOT EXISTS idx_reminders_patient_id ON reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(time);
CREATE INDEX IF NOT EXISTS idx_reminders_is_active ON reminders(is_active);

COMMENT ON TABLE reminders IS 'Flexible reminder system with custom times (Oonjai feedback)';
COMMENT ON COLUMN reminders.custom_time IS 'Custom reminder time set by caregiver (flexible)';
COMMENT ON COLUMN reminders.days_of_week IS 'JSON array of days when reminder should fire';
COMMENT ON COLUMN reminders.frequency IS 'Frequency type: daily, weekly, specific_days';

-- ============================================
-- 2. UPDATE existing reminders (if table already exists with different schema)
-- ============================================

DO $$
BEGIN
  -- Add custom_time if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reminders' AND column_name = 'custom_time'
  ) THEN
    ALTER TABLE reminders ADD COLUMN custom_time TIME;
  END IF;

  -- Add days_of_week if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reminders' AND column_name = 'days_of_week'
  ) THEN
    ALTER TABLE reminders ADD COLUMN days_of_week JSONB;
  END IF;

  -- Add frequency if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reminders' AND column_name = 'frequency'
  ) THEN
    ALTER TABLE reminders ADD COLUMN frequency VARCHAR(50) DEFAULT 'daily';
  END IF;

  -- Add is_active if not exists (for reminders table)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reminders' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE reminders ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ============================================
-- 3. Water Intake Tracking (separate from medication)
-- ============================================

CREATE TABLE IF NOT EXISTS water_intake_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,  -- FIXED: caregiver_groups → groups
  amount_ml INTEGER NOT NULL CHECK (amount_ml > 0 AND amount_ml <= 5000),
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  logged_by_line_user_id VARCHAR(255),
  logged_by_display_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_water_logs_patient
  ON water_intake_logs(patient_id);

CREATE INDEX IF NOT EXISTS idx_water_logs_patient_logged_at
  ON water_intake_logs(patient_id, logged_at);

CREATE INDEX IF NOT EXISTS idx_water_logs_group
  ON water_intake_logs(group_id);

COMMENT ON TABLE water_intake_logs IS 'Daily water intake tracking for patients (separate from medications)';

-- ============================================
-- 4. Use existing patient_medications table (skip creating new medications table)
-- ============================================
-- Note: Database already has 'medications' table with user_id (old schema)
--       and 'patient_medications' table with patient_id (new schema)
--       We'll enhance patient_medications instead of creating new table

-- ============================================
-- 5. UPDATE existing patient_medications (if needed)
-- ============================================

DO $$
BEGIN
  -- Add dosage_amount if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_medications' AND column_name = 'dosage_amount'
  ) THEN
    ALTER TABLE patient_medications ADD COLUMN dosage_amount DECIMAL(5,2);
  END IF;

  -- Add dosage_form if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_medications' AND column_name = 'dosage_form'
  ) THEN
    ALTER TABLE patient_medications ADD COLUMN dosage_form VARCHAR(50) DEFAULT 'tablet';
  END IF;

  -- Add dosage_unit if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_medications' AND column_name = 'dosage_unit'
  ) THEN
    ALTER TABLE patient_medications ADD COLUMN dosage_unit VARCHAR(50) DEFAULT 'tablet';
  END IF;

  -- Add days_of_week if not exists (JSONB for flexibility)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_medications' AND column_name = 'days_of_week'
  ) THEN
    ALTER TABLE patient_medications ADD COLUMN days_of_week JSONB;
  END IF;

  -- Add frequency_type if not exists (renamed from frequency to avoid conflict)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_medications' AND column_name = 'frequency_type'
  ) THEN
    ALTER TABLE patient_medications ADD COLUMN frequency_type VARCHAR(50) DEFAULT 'daily';
  END IF;
END $$;

COMMENT ON COLUMN patient_medications.days_of_week IS 'Specific days to take medication (for weekly/specific_days frequency)';
COMMENT ON COLUMN patient_medications.dosage_amount IS 'Dosage amount (supports fractions like 0.5 for half tablet)';
COMMENT ON COLUMN patient_medications.dosage_form IS 'Form of medication: tablet, capsule, liquid, injection';
COMMENT ON COLUMN patient_medications.dosage_unit IS 'Unit for dosage: tablet, ml, mg, capsule';
COMMENT ON COLUMN patient_medications.frequency_type IS 'How often to take: daily, weekly, specific_days';

-- ============================================
-- 6. Daily water intake goals (settings)
-- ============================================

CREATE TABLE IF NOT EXISTS water_intake_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL UNIQUE REFERENCES patient_profiles(id) ON DELETE CASCADE,
  daily_goal_ml INTEGER NOT NULL DEFAULT 2000 CHECK (daily_goal_ml > 0),
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_times JSONB, -- ['08:00', '12:00', '16:00', '20:00']
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE water_intake_goals IS 'Daily water intake goals and reminder settings per patient';

-- ============================================
-- 7. Update activity_logs for water tracking
-- ============================================

-- Ensure task_type supports 'water' as a separate type
COMMENT ON COLUMN activity_logs.task_type IS 'Type of activity: medication, vitals, water, food, exercise';

-- ============================================
-- 8. Helper function: Calculate daily water intake
-- ============================================

CREATE OR REPLACE FUNCTION get_daily_water_intake(
  p_patient_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
  total_ml INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount_ml), 0)
  INTO total_ml
  FROM water_intake_logs
  WHERE patient_id = p_patient_id
    AND DATE(logged_at) = p_date;

  RETURN total_ml;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_daily_water_intake IS 'Calculate total water intake for a patient on a specific date';

-- ============================================
-- 9. Helper function: Check medication schedule
-- ============================================

CREATE OR REPLACE FUNCTION should_take_medication_today(
  p_medication_id UUID,
  p_check_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  med_frequency VARCHAR(50);
  med_days JSONB;
  day_name TEXT;
BEGIN
  -- Get medication frequency and days from patient_medications table
  SELECT frequency_type, days_of_week
  INTO med_frequency, med_days
  FROM patient_medications
  WHERE id = p_medication_id;

  -- If daily, always return true
  IF med_frequency = 'daily' THEN
    RETURN TRUE;
  END IF;

  -- If specific days, check if today is in the list
  IF med_frequency = 'specific_days' AND med_days IS NOT NULL THEN
    day_name := LOWER(TO_CHAR(p_check_date, 'Day'));
    day_name := TRIM(day_name);

    RETURN med_days ? day_name;
  END IF;

  -- Default to false if no match
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION should_take_medication_today IS 'Check if medication should be taken on a specific date based on schedule (uses patient_medications table)';

-- ============================================
-- 10. Update existing data (safe defaults)
-- ============================================

-- Set defaults for patient_medications table only
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_medications' AND column_name = 'frequency_type') THEN
    UPDATE patient_medications SET frequency_type = 'daily' WHERE frequency_type IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_medications' AND column_name = 'dosage_form') THEN
    UPDATE patient_medications SET dosage_form = 'tablet', dosage_unit = 'tablet' WHERE dosage_form IS NULL;
  END IF;
END $$;

-- ============================================
-- 11. Create triggers for updated_at
-- ============================================

-- Trigger for reminders
CREATE OR REPLACE FUNCTION update_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reminders_updated_at ON reminders;
CREATE TRIGGER trigger_update_reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_reminders_updated_at();

-- Trigger for patient_medications (already exists from migration 001, skip creating)

-- Trigger for water_intake_logs
CREATE OR REPLACE FUNCTION update_water_intake_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_water_intake_logs_updated_at ON water_intake_logs;
CREATE TRIGGER trigger_update_water_intake_logs_updated_at
  BEFORE UPDATE ON water_intake_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_water_intake_logs_updated_at();

-- Trigger for water_intake_goals
CREATE OR REPLACE FUNCTION update_water_intake_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_water_intake_goals_updated_at ON water_intake_goals;
CREATE TRIGGER trigger_update_water_intake_goals_updated_at
  BEFORE UPDATE ON water_intake_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_water_intake_goals_updated_at();

-- ============================================
-- Migration complete
-- ============================================

-- Create schema_migrations table if not exists
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(10) PRIMARY KEY,
  description TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Log migration
INSERT INTO schema_migrations (version, description, executed_at)
VALUES (
  '003',
  'Oonjai Feedback Phase 1: Flexible reminders, water tracking, medication scheduling',
  NOW()
)
ON CONFLICT (version) DO NOTHING;

-- Success message
SELECT 'Migration 003 completed successfully!' as status;
-- Migration 004: Oonjai Feedback - Phase 2 Enhanced Features (FIXED)
-- Created: 2025-01-13
-- Updated: 2025-11-13 (Fixed for existing schema)
-- Purpose:
--   1. Enhanced patient medical information
--   2. Comprehensive allergy tracking (medication, food, other)
--   3. Hospital and doctor information
--   4. Medical history tracking

-- ============================================
-- 1. Enhanced Patient Profile - Medical Information
-- ============================================

DO $$
BEGIN
  -- Add medical_condition if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'medical_condition'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN medical_condition TEXT;
  END IF;

  -- Add hospital_name if not exists (check both spellings)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'hospital_name'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN hospital_name VARCHAR(255);
  END IF;

  -- Add hospital_address if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'hospital_address'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN hospital_address TEXT;
  END IF;

  -- Add hospital_phone if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'hospital_phone'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN hospital_phone VARCHAR(20);
  END IF;

  -- Add doctor_name if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'doctor_name'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN doctor_name VARCHAR(255);
  END IF;

  -- Add doctor_phone if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'doctor_phone'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN doctor_phone VARCHAR(20);
  END IF;

  -- Add medical_notes if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'medical_notes'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN medical_notes TEXT;
  END IF;
END $$;

COMMENT ON COLUMN patient_profiles.medical_condition IS 'ลักษณะอาการป่วย / โรคประจำตัว';
COMMENT ON COLUMN patient_profiles.hospital_name IS 'โรงพยาบาลที่รับการรักษาและมีประวัติ';
COMMENT ON COLUMN patient_profiles.hospital_address IS 'ที่อยู่โรงพยาบาล';
COMMENT ON COLUMN patient_profiles.hospital_phone IS 'เบอร์โทรโรงพยาบาล';
COMMENT ON COLUMN patient_profiles.doctor_name IS 'ชื่อแพทย์ผู้ดูแล';
COMMENT ON COLUMN patient_profiles.doctor_phone IS 'เบอร์โทรแพทย์';
COMMENT ON COLUMN patient_profiles.medical_notes IS 'บันทึกเพิ่มเติมทางการแพทย์';

-- ============================================
-- 2. Comprehensive Allergy Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS allergies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  allergy_type VARCHAR(50) NOT NULL CHECK (allergy_type IN ('medication', 'food', 'other')),
  allergen_name VARCHAR(255) NOT NULL,
  severity VARCHAR(50) CHECK (severity IN ('mild', 'moderate', 'severe')),
  reaction_symptoms TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_line_user_id VARCHAR(255) -- FIXED: removed FK to group_members (optional field)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_allergies_patient
  ON allergies(patient_id);

CREATE INDEX IF NOT EXISTS idx_allergies_type
  ON allergies(patient_id, allergy_type);

COMMENT ON TABLE allergies IS 'Patient allergy information categorized by type (medication, food, other)';
COMMENT ON COLUMN allergies.allergy_type IS 'Category: medication (ยา), food (อาหาร), other (อื่นๆ)';
COMMENT ON COLUMN allergies.allergen_name IS 'Name of allergen (e.g., Penicillin, Peanuts, Latex)';
COMMENT ON COLUMN allergies.severity IS 'Severity level: mild, moderate, severe';
COMMENT ON COLUMN allergies.reaction_symptoms IS 'Symptoms experienced during allergic reaction';
COMMENT ON COLUMN allergies.created_by_line_user_id IS 'LINE user ID of caregiver who added this allergy';

-- ============================================
-- 3. Emergency Contacts Table (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100),
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  priority INTEGER DEFAULT 1,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for emergency_contacts
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_patient
  ON emergency_contacts(patient_id);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_priority
  ON emergency_contacts(patient_id, priority);

COMMENT ON TABLE emergency_contacts IS 'Emergency contact information for patients';
COMMENT ON COLUMN emergency_contacts.priority IS 'Contact priority order (1 = highest priority)';
COMMENT ON COLUMN emergency_contacts.is_primary IS 'Mark as primary emergency contact';

-- Ensure only one primary contact per patient
CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_primary
  ON emergency_contacts(patient_id)
  WHERE is_primary = true;

-- ============================================
-- 4. Update emergency_contacts if exists
-- ============================================

DO $$
BEGIN
  -- Add priority if not exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emergency_contacts')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'emergency_contacts' AND column_name = 'priority'
     ) THEN
    ALTER TABLE emergency_contacts ADD COLUMN priority INTEGER DEFAULT 1;
  END IF;

  -- Add is_primary if not exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emergency_contacts')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'emergency_contacts' AND column_name = 'is_primary'
     ) THEN
    ALTER TABLE emergency_contacts ADD COLUMN is_primary BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================
-- 5. Medical History Log
-- ============================================

CREATE TABLE IF NOT EXISTS medical_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- 'hospitalization', 'surgery', 'diagnosis', 'treatment', 'checkup'
  description TEXT NOT NULL,
  hospital_name VARCHAR(255),
  doctor_name VARCHAR(255),
  outcome TEXT,
  documents JSONB, -- Array of document URLs/paths
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_line_user_id VARCHAR(255) -- FIXED: removed FK to group_members (optional)
);

CREATE INDEX IF NOT EXISTS idx_medical_history_patient
  ON medical_history(patient_id, event_date DESC);

COMMENT ON TABLE medical_history IS 'Timeline of significant medical events for patient';
COMMENT ON COLUMN medical_history.event_type IS 'Type: hospitalization, surgery, diagnosis, treatment, checkup';
COMMENT ON COLUMN medical_history.created_by_line_user_id IS 'LINE user ID of caregiver who logged this event';

-- ============================================
-- 6. Medication History (for reference)
-- ============================================

CREATE TABLE IF NOT EXISTS medication_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  medication_name VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE,
  reason TEXT,
  prescribed_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_history_patient
  ON medication_history(patient_id, start_date DESC);

COMMENT ON TABLE medication_history IS 'Historical record of past medications (discontinued or completed courses)';

-- ============================================
-- 7. Helper function: Get all allergies by type
-- ============================================

CREATE OR REPLACE FUNCTION get_patient_allergies(
  p_patient_id UUID,
  p_allergy_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  allergen_name VARCHAR(255),
  allergy_type VARCHAR(50),
  severity VARCHAR(50),
  reaction_symptoms TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.allergen_name,
    a.allergy_type,
    a.severity,
    a.reaction_symptoms
  FROM allergies a
  WHERE a.patient_id = p_patient_id
    AND (p_allergy_type IS NULL OR a.allergy_type = p_allergy_type)
  ORDER BY
    CASE a.severity
      WHEN 'severe' THEN 1
      WHEN 'moderate' THEN 2
      WHEN 'mild' THEN 3
      ELSE 4
    END,
    a.allergen_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_patient_allergies IS 'Get patient allergies, optionally filtered by type, ordered by severity';

-- ============================================
-- 8. Helper function: Check medication allergy
-- ============================================

CREATE OR REPLACE FUNCTION check_medication_allergy(
  p_patient_id UUID,
  p_medication_name VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
  has_allergy BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM allergies
    WHERE patient_id = p_patient_id
      AND allergy_type = 'medication'
      AND LOWER(allergen_name) = LOWER(p_medication_name)
  ) INTO has_allergy;

  RETURN has_allergy;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_medication_allergy IS 'Check if patient has allergy to specific medication';

-- ============================================
-- 9. Update triggers for updated_at
-- ============================================

-- Reuse existing trigger function if exists, or create new one
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to allergies table
DROP TRIGGER IF EXISTS update_allergies_updated_at ON allergies;
CREATE TRIGGER update_allergies_updated_at
  BEFORE UPDATE ON allergies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to emergency_contacts table
DROP TRIGGER IF EXISTS update_emergency_contacts_updated_at ON emergency_contacts;
CREATE TRIGGER update_emergency_contacts_updated_at
  BEFORE UPDATE ON emergency_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to medical_history table
DROP TRIGGER IF EXISTS update_medical_history_updated_at ON medical_history;
CREATE TRIGGER update_medical_history_updated_at
  BEFORE UPDATE ON medical_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. Row Level Security (RLS) - Optional
-- ============================================

-- Enable RLS for new tables (if using Supabase auth)
ALTER TABLE allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_history ENABLE ROW LEVEL SECURITY;

-- Note: Actual policies should be defined based on your auth setup
-- For now, allow all operations via service role

-- ============================================
-- Migration complete
-- ============================================

-- Log migration
INSERT INTO schema_migrations (version, description, executed_at)
VALUES (
  '004',
  'Oonjai Feedback Phase 2: Enhanced medical information, allergy tracking, medical history',
  NOW()
)
ON CONFLICT (version) DO NOTHING;

-- Success message
SELECT 'Migration 004 completed successfully!' as status;
-- Migration 005: Premium Features (Plus Package) - FIXED
-- Created: 2025-01-13
-- Updated: 2025-11-13 (Fixed for existing schema)
-- Purpose:
--   1. Custom report scheduling times
--   2. Report download with date range
--   3. Extended data retention
--   4. Advanced analytics settings

-- ============================================
-- 1. Package Management
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_name VARCHAR(50) NOT NULL UNIQUE, -- 'free', 'plus'
  display_name VARCHAR(100) NOT NULL,
  price_monthly DECIMAL(10,2) DEFAULT 0,
  features JSONB NOT NULL, -- Array of feature flags
  data_retention_days INTEGER DEFAULT 45, -- Free: 45 days, Plus: unlimited (-1)
  max_daily_notifications INTEGER DEFAULT 1, -- Free: 1, Plus: unlimited
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE subscription_packages IS 'Package definitions (Free and Plus)';
COMMENT ON COLUMN subscription_packages.features IS 'JSONB array of feature names available in this package';
COMMENT ON COLUMN subscription_packages.data_retention_days IS 'Days to keep data (-1 = unlimited)';

-- Insert default packages
INSERT INTO subscription_packages (package_name, display_name, price_monthly, features, data_retention_days, max_daily_notifications)
VALUES
  (
    'free',
    'ฟรี',
    0,
    '["daily_report", "weekly_report", "activity_logging", "emergency_alerts", "ai_respond"]'::jsonb,
    45,
    1
  ),
  (
    'plus',
    'Plus',
    299,
    '["daily_report", "weekly_report", "monthly_report", "activity_logging", "emergency_alerts", "ai_respond", "health_charts", "unlimited_storage", "export_pdf", "export_csv", "ai_insights", "custom_report_time"]'::jsonb,
    -1, -- Unlimited
    -1  -- Unlimited
  )
ON CONFLICT (package_name) DO NOTHING;

-- ============================================
-- 2. User Subscriptions (Group-based)
-- ============================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,  -- FIXED: caregiver_groups → groups
  package_id UUID NOT NULL REFERENCES subscription_packages(id),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN DEFAULT false,
  payment_method VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_group
  ON user_subscriptions(group_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON user_subscriptions(status, expires_at);

COMMENT ON TABLE user_subscriptions IS 'Group subscription to packages (Free or Plus)';
COMMENT ON COLUMN user_subscriptions.group_id IS 'LINE group that has this subscription';
COMMENT ON COLUMN user_subscriptions.expires_at IS 'Expiration date (NULL = never expires)';

-- ============================================
-- 3. Report Settings (Premium: Custom Time)
-- ============================================

CREATE TABLE IF NOT EXISTS report_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,  -- FIXED: caregiver_groups → groups

  -- Daily Report
  daily_report_enabled BOOLEAN DEFAULT true,
  daily_report_time TIME DEFAULT '20:00',

  -- Weekly Report (Plus only)
  weekly_report_enabled BOOLEAN DEFAULT false,
  weekly_report_day INTEGER DEFAULT 0 CHECK (weekly_report_day BETWEEN 0 AND 6), -- 0=Sunday
  weekly_report_time TIME DEFAULT '20:00',

  -- Monthly Report (Plus only)
  monthly_report_enabled BOOLEAN DEFAULT false,
  monthly_report_day INTEGER DEFAULT 1 CHECK (monthly_report_day BETWEEN 1 AND 28), -- Day of month
  monthly_report_time TIME DEFAULT '20:00',

  -- LINE notifications
  send_via_line BOOLEAN DEFAULT true,
  send_via_email BOOLEAN DEFAULT false,
  email_recipients JSONB, -- Array of email addresses

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE report_settings IS 'Custom report scheduling settings (Plus users can customize times)';
COMMENT ON COLUMN report_settings.daily_report_time IS 'Time to send daily report (Plus can customize, Free locked to 20:00)';
COMMENT ON COLUMN report_settings.weekly_report_day IS 'Day of week for weekly report (0=Sunday, 6=Saturday)';

-- ============================================
-- 4. Report Download History (Plus feature)
-- ============================================

CREATE TABLE IF NOT EXISTS report_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,  -- FIXED: caregiver_groups → groups
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom_range'
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  format VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'csv')),
  file_path VARCHAR(500),
  file_size_bytes INTEGER,
  downloaded_by_line_user_id VARCHAR(255), -- FIXED: removed FK to group_members (just store line_user_id)
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_downloads_group
  ON report_downloads(group_id, downloaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_downloads_patient
  ON report_downloads(patient_id, downloaded_at DESC);

COMMENT ON TABLE report_downloads IS 'History of report downloads (Plus feature)';
COMMENT ON COLUMN report_downloads.downloaded_by_line_user_id IS 'LINE user ID of person who downloaded';

-- ============================================
-- 5. Advanced Analytics Settings (Plus)
-- ============================================

CREATE TABLE IF NOT EXISTS analytics_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,  -- FIXED: caregiver_groups → groups

  -- Chart preferences
  show_medication_adherence BOOLEAN DEFAULT true,
  show_vitals_trends BOOLEAN DEFAULT true,
  show_water_intake_chart BOOLEAN DEFAULT true,
  show_activity_heatmap BOOLEAN DEFAULT true,

  -- AI Insights (Plus only)
  ai_insights_enabled BOOLEAN DEFAULT false,
  ai_suggestion_frequency VARCHAR(50) DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly'

  -- Alerts
  low_adherence_threshold INTEGER DEFAULT 70, -- Alert if adherence < 70%
  consecutive_missed_threshold INTEGER DEFAULT 2, -- Alert if missed X times in a row

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE analytics_settings IS 'Advanced analytics and AI insights settings (Plus features)';
COMMENT ON COLUMN analytics_settings.ai_insights_enabled IS 'Enable AI-powered health insights (Plus only)';

-- ============================================
-- 6. Helper function: Check if feature is available
-- ============================================

CREATE OR REPLACE FUNCTION has_feature_access(
  p_group_id UUID,
  p_feature_name VARCHAR(100)
)
RETURNS BOOLEAN AS $$
DECLARE
  package_features JSONB;
  has_access BOOLEAN;
BEGIN
  -- Get package features for the group
  SELECT sp.features
  INTO package_features
  FROM user_subscriptions us
  JOIN subscription_packages sp ON us.package_id = sp.id
  WHERE us.group_id = p_group_id
    AND us.status = 'active'
    AND (us.expires_at IS NULL OR us.expires_at > NOW());

  -- If no active subscription, default to free package
  IF package_features IS NULL THEN
    SELECT features
    INTO package_features
    FROM subscription_packages
    WHERE package_name = 'free';
  END IF;

  -- Check if feature exists in package
  has_access := package_features ? p_feature_name;

  RETURN COALESCE(has_access, false);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION has_feature_access IS 'Check if a group has access to a specific feature based on their subscription';

-- Example usage:
-- SELECT has_feature_access('group-uuid-here', 'export_pdf');

-- ============================================
-- 7. Helper function: Get data retention period
-- ============================================

CREATE OR REPLACE FUNCTION get_data_retention_days(
  p_group_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  retention_days INTEGER;
BEGIN
  SELECT sp.data_retention_days
  INTO retention_days
  FROM user_subscriptions us
  JOIN subscription_packages sp ON us.package_id = sp.id
  WHERE us.group_id = p_group_id
    AND us.status = 'active'
    AND (us.expires_at IS NULL OR us.expires_at > NOW());

  -- Default to free package if no subscription
  IF retention_days IS NULL THEN
    SELECT data_retention_days
    INTO retention_days
    FROM subscription_packages
    WHERE package_name = 'free';
  END IF;

  RETURN COALESCE(retention_days, 45);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_data_retention_days IS 'Get data retention period for a group (-1 = unlimited)';

-- Example usage:
-- SELECT get_data_retention_days('group-uuid-here');

-- ============================================
-- 8. Helper function: Get package name for group
-- ============================================

CREATE OR REPLACE FUNCTION get_group_package(
  p_group_id UUID
)
RETURNS VARCHAR(50) AS $$
DECLARE
  pkg_name VARCHAR(50);
BEGIN
  SELECT sp.package_name
  INTO pkg_name
  FROM user_subscriptions us
  JOIN subscription_packages sp ON us.package_id = sp.id
  WHERE us.group_id = p_group_id
    AND us.status = 'active'
    AND (us.expires_at IS NULL OR us.expires_at > NOW());

  RETURN COALESCE(pkg_name, 'free');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_group_package IS 'Get package name (free/plus) for a group';

-- ============================================
-- 9. Initialize default subscriptions for existing groups
-- ============================================

-- Create free subscription for all existing groups
INSERT INTO user_subscriptions (group_id, package_id, status)
SELECT
  g.id,
  (SELECT id FROM subscription_packages WHERE package_name = 'free'),
  'active'
FROM groups g
WHERE NOT EXISTS (
  SELECT 1 FROM user_subscriptions WHERE group_id = g.id
)
ON CONFLICT (group_id) DO NOTHING;

-- Create default report settings for existing groups
INSERT INTO report_settings (group_id)
SELECT g.id
FROM groups g
WHERE NOT EXISTS (
  SELECT 1 FROM report_settings WHERE group_id = g.id
)
ON CONFLICT (group_id) DO NOTHING;

-- Create default analytics settings for existing groups
INSERT INTO analytics_settings (group_id)
SELECT g.id
FROM groups g
WHERE NOT EXISTS (
  SELECT 1 FROM analytics_settings WHERE group_id = g.id
)
ON CONFLICT (group_id) DO NOTHING;

-- ============================================
-- 10. Update triggers
-- ============================================

-- Reuse update_updated_at_column function if exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_subscriptions
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for report_settings
DROP TRIGGER IF EXISTS update_report_settings_updated_at ON report_settings;
CREATE TRIGGER update_report_settings_updated_at
  BEFORE UPDATE ON report_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for analytics_settings
DROP TRIGGER IF EXISTS update_analytics_settings_updated_at ON analytics_settings;
CREATE TRIGGER update_analytics_settings_updated_at
  BEFORE UPDATE ON analytics_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. Row Level Security (RLS)
-- ============================================

ALTER TABLE subscription_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_settings ENABLE ROW LEVEL SECURITY;

-- Note: Actual policies should be defined based on your auth setup

-- ============================================
-- Migration complete
-- ============================================

-- Log migration
INSERT INTO schema_migrations (version, description, executed_at)
VALUES (
  '005',
  'Premium Features: Custom report scheduling, download with date range, advanced analytics',
  NOW()
)
ON CONFLICT (version) DO NOTHING;

-- Success message
SELECT 'Migration 005 completed successfully!' as status;

-- ============================================
-- Verification queries
-- ============================================

-- Check packages
SELECT * FROM subscription_packages ORDER BY package_name;

-- Check if all groups have subscriptions
SELECT
  COUNT(*) as total_groups,
  COUNT(us.id) as groups_with_subscriptions
FROM groups g
LEFT JOIN user_subscriptions us ON g.id = us.group_id;
