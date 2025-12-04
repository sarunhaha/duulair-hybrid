-- Migration: 008_setup_pg_cron_reminders.sql
-- Setup pg_cron for reminder notifications using Supabase Edge Functions
--
-- Prerequisites:
-- 1. Enable pg_cron extension in Supabase Dashboard (Database > Extensions)
-- 2. Deploy Edge Functions first:
--    - supabase functions deploy send-reminders
--    - supabase functions deploy check-missed-activities
-- 3. Set environment variables in Supabase Dashboard (Edge Functions > Settings):
--    - LINE_CHANNEL_ACCESS_TOKEN
--    - SUPABASE_URL (auto-set)
--    - SUPABASE_SERVICE_ROLE_KEY (auto-set)

-- ============================================
-- STEP 1: Create missing tables
-- ============================================

-- Table for tracking sent reminders (prevent duplicate sends)
CREATE TABLE IF NOT EXISTS reminder_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'sent',
    channel VARCHAR(20) DEFAULT 'direct',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for checking if already sent today
CREATE INDEX IF NOT EXISTS idx_reminder_logs_reminder_date
ON reminder_logs(reminder_id, sent_at);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_patient_date
ON reminder_logs(patient_id, sent_at);

-- Table for tracking missed activity alerts (prevent duplicate alerts)
CREATE TABLE IF NOT EXISTS missed_activity_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_missed_activity_alerts_patient_date
ON missed_activity_alerts(patient_id, sent_at);

-- ============================================
-- STEP 2: Enable pg_cron extension
-- ============================================
-- Note: You may need to enable this in Supabase Dashboard first
-- Go to: Database > Extensions > Search for "pg_cron" > Enable

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================
-- STEP 3: Create cron jobs
-- ============================================

-- Remove existing jobs if they exist (for re-running migration)
SELECT cron.unschedule('send-reminders-every-minute')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-reminders-every-minute');

SELECT cron.unschedule('check-missed-activities-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-missed-activities-hourly');

-- Job 1: Send reminders every minute
-- Calls the send-reminders Edge Function
SELECT cron.schedule(
    'send-reminders-every-minute',
    '* * * * *',  -- Every minute
    $$
    SELECT net.http_post(
        url := 'https://mqxklnzxfrupwwkwlwwc.supabase.co/functions/v1/send-reminders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
    );
    $$
);

-- Job 2: Check missed activities every hour
-- Calls the check-missed-activities Edge Function
SELECT cron.schedule(
    'check-missed-activities-hourly',
    '0 * * * *',  -- Every hour at minute 0
    $$
    SELECT net.http_post(
        url := 'https://mqxklnzxfrupwwkwlwwc.supabase.co/functions/v1/check-missed-activities',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
    );
    $$
);

-- ============================================
-- STEP 4: Verify cron jobs
-- ============================================

-- Check scheduled jobs
SELECT * FROM cron.job;

-- Check job run history (after some time)
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- ============================================
-- NOTES
-- ============================================
--
-- 1. Replace YOUR_PROJECT_REF with your actual Supabase project reference
--    (found in Project Settings > API > Project URL)
--
-- 2. The service_role_key setting should be configured in your Supabase project
--    If not working, you can use the actual key:
--    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--
-- 3. To check if cron jobs are running:
--    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- 4. To disable a cron job:
--    SELECT cron.unschedule('send-reminders-every-minute');
--
-- 5. Edge Function logs can be viewed in:
--    Supabase Dashboard > Edge Functions > Logs
