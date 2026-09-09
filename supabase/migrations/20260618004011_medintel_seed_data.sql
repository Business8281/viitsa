/*
# MedIntel OS — Seed demo data

Inserts demo clinic, staff, patients, inventory, today's appointments, sample consultations,
billing records, and an AI Navigator session so the MVP feels real during demos.
*/

-- Clinic
INSERT INTO clinics (clinic_id, name, address, city, phone, email, owner_name, working_hours)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Sunrise Health Clinic',
  'Plot 42, KPHB Colony, Kukatpally, Hyderabad 500072',
  'Hyderabad',
  '+91 98765 43210',
  'hello@sunriseclinic.com',
  'Dr. Arun Sharma',
  '{"open":"09:00","close":"19:00","days":["Mon","Tue","Wed","Thu","Fri","Sat"]}'::jsonb
)
ON CONFLICT (clinic_id) DO NOTHING;

INSERT INTO clinic_settings (clinic_id, slot_duration_minutes, whatsapp_reminders_enabled)
SELECT '11111111-1111-1111-1111-111111111111', 20, true
ON CONFLICT (clinic_id) DO NOTHING;

-- Users (password_hash = sha256('MedIntel@2026') = 9d1ea503d5e5670c9680367b9691b068909de898ef5f74a4b50c6f9dfd486555)
INSERT INTO users (user_id, clinic_id, name, email, password_hash, role, phone, specialisation, active, avatar_color) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Dr. Arun Sharma', 'admin@sunriseclinic.com', '9d1ea503d5e5670c9680367b9691b068909de898ef5f74a4b50c6f9dfd486555', 'admin', '+91 98765 43210', 'General Medicine', true, '#0F6E56'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Dr. Priya Rao',    'doctor@sunriseclinic.com','9d1ea503d5e5670c9680367b9691b068909de898ef5f74a4b50c6f9dfd486555', 'doctor', '+91 98765 11111', 'General Medicine', true, '#05C994'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Reena Kumar',     'staff@sunriseclinic.com', '9d1ea503d5e5670c9680367b9691b068909de898ef5f74a4b50c6f9dfd486555', 'staff',  '+91 98765 22222', NULL, true, '#E08600')
ON CONFLICT (email) DO NOTHING;

-- Patients
INSERT INTO patients (patient_id, clinic_id, name, age, gender, phone, email, blood_group, address, allergies, chronic_conditions, emergency_contact_name, emergency_contact_phone) VALUES
  ('10000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Ravi Kumar', 52, 'Male', '+91 98001 11111', 'ravi.kumar@example.com', 'O+', '12/B KPHB, Hyderabad', 'Penicillin', 'Diabetes, Hypertension', 'Lakshmi Kumar', '+91 98700 11111'),
  ('10000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Priya Mehta', 34, 'Female', '+91 98002 22222', 'priya.mehta@example.com', 'A+', '5-3 Miyapur, Hyderabad', 'None', 'None', 'Anil Mehta', '+91 98700 22222'),
  ('10000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Sunita Laxmi', 61, 'Female', '+91 98003 33333', 'sunita.laxmi@example.com', 'B+', 'Flat 8, Kondapur, Hyderabad', 'Sulfa drugs', 'Diabetes', 'Kiran Laxmi', '+91 98700 33333'),
  ('10000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Anil Sharma', 28, 'Male', '+91 98004 44444', 'anil.sharma@example.com', 'O-', '21 Hi-Tech City, Hyderabad', 'Dust', 'Asthma', 'Meena Sharma', '+91 98700 44444'),
  ('10000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Deepa Nair', 29, 'Female', '+91 98005 55555', 'deepa.nair@example.com', 'AB+', '9 Jubilee Hills, Hyderabad', 'None', 'Pregnant', 'Suresh Nair', '+91 98700 55555'),
  ('10000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Karthik Reddy', 45, 'Male', '+91 98006 66666', NULL, 'B-', 'Whitefields, Hyderabad', 'None', 'Hypertension', 'Deepika Reddy', '+91 98700 66666'),
  ('10000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','Meera Iyer', 38, 'Female', '+91 98007 77777', NULL, 'A-', 'Madhapur, Hyderabad', 'None', 'None', 'Ganesh Iyer', '+91 98700 77777'),
  ('10000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','Faisal Ahmed', 56, 'Male', '+91 98008 88888', NULL, 'O+', 'Tolichowki, Hyderabad', 'Aspirin', 'Heart Disease', 'Zara Ahmed', '+91 98700 88888')
