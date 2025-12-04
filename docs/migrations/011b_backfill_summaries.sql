-- Migration: 011b_backfill_summaries.sql
-- Backfill daily_patient_summaries for past 3 months
-- Run this AFTER deploying the aggregate-daily-summaries Edge Function
--
-- Note: This uses a loop to call the Edge Function for each day
-- For large datasets, consider running in batches

-- ============================================
-- Option 1: Manual backfill via Edge Function (Recommended)
-- ============================================
-- Run these curl commands from your terminal:
--
-- # Backfill last 90 days
-- for i in {0..90}; do
--   date=$(date -v-${i}d +%Y-%m-%d)
--   echo "Processing $date..."
--   curl -X POST https://mqxklnzxfrupwwkwlwwc.supabase.co/functions/v1/aggregate-daily-summaries \
--     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
--     -H "Content-Type: application/json" \
--     -d "{\"date\": \"$date\"}"
--   sleep 1  # Rate limit
-- done

-- ============================================
-- Option 2: Direct SQL aggregation (Faster for large datasets)
-- ============================================

-- Create a temporary function for backfill
CREATE OR REPLACE FUNCTION backfill_daily_summaries(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (processed_count INTEGER, error_count INTEGER) AS $$
DECLARE
  v_date DATE;
  v_patient RECORD;
  v_processed INTEGER := 0;
  v_errors INTEGER := 0;
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
  v_bp_data RECORD;
  v_water_data RECORD;
  v_med_data RECORD;
  v_activity_data RECORD;
  v_day_name TEXT;
BEGIN
  -- Loop through each date
  FOR v_date IN SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date
  LOOP
    v_start_ts := v_date::timestamp AT TIME ZONE 'Asia/Bangkok';
    v_end_ts := (v_date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok' - interval '1 second';
    v_day_name := LOWER(TO_CHAR(v_date, 'day'));

    -- Process each patient
    FOR v_patient IN SELECT id FROM patient_profiles
    LOOP
      BEGIN
        -- Get BP data
        SELECT
          COUNT(*) as count,
          AVG(CASE
            WHEN metadata->>'systolic' IS NOT NULL THEN (metadata->>'systolic')::numeric
            ELSE NULL
          END) as systolic_avg,
          MIN(CASE
            WHEN metadata->>'systolic' IS NOT NULL THEN (metadata->>'systolic')::integer
            ELSE NULL
          END) as systolic_min,
          MAX(CASE
            WHEN metadata->>'systolic' IS NOT NULL THEN (metadata->>'systolic')::integer
            ELSE NULL
          END) as systolic_max,
          AVG(CASE
            WHEN metadata->>'diastolic' IS NOT NULL THEN (metadata->>'diastolic')::numeric
            ELSE NULL
          END) as diastolic_avg,
          MIN(CASE
            WHEN metadata->>'diastolic' IS NOT NULL THEN (metadata->>'diastolic')::integer
            ELSE NULL
          END) as diastolic_min,
          MAX(CASE
            WHEN metadata->>'diastolic' IS NOT NULL THEN (metadata->>'diastolic')::integer
            ELSE NULL
          END) as diastolic_max,
          AVG(CASE
            WHEN metadata->>'heart_rate' IS NOT NULL THEN (metadata->>'heart_rate')::numeric
            ELSE NULL
          END) as hr_avg,
          MIN(CASE
            WHEN metadata->>'heart_rate' IS NOT NULL THEN (metadata->>'heart_rate')::integer
            ELSE NULL
          END) as hr_min,
          MAX(CASE
            WHEN metadata->>'heart_rate' IS NOT NULL THEN (metadata->>'heart_rate')::integer
            ELSE NULL
          END) as hr_max
        INTO v_bp_data
        FROM activity_logs
        WHERE patient_id = v_patient.id
          AND task_type = 'blood_pressure'
          AND timestamp >= v_start_ts
          AND timestamp < v_end_ts;

        -- Get water data
        SELECT
          COALESCE(SUM(amount_ml), 0) as total,
          COALESCE((SELECT daily_goal_ml FROM water_intake_goals WHERE patient_id = v_patient.id), 2000) as goal
        INTO v_water_data
        FROM water_intake_logs
        WHERE patient_id = v_patient.id
          AND logged_at >= v_start_ts
          AND logged_at < v_end_ts;

        -- Get medication data
        -- Note: patient_medications uses 'frequency' array (not 'times')
        SELECT
          COALESCE(SUM(
            CASE
              WHEN frequency_type = 'daily' OR frequency_type IS NULL THEN COALESCE(array_length(frequency, 1), 1)
              WHEN frequency_type = 'specific_days' AND days_of_week ? v_day_name THEN COALESCE(array_length(frequency, 1), 1)
              ELSE 0
            END
          ), 0) as scheduled,
          (SELECT COUNT(*) FROM activity_logs
           WHERE patient_id = v_patient.id
             AND task_type = 'medication'
             AND timestamp >= v_start_ts
             AND timestamp < v_end_ts) as taken
        INTO v_med_data
        FROM patient_medications
        WHERE patient_id = v_patient.id
          AND is_active = true;

        -- Get activity data
        SELECT
          COUNT(*) as count,
          COALESCE(SUM(
            CASE WHEN task_type = 'exercise' THEN
              COALESCE((metadata->>'duration_minutes')::integer, (metadata->>'minutes')::integer, 30)
            ELSE 0 END
          ), 0) as exercise_mins
        INTO v_activity_data
        FROM activity_logs
        WHERE patient_id = v_patient.id
          AND timestamp >= v_start_ts
          AND timestamp < v_end_ts;

        -- Determine BP status
        DECLARE
          v_bp_status VARCHAR;
        BEGIN
          IF v_bp_data.systolic_avg IS NOT NULL THEN
            IF v_bp_data.systolic_avg >= 180 OR v_bp_data.diastolic_avg >= 120 THEN
              v_bp_status := 'crisis';
            ELSIF v_bp_data.systolic_avg >= 140 OR v_bp_data.diastolic_avg >= 90 THEN
              v_bp_status := 'high';
            ELSIF v_bp_data.systolic_avg >= 130 OR v_bp_data.diastolic_avg >= 80 THEN
              v_bp_status := 'elevated';
            ELSE
              v_bp_status := 'normal';
            END IF;
          ELSE
            v_bp_status := NULL;
          END IF;

          -- Upsert summary
          INSERT INTO daily_patient_summaries (
            patient_id, summary_date,
            bp_readings_count, bp_systolic_avg, bp_systolic_min, bp_systolic_max,
            bp_diastolic_avg, bp_diastolic_min, bp_diastolic_max, bp_status,
            heart_rate_avg, heart_rate_min, heart_rate_max,
            medications_scheduled, medications_taken, medications_missed, medication_compliance_percent,
            water_intake_ml, water_goal_ml, water_compliance_percent,
            activities_count, exercise_minutes,
            has_data, updated_at
          ) VALUES (
            v_patient.id, v_date,
            COALESCE(v_bp_data.count, 0),
            ROUND(v_bp_data.systolic_avg, 1),
            v_bp_data.systolic_min,
            v_bp_data.systolic_max,
            ROUND(v_bp_data.diastolic_avg, 1),
            v_bp_data.diastolic_min,
            v_bp_data.diastolic_max,
            v_bp_status,
            ROUND(v_bp_data.hr_avg),
            v_bp_data.hr_min,
            v_bp_data.hr_max,
            COALESCE(v_med_data.scheduled, 0),
            COALESCE(v_med_data.taken, 0),
            GREATEST(0, COALESCE(v_med_data.scheduled, 0) - COALESCE(v_med_data.taken, 0)),
            CASE WHEN COALESCE(v_med_data.scheduled, 0) > 0
              THEN ROUND((v_med_data.taken::numeric / v_med_data.scheduled) * 100, 2)
              ELSE NULL
            END,
            COALESCE(v_water_data.total, 0),
            COALESCE(v_water_data.goal, 2000),
            CASE WHEN COALESCE(v_water_data.goal, 2000) > 0
              THEN ROUND((v_water_data.total::numeric / v_water_data.goal) * 100, 2)
              ELSE NULL
            END,
            COALESCE(v_activity_data.count, 0),
            COALESCE(v_activity_data.exercise_mins, 0),
            (COALESCE(v_bp_data.count, 0) > 0 OR COALESCE(v_water_data.total, 0) > 0 OR
             COALESCE(v_med_data.taken, 0) > 0 OR COALESCE(v_activity_data.count, 0) > 0),
            NOW()
          )
          ON CONFLICT (patient_id, summary_date)
          DO UPDATE SET
            bp_readings_count = EXCLUDED.bp_readings_count,
            bp_systolic_avg = EXCLUDED.bp_systolic_avg,
            bp_systolic_min = EXCLUDED.bp_systolic_min,
            bp_systolic_max = EXCLUDED.bp_systolic_max,
            bp_diastolic_avg = EXCLUDED.bp_diastolic_avg,
            bp_diastolic_min = EXCLUDED.bp_diastolic_min,
            bp_diastolic_max = EXCLUDED.bp_diastolic_max,
            bp_status = EXCLUDED.bp_status,
            heart_rate_avg = EXCLUDED.heart_rate_avg,
            heart_rate_min = EXCLUDED.heart_rate_min,
            heart_rate_max = EXCLUDED.heart_rate_max,
            medications_scheduled = EXCLUDED.medications_scheduled,
            medications_taken = EXCLUDED.medications_taken,
            medications_missed = EXCLUDED.medications_missed,
            medication_compliance_percent = EXCLUDED.medication_compliance_percent,
            water_intake_ml = EXCLUDED.water_intake_ml,
            water_goal_ml = EXCLUDED.water_goal_ml,
            water_compliance_percent = EXCLUDED.water_compliance_percent,
            activities_count = EXCLUDED.activities_count,
            exercise_minutes = EXCLUDED.exercise_minutes,
            has_data = EXCLUDED.has_data,
            updated_at = NOW();
        END;

        v_processed := v_processed + 1;

      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
        RAISE NOTICE 'Error processing patient % for date %: %', v_patient.id, v_date, SQLERRM;
      END;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_errors;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Run backfill for last 90 days
-- ============================================

-- Uncomment and run this to backfill:
-- SELECT * FROM backfill_daily_summaries(
--   CURRENT_DATE - INTERVAL '90 days',
--   CURRENT_DATE - INTERVAL '1 day'
-- );

-- ============================================
-- Verify backfill
-- ============================================

-- Check row count
-- SELECT COUNT(*) as total_summaries,
--        COUNT(DISTINCT patient_id) as patients,
--        MIN(summary_date) as oldest,
--        MAX(summary_date) as newest
-- FROM daily_patient_summaries;

-- Check sample data
-- SELECT patient_id, summary_date, has_data, bp_readings_count, water_intake_ml, activities_count
-- FROM daily_patient_summaries
-- WHERE has_data = true
-- ORDER BY summary_date DESC
-- LIMIT 20;
