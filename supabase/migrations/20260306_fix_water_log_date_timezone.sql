-- Fix water_logs log_date that were saved using UTC instead of Thailand timezone (GMT+7)
-- Records logged between 00:00-06:59 Thai time have log_date set to the previous day
-- This updates log_date to match the Thailand date based on logged_at timestamp

UPDATE water_logs
SET log_date = (logged_at AT TIME ZONE 'Asia/Bangkok')::date
WHERE log_date != (logged_at AT TIME ZONE 'Asia/Bangkok')::date
  AND logged_at IS NOT NULL;
