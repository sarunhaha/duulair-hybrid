-- Migration: Voice Confirmation State
-- Store pending voice transcriptions waiting for user confirmation

CREATE TABLE IF NOT EXISTS pending_voice_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT NOT NULL,
  patient_id UUID REFERENCES patient_profiles(id),
  transcribed_text TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired'))
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_pending_voice_user
ON pending_voice_confirmations(line_user_id, status);

-- Auto-cleanup expired confirmations (optional - can use pg_cron)
-- DELETE FROM pending_voice_confirmations WHERE expires_at < NOW();

-- RLS Policy
ALTER TABLE pending_voice_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage pending_voice_confirmations"
ON pending_voice_confirmations
FOR ALL
USING (true)
WITH CHECK (true);

COMMENT ON TABLE pending_voice_confirmations IS 'Temporary storage for voice transcriptions waiting for user confirmation';
