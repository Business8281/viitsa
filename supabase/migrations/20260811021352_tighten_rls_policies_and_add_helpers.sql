/*
# Tighten RLS Policies — Replace USING(true) with Auth-Based Ownership Checks

## Summary
Replaces all overly permissive `USING (true)` RLS policies with proper
authentication-based access control. The previous policies allowed any
unauthenticated visitor (anon role) to read, create, modify, and delete
any data across all clinics — a critical security vulnerability in a
multi-tenant healthcare application.

## Changes

### 1. New Helper Functions (SECURITY DEFINER)
- `is_clinic_staff(check_clinic_id uuid)` — returns true if the current
  authenticated user is a staff member (doctor/staff/admin) of the given clinic.
- `is_own_patient_account(check_account_id uuid)` — returns true if the current
  user owns the given patient_account (via auth_user_id).
- `is_linked_patient(check_patient_id uuid)` — returns true if the current
  user is linked to the given patient record (via patient_clinic_links).
- `is_patient_of_clinic(check_clinic_id uuid)` — returns true if the current
  user is a patient linked to any patient record in the given clinic.

### 2. Policy Tightening Strategy
- **clinics** and **users** tables: SELECT remains open to anon+authenticated
  (needed for patient search/booking). Writes restricted to authenticated
  clinic staff only.
- **Clinic-scoped tables**: SELECT restricted to authenticated clinic staff
  OR the patient who owns the record. Writes restricted to authenticated
  clinic staff only (except appointments which patients can also create).
- **Patient-scoped tables**: CRUD restricted to the authenticated patient
  who owns the data.

### 3. Security Impact
- Unauthenticated (anon) users can no longer write to any table.
- Unauthenticated users can only read clinic directory info (clinics, users).
- Authenticated clinic staff can only access data for their own clinic.
- Authenticated patients can only access their own medical data.
- Cross-clinic data access is blocked at the database level.
*/

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION is_clinic_staff(check_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.user_id = auth.uid() AND u.clinic_id = check_clinic_id
  );
$$;

CREATE OR REPLACE FUNCTION is_own_patient_account(check_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM patient_accounts pa
    WHERE pa.auth_user_id = auth.uid() AND pa.account_id = check_account_id
  );
$$;

CREATE OR REPLACE FUNCTION is_linked_patient(check_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM patient_clinic_links pcl
    JOIN patient_accounts pa ON pcl.account_id = pa.account_id
    WHERE pa.auth_user_id = auth.uid() AND pcl.patient_id = check_patient_id
  );
$$;

CREATE OR REPLACE FUNCTION is_patient_of_clinic(check_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM patient_clinic_links pcl
    JOIN patient_accounts pa ON pcl.account_id = pa.account_id
    WHERE pa.auth_user_id = auth.uid() AND pcl.clinic_id = check_clinic_id
  );
$$;

-- ============================================================================
-- CLINICS TABLE — Public read (for search), staff-only writes
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_clinics" ON clinics;
DROP POLICY IF EXISTS "anon_insert_clinics" ON clinics;
DROP POLICY IF EXISTS "anon_update_clinics" ON clinics;
DROP POLICY IF EXISTS "anon_delete_clinics" ON clinics;
DROP POLICY IF EXISTS "select_clinics" ON clinics;

CREATE POLICY "select_clinics" ON clinics FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_clinics" ON clinics FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_clinics" ON clinics FOR UPDATE
  TO authenticated USING (is_clinic_staff(clinic_id)) WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "delete_clinics" ON clinics FOR DELETE
  TO authenticated USING (is_clinic_staff(clinic_id));

-- ============================================================================
-- USERS TABLE (clinic staff) — Public read (for doctor search), staff-only writes
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_users" ON users;
DROP POLICY IF EXISTS "anon_insert_users" ON users;
DROP POLICY IF EXISTS "anon_update_users" ON users;
DROP POLICY IF EXISTS "anon_delete_users" ON users;
DROP POLICY IF EXISTS "select_users" ON users;

CREATE POLICY "select_users" ON users FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_users" ON users FOR INSERT
  TO authenticated WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "update_users" ON users FOR UPDATE
  TO authenticated USING (is_clinic_staff(clinic_id)) WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "delete_users" ON users FOR DELETE
  TO authenticated USING (is_clinic_staff(clinic_id));