ON CONFLICT (patient_id) DO NOTHING;

-- Inventory
INSERT INTO inventory (item_id, clinic_id, name, category, quantity, unit, reorder_level, supplier, cost_per_unit) VALUES
  ('20000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Paracetamol 500mg','Medicine',45,'strips',20,'MediSupply Co',12.50),
  ('20000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Amoxicillin 250mg','Medicine',12,'strips',15,'MediSupply Co',28.00),
  ('20000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Metformin 500mg','Medicine',8,'strips',10,'Pharma Plus',18.00),
  ('20000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Amlodipine 5mg','Medicine',30,'strips',15,'MediSupply Co',22.00),
  ('20000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Cetirizine 10mg','Medicine',0,'strips',10,'Pharma Plus',9.00),
  ('20000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Surgical gloves','Supplies',120,'pairs',50,'SurgiCare',4.50),
  ('20000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','Syringes 5ml','Supplies',80,'pieces',30,'SurgiCare',3.00),
  ('20000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','BP cuffs','Equipment',3,'units',2,'MedEquip India',850.00)
ON CONFLICT (item_id) DO NOTHING;

-- Vitals
INSERT INTO vitals (patient_id, clinic_id, systolic_bp, diastolic_bp, pulse, temperature, spo2, weight, recorded_at) VALUES
  ('10000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',148,92,82,98.6,97,78.5,now()),
  ('10000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',134,84,76,98.4,98,72.1,now()),
  ('10000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111',120,80,88,98.8,95,68.0,now()),
  ('10000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111',142,90,74,98.6,98,82.0,now())
ON CONFLICT DO NOTHING;

