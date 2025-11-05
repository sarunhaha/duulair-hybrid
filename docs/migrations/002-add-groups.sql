-- ============================================================
-- MIGRATION 002: Add Group-Based Flow Support
-- ============================================================
-- Version: 1.0.0
-- Date: 2025-11-05
-- Description: Add tables and columns to support LINE Group-based care model
-- Related: TASK-002-GROUP-BASED-FLOW.md

-- ============================================================
-- NEW TABLE: groups
-- ============================================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_group_id VARCHAR(255) UNIQUE NOT NULL,
  group_name VARCHAR(255),
  patient_id UUID REFERENCES patient_profiles(id) ON DELETE CASCADE,
  primary_caregiver_id UUID REFERENCES caregiver_profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for groups
CREATE INDEX IF NOT EXISTS idx_groups_line_group_id ON groups(line_group_id);
CREATE INDEX IF NOT EXISTS idx_groups_patient_id ON groups(patient_id);
CREATE INDEX IF NOT EXISTS idx_groups_caregiver_id ON groups(primary_caregiver_id);
CREATE INDEX IF NOT EXISTS idx_groups_is_active ON groups(is_active);

-- Comments
COMMENT ON TABLE groups IS 'LINE Groups for family-based patient care (TASK-002)';
COMMENT ON COLUMN groups.line_group_id IS 'LINE Group ID from webhook events';
COMMENT ON COLUMN groups.patient_id IS 'The patient being cared for in this group';
COMMENT ON COLUMN groups.primary_caregiver_id IS 'Main caregiver who set up the group';
COMMENT ON COLUMN groups.is_active IS 'Whether group is active (bot still in group)';

-- ============================================================
-- NEW TABLE: group_members
-- ============================================================
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  line_user_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  picture_url TEXT,
  role VARCHAR(50) CHECK (role IN ('caregiver', 'patient', 'family')),
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,

  CONSTRAINT group_members_unique UNIQUE (group_id, line_user_id)
);

-- Indexes for group_members
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_line_user_id ON group_members(line_user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_is_active ON group_members(is_active);

-- Comments
COMMENT ON TABLE group_members IS 'Members of each LINE group (all can interact with bot)';
COMMENT ON COLUMN group_members.role IS 'Role in the group: caregiver (manager), patient (if has LINE), family (helper)';
COMMENT ON COLUMN group_members.is_active IS 'Whether member is still in group';

-- ============================================================
-- ALTER TABLE: activity_logs
-- Add group context and actor tracking
-- ============================================================
DO $$
BEGIN
  -- Add group_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE activity_logs
      ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

    CREATE INDEX idx_activity_logs_group_id ON activity_logs(group_id);
  END IF;

  -- Add actor_line_user_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'actor_line_user_id'
  ) THEN
    ALTER TABLE activity_logs
      ADD COLUMN actor_line_user_id VARCHAR(255);

    CREATE INDEX idx_activity_logs_actor ON activity_logs(actor_line_user_id);
  END IF;

  -- Add actor_display_name if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'actor_display_name'
  ) THEN
    ALTER TABLE activity_logs
      ADD COLUMN actor_display_name VARCHAR(255);
  END IF;

  -- Add source if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'source'
  ) THEN
    ALTER TABLE activity_logs
      ADD COLUMN source VARCHAR(50) DEFAULT '1:1' CHECK (source IN ('1:1', 'group'));
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN activity_logs.group_id IS 'Group where activity was logged (NULL if 1:1)';
COMMENT ON COLUMN activity_logs.actor_line_user_id IS 'LINE user ID of who logged this activity';
COMMENT ON COLUMN activity_logs.actor_display_name IS 'Display name of actor at time of logging';
COMMENT ON COLUMN activity_logs.source IS 'Where activity came from: 1:1 chat or group chat';

-- ============================================================
-- ALTER TABLE: users
-- Add primary group reference (for future multi-group support)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'primary_group_id'
  ) THEN
    ALTER TABLE users
      ADD COLUMN primary_group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

    CREATE INDEX idx_users_primary_group ON users(primary_group_id);
  END IF;
END $$;

COMMENT ON COLUMN users.primary_group_id IS 'Primary/default group for this user (if caregiver manages multiple groups)';

