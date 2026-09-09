
CREATE TABLE IF NOT EXISTS ai_conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
  account_id UUID REFERENCES patient_accounts(account_id) ON DELETE SET NULL,
  appt_id UUID REFERENCES appointments(appt_id) ON DELETE SET NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  detected_language TEXT DEFAULT 'en',
  triage_level TEXT DEFAULT 'normal',
  triage_summary JSONB,
  doctor_review JSONB,
  voice_transcripts JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_ai_conversations" ON ai_conversations FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_ai_conversations" ON ai_conversations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_ai_conversations" ON ai_conversations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_ai_conversations" ON ai_conversations FOR DELETE
  TO anon, authenticated USING (true);