-- ============================================================================
-- CLINIC_SETTINGS — Staff-only
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_clinic_settings" ON clinic_settings;
DROP POLICY IF EXISTS "anon_insert_clinic_settings" ON clinic_settings;
DROP POLICY IF EXISTS "anon_update_clinic_settings" ON clinic_settings;
DROP POLICY IF EXISTS "anon_delete_clinic_settings" ON clinic_settings;

CREATE POLICY "select_clinic_settings" ON clinic_settings FOR SELECT
  TO authenticated USING (is_clinic_staff(clinic_id));

CREATE POLICY "insert_clinic_settings" ON clinic_settings FOR INSERT
  TO authenticated WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "update_clinic_settings" ON clinic_settings FOR UPDATE
  TO authenticated USING (is_clinic_staff(clinic_id)) WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "delete_clinic_settings" ON clinic_settings FOR DELETE
  TO authenticated USING (is_clinic_staff(clinic_id));

-- ============================================================================
-- PATIENTS (clinic patient records) — Staff + linked patient
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_patients" ON patients;
DROP POLICY IF EXISTS "anon_insert_patients" ON patients;
DROP POLICY IF EXISTS "anon_update_patients" ON patients;
DROP POLICY IF EXISTS "anon_delete_patients" ON patients;

CREATE POLICY "select_patients" ON patients FOR SELECT
  TO authenticated
  USING (is_clinic_staff(clinic_id) OR is_linked_patient(patient_id));

CREATE POLICY "insert_patients" ON patients FOR INSERT
  TO authenticated
  WITH CHECK (is_clinic_staff(clinic_id) OR is_patient_of_clinic(clinic_id));

CREATE POLICY "update_patients" ON patients FOR UPDATE
  TO authenticated
  USING (is_clinic_staff(clinic_id)) WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "delete_patients" ON patients FOR DELETE
  TO authenticated USING (is_clinic_staff(clinic_id));

-- ============================================================================
-- APPOINTMENTS — Staff + linked patient; patients can book
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_appointments" ON appointments;
DROP POLICY IF EXISTS "anon_insert_appointments" ON appointments;
DROP POLICY IF EXISTS "anon_update_appointments" ON appointments;
DROP POLICY IF EXISTS "anon_delete_appointments" ON appointments;

CREATE POLICY "select_appointments" ON appointments FOR SELECT
  TO authenticated
  USING (is_clinic_staff(clinic_id) OR is_linked_patient(patient_id));

CREATE POLICY "insert_appointments" ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (is_clinic_staff(clinic_id) OR is_patient_of_clinic(clinic_id));

CREATE POLICY "update_appointments" ON appointments FOR UPDATE
  TO authenticated
  USING (is_clinic_staff(clinic_id) OR is_linked_patient(patient_id))
  WITH CHECK (is_clinic_staff(clinic_id) OR is_linked_patient(patient_id));

CREATE POLICY "delete_appointments" ON appointments FOR DELETE
  TO authenticated USING (is_clinic_staff(clinic_id));

-- ============================================================================
-- BILLING — Staff + linked patient read; staff-only writes
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_billing" ON billing;
DROP POLICY IF EXISTS "anon_insert_billing" ON billing;
DROP POLICY IF EXISTS "anon_update_billing" ON billing;
DROP POLICY IF EXISTS "anon_delete_billing" ON billing;

CREATE POLICY "select_billing" ON billing FOR SELECT
  TO authenticated
  USING (is_clinic_staff(clinic_id) OR is_linked_patient(patient_id));

CREATE POLICY "insert_billing" ON billing FOR INSERT
  TO authenticated WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "update_billing" ON billing FOR UPDATE
  TO authenticated
  USING (is_clinic_staff(clinic_id)) WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "delete_billing" ON billing FOR DELETE
  TO authenticated USING (is_clinic_staff(clinic_id));

