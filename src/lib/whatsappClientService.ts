import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app, 'asia-south1');

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send WhatsApp OTP directly during login flow
 */
export async function sendWhatsAppOtp(phone: string, otp: string): Promise<WhatsAppResponse> {
  try {
    const fn = httpsCallable<{ phone: string; otp: string }, WhatsAppResponse>(
      functions,
      'sendWhatsAppOtpDirect'
    );
    const result = await fn({ phone, otp });
    return result.data;
  } catch (err: any) {
    console.error('[WhatsAppClient] Failed to send OTP:', err);
    return { success: false, error: err?.message || 'Failed to dispatch WhatsApp OTP' };
  }
}

/**
 * Generic dispatcher for WhatsApp templates
 */
export async function sendWhatsAppNotificationViaAPI(data: {
  action: string;
  to: string;
  clinicId?: string;
  [key: string]: any;
}): Promise<WhatsAppResponse> {
  try {
    const fn = httpsCallable<any, WhatsAppResponse>(functions, 'sendWhatsAppNotification');
    const result = await fn(data);
    return result.data;
  } catch (err: any) {
    console.error(`[WhatsAppClient] Failed action ${data.action}:`, err);
    return { success: false, error: err?.message || 'Failed to send WhatsApp message' };
  }
}

/**
 * Send an appointment reminder using approved template viitsa_appointment_reminder
 */
export async function sendWhatsAppAppointmentReminderViaAPI(params: {
  to: string;
  clinicId: string;
  patientName: string;
  doctorName: string;
  clinicName: string;
  date: string;
  time: string;
  location?: string;
  clinicPhone: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'appointment_reminder',
    to: params.to,
    clinicId: params.clinicId,
    patientName: params.patientName,
    doctorName: params.doctorName,
    clinicName: params.clinicName,
    date: params.date,
    time: params.time,
    location: params.location || params.clinicName,
    clinicPhone: params.clinicPhone,
  });
}

/**
 * Send an appointment confirmation using approved templates
 */
export async function sendWhatsAppAppointmentConfirmationViaAPI(params: {
  to: string;
  clinicId: string;
  type: 'online' | 'followup' | 'report' | 'walkin';
  patientName: string;
  doctorName: string;
  clinicName: string;
  date: string;
  timeOrSlot: string;
  tokenOrQueue: string;
  visitType?: string;
  clinicPhone: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'appointment_confirm',
    ...params,
  });
}

/**
 * Send patient invoice with attached PDF document
 */
export async function sendWhatsAppPatientInvoiceViaAPI(params: {
  to: string;
  clinicId: string;
  patientName: string;
  clinicName: string;
  invoiceNumber: string;
  totalAmount: number | string;
  paymentStatus: string;
  billingDate: string;
  clinicPhone: string;
  pdfUrl?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'patient_invoice',
    ...params,
  });
}

/**
 * Send outstanding balance reminder
 */
export async function sendWhatsAppPaymentReminderViaAPI(params: {
  to: string;
  clinicId: string;
  patientName: string;
  clinicName: string;
  pendingAmount: number | string;
  visitDate: string;
  upiId: string;
  clinicPhone: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'patient_payment_reminder',
    ...params,
  });
}

/**
 * Send follow-up due reminder
 */
export async function sendWhatsAppFollowupDueViaAPI(params: {
  to: string;
  clinicId: string;
  patientName: string;
  doctorName: string;
  clinicName: string;
  dueDate: string;
  clinicPhone: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'patient_followup_due',
    ...params,
  });
}

/**
 * Send lab test report ready notification
 */
export async function sendWhatsAppLabReportViaAPI(params: {
  to: string;
  clinicId: string;
  patientName: string;
  clinicName: string;
  testName: string;
  doctorName: string;
  reportDate: string;
  clinicPhone: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'patient_lab_report',
    ...params,
  });
}

/**
 * Send official Meta WhatsApp patient medicine dosage reminder
 */
export async function sendWhatsAppPatientMedicineReminder(params: {
  to: string;
  clinicId?: string;
  patientName: string;
  clinicName: string;
  medicineName: string;
  dosageTiming: string;
  instructions?: string;
  clinicPhone: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'patient_medicine_reminder',
    ...params,
  });
}

// ── Clinic Subscriptions & B2B Admin Lifecycle Helpers ──────────────────────

export async function sendWhatsAppClinicTrialActivated(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  planTier?: string;
  planName?: string;
  trialValidUntil?: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_trial_activated',
    ...params,
  });
}

export async function sendWhatsAppClinicSubActivated(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  billingCycle: string;
  amountPaid?: string | number;
  nextRenewalDate?: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_sub_activated',
    ...params,
  });
}

export async function sendWhatsAppClinicPlanUpgraded(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  newPlan: string;
  previousPlan: string;
  effectiveDate: string;
  newAmount: string | number;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_plan_upgraded',
    ...params,
  });
}

