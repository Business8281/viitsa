/*
# MedIntel OS — Patient Portal Enhancements

## New Tables
1. `health_reports` — AI-scanned medical reports with extracted data
2. `patient_notifications` — Notifications for appointments, payments, etc.

## Fields Added
- `clinics`: `department` (text array for specialisations), `rating` (numeric)
- `users`: `rating` (numeric for doctor ratings)

## Security
- RLS enabled on all new tables
*/

-- 1. Health reports (AI-scanned medical documents)
CREATE TABLE IF NOT EXISTS health_reports (
  report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(patient_id) ON DELETE CASCADE,
  account_id uuid REFERENCES patient_accounts(account_id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE SET NULL,
  report_type text NOT NULL,
  report_date date,
  hospital_or_doctor text,
  key_findings jsonb DEFAULT '[]'::jsonb,
  diagnosis text,
  medications jsonb DEFAULT '[]'::jsonb,
  doctor_notes text,
  summary text,
  urgent_flags text[] DEFAULT ARRAY[]::text[],
  original_file_url text,
  original_file_type text,
  ai_processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 2. Patient notifications
CREATE TABLE IF NOT EXISTS patient_notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES patient_accounts(account_id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(patient_id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  action_url text,
  created_at timestamptz DEFAULT now()
);

-- Add clinic specialisations (departments)
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS departments text[] DEFAULT ARRAY[]::text[];
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS rating numeric(3,2) DEFAULT 4.5;

-- Add doctor rating
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating numeric(3,2) DEFAULT 4.8;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_reports_patient ON health_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_health_reports_account ON health_reports(account_id);
CREATE INDEX IF NOT EXISTS idx_patient_notifications_account ON patient_notifications(account_id);

-- RLS on new tables
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['health_reports','patient_notifications']) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%1$s" ON %1$s;', t);
    EXECUTE format('CREATE POLICY "anon_select_%1$s" ON %1$s FOR SELECT TO anon, authenticated USING (true);', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%1$s" ON %1$s;', t);
    EXECUTE format('CREATE POLICY "anon_insert_%1$s" ON %1$s FOR INSERT TO anon, authenticated WITH CHECK (true);', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%1$s" ON %1$s;', t);
    EXECUTE format('CREATE POLICY "anon_update_%1$s" ON %1$s FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%1$s" ON %1$s;', t);
    EXECUTE format('CREATE POLICY "anon_delete_%1$s" ON %1$s FOR DELETE TO anon, authenticated USING (true);', t);
  END LOOP;
END $$;