-- ============================================================
-- UPDATE: patient_profiles
-- Ensure user_id can be NULL (for patients without LINE)
-- ============================================================
DO $$
BEGIN
  -- Drop NOT NULL constraint if exists
  ALTER TABLE patient_profiles
    ALTER COLUMN user_id DROP NOT NULL;

  -- Drop UNIQUE constraint if exists (user_id can be NULL for multiple patients without LINE)
  -- Note: This is already handled in current schema

EXCEPTION
  WHEN OTHERS THEN
    -- Constraint might not exist, ignore error
    NULL;
END $$;

COMMENT ON COLUMN patient_profiles.user_id IS 'LINE user ID of patient (NULL if patient does not have LINE account)';

-- ============================================================
-- TRIGGERS: Auto-update updated_at
-- ============================================================

-- Trigger for groups table
CREATE OR REPLACE FUNCTION update_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_groups_updated_at ON groups;
CREATE TRIGGER trigger_update_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_groups_updated_at();

-- ============================================================
-- VIEWS: Useful queries
-- ============================================================

-- View: Active groups with member counts
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

  -- Member stats
  (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.is_active = true) as active_members_count,

  -- Activity stats (last 7 days)
  (SELECT COUNT(*) FROM activity_logs al
   WHERE al.group_id = g.id
   AND al.timestamp >= NOW() - INTERVAL '7 days') as activities_last_7_days

FROM groups g
LEFT JOIN patient_profiles p ON g.patient_id = p.id
LEFT JOIN caregiver_profiles c ON g.primary_caregiver_id = c.id
ORDER BY g.created_at DESC;

COMMENT ON VIEW v_groups_summary IS 'Summary view of all groups with patient, caregiver, and activity stats';

-- View: Group members with roles
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

  -- Activity count
  (SELECT COUNT(*) FROM activity_logs al
   WHERE al.actor_line_user_id = gm.line_user_id
   AND al.group_id = gm.group_id) as total_activities

FROM group_members gm
JOIN groups g ON gm.group_id = g.id
LEFT JOIN patient_profiles p ON g.patient_id = p.id
ORDER BY gm.joined_at DESC;

COMMENT ON VIEW v_group_members_detail IS 'Detailed view of group members with activity counts';

-- ============================================================
-- SAMPLE QUERIES (for testing)
-- ============================================================

-- Get all active groups
-- SELECT * FROM v_groups_summary WHERE is_active = true;

-- Get all members of a specific group
-- SELECT * FROM v_group_members_detail WHERE group_id = 'xxx';

-- Get recent activities in a group with actors
-- SELECT
--   al.timestamp,
--   al.task_type,
--   al.value,
--   al.actor_display_name,
--   al.source
-- FROM activity_logs al
-- WHERE al.group_id = 'xxx'
-- ORDER BY al.timestamp DESC
-- LIMIT 50;

-- Get groups with no activity in last 7 days (inactive)
-- SELECT * FROM v_groups_summary
-- WHERE is_active = true
-- AND activities_last_7_days = 0
-- ORDER BY created_at DESC;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check that all tables exist
SELECT
  tablename,
  schemaname
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('groups', 'group_members')
ORDER BY tablename;

-- Check new columns in activity_logs
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'activity_logs'
  AND column_name IN ('group_id', 'actor_line_user_id', 'actor_display_name', 'source')
ORDER BY column_name;

-- Check indexes
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('groups', 'group_members', 'activity_logs', 'users')
  AND indexname LIKE '%group%'
ORDER BY tablename, indexname;

-- ============================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================

-- CAUTION: This will delete all group data!
-- Only run if you need to completely rollback this migration

/*
-- Drop views
DROP VIEW IF EXISTS v_group_members_detail;
DROP VIEW IF EXISTS v_groups_summary;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS trigger_update_groups_updated_at ON groups;
DROP FUNCTION IF EXISTS update_groups_updated_at();

-- Remove columns from activity_logs
ALTER TABLE activity_logs DROP COLUMN IF EXISTS source;
ALTER TABLE activity_logs DROP COLUMN IF EXISTS actor_display_name;
ALTER TABLE activity_logs DROP COLUMN IF EXISTS actor_line_user_id;
ALTER TABLE activity_logs DROP COLUMN IF EXISTS group_id;

-- Remove column from users
ALTER TABLE users DROP COLUMN IF EXISTS primary_group_id;

-- Drop tables (CASCADE to remove dependencies)
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;

-- Verify rollback
SELECT 'Rollback complete' as status;
*/

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

SELECT 'Migration 002 completed successfully' as status;
