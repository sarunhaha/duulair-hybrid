-- Duulair Multi-Agent System - Database Schema
-- Supabase PostgreSQL Schema
-- Version: 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PATIENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name VARCHAR(255) NOT NULL,
  line_user_id VARCHAR(255) UNIQUE,
  birth_date DATE,
  medical_conditions JSONB DEFAULT '[]',
  medications JSONB DEFAULT '[]',
  caregivers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for LINE user lookups
CREATE INDEX idx_patients_line_user_id ON patients(line_user_id);

COMMENT ON TABLE patients IS 'Elderly patients being monitored by the system';
COMMENT ON COLUMN patients.caregivers IS 'Array of caregiver objects with line_user_id and role';

-- ============================================================
-- ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  message_id VARCHAR(255),
  task_type VARCHAR(50) NOT NULL, -- medication, vitals, water, walk, food
  value TEXT,
  metadata JSONB DEFAULT '{}',
  intent VARCHAR(50),
  processing_result JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_activity_logs_patient_id ON activity_logs(patient_id);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX idx_activity_logs_task_type ON activity_logs(task_type);

COMMENT ON TABLE activity_logs IS 'All patient activities and health data logged by agents';

-- ============================================================
-- ALERTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- emergency, warning, info
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for alert queries
CREATE INDEX idx_alerts_patient_id ON alerts(patient_id);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);
CREATE INDEX idx_alerts_timestamp ON alerts(timestamp DESC);
CREATE INDEX idx_alerts_level ON alerts(level);

COMMENT ON TABLE alerts IS 'Critical alerts and notifications for caregivers';

-- ============================================================
-- AGENT STATES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name VARCHAR(100) NOT NULL UNIQUE,
  state JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_states_agent_name ON agent_states(agent_name);

COMMENT ON TABLE agent_states IS 'Persistent state storage for agents';

-- ============================================================
-- AGENT SPECS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_specs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  role TEXT,
  config JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_specs_name ON agent_specs(name);
CREATE INDEX idx_agent_specs_active ON agent_specs(active);

COMMENT ON TABLE agent_specs IS 'Agent configuration and specifications';

-- ============================================================
-- ERROR LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  level VARCHAR(20),
  agent VARCHAR(100),
  message TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX idx_error_logs_agent ON error_logs(agent);
CREATE INDEX idx_error_logs_level ON error_logs(level);

COMMENT ON TABLE error_logs IS 'System error and debug logs';

-- ============================================================
-- AGENT LOGS TABLE (Optional - for detailed monitoring)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name VARCHAR(100) NOT NULL,
  success BOOLEAN NOT NULL,
  processing_time INTEGER, -- milliseconds
  message_id VARCHAR(255),
  intent VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_logs_agent_name ON agent_logs(agent_name);
CREATE INDEX idx_agent_logs_created_at ON agent_logs(created_at DESC);

COMMENT ON TABLE agent_logs IS 'Performance metrics and monitoring for agents';

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (bypass RLS)
-- Anon users have limited access

-- Patients: Public read for authenticated users
CREATE POLICY "Public patients are viewable by everyone"
  ON patients FOR SELECT
  USING (true);

-- Activity logs: Users can read their own logs
CREATE POLICY "Users can view their own activity logs"
  ON activity_logs FOR SELECT
  USING (true);

-- Alerts: Users can view alerts
CREATE POLICY "Users can view alerts"
  ON alerts FOR SELECT
  USING (true);

-- Agent specs: Public read
CREATE POLICY "Agent specs are viewable by everyone"
  ON agent_specs FOR SELECT
  USING (active = true);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for patients
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for agent_specs
CREATE TRIGGER update_agent_specs_updated_at
  BEFORE UPDATE ON agent_specs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA (Optional - for testing)
-- ============================================================

-- Insert default agent specs
INSERT INTO agent_specs (name, role, config, active) VALUES
  ('intent', 'Classify user messages into intents', '{"model": "claude-3-haiku-20240307", "temperature": 0.1, "maxTokens": 200}', true),
  ('health', 'Process and log health data', '{"model": "claude-3-haiku-20240307", "temperature": 0.3, "maxTokens": 1000}', true),
  ('report', 'Generate daily and weekly reports', '{"model": "claude-3-sonnet-20240229", "temperature": 0.7, "maxTokens": 2000}', true),
  ('alert', 'Monitor and send alerts', '{"model": "claude-3-haiku-20240307", "temperature": 0.1, "maxTokens": 500}', true),
  ('dialog', 'Handle general conversations', '{"model": "claude-3-haiku-20240307", "temperature": 0.8, "maxTokens": 200}', true)
ON CONFLICT (name) DO NOTHING;

-- Example test patient (optional)
-- INSERT INTO patients (display_name, line_user_id) VALUES
--   ('คุณยาย มะลิ', 'U1234567890abcdef')
-- ON CONFLICT (line_user_id) DO NOTHING;

-- ============================================================
-- VIEWS (Optional - for easier querying)
-- ============================================================

-- Daily activity summary
CREATE OR REPLACE VIEW daily_activity_summary AS
SELECT
  patient_id,
  DATE(timestamp) as date,
  task_type,
  COUNT(*) as count,
  JSONB_AGG(metadata) as details
FROM activity_logs
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY patient_id, DATE(timestamp), task_type
ORDER BY date DESC, patient_id;

COMMENT ON VIEW daily_activity_summary IS 'Daily summary of patient activities for the last 7 days';

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Composite indexes for common query patterns
CREATE INDEX idx_activity_logs_patient_timestamp ON activity_logs(patient_id, timestamp DESC);
CREATE INDEX idx_alerts_patient_resolved ON alerts(patient_id, resolved);

-- JSONB indexes for metadata queries (if needed)
-- CREATE INDEX idx_activity_logs_metadata ON activity_logs USING GIN (metadata);
-- CREATE INDEX idx_alerts_metadata ON alerts USING GIN (metadata);

-- ============================================================
-- GRANTS (Optional - adjust based on your needs)
-- ============================================================

-- Grant permissions to authenticated users
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT INSERT, UPDATE ON activity_logs TO authenticated;
-- GRANT INSERT ON alerts TO authenticated;

COMMENT ON SCHEMA public IS 'Duulair Multi-Agent System Database Schema';