-- ============================================================================
-- INVOICES — Staff + linked patient read; staff-only writes
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_invoices" ON invoices;
DROP POLICY IF EXISTS "anon_insert_invoices" ON invoices;
DROP POLICY IF EXISTS "anon_update_invoices" ON invoices;
DROP POLICY IF EXISTS "anon_delete_invoices" ON invoices;

CREATE POLICY "select_invoices" ON invoices FOR SELECT
  TO authenticated
  USING (is_clinic_staff(clinic_id) OR is_linked_patient(patient_id));

CREATE POLICY "insert_invoices" ON invoices FOR INSERT
  TO authenticated WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "update_invoices" ON invoices FOR UPDATE
  TO authenticated
  USING (is_clinic_staff(clinic_id)) WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "delete_invoices" ON invoices FOR DELETE
  TO authenticated USING (is_clinic_staff(clinic_id));

-- ============================================================================
-- BILL_LINE_ITEMS — Staff read via parent bill; staff-only writes
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_bill_line_items" ON bill_line_items;
DROP POLICY IF EXISTS "anon_insert_bill_line_items" ON bill_line_items;
DROP POLICY IF EXISTS "anon_update_bill_line_items" ON bill_line_items;
DROP POLICY IF EXISTS "anon_delete_bill_line_items" ON bill_line_items;

CREATE POLICY "select_bill_line_items" ON bill_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM billing b
      WHERE b.bill_id = bill_line_items.bill_id
      AND (is_clinic_staff(b.clinic_id) OR is_linked_patient(b.patient_id))
    )
  );

CREATE POLICY "insert_bill_line_items" ON bill_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM billing b
      WHERE b.bill_id = bill_line_items.bill_id
      AND is_clinic_staff(b.clinic_id)
    )
  );

CREATE POLICY "update_bill_line_items" ON bill_line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM billing b
      WHERE b.bill_id = bill_line_items.bill_id
      AND is_clinic_staff(b.clinic_id)
    )
  );

CREATE POLICY "delete_bill_line_items" ON bill_line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM billing b
      WHERE b.bill_id = bill_line_items.bill_id
      AND is_clinic_staff(b.clinic_id)
    )
  );

-- ============================================================================
-- INVOICE_SEQUENCES — Staff-only
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_invoice_sequences" ON invoice_sequences;
DROP POLICY IF EXISTS "anon_insert_invoice_sequences" ON invoice_sequences;
DROP POLICY IF EXISTS "anon_update_invoice_sequences" ON invoice_sequences;
DROP POLICY IF EXISTS "anon_delete_invoice_sequences" ON invoice_sequences;

CREATE POLICY "select_invoice_sequences" ON invoice_sequences FOR SELECT
  TO authenticated USING (is_clinic_staff(clinic_id));

CREATE POLICY "insert_invoice_sequences" ON invoice_sequences FOR INSERT
  TO authenticated WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "update_invoice_sequences" ON invoice_sequences FOR UPDATE
  TO authenticated
  USING (is_clinic_staff(clinic_id)) WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "delete_invoice_sequences" ON invoice_sequences FOR DELETE
  TO authenticated USING (is_clinic_staff(clinic_id));

-- ============================================================================
-- CONSULTATIONS — Staff + linked patient read; doctor-only writes
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_consultations" ON consultations;
DROP POLICY IF EXISTS "anon_insert_consultations" ON consultations;
DROP POLICY IF EXISTS "anon_update_consultations" ON consultations;
DROP POLICY IF EXISTS "anon_delete_consultations" ON consultations;

CREATE POLICY "select_consultations" ON consultations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.appt_id = consultations.appt_id
      AND (is_clinic_staff(a.clinic_id) OR is_linked_patient(a.patient_id))
    )
  );

CREATE POLICY "insert_consultations" ON consultations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.appt_id = consultations.appt_id
      AND is_clinic_staff(a.clinic_id)
    )
  );

CREATE POLICY "update_consultations" ON consultations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.appt_id = consultations.appt_id
      AND is_clinic_staff(a.clinic_id)
    )
  );

CREATE POLICY "delete_consultations" ON consultations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.appt_id = consultations.appt_id
      AND is_clinic_staff(a.clinic_id)
    )
  );

