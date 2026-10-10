import { db } from './firebase';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
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
  const status: string =
    input.paymentMethod === 'cash' ? 'paid'
    : input.paymentMethod === 'upi' && input.upiRef ? 'paid'
    : 'pending';

  const allLineItems: BillLineItem[] = [
    { description: 'Consultation fee', amount: input.consultationFee },
    ...input.lineItems,
  ];

  try {
    const batch = writeBatch(db);

    const billRef = doc(collection(db, 'billing'));
    const invoiceRef = doc(collection(db, 'invoices'));

    const invoiceNumber = `INV-${Date.now()}`;
    const timestamp = serverTimestamp();

    batch.set(billRef, {
      clinic_id: input.clinicId,
      patient_id: input.patientId,
      appointment_id: input.apptId,
      amount: total,
      payment_method: input.paymentMethod,
      payment_status: status,
      upi_ref: input.upiRef ?? null,
      created_at: timestamp
    });

    batch.set(invoiceRef, {
      clinic_id: input.clinicId,
      patient_id: input.patientId,
      appointment_id: input.apptId,
      doctor_id: input.doctorId,
      invoice_number: invoiceNumber,
      amount: total,
      consultation_fee: input.consultationFee,
      visit_type: input.visitType ?? 'new-visit',
      discount_amount: input.discountAmount,
      discount_percent: input.discountPercent,
      line_items: allLineItems,
      notes: input.notes ?? null,
      created_at: timestamp
    });

    await batch.commit();

    return {
      ok: true,
      billId: billRef.id,
      invoiceId: invoiceRef.id,
      invoiceNumber: invoiceNumber,
    };
  } catch (e) {
    console.error('Payment Error', e);
    return { ok: false, error: 'Unable to process payment. Please try again.' };
  }
}
