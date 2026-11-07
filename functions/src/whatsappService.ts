import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { ensurePatientInvoicePdfUrl, ensureSubscriptionInvoicePdfUrl } from './invoicePdf';

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

  // Clinic Verification Approved
  'viitsa_clinic_verification_approved': ['viitsa_admin_clinic_verified'],
  'viitsa_admin_clinic_verified': ['viitsa_clinic_verification_approved'],

  // Clinic Verification Rejected
  'viitsa_clinic_verification_rejected': ['viitsa_admin_clinic_rejected'],
  'viitsa_admin_clinic_rejected': ['viitsa_clinic_verification_rejected'],

  // Clinic Docs Needed
  'viitsa_clinic_docs_needed': ['viitsa_admin_clinic_docs_needed'],
  'viitsa_admin_clinic_docs_needed': ['viitsa_clinic_docs_needed'],

  // Doctor Verification Approved
  'viitsa_doctor_verification_approved': ['viitsa_admin_doctor_verified'],
  'viitsa_admin_doctor_verified': ['viitsa_doctor_verification_approved'],

  // Doctor Verification Rejected
  'viitsa_doctor_verification_rejected': ['viitsa_admin_doctor_rejected'],
  'viitsa_admin_doctor_rejected': ['viitsa_doctor_verification_rejected'],

  // Legacy Appointment Confirmation
  'viitsa_appointment_booking_confirmation': ['viitsa_appt_confirm_new_visit', 'viitsa_appt_confirm_online'],
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
  const cleaned = name.trim().replace(/^(Dr\.?|Doctor)\s+/i, '').trim();
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

// In-memory cache for fast deduplication across simultaneous requests
const recentDispatches = new Map<string, number>();
const inFlightDispatches = new Set<string>();

/**
 * Maps any template name or alias into its canonical event category and deduplication window.
 * This guarantees that even if different code paths, webhooks, or alias fallbacks use
 * different template names for the same event, they map to the exact same deduplication key!
 */