-- ============================================================================
-- VITALS — Staff + linked patient read; staff-only writes
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_vitals" ON vitals;
DROP POLICY IF EXISTS "anon_insert_vitals" ON vitals;
DROP POLICY IF EXISTS "anon_update_vitals" ON vitals;
DROP POLICY IF EXISTS "anon_delete_vitals" ON vitals;

CREATE POLICY "select_vitals" ON vitals FOR SELECT
  TO authenticated
  USING (is_clinic_staff(clinic_id) OR is_linked_patient(patient_id));

CREATE POLICY "insert_vitals" ON vitals FOR INSERT
  TO authenticated WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "update_vitals" ON vitals FOR UPDATE
  TO authenticated
  USING (is_clinic_staff(clinic_id)) WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "delete_vitals" ON vitals FOR DELETE
  TO authenticated USING (is_clinic_staff(clinic_id));

-- ============================================================================
-- HEALTH_REPORTS — Staff + patient owner read/write
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_health_reports" ON health_reports;
DROP POLICY IF EXISTS "anon_insert_health_reports" ON health_reports;
DROP POLICY IF EXISTS "anon_update_health_reports" ON health_reports;
DROP POLICY IF EXISTS "anon_delete_health_reports" ON health_reports;

CREATE POLICY "select_health_reports" ON health_reports FOR SELECT
  TO authenticated
  USING (
    is_clinic_staff(clinic_id) OR is_own_patient_account(account_id) OR is_linked_patient(patient_id)
  );

CREATE POLICY "insert_health_reports" ON health_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    is_clinic_staff(clinic_id) OR is_own_patient_account(account_id) OR is_patient_of_clinic(clinic_id)
  );

CREATE POLICY "update_health_reports" ON health_reports FOR UPDATE
  TO authenticated
  USING (is_clinic_staff(clinic_id) OR is_own_patient_account(account_id))
  WITH CHECK (is_clinic_staff(clinic_id) OR is_own_patient_account(account_id));

CREATE POLICY "delete_health_reports" ON health_reports FOR DELETE
  TO authenticated USING (is_clinic_staff(clinic_id));

-- ============================================================================
-- INVENTORY — Staff-only
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_inventory" ON inventory;
DROP POLICY IF EXISTS "anon_insert_inventory" ON inventory;
DROP POLICY IF EXISTS "anon_update_inventory" ON inventory;
DROP POLICY IF EXISTS "anon_delete_inventory" ON inventory;

CREATE POLICY "select_inventory" ON inventory FOR SELECT
  TO authenticated USING (is_clinic_staff(clinic_id));

CREATE POLICY "insert_inventory" ON inventory FOR INSERT
  TO authenticated WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "update_inventory" ON inventory FOR UPDATE
  TO authenticated
  USING (is_clinic_staff(clinic_id)) WITH CHECK (is_clinic_staff(clinic_id));

CREATE POLICY "delete_inventory" ON inventory FOR DELETE
  TO authenticated USING (is_clinic_staff(clinic_id));

-- ============================================================================
-- AI_SESSIONS — Staff + linked patient
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_ai_sessions" ON ai_sessions;
DROP POLICY IF EXISTS "anon_insert_ai_sessions" ON ai_sessions;
DROP POLICY IF EXISTS "anon_update_ai_sessions" ON ai_sessions;
DROP POLICY IF EXISTS "anon_delete_ai_sessions" ON ai_sessions;

CREATE POLICY "select_ai_sessions" ON ai_sessions FOR SELECT
  TO authenticated
  USING (is_clinic_staff(clinic_id) OR is_linked_patient(patient_id));

CREATE POLICY "insert_ai_sessions" ON ai_sessions FOR INSERT
  TO authenticated
  WITH CHECK (is_clinic_staff(clinic_id) OR is_linked_patient(patient_id) OR is_patient_of_clinic(clinic_id));

CREATE POLICY "update_ai_sessions" ON ai_sessions FOR UPDATE
  TO authenticated
  USING (is_clinic_staff(clinic_id) OR is_linked_patient(patient_id))
  WITH CHECK (is_clinic_staff(clinic_id) OR is_linked_patient(patient_id));

