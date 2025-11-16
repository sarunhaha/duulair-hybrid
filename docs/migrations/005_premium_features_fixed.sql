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
