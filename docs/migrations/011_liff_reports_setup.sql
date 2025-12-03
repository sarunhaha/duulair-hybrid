-- Migration: 011_liff_reports_setup.sql
-- Setup for LIFF Report Dashboard
-- - Create daily_patient_summaries table for pre-aggregated data
-- - Create report_access_logs for audit/rate limiting
-- - Setup pg_cron job for nightly aggregation
--
-- Prerequisites:
-- 1. Deploy Edge Function: supabase functions deploy aggregate-daily-summaries
-- 2. Enable pg_cron extension (if not already enabled)

-- ============================================
-- STEP 1: Create daily_patient_summaries table
-- ============================================

CREATE TABLE IF NOT EXISTS public.daily_patient_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  summary_date DATE NOT NULL,

  -- Blood Pressure Summary
  bp_readings_count INTEGER DEFAULT 0,
  bp_systolic_avg NUMERIC(5,1),
  bp_systolic_min INTEGER,
  bp_systolic_max INTEGER,
  bp_diastolic_avg NUMERIC(5,1),
  bp_diastolic_min INTEGER,
  bp_diastolic_max INTEGER,
  bp_status CHARACTER VARYING, -- normal, elevated, high, crisis

  -- Heart Rate
  heart_rate_avg INTEGER,
  heart_rate_min INTEGER,
  heart_rate_max INTEGER,

  -- Medications
  medications_scheduled INTEGER DEFAULT 0,
  medications_taken INTEGER DEFAULT 0,
  medications_missed INTEGER DEFAULT 0,
  medication_compliance_percent NUMERIC(5,2),

  -- Water Intake
  water_intake_ml INTEGER DEFAULT 0,
  water_goal_ml INTEGER DEFAULT 2000,
  water_compliance_percent NUMERIC(5,2),

  -- Activities
  activities_count INTEGER DEFAULT 0,
  exercise_minutes INTEGER DEFAULT 0,

  -- Mood (if tracked)
  mood_avg NUMERIC(3,1),

  -- Metadata
  has_data BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT daily_patient_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT daily_patient_summaries_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
  CONSTRAINT daily_patient_summaries_unique UNIQUE (patient_id, summary_date)
);

-- Critical Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_daily_summaries_patient_date
  ON public.daily_patient_summaries(patient_id, summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date
  ON public.daily_patient_summaries(summary_date);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_has_data
  ON public.daily_patient_summaries(patient_id, summary_date) WHERE has_data = TRUE;

-- ============================================
-- STEP 2: Create report_access_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS public.report_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  accessed_by_line_user_id CHARACTER VARYING NOT NULL,
  access_type CHARACTER VARYING NOT NULL, -- 'view', 'export_csv', 'export_pdf'
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  ip_address CHARACTER VARYING,
  user_agent TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT report_access_logs_pkey PRIMARY KEY (id),
  CONSTRAINT report_access_logs_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE
);

-- Index for rate limiting check
CREATE INDEX IF NOT EXISTS idx_report_access_logs_rate_limit
  ON public.report_access_logs(accessed_by_line_user_id, access_type, accessed_at);
CREATE INDEX IF NOT EXISTS idx_report_access_logs_patient
  ON public.report_access_logs(patient_id, accessed_at);

-- ============================================
-- STEP 3: Enable RLS (Row Level Security)
-- ============================================

ALTER TABLE public.daily_patient_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_access_logs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on daily_patient_summaries"
ON public.daily_patient_summaries
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access on report_access_logs"
ON public.report_access_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- STEP 4: Setup pg_cron job for nightly aggregation
-- ============================================

-- Remove existing job if it exists (for re-running migration)
SELECT cron.unschedule('aggregate-daily-summaries-nightly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aggregate-daily-summaries-nightly');

-- Schedule nightly aggregation at 00:30 Bangkok time (17:30 UTC previous day)
-- Note: pg_cron runs in UTC, Bangkok is UTC+7
-- 00:30 Bangkok = 17:30 UTC (previous day)
SELECT cron.schedule(
    'aggregate-daily-summaries-nightly',
    '30 17 * * *',  -- 17:30 UTC = 00:30 Bangkok
    $$
    SELECT net.http_post(
        url := 'https://mqxklnzxfrupwwkwlwwc.supabase.co/functions/v1/aggregate-daily-summaries',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
    );
    $$
);

-- ============================================
-- STEP 5: Create helper function for rate limiting
-- ============================================

CREATE OR REPLACE FUNCTION check_report_rate_limit(
  p_line_user_id VARCHAR,
  p_access_type VARCHAR,
  p_max_requests INTEGER DEFAULT 10,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  request_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO request_count
  FROM report_access_logs
  WHERE accessed_by_line_user_id = p_line_user_id
    AND access_type = p_access_type
    AND accessed_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  RETURN request_count < p_max_requests;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 6: Create function to get summary stats
-- ============================================

CREATE OR REPLACE FUNCTION get_patient_summary_stats(
  p_patient_id UUID,
  p_date_from DATE,
  p_date_to DATE
)
RETURNS TABLE (
  total_days INTEGER,
  days_with_data INTEGER,
  avg_bp_systolic NUMERIC,
  avg_bp_diastolic NUMERIC,
  avg_medication_compliance NUMERIC,
  total_water_intake BIGINT,
  avg_daily_water NUMERIC,
  total_activities INTEGER,
  total_exercise_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (p_date_to - p_date_from + 1)::INTEGER as total_days,
    COUNT(*)::INTEGER FILTER (WHERE has_data = TRUE) as days_with_data,
    ROUND(AVG(bp_systolic_avg), 1) as avg_bp_systolic,
    ROUND(AVG(bp_diastolic_avg), 1) as avg_bp_diastolic,
    ROUND(AVG(medication_compliance_percent), 1) as avg_medication_compliance,
    SUM(water_intake_ml)::BIGINT as total_water_intake,
    ROUND(AVG(water_intake_ml), 0) as avg_daily_water,
    SUM(activities_count)::INTEGER as total_activities,
    SUM(exercise_minutes)::INTEGER as total_exercise_minutes
  FROM daily_patient_summaries
  WHERE patient_id = p_patient_id
    AND summary_date BETWEEN p_date_from AND p_date_to;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 7: Verify setup
-- ============================================

-- Check tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('daily_patient_summaries', 'report_access_logs');

-- Check cron job scheduled
SELECT * FROM cron.job WHERE jobname = 'aggregate-daily-summaries-nightly';

-- ============================================
-- NOTES
-- ============================================
--
-- 1. Run backfill after this migration:
--    See: docs/migrations/011b_backfill_summaries.sql
--
-- 2. To manually trigger aggregation:
--    curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/aggregate-daily-summaries \
--      -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
--      -H "Content-Type: application/json" \
--      -d '{"date": "2024-11-01"}'
--
-- 3. To check aggregation history:
--    SELECT * FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'aggregate-daily-summaries-nightly')
--    ORDER BY start_time DESC LIMIT 10;
--
