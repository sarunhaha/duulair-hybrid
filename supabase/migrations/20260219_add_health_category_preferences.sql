-- Health Category Preferences: per-patient toggle for hiding/showing health categories in LIFF UI
-- Toggle only affects LIFF UI visibility; LINE Chat recording is unaffected.
-- Data is never deleted — just hidden from UI when disabled.

CREATE TABLE IF NOT EXISTS health_category_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  vitals_enabled BOOLEAN DEFAULT TRUE,
  glucose_enabled BOOLEAN DEFAULT TRUE,
  medications_enabled BOOLEAN DEFAULT TRUE,
  sleep_enabled BOOLEAN DEFAULT TRUE,
  water_enabled BOOLEAN DEFAULT TRUE,
  exercise_enabled BOOLEAN DEFAULT TRUE,
  mood_enabled BOOLEAN DEFAULT TRUE,
  symptoms_enabled BOOLEAN DEFAULT TRUE,
  notes_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id)
);

CREATE INDEX IF NOT EXISTS idx_health_category_preferences_patient
  ON health_category_preferences(patient_id);

-- RLS
ALTER TABLE health_category_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users"
  ON health_category_preferences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for authenticated users"
  ON health_category_preferences FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users"
  ON health_category_preferences FOR UPDATE
  TO authenticated
  USING (true);