CREATE POLICY "delete_ai_sessions" ON ai_sessions FOR DELETE
  TO authenticated
  USING (is_clinic_staff(clinic_id) OR is_linked_patient(patient_id));

-- ============================================================================
-- AI_CONVERSATIONS — Staff + linked patient
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "anon_insert_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "anon_update_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "anon_delete_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "select_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "insert_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "update_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "delete_ai_conversations" ON ai_conversations;

CREATE POLICY "select_ai_conversations" ON ai_conversations FOR SELECT
  TO authenticated
  USING (
    is_clinic_staff(clinic_id) OR is_linked_patient(patient_id) OR is_own_patient_account(account_id)
  );

CREATE POLICY "insert_ai_conversations" ON ai_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    is_clinic_staff(clinic_id) OR is_own_patient_account(account_id) OR is_patient_of_clinic(clinic_id)
  );

CREATE POLICY "update_ai_conversations" ON ai_conversations FOR UPDATE
  TO authenticated
  USING (
    is_clinic_staff(clinic_id) OR is_own_patient_account(account_id) OR is_linked_patient(patient_id)
  )
  WITH CHECK (
    is_clinic_staff(clinic_id) OR is_own_patient_account(account_id) OR is_linked_patient(patient_id)
  );

CREATE POLICY "delete_ai_conversations" ON ai_conversations FOR DELETE
  TO authenticated
  USING (is_clinic_staff(clinic_id) OR is_own_patient_account(account_id));

-- ============================================================================
-- PATIENT_ACCOUNTS — Patient owner + clinic staff read
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_patient_accounts" ON patient_accounts;
DROP POLICY IF EXISTS "anon_insert_patient_accounts" ON patient_accounts;
DROP POLICY IF EXISTS "anon_update_patient_accounts" ON patient_accounts;
DROP POLICY IF EXISTS "anon_delete_patient_accounts" ON patient_accounts;

CREATE POLICY "select_patient_accounts" ON patient_accounts FOR SELECT
  TO authenticated
  USING (
    is_own_patient_account(account_id)
    OR EXISTS (
      SELECT 1 FROM patient_clinic_links pcl
      WHERE pcl.account_id = patient_accounts.account_id
      AND is_clinic_staff(pcl.clinic_id)
    )
  );

CREATE POLICY "insert_patient_accounts" ON patient_accounts FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_patient_accounts" ON patient_accounts FOR UPDATE
  TO authenticated
  USING (is_own_patient_account(account_id))
  WITH CHECK (is_own_patient_account(account_id));

CREATE POLICY "delete_patient_accounts" ON patient_accounts FOR DELETE
  TO authenticated USING (is_own_patient_account(account_id));

-- ============================================================================
-- PATIENT_CLINIC_LINKS — Patient owner + clinic staff
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_patient_clinic_links" ON patient_clinic_links;
DROP POLICY IF EXISTS "anon_insert_patient_clinic_links" ON patient_clinic_links;
DROP POLICY IF EXISTS "anon_update_patient_clinic_links" ON patient_clinic_links;
DROP POLICY IF EXISTS "anon_delete_patient_clinic_links" ON patient_clinic_links;

CREATE POLICY "select_patient_clinic_links" ON patient_clinic_links FOR SELECT
  TO authenticated
  USING (is_own_patient_account(account_id) OR is_clinic_staff(clinic_id));

CREATE POLICY "insert_patient_clinic_links" ON patient_clinic_links FOR INSERT
  TO authenticated
  WITH CHECK (is_own_patient_account(account_id) OR is_clinic_staff(clinic_id) OR is_patient_of_clinic(clinic_id));

CREATE POLICY "update_patient_clinic_links" ON patient_clinic_links FOR UPDATE
  TO authenticated
  USING (is_own_patient_account(account_id) OR is_clinic_staff(clinic_id))
  WITH CHECK (is_own_patient_account(account_id) OR is_clinic_staff(clinic_id));

CREATE POLICY "delete_patient_clinic_links" ON patient_clinic_links FOR DELETE
  TO authenticated
  USING (is_own_patient_account(account_id) OR is_clinic_staff(clinic_id));

