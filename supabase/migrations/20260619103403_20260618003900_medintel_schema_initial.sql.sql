/*
# MedIntel OS — Initial schema (v1)

Creates the full data model for the MedIntel OS clinic operating system.

## New Tables
1. `clinics` — clinic profile (name, address, contact, owner), working_hours as jsonb
2. `users` — staff accounts with role (admin/doctor/staff), password_hash, active flag
3. `patients` — patient master with allergies, chronic_conditions, emergency contact, token_number
4. `appointments` — walk-in/scheduled, status (waiting/in-progress/done/cancelled), triage_level
5. `consultations` — linked to an appt; symptoms, diagnosis, prescription, follow_up_date
6. `billing` — paid/pending/partial; cash/upi/card; sum gives daily revenue
7. `inventory` — quantity, unit, reorder_level, supplier, cost_per_unit
8. `ai_sessions` — conversation jsonb, recommendations jsonb, triage level, doctor_notified
9. `vitals` — BP, pulse, temperature, spo2, weight per patient per visit
10. `clinic_settings` — single-row per clinic for slot duration + reminder toggles

## Security
- RLS enabled on every table.
- Anon + authenticated CRUD: single-tenant demo with custom email/password users table.
- Data intentionally shared across clinic staff.
*/

CREATE TABLE IF NOT EXISTS clinics (
  clinic_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  phone text,
  email text,
  logo_url text,
  owner_name text,
  working_hours jsonb DEFAULT '{"open":"09:00","close":"19:00","days":["Mon","Tue","Wed","Thu","Fri","Sat"]}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','doctor','staff')),
  phone text,
  specialisation text,
  active boolean DEFAULT true,
  avatar_color text DEFAULT '#0F6E56',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
  patient_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  name text NOT NULL,
  age integer,
  gender text CHECK (gender IN ('Male','Female','Other')),
  phone text,
  email text,
  blood_group text,
  address text,
  allergies text DEFAULT 'None',
  chronic_conditions text DEFAULT 'None',
  emergency_contact_name text,
  emergency_contact_phone text,
  token_number integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
  appt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(patient_id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  date date NOT NULL,
  time_slot text NOT NULL,
  type text NOT NULL DEFAULT 'scheduled' CHECK (type IN ('walk-in','scheduled')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in-progress','done','cancelled')),
  reason text,
  triage_level text DEFAULT 'normal' CHECK (triage_level IN ('normal','moderate','urgent')),
  notes text,
  token_number integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consultations (
  consult_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appt_id uuid REFERENCES appointments(appt_id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(patient_id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  symptoms text,
  diagnosis text,
  prescription text,
  follow_up_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing (
  bill_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(patient_id) ON DELETE CASCADE,
  appt_id uuid REFERENCES appointments(appt_id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid','pending','partial')),
  payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash','upi','card')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  quantity numeric(10,2) NOT NULL DEFAULT 0,
  unit text,
  reorder_level numeric(10,2) DEFAULT 10,
  supplier text,
  cost_per_unit numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(patient_id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  appt_id uuid REFERENCES appointments(appt_id) ON DELETE SET NULL,
  symptoms_entered text,
  ai_response text,
  triage_level text DEFAULT 'normal' CHECK (triage_level IN ('normal','moderate','urgent')),
  doctor_notified boolean DEFAULT false,
  conversation jsonb DEFAULT '[]'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vitals (
  vital_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(patient_id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  systolic_bp integer,
  diastolic_bp integer,
  pulse integer,
  temperature numeric(4,1),
  spo2 integer,
  weight numeric(5,1),
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clinic_settings (
  setting_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid UNIQUE REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  slot_duration_minutes integer DEFAULT 20,
  whatsapp_reminders_enabled boolean DEFAULT true,
  sms_reminders_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_billing_clinic_created ON billing(clinic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_patient ON ai_sessions(patient_id);

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['clinics','users','patients','appointments','consultations','billing','inventory','ai_sessions','vitals','clinic_settings']) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['clinics','users','patients','appointments','consultations','billing','inventory','ai_sessions','vitals','clinic_settings']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%1$s" ON %1$s;', tbl);
    EXECUTE format('CREATE POLICY "anon_select_%1$s" ON %1$s FOR SELECT TO anon, authenticated USING (true);', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%1$s" ON %1$s;', tbl);
    EXECUTE format('CREATE POLICY "anon_insert_%1$s" ON %1$s FOR INSERT TO anon, authenticated WITH CHECK (true);', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%1$s" ON %1$s;', tbl);
    EXECUTE format('CREATE POLICY "anon_update_%1$s" ON %1$s FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%1$s" ON %1$s;', tbl);
    EXECUTE format('CREATE POLICY "anon_delete_%1$s" ON %1$s FOR DELETE TO anon, authenticated USING (true);', tbl);
  END LOOP;
END $$;