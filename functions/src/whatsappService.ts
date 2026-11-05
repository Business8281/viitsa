import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { ensurePatientInvoicePdfUrl } from './invoicePdf';

dotenv.config();

const GRAPH_API_BASE = 'https://graph.facebook.com';

/**
 * Bi-directional fallback aliases for template names.
 * Ensures robust delivery regardless of whether Meta approved the shortened/truncated
 * name (e.g. viitsa_clinic_sub_invc) or the full name (e.g. viitsa_clinic_sub_invoice).
 */
const TEMPLATE_ALIASES: Record<string, string[]> = {
  // Authentication OTP
  'viitsa_login_otp': ['phone_login_otps'],
  'phone_login_otps': ['viitsa_login_otp'],

  // Appointment Confirm Online / New Visit
  'viitsa_appt_confirm_new_visit': ['viitsa_appt_confirm_online'],
  'viitsa_appt_confirm_online': ['viitsa_appt_confirm_new_visit'],

  // Quota Limit Alert
  'viitsa_clinic_quota_al': ['viitsa_clinic_quota_alert'],
  'viitsa_clinic_quota_alert': ['viitsa_clinic_quota_al'],

  // Subscription Tax Invoice
  'viitsa_clinic_sub_invc': ['viitsa_clinic_sub_invoice'],
  'viitsa_clinic_sub_invoice': ['viitsa_clinic_sub_invc'],

  // Subscription Cancelled
  'viitsa_clinic_sub_can': ['viitsa_clinic_sub_cancelled'],
  'viitsa_clinic_sub_cancelled': ['viitsa_clinic_sub_can'],

  // Subscription Deactivated / Overdue
  'viitsa_clinic_sub_dea': ['viitsa_clinic_sub_deactivated'],
  'viitsa_clinic_sub_deactivated': ['viitsa_clinic_sub_dea'],

  // Payment Failed
  'viitsa_clinic_payment_failed': ['viitsa_clinic_payment_fail', 'viitsa_clinic_payment_fa'],
  'viitsa_clinic_payment_fail': ['viitsa_clinic_payment_failed'],
  'viitsa_clinic_payment_fa': ['viitsa_clinic_payment_failed'],

  // Payment Success
  'viitsa_clinic_payment_success': ['viitsa_clinic_payment_succ', 'viitsa_clinic_payment_su'],
  'viitsa_clinic_payment_succ': ['viitsa_clinic_payment_success'],
  'viitsa_clinic_payment_su': ['viitsa_clinic_payment_success'],

  // Subscription Renewal Reminder
  'viitsa_clinic_sub_ren': ['viitsa_clinic_sub_renewal_reminder'],
  'viitsa_clinic_sub_renewal_reminder': ['viitsa_clinic_sub_ren'],

  // Plan Downgraded
  'viitsa_clinic_plan_do': ['viitsa_clinic_plan_downgraded'],
  'viitsa_clinic_plan_downgraded': ['viitsa_clinic_plan_do'],
};

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: any;
}

/**
 * Normalizes phone numbers to Meta WhatsApp international format (e.g. 91XXXXXXXXXX)
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  // Strip spaces, dashes, brackets, leading +
  let cleaned = rawPhone.replace(/[^\d]/g, '');

  // If 10 digits, assume India (+91)
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  // If 11 digits and starts with 0 (e.g. 09876543210), replace leading 0 with 91
  else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.substring(1);
  }
  // If 13 digits and starts with 910 (e.g. 9109876543210), strip the 0 after country code
  else if (cleaned.length === 13 && cleaned.startsWith('910')) {
    cleaned = '91' + cleaned.substring(3);
  }

  return cleaned;
}

/**
 * Formats a person's name into proper title casing while preserving mixed-case names (e.g. "McMahon")
 */
