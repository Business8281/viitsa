/*
# Atomic Payment Processing RPC

## Summary
Creates a SECURITY DEFINER function `process_payment_atomic` that performs
all four payment writes (invoice sequence increment, billing insert, line
items insert, invoice insert) in a single atomic database operation.

This replaces the previous client-side approach that performed 4 separate
Supabase inserts sequentially — if any step failed after the first, orphan
records were left in the database with no cleanup.

## Function: process_payment_atomic
Parameters:
- p_clinic_id uuid
- p_patient_id uuid
- p_appt_id uuid (nullable)
- p_doctor_id uuid (nullable)
- p_amount numeric
- p_payment_method text
- p_payment_status text
- p_upi_ref text (nullable)
- p_consultation_fee numeric (nullable)
- p_visit_type text (nullable)
- p_discount_amount numeric (nullable, default 0)
- p_discount_percent numeric (nullable, default 0)
- p_notes text (nullable)
- p_line_items jsonb (array of {description, amount} objects)

Returns: jsonb with { bill_id, invoice_id, invoice_number, payment_status }

## Security
- SECURITY DEFINER: runs with the function owner's privileges so it can
  update invoice_sequences, insert into billing/bill_line_items/invoices
  in a single atomic operation.
- The caller must be authenticated (RLS still applies at the API level).
- The function validates that the caller is a clinic staff member before
  proceeding.
*/

CREATE OR REPLACE FUNCTION process_payment_atomic(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_appt_id uuid DEFAULT NULL,
  p_doctor_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'cash',
  p_payment_status text DEFAULT 'paid',
  p_upi_ref text DEFAULT NULL,
  p_consultation_fee numeric DEFAULT NULL,
  p_visit_type text DEFAULT NULL,
  p_discount_amount numeric DEFAULT 0,
  p_discount_percent numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_line_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bill_id uuid := gen_random_uuid();
  v_invoice_id uuid := gen_random_uuid();
  v_invoice_number text;
  v_next_num integer;
  v_line_item jsonb;
  v_clinic_name text;
  v_clinic_prefix text;
BEGIN
  -- Verify caller is clinic staff
  IF NOT is_clinic_staff(p_clinic_id) THEN
    RAISE EXCEPTION 'Unauthorized: not a staff member of this clinic';
  END IF;

  -- Atomically increment invoice sequence
  INSERT INTO invoice_sequences (clinic_id, last_number)
  VALUES (p_clinic_id, 1)
  ON CONFLICT (clinic_id)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO v_next_num;

  -- Generate invoice number
  SELECT name INTO v_clinic_name FROM clinics WHERE clinic_id = p_clinic_id;
  v_clinic_prefix := COALESCE(upper(left(regexp_replace(v_clinic_name, '[^a-zA-Z]', '', 'g'), 3)), 'INV');
  v_invoice_number := v_clinic_prefix || '-' || to_char(now(), 'YYMMDD') || '-' || lpad(v_next_num::text, 4, '0');

  -- Insert billing record
  INSERT INTO billing (
    bill_id, clinic_id, patient_id, appt_id, amount,
    payment_status, payment_method, created_at, doctor_id,
    discount_amount, discount_percent, upi_ref,
    invoice_number, notes, consultation_fee, visit_type
  ) VALUES (
    v_bill_id, p_clinic_id, p_patient_id, p_appt_id, p_amount,
    p_payment_status, p_payment_method, now(), p_doctor_id,
    p_discount_amount, p_discount_percent, p_upi_ref,
    v_invoice_number, p_notes, p_consultation_fee, p_visit_type
  );

  -- Insert line items
  FOR v_line_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    INSERT INTO bill_line_items (bill_id, description, amount)
    VALUES (
      v_bill_id,
      v_line_item->>'description',
      (v_line_item->>'amount')::numeric
    );
  END LOOP;

  -- Insert invoice
  INSERT INTO invoices (
    invoice_id, invoice_number, bill_id, clinic_id, patient_id, doctor_id,
    subtotal, discount_amount, total, payment_status, payment_method,
    upi_ref, line_items, visit_date, payment_date, notes, created_at
  ) VALUES (
    v_invoice_id, v_invoice_number, v_bill_id, p_clinic_id, p_patient_id, p_doctor_id,
    p_amount, p_discount_amount, p_amount - p_discount_amount,
    p_payment_status, p_payment_method, p_upi_ref,
    p_line_items, CURRENT_DATE,
    CASE WHEN p_payment_status = 'paid' THEN CURRENT_DATE ELSE NULL END,
    p_notes, now()
  );

  RETURN jsonb_build_object(
    'bill_id', v_bill_id,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'payment_status', p_payment_status
  );
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION process_payment_atomic TO authenticated;
