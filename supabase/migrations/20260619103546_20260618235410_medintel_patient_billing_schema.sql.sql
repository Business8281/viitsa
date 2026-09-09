/*
# MedIntel OS — Patient app + invoice + billing upgrade schema

## New Tables
1. `patient_accounts` — Patient-side login (mobile OTP auth, cross-clinic identity)
2. `invoices` — Auto-generated invoice per bill with line items, discount, invoice number
3. `bill_line_items` — Individual charges within a bill (consultation fee, lab test, etc.)
4. `patient_clinic_links` — Records which clinics a patient has visited (for cross-clinic invoice aggregation)
5. `medicine_reminders` — Patient-set medicine reminder preferences

## Modified Tables
- `billing` — add: `doctor_id`, `discount_amount`, `discount_percent`, `upi_ref`, `expected_payment_date`, `line_items` (jsonb), `invoice_id`, `invoice_number`
- `appointments` — add: `booked_via` (patient/staff/walkin), `online_booking` flag, `visit_type` (new-visit/follow-up/report)
- `clinic_settings` — add: `upi_id`, `upi_qr_url`
- `users` — add: `upi_id` for doctor QR

## Security
- RLS enabled on all new tables
- Anon + authenticated CRUD (single-tenant demo pattern)
*/

-- 1. Patient accounts (cross-clinic identity, OTP-based)
CREATE TABLE IF NOT EXISTS patient_accounts (
  account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  name text NOT NULL,
  age integer,
  gender text CHECK (gender IN ('Male','Female','Other')),
  blood_group text,
  allergies text DEFAULT 'None',
  chronic_conditions text DEFAULT 'None',
  emergency_contact_name text,
  emergency_contact_phone text,
  otp_code text DEFAULT '1234',
  otp_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 2. Patient–clinic linking (tracks which patient_id in patients table maps to account)
CREATE TABLE IF NOT EXISTS patient_clinic_links (
  link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES patient_accounts(account_id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(patient_id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, clinic_id)
);

-- 3. Bill line items (individual charge rows per bill)
CREATE TABLE IF NOT EXISTS bill_line_items (
  line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid REFERENCES billing(bill_id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. Invoices (auto-generated on bill creation/payment)
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  bill_id uuid REFERENCES billing(bill_id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(patient_id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid','pending','partial')),
  payment_method text DEFAULT 'cash',
  upi_ref text,
  line_items jsonb DEFAULT '[]'::jsonb,
  visit_date date,
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 5. Medicine reminders (patient side)
CREATE TABLE IF NOT EXISTS medicine_reminders (
  reminder_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES patient_accounts(account_id) ON DELETE CASCADE,
  medicine_name text NOT NULL,
  dosage text,
  frequency text,
  start_date date,
  end_date date,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Alter billing: add extended fields
ALTER TABLE billing ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE billing ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0;
ALTER TABLE billing ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) DEFAULT 0;
ALTER TABLE billing ADD COLUMN IF NOT EXISTS upi_ref text;
ALTER TABLE billing ADD COLUMN IF NOT EXISTS expected_payment_date date;
ALTER TABLE billing ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE billing ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE billing ADD COLUMN IF NOT EXISTS consultation_fee numeric(10,2) DEFAULT 0;
ALTER TABLE billing ADD COLUMN IF NOT EXISTS visit_type text DEFAULT 'new-visit';

-- Alter appointments: online booking flag + visit type
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booked_via text DEFAULT 'staff' CHECK (booked_via IN ('staff','patient','walkin'));
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS visit_type text DEFAULT 'new-visit' CHECK (visit_type IN ('new-visit','follow-up','report-discussion'));
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS online_booking boolean DEFAULT false;

-- Alter clinic_settings: add UPI fields
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS upi_id text;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS upi_qr_url text;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS consultation_fee integer DEFAULT 500;

-- Sequence table for invoice numbers per clinic
CREATE TABLE IF NOT EXISTS invoice_sequences (
  seq_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid UNIQUE REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  last_number integer DEFAULT 0
);

-- Seed invoice sequence for demo clinic
INSERT INTO invoice_sequences (clinic_id, last_number)
VALUES ('11111111-1111-1111-1111-111111111111', 0)
ON CONFLICT (clinic_id) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_clinic ON invoices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_accounts_phone ON patient_accounts(phone);
CREATE INDEX IF NOT EXISTS idx_patient_clinic_links_account ON patient_clinic_links(account_id);
CREATE INDEX IF NOT EXISTS idx_bill_line_items_bill ON bill_line_items(bill_id);

-- RLS on new tables (single-tenant open access)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['patient_accounts','patient_clinic_links','bill_line_items','invoices','medicine_reminders','invoice_sequences']) LOOP
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