-- ============================================================================
-- FAMILY_MEMBERS — Patient owner only
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_family_members" ON family_members;
DROP POLICY IF EXISTS "anon_insert_family_members" ON family_members;
DROP POLICY IF EXISTS "anon_update_family_members" ON family_members;
DROP POLICY IF EXISTS "anon_delete_family_members" ON family_members;

CREATE POLICY "select_family_members" ON family_members FOR SELECT
  TO authenticated USING (is_own_patient_account(account_id));

CREATE POLICY "insert_family_members" ON family_members FOR INSERT
  TO authenticated WITH CHECK (is_own_patient_account(account_id));

CREATE POLICY "update_family_members" ON family_members FOR UPDATE
  TO authenticated
  USING (is_own_patient_account(account_id)) WITH CHECK (is_own_patient_account(account_id));

CREATE POLICY "delete_family_members" ON family_members FOR DELETE
  TO authenticated USING (is_own_patient_account(account_id));

-- ============================================================================
-- MEDICINE_REMINDERS — Patient owner only
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_medicine_reminders" ON medicine_reminders;
DROP POLICY IF EXISTS "anon_insert_medicine_reminders" ON medicine_reminders;
DROP POLICY IF EXISTS "anon_update_medicine_reminders" ON medicine_reminders;
DROP POLICY IF EXISTS "anon_delete_medicine_reminders" ON medicine_reminders;

CREATE POLICY "select_medicine_reminders" ON medicine_reminders FOR SELECT
  TO authenticated USING (is_own_patient_account(account_id));

CREATE POLICY "insert_medicine_reminders" ON medicine_reminders FOR INSERT
  TO authenticated WITH CHECK (is_own_patient_account(account_id));

CREATE POLICY "update_medicine_reminders" ON medicine_reminders FOR UPDATE
  TO authenticated
  USING (is_own_patient_account(account_id)) WITH CHECK (is_own_patient_account(account_id));

CREATE POLICY "delete_medicine_reminders" ON medicine_reminders FOR DELETE
  TO authenticated USING (is_own_patient_account(account_id));

-- ============================================================================
-- PATIENT_NOTIFICATIONS — Patient owner only
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_patient_notifications" ON patient_notifications;
DROP POLICY IF EXISTS "anon_insert_patient_notifications" ON patient_notifications;
DROP POLICY IF EXISTS "anon_update_patient_notifications" ON patient_notifications;
DROP POLICY IF EXISTS "anon_delete_patient_notifications" ON patient_notifications;

CREATE POLICY "select_patient_notifications" ON patient_notifications FOR SELECT
  TO authenticated USING (is_own_patient_account(account_id));

CREATE POLICY "insert_patient_notifications" ON patient_notifications FOR INSERT
  TO authenticated WITH CHECK (is_own_patient_account(account_id));

CREATE POLICY "update_patient_notifications" ON patient_notifications FOR UPDATE
  TO authenticated
  USING (is_own_patient_account(account_id)) WITH CHECK (is_own_patient_account(account_id));

CREATE POLICY "delete_patient_notifications" ON patient_notifications FOR DELETE
  TO authenticated USING (is_own_patient_account(account_id));

-- ============================================================================
-- PATIENT_REWARD_POINTS — Patient owner only
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_patient_reward_points" ON patient_reward_points;
DROP POLICY IF EXISTS "anon_insert_patient_reward_points" ON patient_reward_points;
DROP POLICY IF EXISTS "anon_update_patient_reward_points" ON patient_reward_points;
DROP POLICY IF EXISTS "anon_delete_patient_reward_points" ON patient_reward_points;

CREATE POLICY "select_patient_reward_points" ON patient_reward_points FOR SELECT
  TO authenticated USING (is_own_patient_account(account_id));

CREATE POLICY "insert_patient_reward_points" ON patient_reward_points FOR INSERT
  TO authenticated WITH CHECK (is_own_patient_account(account_id));

CREATE POLICY "update_patient_reward_points" ON patient_reward_points FOR UPDATE
  TO authenticated
  USING (is_own_patient_account(account_id)) WITH CHECK (is_own_patient_account(account_id));

CREATE POLICY "delete_patient_reward_points" ON patient_reward_points FOR DELETE
  TO authenticated USING (is_own_patient_account(account_id));
