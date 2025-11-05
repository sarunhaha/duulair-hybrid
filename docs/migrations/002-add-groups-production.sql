-- ============================================================
-- MIGRATION 002: Add Group-Based Flow Support (PRODUCTION)
-- ============================================================
-- Version: 1.0.0
-- Date: 2025-11-05
-- Description: Add tables and columns to support LINE Group-based care model
-- Related: TASK-002-GROUP-BASED-FLOW.md
-- Compatible with: Current production schema

-- ============================================================
-- STEP 1: CREATE NEW TABLES
-- ============================================================

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_group_id varchar NOT NULL UNIQUE,
  group_name varchar,
  patient_id uuid,
  primary_caregiver_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  -- Foreign keys
  CONSTRAINT groups_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE,
  CONSTRAINT groups_caregiver_id_fkey FOREIGN KEY (primary_caregiver_id) REFERENCES caregiver_profiles(id) ON DELETE SET NULL
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  line_user_id varchar NOT NULL,
  display_name varchar,
  picture_url text,
  role varchar CHECK (role IN ('caregiver', 'patient', 'family')),
  is_active boolean DEFAULT true,
  joined_at timestamp DEFAULT now(),
  left_at timestamp,

  -- Foreign key
  CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,

  -- Unique constraint
  CONSTRAINT group_members_unique UNIQUE (group_id, line_user_id)
);

-- ============================================================
-- STEP 2: CREATE INDEXES FOR NEW TABLES
-- ============================================================

-- Indexes for groups
CREATE INDEX IF NOT EXISTS idx_groups_line_group_id ON groups(line_group_id);
CREATE INDEX IF NOT EXISTS idx_groups_patient_id ON groups(patient_id);
CREATE INDEX IF NOT EXISTS idx_groups_caregiver_id ON groups(primary_caregiver_id);
CREATE INDEX IF NOT EXISTS idx_groups_is_active ON groups(is_active);

-- Indexes for group_members
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_line_user_id ON group_members(line_user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_is_active ON group_members(is_active);

-- ============================================================
-- STEP 3: ADD COMMENTS TO NEW TABLES
-- ============================================================

COMMENT ON TABLE groups IS 'LINE Groups for family-based patient care (TASK-002)';
COMMENT ON COLUMN groups.line_group_id IS 'LINE Group ID from webhook events';
COMMENT ON COLUMN groups.patient_id IS 'The patient being cared for in this group';
COMMENT ON COLUMN groups.primary_caregiver_id IS 'Main caregiver who set up the group';
COMMENT ON COLUMN groups.is_active IS 'Whether group is active (bot still in group)';

COMMENT ON TABLE group_members IS 'Members of each LINE group (all can interact with bot)';
COMMENT ON COLUMN group_members.role IS 'Role in the group: caregiver (manager), patient (if has LINE), family (helper)';
COMMENT ON COLUMN group_members.is_active IS 'Whether member is still in group';

-- ============================================================
-- STEP 4: ALTER EXISTING TABLES - ADD COLUMNS
-- ============================================================

-- Add columns to activity_logs (safe - checks if exists first)
DO $$
BEGIN
  -- Add group_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
      AND column_name = 'group_id'
  ) THEN
    ALTER TABLE activity_logs ADD COLUMN group_id uuid;
  END IF;

  -- Add actor_line_user_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
      AND column_name = 'actor_line_user_id'
  ) THEN
    ALTER TABLE activity_logs ADD COLUMN actor_line_user_id varchar;
  END IF;

  -- Add actor_display_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
      AND column_name = 'actor_display_name'
  ) THEN
    ALTER TABLE activity_logs ADD COLUMN actor_display_name varchar;
  END IF;

  -- Add source
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
      AND column_name = 'source'
  ) THEN
    ALTER TABLE activity_logs ADD COLUMN source varchar DEFAULT '1:1' CHECK (source IN ('1:1', 'group'));
  END IF;
END $$;

-- Add foreign key for activity_logs.group_id (safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activity_logs_group_id_fkey'
      AND table_name = 'activity_logs'
  ) THEN
    ALTER TABLE activity_logs
      ADD CONSTRAINT activity_logs_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add column to users (safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'primary_group_id'
  ) THEN
    ALTER TABLE users ADD COLUMN primary_group_id uuid;
  END IF;
END $$;

