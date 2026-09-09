-- MedIntel OS Database Setup
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ssydcflwrxzrswbekisc/sql
-- Login: admin@sunriseclinic.com / MedIntel@2026

-- Schema
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
  created_at timestamptz DEFAULT now(),
  departments text[] DEFAULT '{}'::text[],
  rating numeric DEFAULT 4.5
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
  created_at timestamptz DEFAULT now(),
  rating numeric DEFAULT 4.8
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
  created_at timestamptz DEFAULT now(),
  booked_via text DEFAULT 'staff' CHECK (booked_via IN ('staff','patient','walkin')),
  visit_type text DEFAULT 'new-visit' CHECK (visit_type IN ('new-visit','follow-up','report-discussion')),
  online_booking boolean DEFAULT false
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
  created_at timestamptz DEFAULT now(),
  doctor_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  discount_amount numeric DEFAULT 0,
  discount_percent numeric DEFAULT 0,
  upi_ref text,
  expected_payment_date date,
  invoice_number text,
  notes text,
  consultation_fee numeric DEFAULT 0,
  visit_type text DEFAULT 'new-visit'
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
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE UNIQUE,
  slot_duration_minutes integer DEFAULT 20,
  whatsapp_reminders_enabled boolean DEFAULT true,
  sms_reminders_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  upi_id text,
  upi_qr_url text,
  consultation_fee integer DEFAULT 500
);

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

CREATE TABLE IF NOT EXISTS patient_clinic_links (
  link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES patient_accounts(account_id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(patient_id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_reports (
  report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(patient_id) ON DELETE CASCADE,
  account_id uuid REFERENCES patient_accounts(account_id) ON DELETE SET NULL,
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE SET NULL,
  report_type text NOT NULL,
  report_date date,
  hospital_or_doctor text,
  key_findings jsonb DEFAULT '[]'::jsonb,
  diagnosis text,
  medications jsonb DEFAULT '[]'::jsonb,
  doctor_notes text,
  summary text,
  urgent_flags text[] DEFAULT '{}'::text[],
  original_file_url text,
  original_file_type text,
  ai_processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  bill_id uuid REFERENCES billing(bill_id) ON DELETE SET NULL,
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(patient_id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  subtotal numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('paid','pending','partial')),
  payment_method text DEFAULT 'cash',
  upi_ref text,
  line_items jsonb DEFAULT '[]'::jsonb,
  visit_date date,
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_sequences (
  seq_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(clinic_id) ON DELETE CASCADE UNIQUE,
  last_number integer DEFAULT 0
);

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

CREATE TABLE IF NOT EXISTS bill_line_items (
  line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid REFERENCES billing(bill_id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_clinic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY anon_all_clinics ON clinics FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_users ON users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_patients ON patients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_appointments ON appointments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_consultations ON consultations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_billing ON billing FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_inventory ON inventory FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_ai_sessions ON ai_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_vitals ON vitals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_clinic_settings ON clinic_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_patient_accounts ON patient_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_patient_clinic_links ON patient_clinic_links FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_health_reports ON health_reports FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_invoices ON invoices FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_invoice_sequences ON invoice_sequences FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_medicine_reminders ON medicine_reminders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_patient_notifications ON patient_notifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_bill_line_items ON bill_line_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed Data
INSERT INTO clinics (clinic_id, name, address, city, phone, email, owner_name, working_hours)
VALUES ('11111111-1111-1111-1111-111111111111', 'Sunrise Health Clinic', 'Plot 42, KPHB Colony, Kukatpally, Hyderabad 500072', 'Hyderabad', '+91 98765 43210', 'hello@sunriseclinic.com', 'Dr. Arun Sharma', '{"open":"09:00","close":"19:00","days":["Mon","Tue","Wed","Thu","Fri","Sat"]}'::jsonb)
ON CONFLICT (clinic_id) DO NOTHING;

INSERT INTO clinic_settings (clinic_id, slot_duration_minutes, whatsapp_reminders_enabled)
SELECT '11111111-1111-1111-1111-111111111111', 20, true ON CONFLICT (clinic_id) DO NOTHING;

INSERT INTO users (user_id, clinic_id, name, email, password_hash, role, phone, specialisation, active, avatar_color) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Dr. Arun Sharma', 'admin@sunriseclinic.com', '9d1ea503d5e5670c9680367b9691b068909de898ef5f74a4b50c6f9dfd486555', 'admin', '+91 98765 43210', 'General Medicine', true, '#0F6E56'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Dr. Priya Rao', 'doctor@sunriseclinic.com', '9d1ea503d5e5670c9680367b9691b068909de898ef5f74a4b50c6f9dfd486555', 'doctor', '+91 98765 11111', 'General Medicine', true, '#05C994'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Reena Kumar', 'staff@sunriseclinic.com', '9d1ea503d5e5670c9680367b9691b068909de898ef5f74a4b50c6f9dfd486555', 'staff', '+91 98765 22222', NULL, true, '#E08600')
ON CONFLICT (email) DO NOTHING;

INSERT INTO patient_accounts (account_id, phone, name, age, gender, blood_group, allergies, chronic_conditions, emergency_contact_name, emergency_contact_phone, otp_code, otp_verified)
VALUES ('99999999-9999-9999-9999-999999999999', '9999999999', 'Ravi Kumar', 52, 'Male', 'O+', 'Penicillin', 'Diabetes, Hypertension', 'Lakshmi Kumar', '+91 98700 11111', '1234', true)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO patients (patient_id, clinic_id, name, age, gender, phone, email, blood_group, address, allergies, chronic_conditions, emergency_contact_name, emergency_contact_phone) VALUES
  ('10000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Ravi Kumar', 52, 'Male', '+91 98001 11111', 'ravi.kumar@example.com', 'O+', '12/B KPHB, Hyderabad', 'Penicillin', 'Diabetes, Hypertension', 'Lakshmi Kumar', '+91 98700 11111'),
  ('10000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Priya Mehta', 34, 'Female', '+91 98002 22222', 'priya.mehta@example.com', 'A+', '5-3 Miyapur, Hyderabad', 'None', 'None', 'Anil Mehta', '+91 98700 22222'),
  ('10000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Sunita Laxmi', 61, 'Female', '+91 98003 33333', 'sunita.laxmi@example.com', 'B+', 'Flat 8, Kondapur, Hyderabad', 'Sulfa drugs', 'Diabetes', 'Kiran Laxmi', '+91 98700 33333'),
  ('10000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Anil Sharma', 28, 'Male', '+91 98004 44444', 'anil.sharma@example.com', 'O-', '21 Hi-Tech City, Hyderabad', 'Dust', 'Asthma', 'Meena Sharma', '+91 98700 44444')
ON CONFLICT (patient_id) DO NOTHING;

INSERT INTO patient_clinic_links (account_id, patient_id, clinic_id)
VALUES ('99999999-9999-9999-9999-999999999999', '10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

INSERT INTO inventory (item_id, clinic_id, name, category, quantity, unit, reorder_level, supplier, cost_per_unit) VALUES
  ('20000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Paracetamol 500mg','Medicine',45,'strips',20,'MediSupply Co',12.50),
  ('20000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Amoxicillin 250mg','Medicine',12,'strips',15,'MediSupply Co',28.00),
  ('20000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Metformin 500mg','Medicine',8,'strips',10,'Pharma Plus',18.00)
ON CONFLICT (item_id) DO NOTHING;

INSERT INTO invoice_sequences (clinic_id, last_number)
VALUES ('11111111-1111-1111-1111-111111111111', 0) ON CONFLICT (clinic_id) DO NOTHING;
