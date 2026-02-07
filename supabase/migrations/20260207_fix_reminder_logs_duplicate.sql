-- Fix duplicate reminder notifications by adding unique constraint
-- This prevents race condition where two function calls can send the same reminder

-- First, delete duplicates keeping only the earliest one
DELETE FROM reminder_logs a USING reminder_logs b
WHERE a.id > b.id
  AND a.reminder_id = b.reminder_id
  AND DATE(a.sent_at AT TIME ZONE 'Asia/Bangkok') = DATE(b.sent_at AT TIME ZONE 'Asia/Bangkok');

-- Add unique constraint: one reminder can only be sent once per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_logs_unique_per_day
ON reminder_logs (reminder_id, (DATE(sent_at AT TIME ZONE 'Asia/Bangkok')));

-- Do the same for medication_notification_logs if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'medication_notification_logs') THEN
    -- Delete duplicates
    DELETE FROM medication_notification_logs a USING medication_notification_logs b
    WHERE a.id > b.id
      AND a.medication_id = b.medication_id
      AND a.time_period = b.time_period
      AND DATE(a.sent_at AT TIME ZONE 'Asia/Bangkok') = DATE(b.sent_at AT TIME ZONE 'Asia/Bangkok');

    -- Add unique constraint
    CREATE UNIQUE INDEX IF NOT EXISTS idx_medication_notification_logs_unique_per_day
    ON medication_notification_logs (medication_id, time_period, (DATE(sent_at AT TIME ZONE 'Asia/Bangkok')));
  END IF;
END $$;
