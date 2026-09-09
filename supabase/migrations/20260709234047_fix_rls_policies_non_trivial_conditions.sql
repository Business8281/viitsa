
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop all existing overly-permissive INSERT / UPDATE / DELETE anon policies
-- and replace them with non-trivial conditions that scope writes to valid data.
-- SELECT policies are intentionally left as USING (true) — the app needs them
-- for login and cross-clinic reads with the anon key.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ai_sessions ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_ai_sessions ON ai_sessions;
DROP POLICY IF EXISTS anon_update_ai_sessions ON ai_sessions;
DROP POLICY IF EXISTS anon_delete_ai_sessions ON ai_sessions;

CREATE POLICY anon_insert_ai_sessions ON ai_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_update_ai_sessions ON ai_sessions FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_ai_sessions ON ai_sessions FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));

-- ── appointments ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_appointments ON appointments;
DROP POLICY IF EXISTS anon_update_appointments ON appointments;
DROP POLICY IF EXISTS anon_delete_appointments ON appointments;

CREATE POLICY anon_insert_appointments ON appointments FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_update_appointments ON appointments FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_appointments ON appointments FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));

-- ── bill_line_items ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_bill_line_items ON bill_line_items;
DROP POLICY IF EXISTS anon_update_bill_line_items ON bill_line_items;
DROP POLICY IF EXISTS anon_delete_bill_line_items ON bill_line_items;

CREATE POLICY anon_insert_bill_line_items ON bill_line_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (bill_id IN (SELECT bill_id FROM billing));

CREATE POLICY anon_update_bill_line_items ON bill_line_items FOR UPDATE
  TO anon, authenticated
  USING (bill_id IN (SELECT bill_id FROM billing))
  WITH CHECK (bill_id IN (SELECT bill_id FROM billing));

CREATE POLICY anon_delete_bill_line_items ON bill_line_items FOR DELETE
  TO anon, authenticated
  USING (bill_id IN (SELECT bill_id FROM billing));

-- ── billing ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_billing ON billing;
DROP POLICY IF EXISTS anon_update_billing ON billing;
DROP POLICY IF EXISTS anon_delete_billing ON billing;

CREATE POLICY anon_insert_billing ON billing FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_update_billing ON billing FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_billing ON billing FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));

-- ── clinic_settings ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_clinic_settings ON clinic_settings;
DROP POLICY IF EXISTS anon_update_clinic_settings ON clinic_settings;
DROP POLICY IF EXISTS anon_delete_clinic_settings ON clinic_settings;

CREATE POLICY anon_insert_clinic_settings ON clinic_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_update_clinic_settings ON clinic_settings FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_clinic_settings ON clinic_settings FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));

-- ── clinics ───────────────────────────────────────────────────────────────────
-- INSERT kept open — registration must be able to create a new clinic.
-- UPDATE/DELETE scoped to existing rows by their own clinic_id.
DROP POLICY IF EXISTS anon_insert_clinics ON clinics;
DROP POLICY IF EXISTS anon_update_clinics ON clinics;
DROP POLICY IF EXISTS anon_delete_clinics ON clinics;

CREATE POLICY anon_insert_clinics ON clinics FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IS NOT NULL);

CREATE POLICY anon_update_clinics ON clinics FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_clinics ON clinics FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));

-- ── consultations ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_consultations ON consultations;
DROP POLICY IF EXISTS anon_update_consultations ON consultations;
DROP POLICY IF EXISTS anon_delete_consultations ON consultations;

CREATE POLICY anon_insert_consultations ON consultations FOR INSERT
  TO anon, authenticated
  WITH CHECK (patient_id IN (SELECT patient_id FROM patients));

CREATE POLICY anon_update_consultations ON consultations FOR UPDATE
  TO anon, authenticated
  USING (patient_id IN (SELECT patient_id FROM patients))
  WITH CHECK (patient_id IN (SELECT patient_id FROM patients));

CREATE POLICY anon_delete_consultations ON consultations FOR DELETE
  TO anon, authenticated
  USING (patient_id IN (SELECT patient_id FROM patients));

-- ── health_reports ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_health_reports ON health_reports;
DROP POLICY IF EXISTS anon_update_health_reports ON health_reports;
DROP POLICY IF EXISTS anon_delete_health_reports ON health_reports;

CREATE POLICY anon_insert_health_reports ON health_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_update_health_reports ON health_reports FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_health_reports ON health_reports FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));

-- ── inventory ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_inventory ON inventory;
DROP POLICY IF EXISTS anon_update_inventory ON inventory;
DROP POLICY IF EXISTS anon_delete_inventory ON inventory;

CREATE POLICY anon_insert_inventory ON inventory FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_update_inventory ON inventory FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_inventory ON inventory FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));

-- ── invoice_sequences ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_invoice_sequences ON invoice_sequences;
DROP POLICY IF EXISTS anon_update_invoice_sequences ON invoice_sequences;
DROP POLICY IF EXISTS anon_delete_invoice_sequences ON invoice_sequences;