-- Add foreign key for users.primary_group_id (safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_primary_group_id_fkey'
      AND table_name = 'users'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_primary_group_id_fkey
      FOREIGN KEY (primary_group_id) REFERENCES groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- STEP 5: MODIFY EXISTING COLUMNS
-- ============================================================

-- Allow patient_profiles.user_id to be NULL (for patients without LINE)
ALTER TABLE patient_profiles ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================
-- STEP 6: CREATE INDEXES FOR NEW COLUMNS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_activity_logs_group_id ON activity_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs(actor_line_user_id);
CREATE INDEX IF NOT EXISTS idx_users_primary_group ON users(primary_group_id);

-- ============================================================
-- STEP 7: ADD COMMENTS TO NEW COLUMNS
-- ============================================================

COMMENT ON COLUMN activity_logs.group_id IS 'Group where activity was logged (NULL if 1:1)';
COMMENT ON COLUMN activity_logs.actor_line_user_id IS 'LINE user ID of who logged this activity';
COMMENT ON COLUMN activity_logs.actor_display_name IS 'Display name of actor at time of logging';
COMMENT ON COLUMN activity_logs.source IS 'Where activity came from: 1:1 chat or group chat';

COMMENT ON COLUMN users.primary_group_id IS 'Primary/default group for this user (if caregiver manages multiple groups)';

COMMENT ON COLUMN patient_profiles.user_id IS 'LINE user ID of patient (NULL if patient does not have LINE account)';

-- ============================================================
-- STEP 8: CREATE TRIGGERS
-- ============================================================

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for groups
DROP TRIGGER IF EXISTS trigger_update_groups_updated_at ON groups;
CREATE TRIGGER trigger_update_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_groups_updated_at();

-- ============================================================
-- STEP 9: CREATE VIEWS
-- ============================================================

-- View: Active groups summary
CREATE OR REPLACE VIEW v_groups_summary AS
SELECT
  g.id,
  g.line_group_id,
  g.group_name,
  g.is_active,
  g.created_at,

  -- Patient info
  p.first_name || ' ' || p.last_name as patient_name,
  EXTRACT(YEAR FROM AGE(p.birth_date)) as patient_age,
  p.gender as patient_gender,

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
LEFT JOIN patient_profiles p ON g.patient_id = p.id
LEFT JOIN caregiver_profiles c ON g.primary_caregiver_id = c.id
ORDER BY g.created_at DESC;

COMMENT ON VIEW v_groups_summary IS 'Summary view of all groups with patient, caregiver, and activity stats';

-- View: Group members detail
CREATE OR REPLACE VIEW v_group_members_detail AS
SELECT
  gm.id,
  gm.group_id,
  g.group_name,
  gm.line_user_id,
  gm.display_name,
  gm.picture_url,
  gm.role,
  gm.is_active,
  gm.joined_at,
  gm.left_at,

  -- Patient name
  p.first_name || ' ' || p.last_name as patient_name,

  -- Activity count by this member
  (SELECT COUNT(*)
   FROM activity_logs al
   WHERE al.actor_line_user_id = gm.line_user_id
     AND al.group_id = gm.group_id) as total_activities

FROM group_members gm
JOIN groups g ON gm.group_id = g.id
LEFT JOIN patient_profiles p ON g.patient_id = p.id
ORDER BY gm.joined_at DESC;

COMMENT ON VIEW v_group_members_detail IS 'Detailed view of group members with activity counts';

-- ============================================================
-- STEP 10: VERIFICATION QUERIES
-- ============================================================

-- Check new tables
SELECT
  'groups' as table_name,
  COUNT(*) as record_count
FROM groups
UNION ALL
SELECT
  'group_members' as table_name,
  COUNT(*) as record_count
FROM group_members;

-- Check new columns in activity_logs
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activity_logs'
  AND column_name IN ('group_id', 'actor_line_user_id', 'actor_display_name', 'source')
ORDER BY ordinal_position;

-- Check new column in users
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'primary_group_id';

-- Check patient_profiles.user_id nullable
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'patient_profiles'
  AND column_name = 'user_id';

-- Check indexes
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE '%group%'
    OR indexname LIKE '%actor%'
  )
ORDER BY tablename, indexname;

-- Check views
SELECT
  schemaname,
  viewname
FROM pg_views
WHERE schemaname = 'public'
  AND viewname LIKE 'v_group%'
ORDER BY viewname;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

SELECT
  'Migration 002 completed successfully' as status,
  NOW() as completed_at;

-- Summary report
SELECT
  'Tables created: groups, group_members' as step_1
UNION ALL
SELECT
  'Columns added: activity_logs (4), users (1)' as step_2
UNION ALL
SELECT
  'Indexes created: 9' as step_3
UNION ALL
SELECT
  'Views created: 2' as step_4
UNION ALL
SELECT
  'Triggers created: 1' as step_5;
