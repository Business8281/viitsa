import { supabase } from './supabase';
import { localDateISO } from './format';
import type { BillLineItem, PaymentMethod } from './types';

export interface ProcessPaymentInput {
  clinicId: string;
  patientId: string;
  apptId: string | null;
  doctorId: string | null;
  consultationFee: number;
  lineItems: BillLineItem[];
  discountAmount: number;
  discountPercent: number;
  paymentMethod: PaymentMethod;
  upiRef?: string;
  expectedPaymentDate?: string;
  notes?: string;
  visitType?: string;
}

export interface ProcessPaymentResult {
  ok: boolean;
  billId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
}

export async function processPayment(input: ProcessPaymentInput): Promise<ProcessPaymentResult> {
  const subtotal = input.consultationFee + input.lineItems.reduce((s, i) => s + i.amount, 0);
  const total = Math.max(0, subtotal - input.discountAmount);
  // Cash is marked 'paid' immediately (collected in person by staff).
  // UPI is 'paid' only if a transaction reference is provided as proof.
  // Card is 'pending' until a payment gateway verifies the transaction.
  // This avoids faking payment success without verification.
  const status: string =
    input.paymentMethod === 'cash' ? 'paid'
    : input.paymentMethod === 'upi' && input.upiRef ? 'paid'
    : 'pending';

  const allLineItems: BillLineItem[] = [
    { description: 'Consultation fee', amount: input.consultationFee },
    ...input.lineItems,
  ];

  try {
    const { data, error } = await supabase.rpc('process_payment_atomic', {
      p_clinic_id: input.clinicId,
      p_patient_id: input.patientId,
      p_appt_id: input.apptId,
      p_doctor_id: input.doctorId,
      p_amount: total,
      p_payment_method: input.paymentMethod,
      p_payment_status: status,
      p_upi_ref: input.upiRef ?? null,
      p_consultation_fee: input.consultationFee,
      p_visit_type: input.visitType ?? 'new-visit',
      p_discount_amount: input.discountAmount,
      p_discount_percent: input.discountPercent,
      p_notes: input.notes ?? null,
      p_line_items: JSON.stringify(allLineItems),
    });

    if (error) {
      return { ok: false, error: 'Unable to process payment. Please try again.' };
    }

    const result = data as { bill_id: string; invoice_id: string; invoice_number: string; payment_status: string };

    return {
      ok: true,
      billId: result.bill_id,
      invoiceId: result.invoice_id,
      invoiceNumber: result.invoice_number,
    };
  } catch {
    return { ok: false, error: 'Unable to process payment. Please try again.' };
  }
}