-- Today's appointments
INSERT INTO appointments (appt_id, clinic_id, patient_id, doctor_id, date, time_slot, type, status, reason, triage_level, token_number) VALUES
  ('30000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE, '09:00', 'scheduled', 'done', 'Routine diabetes follow-up', 'normal', 1),
  ('30000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE, '09:30', 'scheduled', 'done', 'General check-up', 'normal', 2),
  ('30000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000003','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE, '10:30', 'scheduled', 'in-progress', 'High sugar review', 'moderate', 3),
  ('30000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000004','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE, '11:00', 'walk-in', 'waiting', 'Breathing difficulty', 'urgent', 4),
  ('30000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000005','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE, '11:30', 'scheduled', 'waiting', 'Antenatal check-up', 'normal', 5),
  ('30000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000006','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE, '12:00', 'walk-in', 'waiting', 'Headache and giddiness', 'moderate', 6),
  ('30000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000007','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE, '15:00', 'scheduled', 'waiting', 'Skin allergy', 'normal', 7),
  ('30000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000008','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE, '16:00', 'scheduled', 'waiting', 'Chest tightness', 'urgent', 8)
ON CONFLICT (appt_id) DO NOTHING;

-- Sample consultations
INSERT INTO consultations (consult_id, appt_id, patient_id, doctor_id, symptoms, diagnosis, prescription, follow_up_date, notes, created_at) VALUES
  ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Increased thirst and fatigue over 2 weeks','Type 2 Diabetes — uncontrolled','Metformin 500mg twice daily after meals. Repeat HbA1c in 3 months.', CURRENT_DATE + 90, 'Advised diet control', now() - INTERVAL '30 days'),
  ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Mild fever and body ache','Viral fever','Paracetamol 500mg, rest, fluids', CURRENT_DATE + 7, 'Self-limiting', now() - INTERVAL '14 days'),
  ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Frequent urination at night','Diabetes management review','Continue Metformin. Add Glimepiride 1mg morning.', CURRENT_DATE + 60, 'HbA1c 7.8%', now() - INTERVAL '10 days')
ON CONFLICT (consult_id) DO NOTHING;

-- Billing (today + prior days for charts)
INSERT INTO billing (bill_id, clinic_id, patient_id, appt_id, amount, payment_status, payment_method, created_at) VALUES
  ('50000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',600,'paid','upi', now()),
  ('50000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002',400,'paid','cash', now()),
  ('50000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003',500,'pending','cash', now()),
  ('50000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000004',NULL,800,'pending','cash', now() - INTERVAL '6 days'),
  ('50000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000005',NULL,650,'paid','upi', now() - INTERVAL '5 days'),
  ('50000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000006',NULL,450,'paid','card', now() - INTERVAL '4 days'),
  ('50000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000007',NULL,300,'paid','cash', now() - INTERVAL '3 days'),
  ('50000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000008',NULL,1200,'pending','cash', now() - INTERVAL '2 days'),
  ('50000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000006',NULL,500,'partial','cash', now() - INTERVAL '1 days')
ON CONFLICT (bill_id) DO NOTHING;

-- Past-week appointments (footfall chart)
INSERT INTO appointments (appt_id, clinic_id, patient_id, doctor_id, date, time_slot, type, status, reason, triage_level, token_number) VALUES
  ('31000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE - 6, '09:00','scheduled','done','Diabetes review','normal',1),
  ('31000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE - 6, '10:00','scheduled','done','Skin rash','normal',2),
  ('31000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000003','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE - 5, '11:00','scheduled','done','Sugar review','moderate',1),
  ('31000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000004','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE - 5, '12:00','walk-in','done','Asthma','urgent',1),
  ('31000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000005','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE - 4, '09:30','scheduled','done','Antenatal','normal',1),
  ('31000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000006','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE - 4, '10:30','scheduled','done','BP review','moderate',2),
  ('31000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000007','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE - 3, '11:30','walk-in','done','Headache','normal',1),
  ('31000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000008','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE - 2, '16:00','scheduled','done','Chest pain follow-up','urgent',1),
  ('31000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000004','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE + 1, '10:00','scheduled','waiting','Asthma review','normal',1),
  ('31000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE + 1, '10:30','scheduled','waiting','Sugar review','normal',2),
  ('31000000-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000006','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_DATE + 2, '11:00','scheduled','waiting','BP follow-up','normal',1)
ON CONFLICT (appt_id) DO NOTHING;

-- AI session (urgent chest pain demo)
INSERT INTO ai_sessions (session_id, patient_id, clinic_id, appt_id, symptoms_entered, ai_response, triage_level, doctor_notified, conversation, recommendations, created_at) VALUES
  ('60000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000004',
   '11111111-1111-1111-1111-111111111111',
   '30000000-0000-0000-0000-000000000004',
   'Chest tightness and shortness of breath',
   'I understand this is stressful. Chest tightness with shortness of breath needs urgent attention. Please proceed to the doctor immediately — you have been moved to the top of the queue. triage_level: URGENT',
   'urgent',
   true,
   '[{"role":"ai","text":"Hello, I''m MedIntel AI Navigator. Can you describe your symptoms?"},{"role":"patient","text":"I have chest tightness and shortness of breath"},{"role":"ai","text":"I understand this is stressful. Chest tightness with shortness of breath needs urgent attention. Please proceed to the doctor immediately. triage_level: URGENT"}]'::jsonb,
   '[{"level":"urgent","text":"Move patient to top of doctor queue immediately"},{"level":"urgent","text":"Have a nurse escort the patient; monitor SpO2 and BP on arrival"},{"level":"caution","text":"Keep an ECG ready before the doctor sees the patient"}]'::jsonb,
   now()) ON CONFLICT (session_id) DO NOTHING;

SELECT 'seeded' AS status;