export function getEventCategory(templateName: string): { category: string; windowMs: number } {
  const name = (templateName || '').toLowerCase().trim();

  // 1. Authentication OTP (15-second cooldown to avoid double clicks)
  if (name.includes('otp')) {
    return { category: 'auth_otp', windowMs: 15 * 1000 };
  }

  // 2. Appointment Confirmations (All 5 approved variants + legacy aliases map to the same category)
  if (name.startsWith('viitsa_appt_confirm') || name === 'viitsa_appointment_booking_confirmation') {
    return { category: 'appt_confirm', windowMs: 60 * 1000 };
  }

  // 3. Appointment Updates (Reschedule, Reminder, Cancellation)
  if (name.includes('rescheduled')) {
    return { category: 'appt_rescheduled', windowMs: 60 * 1000 };
  }
  if (name.includes('reminder') && (name.includes('appt') || name.includes('appointment'))) {
    return { category: 'appt_reminder', windowMs: 60 * 1000 };
  }
  if (name.includes('cancelled') && (name.includes('appt') || name.includes('appointment'))) {
    return { category: 'appt_cancelled', windowMs: 60 * 1000 };
  }

  // 4. Patient Billing & Care Reminders
  if (name === 'viitsa_patient_invoice') {
    return { category: 'patient_invoice', windowMs: 60 * 1000 };
  }
  if (name === 'viitsa_patient_payment_reminder') {
    return { category: 'patient_payment_reminder', windowMs: 60 * 1000 };
  }
  if (name === 'viitsa_patient_followup_due') {
    return { category: 'patient_followup_due', windowMs: 60 * 1000 };
  }
  if (name === 'viitsa_patient_lab_report_ready') {
    return { category: 'patient_lab_report_ready', windowMs: 60 * 1000 };
  }
  if (name === 'viitsa_patient_medicine_reminder') {
    return { category: 'patient_medicine_reminder', windowMs: 60 * 1000 };
  }

  // 5. Clinic Onboarding & Verification Lifecycle (180-second / 3-minute lock window)
  if (name === 'viitsa_clinic_pending_approval') {
    return { category: 'clinic_pending_approval', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_verification_approved' || name === 'viitsa_admin_clinic_verified') {
    return { category: 'clinic_approved', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_verification_rejected' || name === 'viitsa_admin_clinic_rejected') {
    return { category: 'clinic_rejected', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_docs_needed' || name === 'viitsa_admin_clinic_docs_needed') {
    return { category: 'clinic_docs_needed', windowMs: 180 * 1000 };
  }

  // 6. Doctor Onboarding & Verification Lifecycle (180-second / 3-minute lock window)
  if (name === 'viitsa_doctor_verification_approved' || name === 'viitsa_admin_doctor_verified') {
    return { category: 'doctor_approved', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_doctor_verification_rejected' || name === 'viitsa_admin_doctor_rejected') {
    return { category: 'doctor_rejected', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_doctor_added_by_clinic') {
    return { category: 'doctor_added', windowMs: 180 * 1000 };
  }

  // 7. Clinic Subscription Lifecycle (180-second / 3-minute lock window)
  if (name === 'viitsa_clinic_trial_activated') {
    return { category: 'clinic_trial_activated', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_sub_activated') {
    return { category: 'clinic_sub_activated', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_sub_cancelled' || name === 'viitsa_clinic_sub_can') {
    return { category: 'clinic_sub_cancelled', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_sub_deactivated' || name === 'viitsa_clinic_sub_dea') {
    return { category: 'clinic_sub_deactivated', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_plan_upgraded') {
    return { category: 'clinic_plan_upgraded', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_plan_downgraded' || name === 'viitsa_clinic_plan_do') {
    return { category: 'clinic_plan_downgraded', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_payment_success' || name.startsWith('viitsa_clinic_payment_succ')) {
    return { category: 'clinic_payment_success', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_payment_failed' || name.startsWith('viitsa_clinic_payment_fail')) {
    return { category: 'clinic_payment_failed', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_sub_renewal_reminder' || name === 'viitsa_clinic_sub_ren') {
    return { category: 'clinic_sub_renewal_reminder', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_sub_invoice' || name === 'viitsa_clinic_sub_invc') {
    return { category: 'clinic_sub_invoice', windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_clinic_quota_alert' || name === 'viitsa_clinic_quota_al') {
    return { category: 'clinic_quota_alert', windowMs: 180 * 1000 };
  }

  // 8. Admin Plan Overrides (180-second / 3-minute lock window)
  if (name.startsWith('viitsa_admin_plan_')) {
    return { category: name, windowMs: 180 * 1000 };
  }
  if (name === 'viitsa_admin_payment_request') {
    return { category: 'admin_payment_request', windowMs: 180 * 1000 };
  }

  // Default fallback
  return { category: name, windowMs: 60 * 1000 };
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

  // Business Self-Send Guard: Meta WhatsApp Cloud API does not permit sending messages to the business's own registered phone number
  const BUSINESS_PHONE_CLEAN = '917396111081';
  if (normalizedPhone === BUSINESS_PHONE_CLEAN) {
    console.warn(`[WhatsAppService] Warning: Recipient ${normalizedPhone} is Viitsa's own registered WhatsApp Business number. Meta API rejects self-messaging.`);
    return {
      success: false,
      error: 'Recipient phone number is Viitsa’s registered WhatsApp Business number (+91 73961 11081). Meta Cloud API does not allow a WhatsApp business account to message itself. Please test with an external phone number.',
    };
  }

  // Resolve event category and lock window
  const { category, windowMs } = getEventCategory(options.templateName);
  const dedupKey = `${normalizedPhone}_${category}`;
  const nowMs = Date.now();

  // Tier 1: In-Flight and In-Memory Check (< 1ms)
  if (inFlightDispatches.has(dedupKey)) {
    console.warn(`[WhatsAppService] Deduplication Guard: Suppressed concurrent in-flight dispatch of category '${category}' (${options.templateName}) to ${normalizedPhone}`);
    return { success: true, messageId: 'dedup_suppressed_inflight' };
  }
  const memLast = recentDispatches.get(dedupKey);
  if (memLast && (nowMs - memLast < windowMs)) {
    console.warn(`[WhatsAppService] Deduplication Guard: Suppressed in-memory duplicate of category '${category}' (${options.templateName}) to ${normalizedPhone} (${Math.round((nowMs - memLast) / 1000)}s ago)`);
    return { success: true, messageId: 'dedup_suppressed_memory' };
  }

  // Tier 2: Distributed Firestore Lock Check (Atomic Cross-Instance Guard via Transaction)
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const lockRef = db.collection('whatsapp_dispatch_locks').doc(dedupKey);

  try {
    let alreadyHandled = false;
    let existingMessageId: string | undefined;

    await db.runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      if (lockDoc.exists) {
        const lockData = lockDoc.data() || {};
        const fsLast = lockData.dispatched_at_ms || 0;
        const isPending = lockData.status === 'in_progress' && (nowMs - fsLast < 30000);
        if (isPending || (nowMs - fsLast < windowMs)) {
          alreadyHandled = true;
          existingMessageId = lockData.message_id;
          return;
        }
      }
      transaction.set(lockRef, {
        phone: normalizedPhone,
        category,
        template: options.templateName,
        status: 'in_progress',
        dispatched_at_ms: nowMs,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    if (alreadyHandled) {
      console.warn(`[WhatsAppService] Deduplication Guard: Suppressed cross-instance duplicate of category '${category}' (${options.templateName}) to ${normalizedPhone}`);
      recentDispatches.set(dedupKey, nowMs);
      return { success: true, messageId: existingMessageId || 'dedup_suppressed_firestore' };
    }

    inFlightDispatches.add(dedupKey);
    recentDispatches.set(dedupKey, nowMs);
  } catch (lockErr) {
    console.warn('[WhatsAppService] Deduplication lock check notice:', lockErr);
  }

  // PRE-EMPTIVE IN-MEMORY LOCK RESERVATION:
  // Set in-memory markers before making the external HTTP fetch to Meta!
  inFlightDispatches.add(dedupKey);
  recentDispatches.set(dedupKey, nowMs);

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
        
        let aliasComponents = payload.template.components;
        // Adapt parameters if retrying viitsa_appt_confirm_new_visit (7 params) from viitsa_appt_confirm_online (8 params)
        if (alias === 'viitsa_appt_confirm_new_visit' && Array.isArray(aliasComponents)) {
          aliasComponents = aliasComponents.map((comp: any) => {
            if (comp.type === 'body' && Array.isArray(comp.parameters) && comp.parameters.length === 8) {
              return {
                ...comp,
                parameters: [
                  ...comp.parameters.slice(0, 6),
                  comp.parameters[7], // clinic phone
                ],
              };
            }
            return comp;
          });
        }

        const fallbackPayload = {
          ...payload,
          template: {
            ...payload.template,
            name: alias,
            components: aliasComponents,
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

    // If still failing and error mentions header or media mismatch while header was sent, retry body-only
    const errMsg = (data?.error?.message || '').toLowerCase();
    const isHeaderOrMediaError = errMsg.includes('header') || errMsg.includes('media') || errMsg.includes('download') || errMsg.includes('document');
    if (!response.ok && isHeaderOrMediaError && options.components?.some((c: any) => c.type === 'header')) {
      console.warn(`[WhatsAppService] Header/Media component rejected (${data?.error?.message}). Retrying body-only fallback...`);
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

    // If still failing and error mentions button mismatch while button was sent, retry without button component
    if (!response.ok && (data?.error?.message?.toLowerCase().includes('button') || data?.error?.error_user_msg?.toLowerCase().includes('button')) && options.components?.some((c: any) => c.type === 'button')) {
      console.warn(`[WhatsAppService] Button component rejected (${data?.error?.message}). Retrying without button fallback...`);
      const withoutButtonComponents = options.components.filter((c: any) => c.type !== 'button');
      const withoutButtonPayload = {
        ...payload,
        template: {
          ...payload.template,
          components: withoutButtonComponents,
        },
      };
      const retryRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(withoutButtonPayload),
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

      // Clean up in-flight and allow legitimate user retries if needed
      recentDispatches.delete(dedupKey);
      await lockRef.set({
        status: 'failed',
        error: errorMessage,
        failed_at_ms: Date.now(),
      }, { merge: true }).catch(() => {});

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

    // Finalize the deduplication lock with confirmed Meta message ID and timestamp
    recentDispatches.set(dedupKey, nowMs);
    await lockRef.set({
      status: 'sent',
      message_id: messageId || 'ok',
      completed_at_ms: Date.now(),
    }, { merge: true }).catch(() => {});

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
    recentDispatches.delete(dedupKey);
    await lockRef.set({
      status: 'network_error',
      error: error?.message || 'Network error',
      failed_at_ms: Date.now(),
    }, { merge: true }).catch(() => {});
    return {
      success: false,
      error: error?.message || 'Network error communicating with WhatsApp Cloud API',
    };
  } finally {
    inFlightDispatches.delete(dedupKey);
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
 * Template: phone_login_otps (alias: viitsa_login_otp)
 * Category: AUTHENTICATION
 * Variables: {{1}} = otp_code
 * Button: Copy code (sub_type: copy_code)
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
      sub_type: 'copy_code',
      index: '0',
      parameters: [
        { type: 'coupon_code', coupon_code: otpCode },
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
// 2. APPOINTMENT CONFIRMATIONS (Online, Follow-up, Report Review, Walk-in, New Visit)
// ============================================================================

export interface AppointmentConfirmData {
  to: string;
  clinicId?: string;
  type: 'online' | 'followup' | 'report' | 'walkin' | 'new_visit';
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
    case 'new_visit':
      // Template: viitsa_appt_confirm_new_visit (7 params)
      // {{1}}=patient, {{2}}=doctor, {{3}}=clinic, {{4}}=date, {{5}}=time, {{6}}=token, {{7}}=phone
      templateName = process.env.WA_TEMPLATE_APPT_NEW_VISIT || 'viitsa_appt_confirm_new_visit';
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

    case 'online':
      // Template: viitsa_appt_confirm_online (alias: viitsa_appt_confirm_new_visit) (7 params)
      // {{1}}=patient, {{2}}=doctor, {{3}}=clinic, {{4}}=date, {{5}}=timeOrSlot, {{6}}=token, {{7}}=phone
      templateName = process.env.WA_TEMPLATE_APPT_ONLINE || 'viitsa_appt_confirm_online';
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

export interface PatientMedicineReminderData {
  to: string;
  clinicId?: string;
  patientName: string;
  clinicName: string;
  medicineName: string;
  dosageTiming: string;
  instructions?: string;
  clinicPhone: string;
  doctorName?: string;
}

/**
 * Template: viitsa_patient_medicine_reminder (6 params)
 * {{1}}=patient, {{2}}=clinic, {{3}}=medicine, {{4}}=dosageTiming, {{5}}=instructions, {{6}}=phone
 */
export async function sendPatientMedicineReminder(data: PatientMedicineReminderData): Promise<WhatsAppSendResult> {
  const templateName = process.env.WA_TEMPLATE_MEDICINE_REMINDER || 'viitsa_patient_medicine_reminder';
  const patient = formatProperName(data.patientName);

  const res = await sendWhatsAppTemplate({
    to: data.to,
    templateName,
    clinicId: data.clinicId,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: patient },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.medicineName || 'Prescribed Medicine' },
          { type: 'text', text: data.dosageTiming || 'As prescribed' },
          { type: 'text', text: data.instructions || 'Complete full course as directed' },
          { type: 'text', text: data.clinicPhone || '+91 73961 11081' },
        ],
      },
    ],
  });

  return res;
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
  let pdfLink = data.pdfUrl;
  if (!pdfLink) {
    try {
      const numAmt = typeof data.totalAmount === 'number'
        ? data.totalAmount
        : parseFloat(String(data.totalAmount).replace(/[^\d.]/g, '')) || 5999;
      pdfLink = await ensureSubscriptionInvoicePdfUrl({
        invoiceNumber: data.invoiceNo || 'INV-001',
        invoiceDate: data.invoiceDate || new Date().toLocaleDateString('en-IN'),
        status: 'PAID',
        clinicName: data.clinicName || 'Clinic Partner',
        customerEmail: '',
        planName: data.planName || 'Clinic Plan',
        tier: 'clinic',
        cycle: 'monthly',
        amount: numAmt,
      }, data.clinicId);
    } catch (pdfErr) {
      console.warn('[sendClinicSubInvoice] Notice generating PDF attachment:', pdfErr);
    }
  }

  const components: any[] = [];
  const finalPdfUrl = pdfLink || `https://viitsa.com/api/invoice/${data.invoiceNo || 'INV'}.pdf`;
  components.push({
    type: 'header',
    parameters: [
      {
        type: 'document',
        document: {
          link: finalPdfUrl,
          filename: `Viitsa_Invoice_${data.invoiceNo || 'INV'}.pdf`,
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
 * Template: viitsa_admin_plan_activated (6 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Activated Plan, {{4}} Valid Through, {{5}} Admin Remarks, {{6}} Support Phone
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
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_admin_plan_activated',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.planName || 'Clinic Plan' },
          { type: 'text', text: data.validThrough || 'Active' },
          { type: 'text', text: data.adminRemarks || 'Platform administrator approval' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_admin_plan_free_granted (5 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Granted Tier, {{4}} Active Period, {{5}} Support Phone
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
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_admin_plan_free_granted',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.planTier || 'Promotional Tier' },
          { type: 'text', text: data.activePeriod || '30-Day Sponsorship' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_admin_plan_deactivated (6 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Plan, {{4}} Deactivation Date, {{5}} Reason, {{6}} Support Phone
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
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_admin_plan_deactivated',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.planName || 'Clinic Plan' },
          { type: 'text', text: data.deactivationDate || new Date().toLocaleDateString('en-IN') },
          { type: 'text', text: data.reason || 'Administrative Review' },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_admin_plan_suspended (5 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Reason, {{4}} Suspension Date, {{5}} Compliance Phone
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
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_admin_plan_suspended',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.reason || 'Compliance Review' },
          { type: 'text', text: data.suspensionDate || new Date().toLocaleDateString('en-IN') },
          { type: 'text', text: data.compliancePhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_admin_plan_reactivated (5 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Restored Plan, {{4}} Reactivation Date, {{5}} Support Phone
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
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_admin_plan_reactivated',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.planName || 'Clinic Plan' },
          { type: 'text', text: data.reactivationDate || new Date().toLocaleDateString('en-IN') },
          { type: 'text', text: data.supportPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}

/**
 * Template: viitsa_admin_payment_request (7 params)
 * {{1}} Admin Name, {{2}} Clinic Name, {{3}} Plan/Add-on, {{4}} Amount, {{5}} Due Date, {{6}} Invoice Ref, {{7}} Accounts Phone
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
  const cleanAmount = formatAmount(data.amount);
  return sendWhatsAppTemplate({
    to: data.to,
    clinicId: data.clinicId,
    templateName: 'viitsa_admin_payment_request',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: formatProperName(data.adminName || 'Doctor') },
          { type: 'text', text: data.clinicName || 'Clinic' },
          { type: 'text', text: data.serviceName || 'Clinic Subscription' },
          { type: 'text', text: cleanAmount },
          { type: 'text', text: data.dueDate || new Date().toLocaleDateString('en-IN') },
          { type: 'text', text: data.invoiceRef || 'VIITSA-INV' },
          { type: 'text', text: data.accountsPhone || '+91 73961 11081' },
        ],
      },
    ],
  });
}
