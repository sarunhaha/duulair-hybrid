-- Lab Results table: stores individual test values across all panels (CBC, Liver, Kidney, Lipid, etc.)
-- Each row = 1 test value, grouped by test_type (panel) and lab_date

CREATE TABLE IF NOT EXISTS lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL,       -- 'cbc', 'liver', 'kidney', 'lipid', 'diabetes', 'thyroid'
  test_name TEXT NOT NULL,       -- 'Platelet', 'ALT', 'Creatinine', etc.
  value DECIMAL NOT NULL,
  unit TEXT,                     -- 'mg/dL', 'U/L', '%', etc.
  normal_min DECIMAL,
  normal_max DECIMAL,
  status TEXT CHECK (status IN ('normal', 'high', 'low', 'critical')),
  lab_date DATE,                 -- date of the lab test
  lab_name TEXT,                 -- hospital/lab name (optional)
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_results_patient ON lab_results(patient_id);
CREATE INDEX idx_lab_results_type ON lab_results(test_type);
CREATE INDEX idx_lab_results_date ON lab_results(lab_date);

ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

-- Add lab_results_enabled to health_category_preferences
ALTER TABLE health_category_preferences
  ADD COLUMN IF NOT EXISTS lab_results_enabled BOOLEAN DEFAULT TRUE;
