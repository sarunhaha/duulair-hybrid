-- Migration 014: Add PDPA consent fields to users table
-- Required for PDPA compliance: health data = sensitive data, needs explicit consent

ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_accepted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_version VARCHAR(10) DEFAULT '1.0';
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_caregiver_share BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_marketing BOOLEAN DEFAULT false;

-- Auto-consent existing users (they used the service before T&C existed)
UPDATE users
SET consent_accepted = true,
    consent_accepted_at = now(),
    consent_version = '1.0'
WHERE created_at < now();
