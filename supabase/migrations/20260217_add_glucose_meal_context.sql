-- Add meal_context and food_notes columns to vitals_logs for glucose tracking
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS meal_context TEXT;
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS food_notes TEXT;
