-- ============================================================
-- MIGRATION 010: Caregiver Patient Preferences (Phase 4)
-- ============================================================
-- Date: 2025-01-22
-- Description: Allow caregivers to set default patient for easier logging
-- Feature: Smart Default + Always Override UX

-- ============================================================
-- STEP 1: Create caregiver_patient_preferences table
-- ============================================================

CREATE TABLE IF NOT EXISTS caregiver_patient_preferences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  caregiver_line_user_id varchar(255) NOT NULL,
  default_patient_id uuid NOT NULL,

  -- Metadata
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  -- Foreign keys
  CONSTRAINT preferences_group_id_fkey FOREIGN KEY (group_id)
    REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT preferences_patient_id_fkey FOREIGN KEY (default_patient_id)
    REFERENCES patient_profiles(id) ON DELETE CASCADE,

  -- One preference per caregiver per group
  CONSTRAINT preferences_unique UNIQUE (group_id, caregiver_line_user_id)
);

-- ============================================================
-- STEP 2: Create indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_preferences_group_id
  ON caregiver_patient_preferences(group_id);

CREATE INDEX IF NOT EXISTS idx_preferences_caregiver
  ON caregiver_patient_preferences(caregiver_line_user_id);

CREATE INDEX IF NOT EXISTS idx_preferences_patient
  ON caregiver_patient_preferences(default_patient_id);

-- Composite index for fast lookup
CREATE INDEX IF NOT EXISTS idx_preferences_group_caregiver
  ON caregiver_patient_preferences(group_id, caregiver_line_user_id);

-- ============================================================
-- STEP 3: Add comments
-- ============================================================

COMMENT ON TABLE caregiver_patient_preferences IS 'Stores each caregiver''s default patient preference per group (Phase 4: Smart Default)';
COMMENT ON COLUMN caregiver_patient_preferences.group_id IS 'Which LINE group this preference belongs to';
COMMENT ON COLUMN caregiver_patient_preferences.caregiver_line_user_id IS 'LINE User ID of the caregiver';
COMMENT ON COLUMN caregiver_patient_preferences.default_patient_id IS 'Default patient for this caregiver (used when no patient name detected)';

-- ============================================================
-- STEP 4: Create helper functions
-- ============================================================

-- Function to get caregiver's default patient
CREATE OR REPLACE FUNCTION get_caregiver_default_patient(
  p_group_id uuid,
  p_caregiver_line_user_id varchar(255)
)
RETURNS uuid AS $$
DECLARE
  v_patient_id uuid;
BEGIN
  SELECT default_patient_id INTO v_patient_id
  FROM caregiver_patient_preferences
  WHERE group_id = p_group_id
    AND caregiver_line_user_id = p_caregiver_line_user_id;

  RETURN v_patient_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_caregiver_default_patient IS 'Get caregiver''s default patient for a group (returns NULL if not set)';

-- Function to set caregiver's default patient
CREATE OR REPLACE FUNCTION set_caregiver_default_patient(
  p_group_id uuid,
  p_caregiver_line_user_id varchar(255),
  p_patient_id uuid
)
RETURNS boolean AS $$
BEGIN
  -- Verify patient exists in group
  IF NOT EXISTS (
    SELECT 1 FROM group_patients
    WHERE group_id = p_group_id
      AND patient_id = p_patient_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Patient % is not in group %', p_patient_id, p_group_id;
  END IF;

  -- Insert or update preference
  INSERT INTO caregiver_patient_preferences (
    group_id,
    caregiver_line_user_id,
    default_patient_id
  )
  VALUES (p_group_id, p_caregiver_line_user_id, p_patient_id)
  ON CONFLICT (group_id, caregiver_line_user_id)
  DO UPDATE SET
    default_patient_id = p_patient_id,
    updated_at = now();

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_caregiver_default_patient IS 'Set or update caregiver''s default patient for a group';

-- Function to remove caregiver's preference
CREATE OR REPLACE FUNCTION remove_caregiver_default_patient(
  p_group_id uuid,
  p_caregiver_line_user_id varchar(255)
)
RETURNS boolean AS $$
BEGIN
  DELETE FROM caregiver_patient_preferences
  WHERE group_id = p_group_id
    AND caregiver_line_user_id = p_caregiver_line_user_id;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION remove_caregiver_default_patient IS 'Remove caregiver''s default patient preference';

-- ============================================================
-- STEP 5: Create view for easy querying
-- ============================================================

CREATE OR REPLACE VIEW v_caregiver_preferences AS
SELECT
  cp.id,
  cp.group_id,
  g.group_name,
  cp.caregiver_line_user_id,
  gm.display_name as caregiver_name,
  cp.default_patient_id,
  p.first_name || ' ' || p.last_name as default_patient_name,
  p.nickname as patient_nickname,
  cp.created_at,
  cp.updated_at
FROM caregiver_patient_preferences cp
JOIN groups g ON cp.group_id = g.id
LEFT JOIN group_members gm ON (
  cp.group_id = gm.group_id
  AND cp.caregiver_line_user_id = gm.line_user_id
)
LEFT JOIN patient_profiles p ON cp.default_patient_id = p.id
ORDER BY cp.created_at DESC;

COMMENT ON VIEW v_caregiver_preferences IS 'Human-readable view of caregiver preferences with names';

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check table created
SELECT 'caregiver_patient_preferences table' as check_item,
       COUNT(*) as record_count
FROM caregiver_patient_preferences;

-- Check functions exist
SELECT 'Functions created' as check_item,
       COUNT(*) as function_count
FROM pg_proc
WHERE proname IN (
  'get_caregiver_default_patient',
  'set_caregiver_default_patient',
  'remove_caregiver_default_patient'
);

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

SELECT 'Migration 010 completed: Caregiver patient preferences enabled (Phase 4)' as status;