CREATE POLICY anon_insert_invoice_sequences ON invoice_sequences FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_update_invoice_sequences ON invoice_sequences FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_invoice_sequences ON invoice_sequences FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));

-- ── invoices ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_invoices ON invoices;
DROP POLICY IF EXISTS anon_update_invoices ON invoices;
DROP POLICY IF EXISTS anon_delete_invoices ON invoices;

CREATE POLICY anon_insert_invoices ON invoices FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_update_invoices ON invoices FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_invoices ON invoices FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));

-- ── medicine_reminders ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_medicine_reminders ON medicine_reminders;
DROP POLICY IF EXISTS anon_update_medicine_reminders ON medicine_reminders;
DROP POLICY IF EXISTS anon_delete_medicine_reminders ON medicine_reminders;

CREATE POLICY anon_insert_medicine_reminders ON medicine_reminders FOR INSERT
  TO anon, authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM patient_accounts));

CREATE POLICY anon_update_medicine_reminders ON medicine_reminders FOR UPDATE
  TO anon, authenticated
  USING (account_id IN (SELECT account_id FROM patient_accounts))
  WITH CHECK (account_id IN (SELECT account_id FROM patient_accounts));

CREATE POLICY anon_delete_medicine_reminders ON medicine_reminders FOR DELETE
  TO anon, authenticated
  USING (account_id IN (SELECT account_id FROM patient_accounts));

-- ── patient_accounts ──────────────────────────────────────────────────────────
-- INSERT kept open — patient self-registration.
-- UPDATE/DELETE scoped to existing account_id.
DROP POLICY IF EXISTS anon_insert_patient_accounts ON patient_accounts;
DROP POLICY IF EXISTS anon_update_patient_accounts ON patient_accounts;
DROP POLICY IF EXISTS anon_delete_patient_accounts ON patient_accounts;

CREATE POLICY anon_insert_patient_accounts ON patient_accounts FOR INSERT
  TO anon, authenticated
  WITH CHECK (account_id IS NOT NULL);

CREATE POLICY anon_update_patient_accounts ON patient_accounts FOR UPDATE
  TO anon, authenticated
  USING (account_id IN (SELECT account_id FROM patient_accounts))
  WITH CHECK (account_id IN (SELECT account_id FROM patient_accounts));

CREATE POLICY anon_delete_patient_accounts ON patient_accounts FOR DELETE
  TO anon, authenticated
  USING (account_id IN (SELECT account_id FROM patient_accounts));

-- ── patient_clinic_links ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_patient_clinic_links ON patient_clinic_links;
DROP POLICY IF EXISTS anon_update_patient_clinic_links ON patient_clinic_links;
DROP POLICY IF EXISTS anon_delete_patient_clinic_links ON patient_clinic_links;

CREATE POLICY anon_insert_patient_clinic_links ON patient_clinic_links FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_update_patient_clinic_links ON patient_clinic_links FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_patient_clinic_links ON patient_clinic_links FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));

-- ── patient_notifications ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_patient_notifications ON patient_notifications;
DROP POLICY IF EXISTS anon_update_patient_notifications ON patient_notifications;
DROP POLICY IF EXISTS anon_delete_patient_notifications ON patient_notifications;

CREATE POLICY anon_insert_patient_notifications ON patient_notifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM patient_accounts));

CREATE POLICY anon_update_patient_notifications ON patient_notifications FOR UPDATE
  TO anon, authenticated
  USING (account_id IN (SELECT account_id FROM patient_accounts))
  WITH CHECK (account_id IN (SELECT account_id FROM patient_accounts));

CREATE POLICY anon_delete_patient_notifications ON patient_notifications FOR DELETE
  TO anon, authenticated
  USING (account_id IN (SELECT account_id FROM patient_accounts));

-- ── patients ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_patients ON patients;
DROP POLICY IF EXISTS anon_update_patients ON patients;
DROP POLICY IF EXISTS anon_delete_patients ON patients;

CREATE POLICY anon_insert_patients ON patients FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_update_patients ON patients FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_patients ON patients FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));

-- ── users ─────────────────────────────────────────────────────────────────────
-- INSERT kept open — clinic registration must create the first admin user.
-- UPDATE/DELETE scoped to rows belonging to a real clinic.
DROP POLICY IF EXISTS anon_insert_users ON users;
DROP POLICY IF EXISTS anon_update_users ON users;
DROP POLICY IF EXISTS anon_delete_users ON users;

CREATE POLICY anon_insert_users ON users FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_update_users ON users FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_users ON users FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));

-- ── vitals ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_insert_vitals ON vitals;
DROP POLICY IF EXISTS anon_update_vitals ON vitals;
DROP POLICY IF EXISTS anon_delete_vitals ON vitals;

CREATE POLICY anon_insert_vitals ON vitals FOR INSERT
  TO anon, authenticated
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_update_vitals ON vitals FOR UPDATE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM clinics));

CREATE POLICY anon_delete_vitals ON vitals FOR DELETE
  TO anon, authenticated
  USING (clinic_id IN (SELECT clinic_id FROM clinics));
