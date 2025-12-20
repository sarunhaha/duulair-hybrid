-- =====================================================
-- OONJ.AI Schema Restructure - Phase 4: Cleanup Unused Tables
-- Version: 004
-- Date: 2025-12-18
-- Description: ลบ tables ที่ไม่ใช้แล้ว (หลังจากตรวจสอบข้อมูลแล้ว)
-- =====================================================

-- ⚠️ WARNING: RUN THIS ONLY AFTER VERIFYING DATA MIGRATION!
-- ⚠️ Make sure to backup database before running this script!

-- =====================================================
-- Step 1: Create backup tables (optional safety measure)
-- =====================================================

-- Backup patient_medications
CREATE TABLE IF NOT EXISTS public._backup_patient_medications AS
SELECT * FROM public.patient_medications;

-- Backup water_intake_logs
CREATE TABLE IF NOT EXISTS public._backup_water_intake_logs AS
SELECT * FROM public.water_intake_logs;

-- Backup water_intake_goals
CREATE TABLE IF NOT EXISTS public._backup_water_intake_goals AS
SELECT * FROM public.water_intake_goals;

-- Backup missed_activity_alerts
CREATE TABLE IF NOT EXISTS public._backup_missed_activity_alerts AS
SELECT * FROM public.missed_activity_alerts;

-- Backup caregivers
CREATE TABLE IF NOT EXISTS public._backup_caregivers AS
SELECT * FROM public.caregivers;

-- Backup schedules
CREATE TABLE IF NOT EXISTS public._backup_schedules AS
SELECT * FROM public.schedules;

-- Backup medication_history
CREATE TABLE IF NOT EXISTS public._backup_medication_history AS
SELECT * FROM public.medication_history;

-- Backup analytics_settings
CREATE TABLE IF NOT EXISTS public._backup_analytics_settings AS
SELECT * FROM public.analytics_settings;

-- Backup subscription tables
CREATE TABLE IF NOT EXISTS public._backup_subscription_packages AS
SELECT * FROM public.subscription_packages;

CREATE TABLE IF NOT EXISTS public._backup_user_subscriptions AS
SELECT * FROM public.user_subscriptions;

-- Backup caregiver_patient_preferences
CREATE TABLE IF NOT EXISTS public._backup_caregiver_patient_preferences AS
SELECT * FROM public.caregiver_patient_preferences;

-- =====================================================
-- Step 2: Drop tables that are no longer needed
-- =====================================================

-- Drop tables in correct order (respecting foreign keys)

-- 2.1 Drop subscription tables (ไม่ใช้ใน MVP)
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_packages CASCADE;

-- 2.2 Drop analytics_settings (ไม่ใช้ใน MVP)
DROP TABLE IF EXISTS public.analytics_settings CASCADE;

-- 2.3 Drop caregiver_patient_preferences (ใช้ group_patients แทน)
DROP TABLE IF EXISTS public.caregiver_patient_preferences CASCADE;

-- 2.4 Drop schedules (ใช้ reminders แทน)
DROP TABLE IF EXISTS public.schedules CASCADE;

-- 2.5 Drop caregivers (ใช้ caregiver_profiles + patient_caregivers แทน)
DROP TABLE IF EXISTS public.caregivers CASCADE;

-- 2.6 Drop medication_history (รวมกับ medical_history)
DROP TABLE IF EXISTS public.medication_history CASCADE;

-- 2.7 Drop missed_activity_alerts (รวมกับ alert_logs)
DROP TABLE IF EXISTS public.missed_activity_alerts CASCADE;

-- 2.8 Drop water tables (ข้อมูลย้ายไป activity_logs + health_goals แล้ว)
DROP TABLE IF EXISTS public.water_intake_logs CASCADE;
DROP TABLE IF EXISTS public.water_intake_goals CASCADE;

-- 2.9 Drop patient_medications (รวมกับ medications แล้ว)
DROP TABLE IF EXISTS public.patient_medications CASCADE;

-- =====================================================
-- Step 3: Clean up orphaned data
-- =====================================================

-- Remove medications without patient_id (legacy data)
-- DELETE FROM public.medications WHERE patient_id IS NULL AND user_id IS NULL;

-- Remove old activity_logs without patient_id (optional)
-- DELETE FROM public.activity_logs WHERE patient_id IS NULL AND created_at < NOW() - INTERVAL '1 year';

-- =====================================================
-- Step 4: Add NOT NULL constraints where appropriate
-- =====================================================

-- These should be run after verifying all data has patient_id
-- ALTER TABLE public.vitals_logs ALTER COLUMN patient_id SET NOT NULL;
-- ALTER TABLE public.mood_logs ALTER COLUMN patient_id SET NOT NULL;

-- =====================================================
-- Step 5: Record migration
-- =====================================================
INSERT INTO public.schema_migrations (version, description)
VALUES ('004', 'Cleanup unused tables after data migration')
ON CONFLICT (version) DO NOTHING;

-- =====================================================
-- Summary of removed tables:
-- =====================================================
-- 1. subscription_packages     - ไม่ใช้ใน MVP
-- 2. user_subscriptions        - ไม่ใช้ใน MVP
-- 3. analytics_settings        - ไม่ใช้ใน MVP
-- 4. caregiver_patient_preferences - ใช้ group_patients แทน
-- 5. schedules                 - ใช้ reminders แทน
-- 6. caregivers               - ใช้ caregiver_profiles + patient_caregivers แทน
-- 7. medication_history       - รวมกับ medical_history
-- 8. missed_activity_alerts   - รวมกับ alert_logs
-- 9. water_intake_logs        - ย้ายไป activity_logs
-- 10. water_intake_goals      - รวมกับ health_goals
-- 11. patient_medications     - รวมกับ medications
-- =====================================================

-- =====================================================
-- Tables KEPT (Final Schema):
-- =====================================================
-- Core:
--   - users
--   - patient_profiles
--   - caregiver_profiles
--   - patient_caregivers
--   - groups
--   - group_members
--   - group_patients
--
-- Health Data:
--   - vitals_logs (altered)
--   - mood_logs (altered)
--   - activity_logs (altered)
--   - conversation_logs (altered)
--   - symptoms (NEW)
--   - sleep_logs (NEW)
--   - exercise_logs (NEW)
--   - health_events (NEW)
--
-- Reminders:
--   - reminders
--   - reminder_logs
--   - medications
--   - medication_logs
--   - medication_notification_logs
--
-- Reports:
--   - daily_reports
--   - daily_patient_summaries
--   - report_settings
--   - report_downloads
--   - report_access_logs
--
-- Settings & Safety:
--   - health_goals (altered)
--   - notification_settings
--   - emergency_contacts
--   - allergies
--   - alert_logs
--   - link_codes
--   - medical_history
--
-- System:
--   - app_config
--   - schema_migrations
-- =====================================================
