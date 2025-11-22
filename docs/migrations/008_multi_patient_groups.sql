-- ============================================================
-- MIGRATION 008: Multi-Patient Group Support
-- ============================================================
-- Date: 2025-01-21
-- Description: Allow multiple patients in one LINE group
-- Change: groups.patient_id → group_patients (many-to-many)

-- ============================================================
-- STEP 1: Create group_patients table (many-to-many)
-- ============================================================

CREATE TABLE IF NOT EXISTS group_patients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  added_by_caregiver_id uuid,
  added_at timestamp DEFAULT now(),
  is_active boolean DEFAULT true,

  -- Foreign keys
  CONSTRAINT group_patients_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT group_patients_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE,
  CONSTRAINT group_patients_caregiver_id_fkey FOREIGN KEY (added_by_caregiver_id) REFERENCES caregiver_profiles(id) ON DELETE SET NULL,

  -- Unique constraint: one patient can't be added twice to same group
  CONSTRAINT group_patients_unique UNIQUE (group_id, patient_id)
);

-- ============================================================
-- STEP 2: Migrate existing data from groups.patient_id
-- ============================================================

-- Copy existing patient_id to group_patients table
INSERT INTO group_patients (group_id, patient_id, added_by_caregiver_id, added_at)
SELECT
  id as group_id,
  patient_id,
  primary_caregiver_id as added_by_caregiver_id,
  created_at as added_at
FROM groups
WHERE patient_id IS NOT NULL;

-- ============================================================
-- STEP 3: Drop old patient_id column from groups
-- ============================================================

-- Drop foreign key constraint first
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_patient_id_fkey;

-- Drop the column
ALTER TABLE groups DROP COLUMN IF EXISTS patient_id;

-- ============================================================
-- STEP 4: Create indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_group_patients_group_id ON group_patients(group_id);
CREATE INDEX IF NOT EXISTS idx_group_patients_patient_id ON group_patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_group_patients_is_active ON group_patients(is_active);

-- ============================================================
-- STEP 5: Add comments
-- ============================================================

COMMENT ON TABLE group_patients IS 'Many-to-many: Multiple patients can be managed in one LINE group';
COMMENT ON COLUMN group_patients.added_by_caregiver_id IS 'Which caregiver added this patient to the group';
COMMENT ON COLUMN group_patients.is_active IS 'Whether this patient is still being managed in this group';

-- ============================================================
-- STEP 6: Update views
-- ============================================================

-- Drop old view
DROP VIEW IF EXISTS v_groups_summary;

-- Create new view with patient count
CREATE OR REPLACE VIEW v_groups_summary AS
SELECT
  g.id,
  g.line_group_id,
  g.group_name,
  g.is_active,
  g.created_at,

  -- Patient count
  (SELECT COUNT(*)
   FROM group_patients gp
   WHERE gp.group_id = g.id AND gp.is_active = true) as patient_count,

  -- Patient names (comma-separated)
  (SELECT STRING_AGG(p.first_name || ' ' || p.last_name, ', ')
   FROM group_patients gp
   JOIN patient_profiles p ON gp.patient_id = p.id
   WHERE gp.group_id = g.id AND gp.is_active = true) as patient_names,

  -- Caregiver info
  c.first_name || ' ' || c.last_name as caregiver_name,
  c.phone_number as caregiver_phone,

  -- Member count
  (SELECT COUNT(*)
   FROM group_members gm
   WHERE gm.group_id = g.id AND gm.is_active = true) as active_members_count,

  -- Activity count (last 7 days)
  (SELECT COUNT(*)
   FROM activity_logs al
   WHERE al.group_id = g.id
     AND al.timestamp >= NOW() - INTERVAL '7 days') as activities_last_7_days

FROM groups g
LEFT JOIN caregiver_profiles c ON g.primary_caregiver_id = c.id
ORDER BY g.created_at DESC;

COMMENT ON VIEW v_groups_summary IS 'Summary view of all groups with multiple patients support';

-- ============================================================
-- STEP 7: Create helper functions
-- ============================================================

-- Function to get all patients in a group
CREATE OR REPLACE FUNCTION get_group_patients(p_group_id uuid)
RETURNS TABLE (
  patient_id uuid,
  patient_name text,
  age integer,
  added_at timestamp
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.first_name || ' ' || p.last_name,
    EXTRACT(YEAR FROM AGE(p.birth_date))::integer,
    gp.added_at
  FROM group_patients gp
  JOIN patient_profiles p ON gp.patient_id = p.id
  WHERE gp.group_id = p_group_id
    AND gp.is_active = true
  ORDER BY gp.added_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to add patient to group
CREATE OR REPLACE FUNCTION add_patient_to_group(
  p_group_id uuid,
  p_patient_id uuid,
  p_caregiver_id uuid
)
RETURNS boolean AS $$
BEGIN
  INSERT INTO group_patients (group_id, patient_id, added_by_caregiver_id)
  VALUES (p_group_id, p_patient_id, p_caregiver_id)
  ON CONFLICT (group_id, patient_id) DO UPDATE
  SET is_active = true, added_at = now();

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check table created
SELECT 'group_patients table' as check_item, COUNT(*) as record_count
FROM group_patients;

-- Check migration worked
SELECT
  g.id,
  g.group_name,
  COUNT(gp.patient_id) as patient_count
FROM groups g
LEFT JOIN group_patients gp ON g.id = gp.group_id
GROUP BY g.id, g.group_name
ORDER BY patient_count DESC;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

SELECT 'Migration 008 completed: Multi-patient groups enabled' as status;