export async function sendWhatsAppClinicPlanDowngraded(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  currentPlan: string;
  downgradedPlan: string;
  effectiveDate: string;
  cycleEndDate?: string;
  newAmount?: string | number;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_plan_downgraded',
    ...params,
  });
}

export async function sendWhatsAppClinicSubRenewalReminder(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  renewalAmount: string | number;
  dueDate: string;
  autoDebitStatus?: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_sub_renewal_reminder',
    ...params,
  });
}

export async function sendWhatsAppClinicPaymentSuccess(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  amount: string | number;
  transactionId: string;
  activeUntilDate?: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_payment_success',
    ...params,
  });
}

export async function sendWhatsAppClinicPaymentFailed(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  dueAmount?: string | number;
  reason?: string;
  gracePeriodEnd?: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_payment_failed',
    ...params,
  });
}

export async function sendWhatsAppClinicSubDeactivated(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  deactivationDate: string;
  status?: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_sub_deactivated',
    ...params,
  });
}

export async function sendWhatsAppClinicSubCancelled(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  cancelledPlan?: string;
  accessDate?: string;
  effectiveDate: string;
  endDate?: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_sub_cancelled',
    ...params,
  });
}

export async function sendWhatsAppClinicSubInvoice(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  invoiceNo: string;
  planName: string;
  totalAmount: string | number;
  invoiceDate: string;
  pdfUrl?: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_sub_invoice',
    ...params,
  });
}

export async function sendWhatsAppClinicQuotaAlert(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  quotaType?: string;
  percentUsed: string | number;
  used?: string | number;
  totalLimit?: string | number;
  resetDate?: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_quota_alert',
    ...params,
  });
}

export async function sendWhatsAppClinicPendingApproval(params: {
  to: string;
  clinicId: string;
  adminName?: string;
  clinicName: string;
  submissionDate: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_pending_approval',
    ...params,
  });
}

export async function sendWhatsAppClinicVerificationApproved(params: {
  to: string;
  clinicId: string;
  adminName?: string;
  clinicName: string;
  approvedDate: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_verification_approved',
    ...params,
  });
}

export async function sendWhatsAppClinicVerificationRejected(params: {
  to: string;
  clinicId: string;
  adminName?: string;
  clinicName: string;
  reason: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_verification_rejected',
    ...params,
  });
}

export async function sendWhatsAppClinicDocsNeeded(params: {
  to: string;
  clinicId: string;
  adminName?: string;
  clinicName: string;
  missingDocs: string;
  deadline: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'clinic_docs_needed',
    ...params,
  });
}

export async function sendWhatsAppDoctorVerificationApproved(params: {
  to: string;
  clinicId?: string;
  recipientName?: string;
  doctorName: string;
  clinicName: string;
  councilRegNo?: string;
  approvalDate?: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'doctor_verification_approved',
    ...params,
  });
}

export async function sendWhatsAppDoctorVerificationRejected(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  doctorName: string;
  clinicName: string;
  reason: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'doctor_verification_rejected',
    ...params,
  });
}

export async function sendWhatsAppAdminPlanActivated(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  validThrough: string;
  adminRemarks?: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'admin_plan_activated',
    ...params,
  });
}

export async function sendWhatsAppAdminPlanFreeGranted(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  planTier: string;
  activePeriod: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'admin_plan_free_granted',
    ...params,
  });
}

export async function sendWhatsAppAdminPlanDeactivated(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  deactivationDate: string;
  reason?: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'admin_plan_deactivated',
    ...params,
  });
}

export async function sendWhatsAppAdminPlanSuspended(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  reason: string;
  suspensionDate: string;
  compliancePhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'admin_plan_suspended',
    ...params,
  });
}

export async function sendWhatsAppAdminPlanReactivated(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  reactivationDate: string;
  supportPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'admin_plan_reactivated',
    ...params,
  });
}

export async function sendWhatsAppAdminPaymentRequest(params: {
  to: string;
  clinicId?: string;
  adminName?: string;
  clinicName: string;
  serviceName: string;
  amount: string | number;
  dueDate: string;
  invoiceRef: string;
  accountsPhone?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'admin_payment_request',
    ...params,
  });
}

/**
 * Send WhatsApp notification to doctor when clinic adds them to practice
 */
export async function sendWhatsAppDoctorAddedViaAPI(params: {
  to: string;
  doctorName: string;
  clinicName: string;
  email: string;
  clinicPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'doctor_added_by_clinic',
    ...params,
  });
}

/**
 * Send WhatsApp welcome & membership notification to doctor when platform admin approves verification
 */
export async function sendWhatsAppDoctorApprovedViaAPI(params: {
  to: string;
  doctorName: string;
  clinicName: string;
  email?: string;
  councilRegNo?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppResponse> {
  return sendWhatsAppNotificationViaAPI({
    action: 'doctor_verification_approved',
    ...params,
  });
}


