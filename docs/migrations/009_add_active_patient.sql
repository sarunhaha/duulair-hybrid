-- ============================================================
-- MIGRATION 009: Add Active Patient Selection
-- ============================================================
-- Date: 2025-01-21
-- Description: Allow groups to select which patient is currently active
-- Feature: /switch command support

-- ============================================================
-- STEP 1: Add active_patient_id to groups table
-- ============================================================

ALTER TABLE groups
ADD COLUMN IF NOT EXISTS active_patient_id uuid;

-- Add foreign key constraint
ALTER TABLE groups
ADD CONSTRAINT groups_active_patient_id_fkey
FOREIGN KEY (active_patient_id)
REFERENCES patient_profiles(id)
ON DELETE SET NULL;

-- ============================================================
-- STEP 2: Set default active patient (first patient by added_at)
-- ============================================================

-- For each group, set active_patient_id to the first patient added
UPDATE groups g
SET active_patient_id = (
  SELECT gp.patient_id
  FROM group_patients gp
  WHERE gp.group_id = g.id
    AND gp.is_active = true
  ORDER BY gp.added_at ASC
  LIMIT 1
)
WHERE active_patient_id IS NULL;

-- ============================================================
-- STEP 3: Create index
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_groups_active_patient ON groups(active_patient_id);

-- ============================================================
-- STEP 4: Add comments
-- ============================================================

COMMENT ON COLUMN groups.active_patient_id IS 'Currently selected patient for group operations (NULL = use first patient)';

-- ============================================================
-- STEP 5: Create helper function to switch patient
-- ============================================================

CREATE OR REPLACE FUNCTION switch_active_patient(
  p_group_id uuid,
  p_patient_id uuid
)
RETURNS TABLE (
  success boolean,
  message text,
  patient_name text
) AS $$
DECLARE
  v_patient_exists boolean;
  v_patient_name text;
BEGIN
  -- Check if patient exists in this group
  SELECT EXISTS(
    SELECT 1 FROM group_patients
    WHERE group_id = p_group_id
      AND patient_id = p_patient_id
      AND is_active = true
  ) INTO v_patient_exists;

  IF NOT v_patient_exists THEN
    RETURN QUERY SELECT false, 'ผู้ป่วยไม่อยู่ในกลุ่มนี้'::text, NULL::text;
    RETURN;
  END IF;

  -- Get patient name
  SELECT first_name || ' ' || last_name
  INTO v_patient_name
  FROM patient_profiles
  WHERE id = p_patient_id;

  -- Update active patient
  UPDATE groups
  SET active_patient_id = p_patient_id
  WHERE id = p_group_id;

  RETURN QUERY SELECT true, 'เปลี่ยนผู้ป่วยสำเร็จ'::text, v_patient_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check column added
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'groups'
  AND column_name = 'active_patient_id';

-- Check active patients set correctly
SELECT
  g.id,
  g.group_name,
  g.active_patient_id,
  p.first_name || ' ' || p.last_name as active_patient_name
FROM groups g
LEFT JOIN patient_profiles p ON g.active_patient_id = p.id;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

SELECT 'Migration 009 completed: Active patient selection enabled' as status;
