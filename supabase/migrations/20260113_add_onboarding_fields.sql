-- Migration 009: Add onboarding fields to users table
-- Date: 2026-01-13
-- Purpose: Support conversational onboarding flow ("คุยแล้วเก็บ")

-- Add onboarding tracking fields to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_step character varying DEFAULT 'welcome';

-- Add onboarding fields to patient_profiles for data collected during onboarding
-- (These fields already exist, just documenting that they're used for onboarding)
-- first_name, last_name, nickname, birth_date, medical_condition

-- Create index for quick lookup of incomplete onboarding
CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(onboarding_completed) WHERE onboarding_completed = false;

-- Comment on columns
COMMENT ON COLUMN users.onboarding_completed IS 'Whether user has completed the conversational onboarding flow';
COMMENT ON COLUMN users.onboarding_step IS 'Current step in onboarding: welcome, ask_name, ask_birthdate, ask_conditions, complete';

-- Record migration
INSERT INTO schema_migrations (version, description)
VALUES ('009', 'Add onboarding fields to users table')
ON CONFLICT (version) DO NOTHING;
