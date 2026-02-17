-- Migration 013: Add meal_context and food_notes columns to vitals_logs for glucose tracking
-- glucose column already exists in vitals_logs

ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS meal_context TEXT;
ALTER TABLE vitals_logs ADD COLUMN IF NOT EXISTS food_notes TEXT;

-- meal_context values: 'fasting', 'post_meal_1h', 'post_meal_2h', 'before_bed', or NULL
