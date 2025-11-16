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