export function formatProperName(name?: string | null): string {
  if (!name || !name.trim()) return 'Patient';
  return name
    .trim()
    .split(/\s+/)
    .map(word => {
      if (word.length <= 1) return word.toUpperCase();
      // If the word already has a mix of uppercase and lowercase, preserve original casing
      if (/[A-Z]/.test(word) && /[a-z]/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Strips prefixes like "Dr. " if the template text already includes "Dr. "
 * and formats proper title casing (e.g. "pavan" -> "Pavan", "dr. pavan kumar" -> "Pavan Kumar")
 */
export function cleanDoctorName(name?: string | null): string {
  if (!name || !name.trim()) return 'Doctor';
  let cleaned = name.trim().replace(/^(Dr\.?|Doctor)\s+/i, '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'doctor') return 'Doctor';
  return cleaned
    .split(/\s+/)
    .map(word => {
      if (word.length <= 1) return word.toUpperCase();
      if (/[A-Z]/.test(word) && /[a-z]/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Formats numeric currency amounts with Indian 2-decimal comma separators (e.g. 5999 -> "5,999.00")
 */
export function formatAmount(amt: number | string | undefined | null): string {
  if (amt === undefined || amt === null || amt === '') return '0.00';
  const n = typeof amt === 'number' ? amt : parseFloat(String(amt).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? String(amt) : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Low-level sender for Meta WhatsApp Cloud API templates
 */
export async function sendWhatsAppTemplate(options: {
  to: string;
  templateName: string;
  components?: any[];
  languageCode?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1446373325215641';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

  if (!accessToken) {
    console.error('[WhatsAppService] Error: WHATSAPP_ACCESS_TOKEN is missing');
    return { success: false, error: 'WHATSAPP_ACCESS_TOKEN is not configured.' };
  }

  const normalizedPhone = normalizePhoneNumber(options.to);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    console.error('[WhatsAppService] Error: Invalid recipient phone number:', options.to);
    return { success: false, error: `Invalid phone number: ${options.to}` };
  }

  const endpoint = `${GRAPH_API_BASE}/${apiVersion}/${phoneNumberId}/messages`;

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'template',
    template: {
      name: options.templateName,
      language: {
        code: options.languageCode || 'en_US',
      },
      components: options.components || [],
    },
  };

  try {
    let response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data: any = await response.json();

    // Check if error is related to template name not matching/existing in Meta
    const isTemplateNotFound = !response.ok && (
      data?.error?.code === 100 ||
      data?.error?.code === 132001 ||
      (typeof data?.error?.message === 'string' && (
        data.error.message.includes('does not match any template') ||
        data.error.message.includes('Template does not exist') ||
        data.error.message.includes('No matching template')
      ))
    );

    // If template name was rejected, automatically try registered alias(es)
    if (isTemplateNotFound && TEMPLATE_ALIASES[options.templateName]) {
      const aliases = TEMPLATE_ALIASES[options.templateName];
      for (const alias of aliases) {
        if (alias === options.templateName) continue;
        console.warn(`[WhatsAppService] Template '${options.templateName}' not found on Meta. Retrying with alias '${alias}'...`);
        const fallbackPayload = {
          ...payload,
          template: {
            ...payload.template,
            name: alias,
          },
        };
        const fallbackRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fallbackPayload),
        });
        const fallbackData: any = await fallbackRes.json();
        if (fallbackRes.ok) {
          response = fallbackRes;
          data = fallbackData;
          options.templateName = alias; // Update recorded template name
          break;
        } else {
          console.warn(`[WhatsAppService] Alias '${alias}' attempt failed:`, JSON.stringify(fallbackData));
        }
      }
    }

    // If still failing and error mentions header mismatch while header was sent, retry body-only
    if (!response.ok && data?.error?.message?.toLowerCase().includes('header') && options.components?.some((c: any) => c.type === 'header')) {
      console.warn(`[WhatsAppService] Header component rejected (${data?.error?.message}). Retrying body-only fallback...`);
      const bodyOnlyComponents = options.components.filter((c: any) => c.type !== 'header');
      const bodyOnlyPayload = {
        ...payload,
        template: {
          ...payload.template,
          components: bodyOnlyComponents,
        },
      };
      const retryRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyOnlyPayload),
      });
      const retryData: any = await retryRes.json();
      if (retryRes.ok) {
        response = retryRes;
        data = retryData;
      }
    }

    if (!response.ok) {
      console.error(`[WhatsAppService] Meta API Error (${response.status}):`, JSON.stringify(data));
      const errorMessage = data?.error?.message || `Meta API error (${response.status})`;

      // Log failure in Firestore
      await logWhatsAppActivity({
        clinic_id: options.clinicId,
        recipient_phone: normalizedPhone,
        template_name: options.templateName,
        status: 'failed',
        error: errorMessage,
        raw_error: data,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: false,
        error: errorMessage,
        details: data,
      };
    }

    const messageId = data?.messages?.[0]?.id;

    // Log success in Firestore
    await logWhatsAppActivity({
      clinic_id: options.clinicId,
      recipient_phone: normalizedPhone,
      template_name: options.templateName,
      status: 'sent',
      meta_message_id: messageId,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Increment usage counter if clinicId is present
    if (options.clinicId) {
      await incrementClinicUsage(options.clinicId);
    }

    return {
      success: true,
      messageId,
      details: data,
    };
  } catch (error: any) {
    console.error('[WhatsAppService] Network or unexpected error sending message:', error);
    return {
      success: false,
      error: error?.message || 'Network error communicating with WhatsApp Cloud API',
    };
  }
}

function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Log message in `whatsapp_logs` Firestore collection
 */
async function logWhatsAppActivity(logData: Record<string, any>) {
  try {
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Ignore if settings already configured
    }
    await db.collection('whatsapp_logs').add(cleanUndefined(logData));
  } catch (err) {
    console.warn('[WhatsAppService] Failed to record whatsapp_logs entry:', err);
  }
}

/**
 * Increment clinic WhatsApp message counter in `usage_counters/{clinicId}`
 * and automatically triggers `viitsa_clinic_quota_al` when 80% usage threshold is hit.
 */
async function incrementClinicUsage(clinicId: string) {
  try {
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const counterRef = db.collection('usage_counters').doc(clinicId);

    await counterRef.set(
      {
        clinic_id: clinicId,
        year_month: yearMonth,
        whatsapp_messages_used: admin.firestore.FieldValue.increment(1),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Auto Quota Alert Check (>= 80% limit)
    try {
      const counterSnap = await counterRef.get();
      const counterData = counterSnap.data() || {};
      const used = counterData.whatsapp_messages_used || 0;
      const lastAlertedMonth = counterData.last_quota_alert_month;

      if (lastAlertedMonth !== yearMonth) {
        const clinicSnap = await db.collection('clinics').doc(clinicId).get();
        if (clinicSnap.exists) {
          const clinicData = clinicSnap.data() || {};
          const plan = (clinicData.subscription_plan || 'solo').toLowerCase();
          const planLimits: Record<string, number> = {
            solo: 1000,
            clinic: 2500,
            multispecialty: 10000,
          };
          const limit = planLimits[plan] || 2500;
          const threshold = Math.floor(limit * 0.8);

          if (used >= threshold) {
            const cPhone = clinicData.phone || clinicData.contact_phone;
            if (cPhone) {
              const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
              const resetDateStr = nextMonthDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              const pct = Math.min(100, Math.round((used / limit) * 100));

              await counterRef.update({
                last_quota_alert_month: yearMonth,
                last_quota_alert_at: admin.firestore.FieldValue.serverTimestamp(),
              });

              await sendClinicQuotaAlert({
                to: cPhone,
                clinicId,
                adminName: clinicData.owner_name || 'Doctor',
                clinicName: clinicData.name || 'Clinic',
                quotaType: 'WhatsApp Messages',
                percentUsed: pct,
                used: used.toLocaleString('en-IN'),
                totalLimit: limit.toLocaleString('en-IN'),
                resetDate: resetDateStr,
                supportPhone: '+91 73961 11081',
              });
            }
          }
        }
      }
    } catch (quotaErr) {
      console.warn('[WhatsAppService] Quota check notice:', quotaErr);
    }
  } catch (err) {
    console.warn('[WhatsAppService] Could not increment usage counter:', err);
  }
}

// ============================================================================
// 1. AUTHENTICATION (OTP)
// ============================================================================

/**
 * Template: phone_login_otps
 * Variables: {{1}} = otp_code
 * Button: copy code url
 */
export async function sendOtpWhatsApp(to: string, otpCode: string): Promise<WhatsAppSendResult> {
  const templateName = process.env.WA_TEMPLATE_OTP || 'phone_login_otps';

  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: otpCode },
      ],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [
        { type: 'text', text: otpCode },
      ],
    },
  ];

  return sendWhatsAppTemplate({
    to,
    templateName,
    components,
    languageCode: 'en_US',
  });
}

// ============================================================================
// 2. APPOINTMENT CONFIRMATIONS (Online, Follow-up, Report Review, Walk-in)
// ============================================================================

export interface AppointmentConfirmData {
  to: string;
  clinicId?: string;
  type: 'online' | 'followup' | 'report' | 'walkin';
  patientName: string;
  doctorName: string;
  clinicName: string;
  date: string;
  timeOrSlot: string;
  tokenOrQueue: string;
  visitType?: string;
  clinicPhone: string;
}

export async function sendAppointmentConfirmation(data: AppointmentConfirmData): Promise<WhatsAppSendResult> {
  const docName = cleanDoctorName(data.doctorName);
  const patient = formatProperName(data.patientName);
  const clinic = data.clinicName || 'Clinic';
  const phone = data.clinicPhone || '+91 73961 11081';

  let templateName = '';
  let bodyParams: { type: 'text'; text: string }[] = [];

  switch (data.type) {
    case 'online':
      // Template: viitsa_appt_confirm_online (8 params)
      // {{1}}=patient, {{2}}=doctor, {{3}}=clinic, {{4}}=date, {{5}}=slot, {{6}}=token, {{7}}=visitType, {{8}}=phone
      templateName = process.env.WA_TEMPLATE_APPT_ONLINE || 'viitsa_appt_confirm_online';
      bodyParams = [
        { type: 'text', text: patient },
        { type: 'text', text: docName },
        { type: 'text', text: clinic },
        { type: 'text', text: data.date || 'Scheduled Date' },
        { type: 'text', text: data.timeOrSlot || 'Scheduled Time' },
        { type: 'text', text: data.tokenOrQueue || 'Slot 1' },
        { type: 'text', text: data.visitType || 'Online Consultation' },
        { type: 'text', text: phone },
      ];
      break;

    case 'followup':
      // Template: viitsa_appt_confirm_followup (7 params)
      // {{1}}=patient, {{2}}=doctor, {{3}}=clinic, {{4}}=date, {{5}}=time, {{6}}=token, {{7}}=phone
      templateName = process.env.WA_TEMPLATE_APPT_FOLLOWUP || 'viitsa_appt_confirm_followup';
      bodyParams = [
        { type: 'text', text: patient },
        { type: 'text', text: docName },
        { type: 'text', text: clinic },
        { type: 'text', text: data.date || 'Scheduled Date' },
        { type: 'text', text: data.timeOrSlot || 'Scheduled Time' },
        { type: 'text', text: data.tokenOrQueue || 'Slot 1' },
        { type: 'text', text: phone },
      ];
      break;

    case 'report':
      // Template: viitsa_appt_confirm_report (7 params)
      // {{1}}=patient, {{2}}=doctor, {{3}}=clinic, {{4}}=date, {{5}}=time, {{6}}=token, {{7}}=phone
      templateName = process.env.WA_TEMPLATE_APPT_REPORT || 'viitsa_appt_confirm_report';
      bodyParams = [
        { type: 'text', text: patient },
        { type: 'text', text: docName },
        { type: 'text', text: clinic },
        { type: 'text', text: data.date || 'Scheduled Date' },
        { type: 'text', text: data.timeOrSlot || 'Scheduled Time' },
        { type: 'text', text: data.tokenOrQueue || 'Slot 1' },
        { type: 'text', text: phone },
      ];
      break;

    case 'walkin':
    default:
      // Template: viitsa_appt_confirm_walkin (6 params)
      // {{1}}=patient, {{2}}=clinic, {{3}}=token, {{4}}=doctor, {{5}}=estTime, {{6}}=phone
      templateName = process.env.WA_TEMPLATE_APPT_WALKIN || 'viitsa_appt_confirm_walkin';
      bodyParams = [
        { type: 'text', text: patient },
        { type: 'text', text: clinic },
        { type: 'text', text: data.tokenOrQueue || 'W-01' },
        { type: 'text', text: docName },
        { type: 'text', text: data.timeOrSlot || 'Shortly' },
        { type: 'text', text: phone },
      ];
      break;
  }

  return sendWhatsAppTemplate({
    to: data.to,
    templateName,
    clinicId: data.clinicId,
    components: [
      {
        type: 'body',
        parameters: bodyParams,
      },
    ],
  });
}

// ============================================================================
// 3. APPOINTMENT RESCHEDULED, REMINDER & CANCELLED
// ============================================================================

export interface AppointmentRescheduledData {
  to: string;
  clinicId?: string;
  patientName: string;
  doctorName: string;
  clinicName: string;
  newDate: string;
  newTime: string;
  newTokenOrSlot: string;
  reason?: string;
  clinicPhone: string;
}

/**
 * Template: viitsa_appointment_rescheduled (8 params)
 * {{1}}=patient, {{2}}=doctor, {{3}}=clinic, {{4}}=newDate, {{5}}=newTime, {{6}}=newToken, {{7}}=reason, {{8}}=phone
 */
export async function sendAppointmentRescheduled(data: AppointmentRescheduledData): Promise<WhatsAppSendResult> {
  const templateName = process.env.WA_TEMPLATE_APPT_RESCHEDULED || 'viitsa_appointment_rescheduled';
  const docName = cleanDoctorName(data.doctorName);
  const patient = formatProperName(data.patientName);

  return sendWhatsAppTemplate({
    to: data.to,
    templateName,
    clinicId: data.clinicId,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: patient },
          { type: 'text', text: docName },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.newDate || 'Updated Date' },
          { type: 'text', text: data.newTime || 'Updated Time' },
          { type: 'text', text: data.newTokenOrSlot || 'Confirmed' },
          { type: 'text', text: data.reason || 'Schedule update requested' },
          { type: 'text', text: data.clinicPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

export interface AppointmentReminderData {
  to: string;
  clinicId?: string;
  patientName: string;
  doctorName: string;
  clinicName: string;
  date: string;
  time: string;
  location: string;
  clinicPhone: string;
}

/**
 * Template: viitsa_appointment_reminder (7 params)
 * {{1}}=patient, {{2}}=doctor, {{3}}=clinic, {{4}}=date, {{5}}=time, {{6}}=location, {{7}}=phone
 */
export async function sendAppointmentReminder(data: AppointmentReminderData): Promise<WhatsAppSendResult> {
  const templateName = process.env.WA_TEMPLATE_APPT_REMINDER || 'viitsa_appointment_reminder';
  const docName = cleanDoctorName(data.doctorName);
  const patient = formatProperName(data.patientName);

  return sendWhatsAppTemplate({
    to: data.to,
    templateName,
    clinicId: data.clinicId,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: patient },
          { type: 'text', text: docName },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.date || 'Scheduled Date' },
          { type: 'text', text: data.time || 'Scheduled Time' },
          { type: 'text', text: data.location || data.clinicName || 'Clinic' },
          { type: 'text', text: data.clinicPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

export interface AppointmentCancelledData {
  to: string;
  clinicId?: string;
  patientName: string;
  doctorName: string;
  clinicName: string;
  date: string;
  time: string;
  reason?: string;
  clinicPhone: string;
}

/**
 * Template: viitsa_appointment_cancelled (7 params)
 * {{1}}=patient, {{2}}=doctor, {{3}}=clinic, {{4}}=scheduledDate, {{5}}=scheduledTime, {{6}}=reason, {{7}}=phone
 */
export async function sendAppointmentCancelled(data: AppointmentCancelledData): Promise<WhatsAppSendResult> {
  const templateName = process.env.WA_TEMPLATE_APPT_CANCELLED || 'viitsa_appointment_cancelled';
  const docName = cleanDoctorName(data.doctorName);
  const patient = formatProperName(data.patientName);

  return sendWhatsAppTemplate({
    to: data.to,
    templateName,
    clinicId: data.clinicId,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: patient },
          { type: 'text', text: docName },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.date || 'Scheduled Date' },
          { type: 'text', text: data.time || 'Scheduled Time' },
          { type: 'text', text: data.reason || 'Cancelled per patient / clinic request' },
          { type: 'text', text: data.clinicPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

// ============================================================================
// 4. BILLING & INVOICES
// ============================================================================

export interface PatientInvoiceData {
  to: string;
  clinicId?: string;
  patientName: string;
  clinicName: string;
  invoiceNumber: string;
  totalAmount: string | number;
  paymentStatus: string;
  billingDate: string;
  clinicPhone: string;
  pdfUrl?: string; // Document attachment URL
}

/**
 * Template: viitsa_patient_invoice (HEADER: DOCUMENT, BODY: 7 params)
 * {{1}}=patient, {{2}}=clinic, {{3}}=invoiceNo, {{4}}=amount, {{5}}=status, {{6}}=date, {{7}}=phone
 */
export async function sendPatientInvoice(data: PatientInvoiceData): Promise<WhatsAppSendResult> {
  const templateName = process.env.WA_TEMPLATE_PATIENT_INVOICE || 'viitsa_patient_invoice';
  const amountStr = formatAmount(data.totalAmount);
  const patient = formatProperName(data.patientName);

  // Guarantee an authentic, real clinical PDF document URL is attached (never dummy)
  let finalPdfUrl = data.pdfUrl;
  if (!finalPdfUrl || finalPdfUrl.includes('dummy') || finalPdfUrl.includes('example.com')) {
    try {
      finalPdfUrl = await ensurePatientInvoicePdfUrl({
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.billingDate,
        clinicName: data.clinicName,
        clinicPhone: data.clinicPhone,
        patientName: data.patientName,
        totalAmount: data.totalAmount,
        paymentStatus: data.paymentStatus,
        paymentMethod: (data as any).paymentMethod,
        items: (data as any).items,
      }, data.clinicId);
    } catch (pdfErr) {
      console.warn('[sendPatientInvoice] Notice on generating PDF attachment:', pdfErr);
    }
  }

  const components: any[] = [];

  // Header document attachment (PDF) - Meta requires DOCUMENT header for viitsa_patient_invoice
  const docUrl = finalPdfUrl || `https://viitsa.com/api/invoice/${data.invoiceNumber || 'bill'}.pdf`;
  components.push({
    type: 'header',
    parameters: [
      {
        type: 'document',
        document: {
          link: docUrl,
          filename: `Invoice-${data.invoiceNumber || 'bill'}.pdf`,
        },
      },
    ],
  });

  // Body variables
  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: patient },
      { type: 'text', text: data.clinicName || 'Clinic' },
      { type: 'text', text: data.invoiceNumber || 'N/A' },
      { type: 'text', text: amountStr },
      { type: 'text', text: data.paymentStatus || 'PAID' },
      { type: 'text', text: data.billingDate || (data as any).invoiceDate || new Date().toLocaleDateString('en-IN') },
      { type: 'text', text: data.clinicPhone || '+91 73961 11081' },
    ],
  });

  return sendWhatsAppTemplate({
    to: data.to,
    templateName,
    clinicId: data.clinicId,
    components,
  });
}

export interface PatientPaymentReminderData {
  to: string;
  clinicId?: string;
  patientName: string;
  clinicName: string;
  pendingAmount: string | number;
  visitDate?: string;
  dueDate?: string;
  upiId?: string;
  clinicPhone?: string;
}

/**
 * Template: viitsa_patient_payment_reminder (6 params)
 * {{1}}=patient, {{2}}=clinic, {{3}}=pendingAmount, {{4}}=visitDate, {{5}}=upiId, {{6}}=phone
 */
export async function sendPatientPaymentReminder(data: PatientPaymentReminderData): Promise<WhatsAppSendResult> {
  const templateName = process.env.WA_TEMPLATE_PAYMENT_REMINDER || 'viitsa_patient_payment_reminder';
  const amountStr = formatAmount(data.pendingAmount);
  const patient = formatProperName(data.patientName);
  const visitDateStr = data.visitDate || data.dueDate || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return sendWhatsAppTemplate({
    to: data.to,
    templateName,
    clinicId: data.clinicId,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: patient },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: amountStr },
          { type: 'text', text: visitDateStr },
          { type: 'text', text: data.upiId || 'clinic@upi' },
          { type: 'text', text: data.clinicPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

// ============================================================================
// 5. CLINICAL (Follow-up due, Lab report ready)
// ============================================================================

export interface PatientFollowupDueData {
  to: string;
  clinicId?: string;
  patientName: string;
  doctorName: string;
  clinicName: string;
  dueDate: string;
  clinicPhone: string;
}

/**
 * Template: viitsa_patient_followup_due (5 params)
 * {{1}}=patient, {{2}}=doctor, {{3}}=clinic, {{4}}=dueDate, {{5}}=phone
 */
export async function sendPatientFollowupDue(data: PatientFollowupDueData): Promise<WhatsAppSendResult> {
  const templateName = process.env.WA_TEMPLATE_FOLLOWUP_DUE || 'viitsa_patient_followup_due';
  const docName = cleanDoctorName(data.doctorName);
  const patient = formatProperName(data.patientName);

  return sendWhatsAppTemplate({
    to: data.to,
    templateName,
    clinicId: data.clinicId,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: patient },
          { type: 'text', text: docName },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.dueDate || 'Upcoming' },
          { type: 'text', text: data.clinicPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

export interface PatientLabReportData {
  to: string;
  clinicId?: string;
  patientName: string;
  clinicName: string;
  testName: string;
  doctorName: string;
  reportDate: string;
  clinicPhone: string;
}

/**
 * Template: viitsa_patient_lab_report_ready (6 params)
 * {{1}}=patient, {{2}}=clinic, {{3}}=testName, {{4}}=doctor, {{5}}=reportDate, {{6}}=phone
 */
export async function sendPatientLabReportReady(data: PatientLabReportData): Promise<WhatsAppSendResult> {
  const templateName = process.env.WA_TEMPLATE_LAB_REPORT_READY || 'viitsa_patient_lab_report_ready';
  const docName = cleanDoctorName(data.doctorName);
  const patient = formatProperName(data.patientName);

  return sendWhatsAppTemplate({
    to: data.to,
    templateName,
    clinicId: data.clinicId,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: patient },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.testName || 'Diagnostic Test' },
          { type: 'text', text: docName },
          { type: 'text', text: data.reportDate || 'Today' },
          { type: 'text', text: data.clinicPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

// ============================================================================
// 6. CLINIC B2B SUBSCRIPTIONS & ADMIN GOVERNANCE
// ============================================================================

/**
 * Template: viitsa_clinic_trial_activated (5 params)
 * {{1}} Clinic Admin Name, {{2}} Clinic Name, {{3}} Plan Name, {{4}} Expiry Date, {{5}} Support Phone
 */
export async function sendClinicTrialActivated(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  planName?: string;
  planTier?: string;
  expiryDate?: string;
  trialValidUntil?: string;
  startDate?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_clinic_trial_activated',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.planTier || data.planName || 'Clinic Pro Plan' },
          { type: 'text', text: data.trialValidUntil || data.expiryDate || '30 Days' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_clinic_sub_activated (7 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Plan Name, {{4}} Billing Cycle, {{5}} Amount Paid, {{6}} Next Renewal Date, {{7}} Support Phone
 */
export async function sendClinicSubActivated(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  billingCycle: string;
  amountPaid?: string | number;
  validUntil?: string;
  nextRenewalDate?: string;
  inclusions?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_clinic_sub_activated',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.planName || 'Clinic Plan' },
          { type: 'text', text: data.billingCycle || 'Monthly' },
          { type: 'text', text: formatAmount(data.amountPaid) },
          { type: 'text', text: data.nextRenewalDate || data.validUntil || 'On Schedule' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_clinic_plan_upgraded (7 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} New Plan, {{4}} Old Plan, {{5}} Effective Date, {{6}} New Billing Amount, {{7}} Support Phone
 */
export async function sendClinicPlanUpgraded(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  newPlan: string;
  previousPlan: string;
  effectiveDate: string;
  newAmount: string | number;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_clinic_plan_upgraded',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.previousPlan || 'Previous Plan' },
          { type: 'text', text: data.newPlan || 'Upgraded Plan' },
          { type: 'text', text: data.effectiveDate || 'Immediately' },
          { type: 'text', text: formatAmount(data.newAmount) },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_clinic_plan_do (or alias viitsa_clinic_plan_downgraded) (7 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Current Plan, {{4}} Downgraded Plan, {{5}} Effective Date, {{6}} Current Cycle End Date, {{7}} Support Phone
 */
export async function sendClinicPlanDowngraded(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  currentPlan: string;
  downgradedPlan: string;
  effectiveDate: string;
  cycleEndDate?: string;
  newAmount?: string | number;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  const cycleEnd = data.cycleEndDate || data.effectiveDate;
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_clinic_plan_downgraded',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.currentPlan || 'Current Plan' },
          { type: 'text', text: data.downgradedPlan || 'New Scheduled Plan' },
          { type: 'text', text: data.effectiveDate || 'End of cycle' },
          { type: 'text', text: cycleEnd },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_clinic_sub_ren (or alias viitsa_clinic_sub_renewal_reminder) (7 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Plan Name, {{4}} Renewal Amount, {{5}} Due Date, {{6}} Auto-Debit Status, {{7}} Support Phone
 */
export async function sendClinicSubRenewalReminder(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  renewalAmount: string | number;
  dueDate: string;
  autoDebitStatus?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_clinic_sub_renewal_reminder',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.planName || 'Clinic Plan' },
          { type: 'text', text: formatAmount(data.renewalAmount) },
          { type: 'text', text: data.dueDate || 'Upcoming due date' },
          { type: 'text', text: data.autoDebitStatus || 'Scheduled via e-Mandate' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_clinic_payment_success (or alias viitsa_clinic_payment_succ) (7 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Plan Name, {{4}} Amount Paid, {{5}} Transaction Ref, {{6}} Active Until Date, {{7}} Support Phone
 */
export async function sendClinicPaymentSuccess(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  amount: string | number;
  transactionId: string;
  activeUntilDate?: string;
  paymentDate?: string;
  nextRenewalDate?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_clinic_payment_success',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.planName || 'Clinic Plan' },
          { type: 'text', text: formatAmount(data.amount) },
          { type: 'text', text: data.transactionId || 'pay_confirmed' },
          { type: 'text', text: data.activeUntilDate || data.nextRenewalDate || data.paymentDate || 'Active' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_clinic_payment_failed (or alias viitsa_clinic_payment_fail) (7 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Plan Name, {{4}} Due Amount, {{5}} Reason, {{6}} Grace Period End, {{7}} Support Phone
 */
export async function sendClinicPaymentFailed(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  dueAmount?: string | number;
  amount?: string | number;
  reason?: string;
  gracePeriodEnd?: string;
  attemptDate?: string;
  retryLink?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_clinic_payment_failed',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.planName || 'Clinic Plan' },
          { type: 'text', text: formatAmount(data.dueAmount || data.amount) },
          { type: 'text', text: data.reason || 'Insufficient funds or mandate limit reached' },
          { type: 'text', text: data.gracePeriodEnd || data.attemptDate || 'Within 7 Days' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_clinic_sub_dea (or alias viitsa_clinic_sub_deactivated) (6 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Plan Name, {{4}} Deactivation Date, {{5}} Status, {{6}} Support Phone
 */
export async function sendClinicSubDeactivated(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  deactivationDate: string;
  status?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_clinic_sub_deactivated',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.planName || 'Clinic Plan' },
          { type: 'text', text: data.deactivationDate || 'Immediately' },
          { type: 'text', text: data.status || 'Deactivated - Overdue' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_clinic_sub_can (or alias viitsa_clinic_sub_cancelled) (6 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Cancelled Plan, {{4}} Access Concludes On, {{5}} End Date, {{6}} Support Phone
 */
export async function sendClinicSubCancelled(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  cancelledPlan?: string;
  planName?: string;
  accessDate?: string;
  effectiveDate: string;
  endDate?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  const effDate = data.effectiveDate || data.accessDate || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const endDate = data.endDate || effDate;

  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_clinic_sub_cancelled',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.cancelledPlan || data.planName || 'Clinic Plan' },
          { type: 'text', text: effDate },
          { type: 'text', text: endDate },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_clinic_sub_invc (or alias viitsa_clinic_sub_invoice) (Header: Document PDF, Body: 7 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Invoice No, {{4}} Plan, {{5}} Total Amount, {{6}} Invoice Date, {{7}} Accounts Phone
 */
export async function sendClinicSubInvoice(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  invoiceNo: string;
  planName: string;
  totalAmount: string | number;
  invoiceDate: string;
  pdfUrl?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  const components: any[] = [];
  const pdfLink = data.pdfUrl || `https://viitsa.com/api/invoice/${data.invoiceNo}.pdf`;
  components.push({
    type: 'header',
    parameters: [
      {
        type: 'document',
        document: {
          link: pdfLink,
          filename: `Viitsa_Invoice_${data.invoiceNo}.pdf`,
        },
      },
    ],
  });
  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
      { type: 'text', text: data.clinicName || 'Clinic' },
      { type: 'text', text: data.invoiceNo || 'INV-001' },
      { type: 'text', text: data.planName || 'Clinic Plan' },
      { type: 'text', text: formatAmount(data.totalAmount) },
      { type: 'text', text: data.invoiceDate || new Date().toLocaleDateString('en-IN') },
      { type: 'text', text: data.supportPhone || '+91 73961 11081' },
    ],
  });
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_clinic_sub_invoice',
    components,
  });
}

/**
 * Template: viitsa_clinic_quota_al (or alias viitsa_clinic_quota_alert) (8 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Usage %, {{4}} Quota Type, {{5}} Used, {{6}} Total Limit, {{7}} Reset Date, {{8}} Support Phone
 */
export async function sendClinicQuotaAlert(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  quotaType?: string;
  percentUsed?: string | number;
  used?: string | number;
  totalLimit?: string | number;
  resetDate?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  const percentNum = typeof data.percentUsed === 'number'
    ? data.percentUsed
    : parseInt(String(data.percentUsed || '80').replace(/[^0-9]/g, ''), 10) || 80;

  const total = data.totalLimit ? String(data.totalLimit) : '2,500';
  const used = data.used ? String(data.used) : String(Math.round((percentNum / 100) * 2500));
  const reset = data.resetDate || new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_clinic_quota_alert',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: String(percentNum) },
          { type: 'text', text: data.quotaType || 'WhatsApp Reminders' },
          { type: 'text', text: used },
          { type: 'text', text: total },
          { type: 'text', text: reset },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_clinic_pending_approval (5 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Clinic ID, {{4}} Submission Date, {{5}} Support Phone
 */
export async function sendClinicPendingApproval(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  clinicId: string;
  submissionDate: string;
  supportPhone?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: process.env.WA_TEMPLATE_CLINIC_PENDING_APPROVAL || 'viitsa_clinic_pending_approval',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.clinicId || 'CLN-PENDING' },
          { type: 'text', text: data.submissionDate || new Date().toLocaleDateString('en-IN') },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_admin_clinic_verified (5 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Clinic ID, {{4}} Verification Date, {{5}} Support Phone
 */
export async function sendClinicVerificationApproved(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  clinicId?: string;
  approvedDate: string;
  supportPhone?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_admin_clinic_verified',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.clinicId || 'CLINIC-VERIFIED' },
          { type: 'text', text: data.approvedDate || new Date().toLocaleDateString('en-IN') },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_admin_clinic_rejected (4 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Reason, {{4}} Compliance Phone
 */
export async function sendClinicVerificationRejected(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  reason: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_admin_clinic_rejected',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.reason || 'Document verification incomplete or illegible' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_admin_clinic_docs_needed (5 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Missing Documents, {{4}} Upload Deadline, {{5}} Support Phone
 */
export async function sendClinicDocsNeeded(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  missingDocs: string;
  deadline: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_admin_clinic_docs_needed',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.missingDocs || 'Clinical Establishment Certificate & Council Registration' },
          { type: 'text', text: data.deadline || 'Within 7 business days' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_admin_doctor_verified (5 params)
 * {{1}} Doctor Name, {{2}} Clinic Name, {{3}} Doctor Name, {{4}} Login Email, {{5}} Support Phone
 */
export async function sendDoctorVerificationApproved(data: {
  to: string;
  recipientName?: string;
  doctorName: string;
  clinicName: string;
  email?: string;
  councilRegNo?: string;
  approvalDate?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_admin_doctor_verified',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: cleanDoctorName(data.recipientName || data.doctorName) },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: cleanDoctorName(data.doctorName) },
          { type: 'text', text: data.email || 'your registered email' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_doctor_added_by_clinic (5 params)
 * Sent when a clinic registers/adds a doctor to their clinic
 * {{1}} Doctor Name, {{2}} Clinic Name, {{3}} Doctor Name, {{4}} Registered Email, {{5}} Clinic Support Phone
 */
export async function sendDoctorAddedByClinic(data: {
  to: string;
  doctorName: string;
  clinicName: string;
  email: string;
  clinicPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_doctor_added_by_clinic',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: cleanDoctorName(data.doctorName) },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: cleanDoctorName(data.doctorName) },
          { type: 'text', text: data.email || 'N/A' },
          { type: 'text', text: data.clinicPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_admin_doctor_rejected (5 params)
 * {{1}} Admin Name, {{2}} Doctor Name, {{3}} Clinic Name, {{4}} Reason, {{5}} Support Phone
 */
export async function sendDoctorVerificationRejected(data: {
  to: string;
  adminName?: string;
  doctorName: string;
  clinicName: string;
  reason: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_admin_doctor_rejected',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: cleanDoctorName(data.doctorName) },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.reason || 'Medical council registration or certificate details could not be validated' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_admin_plan_activated -> Uses approved viitsa_clinic_sub_activated
 */
export async function sendAdminPlanActivated(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  validThrough: string;
  adminRemarks?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendClinicSubActivated({
    to: data.to,
    adminName: data.adminName,
    clinicName: data.clinicName,
    planName: data.planName,
    billingCycle: 'Annual Partner Grant',
    amountPaid: '0.00',
    validUntil: data.validThrough || 'Active',
    nextRenewalDate: data.validThrough || 'Annual',
    supportPhone: data.supportPhone,
    clinicId: data.clinicId,
  });
}

/**
 * Template: viitsa_admin_plan_free_granted -> Uses approved viitsa_clinic_trial_activated
 */
export async function sendAdminPlanFreeGranted(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  planTier: string;
  activePeriod: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendClinicTrialActivated({
    to: data.to,
    adminName: data.adminName,
    clinicName: data.clinicName,
    planName: data.planTier || 'Promotional Access',
    expiryDate: data.activePeriod || 'Lifetime / Partner Grant',
    supportPhone: data.supportPhone,
    clinicId: data.clinicId,
  });
}

/**
 * Template: viitsa_admin_plan_deactivated -> Uses approved viitsa_clinic_sub_deactivated
 */
export async function sendAdminPlanDeactivated(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  deactivationDate: string;
  reason?: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendClinicSubDeactivated({
    to: data.to,
    adminName: data.adminName,
    clinicName: data.clinicName,
    planName: data.planName || 'Clinic Suite',
    deactivationDate: data.deactivationDate || new Date().toLocaleDateString('en-IN'),
    status: data.reason || 'Administrative Review',
    supportPhone: data.supportPhone,
    clinicId: data.clinicId,
  });
}

/**
 * Template: viitsa_admin_plan_suspended -> Uses approved viitsa_clinic_sub_deactivated
 */
export async function sendAdminPlanSuspended(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  reason: string;
  suspensionDate: string;
  compliancePhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendClinicSubDeactivated({
    to: data.to,
    adminName: data.adminName,
    clinicName: data.clinicName,
    planName: 'Suspended Account',
    deactivationDate: data.suspensionDate || new Date().toLocaleDateString('en-IN'),
    status: `Temporary Compliance Suspension: ${data.reason}`,
    supportPhone: data.compliancePhone,
    clinicId: data.clinicId,
  });
}

/**
 * Template: viitsa_admin_plan_reactivated -> Uses approved viitsa_clinic_sub_activated
 */
export async function sendAdminPlanReactivated(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  planName: string;
  reactivationDate: string;
  supportPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendClinicSubActivated({
    to: data.to,
    adminName: data.adminName,
    clinicName: data.clinicName,
    planName: data.planName || 'Active Suite',
    billingCycle: 'Restored Active Plan',
    amountPaid: '0.00',
    validUntil: data.reactivationDate || new Date().toLocaleDateString('en-IN'),
    nextRenewalDate: 'Active',
    supportPhone: data.supportPhone,
    clinicId: data.clinicId,
  });
}

/**
 * Template: viitsa_admin_payment_request -> Uses approved viitsa_clinic_sub_renewal_reminder
 */
export async function sendAdminPaymentRequest(data: {
  to: string;
  adminName?: string;
  clinicName: string;
  serviceName: string;
  amount: string | number;
  dueDate: string;
  invoiceRef: string;
  accountsPhone?: string;
  clinicId?: string;
}): Promise<WhatsAppSendResult> {
  return sendClinicSubRenewalReminder({
    to: data.to,
    adminName: data.adminName,
    clinicName: data.clinicName,
    planName: `${data.serviceName} (Ref: ${data.invoiceRef})`,
    renewalAmount: data.amount,
    dueDate: data.dueDate,
    autoDebitStatus: 'Invoice Due',
    supportPhone: data.accountsPhone,
    clinicId: data.clinicId,
  });
}
