-- Migration: Add medication_id to reminders table
-- Purpose: Link reminders to specific medications for accurate tracking

-- Add medication_id column to reminders table
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS medication_id UUID REFERENCES medications(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reminders_medication_id ON reminders(medication_id);

-- Comment for documentation
COMMENT ON COLUMN reminders.medication_id IS 'Links to specific medication for medication-type reminders';
