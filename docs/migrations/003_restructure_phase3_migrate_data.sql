-- =====================================================
-- OONJ.AI Schema Restructure - Phase 3: Migrate Data
-- Version: 003
-- Date: 2025-12-18
-- Description: Migrate ข้อมูลจาก tables เก่าไป tables ใหม่
-- =====================================================

-- 1. Migrate patient_medications → medications (รวม tables)
-- =====================================================
-- ถ้ามีข้อมูลใน patient_medications ให้ copy ไป medications
INSERT INTO public.medications (
  patient_id,
  name,
  dosage,
  dosage_amount,
  dosage_unit,
  dosage_form,
  frequency,
  days_of_week,
  active,
  note,
  created_at
)
SELECT
  pm.patient_id,
  pm.name,
  pm.dosage,
  pm.dosage_amount,
  pm.dosage_unit,
  pm.dosage_form,
  pm.frequency_type,
  CASE
    WHEN pm.days_of_week IS NULL THEN NULL
    ELSE ARRAY(SELECT jsonb_array_elements_text(pm.days_of_week))
  END,
  pm.is_active,
  pm.notes,
  pm.created_at
FROM public.patient_medications pm
WHERE NOT EXISTS (
  SELECT 1 FROM public.medications m
  WHERE m.patient_id = pm.patient_id
  AND m.name = pm.name
);

-- 2. Migrate water_intake_logs → activity_logs (for historical data)
-- =====================================================
INSERT INTO public.activity_logs (
  patient_id,
  task_type,
  value,
  metadata,
  timestamp,
  created_at,
  group_id,
  actor_line_user_id,
  actor_display_name,
  source
)
SELECT
  wl.patient_id,
  'water',
  wl.amount_ml::text,
  jsonb_build_object(
    'amount_ml', wl.amount_ml,
    'notes', wl.notes,
    'migrated_from', 'water_intake_logs'
  ),
  wl.logged_at,
  wl.created_at,
  wl.group_id,
  wl.logged_by_line_user_id,
  wl.logged_by_display_name,
  CASE WHEN wl.group_id IS NOT NULL THEN 'group' ELSE '1:1' END
FROM public.water_intake_logs wl
WHERE NOT EXISTS (
  SELECT 1 FROM public.activity_logs al
  WHERE al.patient_id = wl.patient_id
  AND al.task_type = 'water'
  AND al.timestamp = wl.logged_at
);

-- 3. Migrate water_intake_goals → health_goals
-- =====================================================
UPDATE public.health_goals hg
SET target_water_ml = wig.daily_goal_ml
FROM public.water_intake_goals wig
WHERE hg.patient_id = wig.patient_id;

-- Insert for patients that don't have health_goals yet
INSERT INTO public.health_goals (patient_id, target_water_ml)
SELECT wig.patient_id, wig.daily_goal_ml
FROM public.water_intake_goals wig
WHERE NOT EXISTS (
  SELECT 1 FROM public.health_goals hg
  WHERE hg.patient_id = wig.patient_id
);

-- 4. Migrate missed_activity_alerts → alert_logs
-- =====================================================
INSERT INTO public.alert_logs (
  user_id,
  alert_type,
  severity,
  message,
  trigger_data,
  created_at
)
SELECT
  (SELECT user_id FROM public.patient_profiles WHERE id = maa.patient_id),
  'missed_activity',
  'warning',
  'ไม่พบกิจกรรมติดต่อกันเกิน 4 ชั่วโมง',
  jsonb_build_object(
    'patient_id', maa.patient_id,
    'group_id', maa.group_id,
    'last_activity_at', maa.last_activity_at,
    'migrated_from', 'missed_activity_alerts'
  ),
  maa.sent_at
FROM public.missed_activity_alerts maa
WHERE NOT EXISTS (
  SELECT 1 FROM public.alert_logs al
  WHERE al.trigger_data->>'patient_id' = maa.patient_id::text
  AND al.alert_type = 'missed_activity'
  AND al.created_at = maa.sent_at
);

-- 5. Update vitals_logs - set patient_id from user_id
-- =====================================================
UPDATE public.vitals_logs vl
SET patient_id = pp.id
FROM public.users u
JOIN public.patient_profiles pp ON pp.user_id = u.id
WHERE vl.user_id = u.id
AND vl.patient_id IS NULL;

-- 6. Update mood_logs - set patient_id from user_id
-- =====================================================
UPDATE public.mood_logs ml
SET patient_id = pp.id
FROM public.users u
JOIN public.patient_profiles pp ON pp.user_id = u.id
WHERE ml.user_id = u.id
AND ml.patient_id IS NULL;

-- 7. Migrate caregivers → patient_caregivers (if not already linked)
-- =====================================================
INSERT INTO public.patient_caregivers (
  patient_id,
  caregiver_id,
  relationship,
  is_primary,
  notify_emergency,
  notify_medication,
  notify_daily_report,
  notify_abnormal_vitals,
  status,
  created_at
)
SELECT DISTINCT
  pp.id as patient_id,
  cp.id as caregiver_id,
  c.relationship,
  c.is_primary,
  c.receive_alerts,
  c.receive_alerts,
  c.receive_daily_report,
  c.receive_alerts,
  'active',
  c.created_at
FROM public.caregivers c
JOIN public.users u ON c.user_id = u.id OR c.line_user_id = u.line_user_id
JOIN public.caregiver_profiles cp ON cp.user_id = u.id
CROSS JOIN public.patient_profiles pp  -- This needs proper linking logic
WHERE NOT EXISTS (
  SELECT 1 FROM public.patient_caregivers pc
  WHERE pc.caregiver_id = cp.id
)
LIMIT 0;  -- Disabled: needs manual review for proper patient-caregiver mapping

-- 8. Record migration
-- =====================================================
INSERT INTO public.schema_migrations (version, description)
VALUES ('003', 'Migrate data from old tables to new structure')
ON CONFLICT (version) DO NOTHING;

-- =====================================================
-- IMPORTANT NOTES:
-- =====================================================
-- 1. ข้อมูลเก่าจะถูก copy ไม่ใช่ย้าย - tables เก่ายังอยู่
-- 2. ตรวจสอบข้อมูลหลังจาก migrate แล้วก่อนลบ tables เก่า
-- 3. Caregivers migration ถูก disable - ต้อง review manual
-- 4. Run Phase 4 (cleanup) หลังจากตรวจสอบข้อมูลแล้ว
