-- Migration: Copy medication and water records from activity_logs to dedicated tables
-- Date: 2026-01-27
-- Purpose: Chatbot was writing to activity_logs, but Dashboard/API reads from medication_logs/water_logs
-- This migration copies existing data to dedicated tables without deleting originals

-- 1. Migrate medication records from activity_logs to medication_logs
INSERT INTO medication_logs (
  patient_id,
  medication_name,
  taken_at,
  status,
  ai_confidence,
  raw_text,
  activity_log_id,
  created_at
)
SELECT
  al.patient_id,
  COALESCE(al.metadata->>'medication_name', al.value, 'ยา'),
  COALESCE(al.timestamp, al.created_at),
  CASE
    WHEN (al.metadata->>'taken')::boolean = true THEN 'taken'
    WHEN (al.metadata->>'taken')::boolean = false THEN 'skipped'
    ELSE 'taken'
  END,
  al.ai_confidence,
  al.raw_text,
  al.id,
  al.created_at
FROM activity_logs al
WHERE al.task_type = 'medication'
  AND al.patient_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM medication_logs ml
    WHERE ml.activity_log_id = al.id
  );

-- 2. Migrate water records from activity_logs to water_logs
INSERT INTO water_logs (
  patient_id,
  log_date,
  amount_ml,
  glasses,
  ai_confidence,
  raw_text,
  activity_log_id,
  created_at
)
SELECT
  al.patient_id,
  DATE(COALESCE(al.timestamp, al.created_at)),
  COALESCE(
    (al.metadata->>'amount_ml')::integer,
    (al.metadata->>'amount')::integer,
    NULLIF(al.value, '')::integer,
    0
  ),
  ROUND(
    COALESCE(
      (al.metadata->>'amount_ml')::numeric,
      (al.metadata->>'amount')::numeric,
      NULLIF(al.value, '')::numeric,
      0
    ) / 250
  ),
  al.ai_confidence,
  al.raw_text,
  al.id,
  al.created_at
FROM activity_logs al
WHERE al.task_type = 'water'
  AND al.patient_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM water_logs wl
    WHERE wl.activity_log_id = al.id
  );
