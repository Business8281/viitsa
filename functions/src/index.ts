import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import Razorpay from "razorpay";
import * as crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

if (!admin.apps.length) {
  admin.initializeApp();
}

setGlobalOptions({
  region: "asia-south1",
  memory: "256MiB",
  cpu: "gcf_gen1",
  maxInstances: 5,
});

// Import modules
import { aiChat } from "./aiChat";
import {
  sendInstantEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmailAuthOtp,
  verifyEmailAuthOtp,
  markEmailVerified,
} from "./email";
import { createClinicSubscription, cancelClinicSubscription, razorpayWebhook } from "./razorpay";
import { whatsappWebhook } from "./whatsappWebhook";
import { onAppointmentUpdated } from "./onAppointmentUpdated";
import {
  sendOtpWhatsApp,
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  sendAppointmentRescheduled,
  sendAppointmentCancelled,
  sendPatientInvoice,
  sendPatientPaymentReminder,
  sendPatientFollowupDue,
  sendPatientLabReportReady,
  sendPatientMedicineReminder,
  sendClinicTrialActivated,
  sendClinicSubActivated,
  sendClinicPlanUpgraded,
  sendClinicPlanDowngraded,
  sendClinicSubRenewalReminder,
  sendClinicPaymentSuccess,
  sendClinicPaymentFailed,
  sendClinicSubDeactivated,
  sendClinicSubCancelled,
  sendClinicSubInvoice,
  sendClinicQuotaAlert,
  sendClinicPendingApproval,
  sendClinicVerificationApproved,
  sendClinicVerificationRejected,
  sendClinicDocsNeeded,
  sendDoctorVerificationApproved,
  sendDoctorVerificationRejected,
  sendDoctorAddedByClinic,
  sendAdminPlanActivated,
  sendAdminPlanFreeGranted,
  sendAdminPlanDeactivated,
  sendAdminPlanSuspended,
  sendAdminPlanReactivated,
  sendAdminPaymentRequest,
} from "./whatsappService";

export {
  aiChat,
  sendInstantEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmailAuthOtp,
  verifyEmailAuthOtp,
  markEmailVerified,
  createClinicSubscription,
  cancelClinicSubscription,
  razorpayWebhook,
  whatsappWebhook,
  onAppointmentUpdated,
};

function formatDisplayDate(dateStr: any): string {
  if (!dateStr) return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  let dateVal = dateStr;
  if (typeof dateVal?.toDate === 'function') dateVal = dateVal.toDate();
  else if (typeof dateVal?.seconds === 'number') dateVal = new Date(dateVal.seconds * 1000);
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatProperName(name?: string | null): string {
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

// ============================================================================
// CALLABLE: Send WhatsApp Notification
// ============================================================================
export const sendWhatsAppNotification = onCall(
  {
    region: "asia-south1",
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const data = request.data || {};
    const { action } = data;

    // For OTP, allow unauthenticated (phone login flow)
    if (action === 'otp') {
      const { to, otp } = data;
      if (!to || !otp) {
        throw new HttpsError('invalid-argument', 'Missing recipient phone (to) or OTP code (otp).');
      }
      return await sendOtpWhatsApp(to, String(otp));
    }

    // Require auth for all other notifications
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to send notifications.');
    }

    try {
      switch (action) {
        case 'appointment_confirm':
          return await sendAppointmentConfirmation(data);
        case 'appointment_reminder':
          return await sendAppointmentReminder(data);
        case 'appointment_rescheduled':
          return await sendAppointmentRescheduled(data);
        case 'appointment_cancelled':
          return await sendAppointmentCancelled(data);
        case 'patient_invoice':
          return await sendPatientInvoice(data);
        case 'patient_payment_reminder':
          return await sendPatientPaymentReminder(data);
        case 'patient_followup_due':
          return await sendPatientFollowupDue(data);
        case 'patient_lab_report':
          return await sendPatientLabReportReady(data);
        case 'patient_medicine_reminder':
          return await sendPatientMedicineReminder(data);
        case 'clinic_trial_activated':
          return await sendClinicTrialActivated(data);
        case 'clinic_sub_activated':
          return await sendClinicSubActivated(data);
        case 'clinic_plan_upgraded':
          return await sendClinicPlanUpgraded(data);
        case 'clinic_plan_downgraded':
          return await sendClinicPlanDowngraded(data);
        case 'clinic_sub_renewal_reminder':
          return await sendClinicSubRenewalReminder(data);
        case 'clinic_payment_success':
          return await sendClinicPaymentSuccess(data);
        case 'clinic_payment_failed':
          return await sendClinicPaymentFailed(data);
        case 'clinic_sub_deactivated':
          return await sendClinicSubDeactivated(data);
        case 'clinic_sub_cancelled':
          return await sendClinicSubCancelled(data);
        case 'clinic_sub_invoice':
          return await sendClinicSubInvoice(data);
        case 'clinic_quota_alert':
          return await sendClinicQuotaAlert(data);
        case 'clinic_pending_approval':
          return await sendClinicPendingApproval(data);
        case 'clinic_verification_approved':
          return await sendClinicVerificationApproved(data);
        case 'clinic_verification_rejected':
          return await sendClinicVerificationRejected(data);
        case 'clinic_docs_needed':
          return await sendClinicDocsNeeded(data);
        case 'doctor_verification_approved':
          return await sendDoctorVerificationApproved(data);
        case 'doctor_verification_rejected':
          return await sendDoctorVerificationRejected(data);
        case 'doctor_added_by_clinic':
          return await sendDoctorAddedByClinic(data);
        case 'admin_plan_activated':
          return await sendAdminPlanActivated(data);
        case 'admin_plan_free_granted':
          return await sendAdminPlanFreeGranted(data);
        case 'admin_plan_deactivated':
          return await sendAdminPlanDeactivated(data);
        case 'admin_plan_suspended':
          return await sendAdminPlanSuspended(data);
        case 'admin_plan_reactivated':
          return await sendAdminPlanReactivated(data);
        case 'admin_payment_request':
          return await sendAdminPaymentRequest(data);
        default:
          throw new HttpsError('invalid-argument', `Unknown WhatsApp notification action: ${action}`);
      }
    } catch (err: any) {
      console.error('[sendWhatsAppNotification] Handler error:', err);
      throw new HttpsError('internal', err?.message || 'Failed to dispatch WhatsApp message.');
    }
  }
);

// Dedicated OTP callable for phone login flows
export const sendWhatsAppOtpDirect = onCall(
  {
    region: "asia-south1",
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const { phone, otp } = request.data || {};
    if (!phone || !otp) {
      throw new HttpsError('invalid-argument', 'Missing phone or otp.');
    }
    return await sendOtpWhatsApp(phone, String(otp));
  }
);

// ============================================================================
// CALLABLE: Send WhatsApp Auth OTP (Generates code, stores in DB, sends via WA)
// ============================================================================
export const sendWhatsAppAuthOtp = onCall(
  {
    region: "asia-south1",
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const { phone, portal = 'clinic', action = 'login' } = request.data || {};
    if (!phone) {
      throw new HttpsError('invalid-argument', 'Mobile number is required.');
    }

    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      throw new HttpsError('invalid-argument', 'Valid 10-digit mobile number required.');
    }

    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();

    const intlPhone = '+91' + cleanPhone;

    // Upfront Role Verification: NEVER dispatch OTP if there is a role mismatch
    if (portal === 'clinic') {
      let registeredRole: string | undefined;

      const u1 = await db.collection("users").where("phone", "==", cleanPhone).limit(1).get();
      const u2 = u1.empty ? await db.collection("users").where("phone", "==", intlPhone).limit(1).get() : u1;
      if (!u2.empty) {
        registeredRole = u2.docs[0].data()?.role;
      } else {
        const p1 = await db.collection("patient_accounts").where("phone", "==", cleanPhone).limit(1).get();
        if (!p1.empty) {
          registeredRole = 'patient';
        }
      }

      if (action === 'login') {
        if (registeredRole === 'patient' || registeredRole === 'patient_attendant') {
          throw new HttpsError('permission-denied', `This mobile number (+91 ${cleanPhone}) is registered for a Patient account. You cannot sign in to the Clinic Portal with a Patient account. Please sign in via the Patient Portal (/login).`);
        }
        if (registeredRole && ['company_admin', 'company_manager', 'company_staff', 'admin'].includes(registeredRole)) {
          throw new HttpsError('permission-denied', `This mobile number (+91 ${cleanPhone}) is registered for a System Admin account. Please sign in via the Admin Portal (/admin/login).`);
        }
        if (!registeredRole) {
          throw new HttpsError('not-found', `No clinic account found for mobile number (+91 ${cleanPhone}). If you are a new clinic, please select the "Create Account" tab to register.`);
        }
      } else if (action === 'register') {
        if (registeredRole === 'patient' || registeredRole === 'patient_attendant') {
          throw new HttpsError('permission-denied', `This mobile number (+91 ${cleanPhone}) is already registered for a Patient account. You cannot create a clinic account with a patient mobile number. Please sign in via the Patient Portal (/login).`);
        }
        if (registeredRole && ['clinic_admin', 'clinic_doctor', 'clinic_staff', 'doctor', 'staff'].includes(registeredRole)) {
          throw new HttpsError('already-exists', `This mobile number (+91 ${cleanPhone}) is already registered for a Clinic account. Please sign in instead.`);
        }
      }
    } else if (portal === 'patient') {
      const u1 = await db.collection("users").where("phone", "==", cleanPhone).limit(1).get();
      const u2 = u1.empty ? await db.collection("users").where("phone", "==", intlPhone).limit(1).get() : u1;
      if (!u2.empty) {
        const registeredRole = u2.docs[0].data()?.role;
        if (registeredRole && ['clinic_admin', 'clinic_doctor', 'clinic_staff', 'doctor', 'staff'].includes(registeredRole)) {
          throw new HttpsError('permission-denied', `This mobile number (+91 ${cleanPhone}) is registered for a Clinic account. Please sign in via the Clinic Portal (/clinic/login).`);
        }
        if (registeredRole && ['company_admin', 'company_manager', 'company_staff', 'admin'].includes(registeredRole)) {
          throw new HttpsError('permission-denied', `This mobile number (+91 ${cleanPhone}) is registered for a System Admin account. Please sign in via the Admin Portal (/admin/login).`);
        }
      }
    }

    // Generate cryptographically sound 6-digit OTP
    const otpCode = String(crypto.randomInt(100000, 1000000));

    // Store in phone_otps collection with 10-minute expiry
    await db.collection("phone_otps").doc(cleanPhone).set({
      phone: cleanPhone,
      code: otpCode,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      expires_at: Date.now() + 10 * 60 * 1000,
      verified: false,
    });

    const sendRes = await sendOtpWhatsApp(cleanPhone, otpCode);
    if (!sendRes.success) {
      console.error('[sendWhatsAppAuthOtp] Meta dispatch error:', sendRes.error);
      throw new HttpsError('internal', sendRes.error || 'Failed to dispatch WhatsApp OTP');
    }

    return { success: true, message: 'OTP sent to your WhatsApp successfully.' };
  }
);

// ============================================================================
// CALLABLE: Verify WhatsApp Auth OTP & Issue Custom Token
// ============================================================================
export const verifyWhatsAppAuthOtp = onCall(
  {
    region: "asia-south1",
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    try {
      const { phone, otp, onboarding } = request.data || {};
      if (!phone || !otp) {
        throw new HttpsError('invalid-argument', 'Mobile number and verification code are required.');
      }

      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      const cleanOtp = String(otp).trim();

      if (!admin.apps.length) admin.initializeApp();
      const db = admin.firestore();

      // Fetch stored OTP
      const otpDoc = await db.collection("phone_otps").doc(cleanPhone).get();
      if (!otpDoc.exists) {
        throw new HttpsError('not-found', 'No OTP requested for this number or session expired.');
      }

      const otpData = otpDoc.data() || {};
      if (Date.now() > (otpData.expires_at || 0)) {
        throw new HttpsError('deadline-exceeded', 'OTP has expired. Please request a new code.');
      }

      if (otpData.code !== cleanOtp) {
        throw new HttpsError('permission-denied', 'Incorrect OTP. Please enter the valid verification code.');
      }

      // Mark as verified
      await otpDoc.ref.update({
        verified: true,
        verified_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Lookup or create Firebase Auth user
      const intlPhone = '+91' + cleanPhone;
      const targetUid = 'phone_' + cleanPhone;
      let userRecord: admin.auth.UserRecord;

      try {
        userRecord = await admin.auth().getUserByPhoneNumber(intlPhone);
      } catch {
        try {
          userRecord = await admin.auth().getUser(targetUid);
        } catch {
          try {
            // Create new Firebase user
            userRecord = await admin.auth().createUser({
              uid: targetUid,
              phoneNumber: intlPhone,
              displayName: onboarding?.name || '',
            });
          } catch (createErr: any) {
            console.warn('[verifyWhatsAppAuthOtp] createUser warning:', createErr);
            // Fallback: try fetching by targetUid or intlPhone if another process created it concurrently
            try {
              userRecord = await admin.auth().getUser(targetUid);
            } catch {
              userRecord = await admin.auth().getUserByPhoneNumber(intlPhone);
            }
          }
        }
      }

      // Generate custom authentication token for client-side signInWithCustomToken
      let customToken: string;
      try {
        customToken = await admin.auth().createCustomToken(userRecord.uid, {
          role: onboarding?.role || 'patient',
          phone: intlPhone,
        });
      } catch (tokenErr: any) {
        console.error('[verifyWhatsAppAuthOtp] createCustomToken error:', tokenErr);
        throw new HttpsError('internal', tokenErr.message || 'Failed to generate session token');
      }

      return {
        success: true,
        customToken,
        uid: userRecord.uid,
      };
    } catch (err: any) {
      console.error('[verifyWhatsAppAuthOtp] Handler failed:', err);
      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError('internal', err.message || 'Failed to verify verification code.');
    }
  }
);

// ============================================================================
// CALLABLE: Check Registration Conflict & Upfront Role Blocking
// ============================================================================
export const checkRegistrationConflict = onCall(
  {
    region: "asia-south1",
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const { phone, email, action = 'register', portal = 'clinic' } = request.data || {};
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();

    const formatRole = (r?: string): string => {
      if (!r) return "User";
      switch (r) {
        case "patient": return "Patient";
        case "patient_attendant": return "Patient Attendant";
        case "clinic_admin": return "Clinic Administrator";
        case "clinic_doctor":
        case "doctor": return "Clinic Doctor";
        case "clinic_staff":
        case "staff": return "Clinic Staff";
        case "company_admin":
        case "admin": return "VIITSA System Admin";
        case "company_manager": return "VIITSA Operations Manager";
        case "company_staff": return "VIITSA Support Staff";
        default: return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }
    };

    const CLINIC_ROLES = ["clinic_admin", "clinic_doctor", "clinic_staff", "doctor", "staff"];
    const PATIENT_ROLES = ["patient", "patient_attendant"];
    const ADMIN_ROLES = ["company_admin", "company_manager", "company_staff", "admin"];

    let phoneConflict: { exists: boolean; role?: string; roleLabel?: string; email?: string } = { exists: false };
    let emailConflict: { exists: boolean; role?: string; roleLabel?: string; phone?: string } = { exists: false };

    const clean10 = phone ? String(phone).replace(/\D/g, '').slice(-10) : "";
    const cleanMail = email ? String(email).trim().toLowerCase() : "";

    // 1. Check Phone
    if (clean10.length === 10) {
      const intlPhone = '+91' + clean10;

      // A. Check Firestore users
      const userByPhone1 = await db.collection("users").where("phone", "==", clean10).limit(1).get();
      const userByPhone2 = userByPhone1.empty ? await db.collection("users").where("phone", "==", intlPhone).limit(1).get() : userByPhone1;

      if (!userByPhone2.empty) {
        const uData = userByPhone2.docs[0].data();
        const r = uData.role || "patient";
        phoneConflict = {
          exists: true,
          role: r,
          roleLabel: formatRole(r),
          email: uData.email || undefined,
        };
      } else {
        // B. Check patient_accounts
        const pAccByPhone = await db.collection("patient_accounts").where("phone", "==", clean10).limit(1).get();
        if (!pAccByPhone.empty) {
          phoneConflict = {
            exists: true,
            role: "patient",
            roleLabel: "Patient",
            email: pAccByPhone.docs[0].data()?.email || undefined,
          };
        } else {
          // C. Check Firebase Auth by Phone
          try {
            const authUser = await admin.auth().getUserByPhoneNumber(intlPhone);
            const claims = authUser.customClaims || {};
            const r = (claims.role as string) || "patient";
            phoneConflict = {
              exists: true,
              role: r,
              roleLabel: formatRole(r),
              email: authUser.email || undefined,
            };
          } catch {
            try {
              const authUser = await admin.auth().getUser('phone_' + clean10);
              const claims = authUser.customClaims || {};
              const r = (claims.role as string) || "patient";
              phoneConflict = {
                exists: true,
                role: r,
                roleLabel: formatRole(r),
                email: authUser.email || undefined,
              };
            } catch {
              // Not registered
            }
          }
        }
      }
    }

    // 2. Check Email
    if (cleanMail && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanMail)) {
      // A. Check Firestore users
      const userByEmail = await db.collection("users").where("email", "==", cleanMail).limit(1).get();
      if (!userByEmail.empty) {
        const uData = userByEmail.docs[0].data();
        const r = uData.role || "clinic_admin";
        emailConflict = {
          exists: true,
          role: r,
          roleLabel: formatRole(r),
          phone: uData.phone || undefined,
        };
      } else {
        // B. Check patient_accounts
        const pAccByEmail = await db.collection("patient_accounts").where("email", "==", cleanMail).limit(1).get();
        if (!pAccByEmail.empty) {
          emailConflict = {
            exists: true,
            role: "patient",
            roleLabel: "Patient",
            phone: pAccByEmail.docs[0].data()?.phone || undefined,
          };
        } else {
          // C. Check Firebase Auth by Email
          try {
            await admin.auth().getUserByEmail(cleanMail);
            emailConflict = {
              exists: true,
              role: "user",
              roleLabel: "User",
            };
          } catch {
            // Not registered
          }
        }
      }
    }

    // 3. Resolve permissions / conflicts based on action and portal
    let allowed = true;
    let hasConflict = false;
    let conflictMessage = "";

    // ─── LOGIN FLOW ───
    if (action === 'login') {
      if (portal === 'clinic') {
        // If checking phone login:
        if (clean10) {
          if (phoneConflict.exists) {
            if (PATIENT_ROLES.includes(phoneConflict.role || '')) {
              allowed = false;
              hasConflict = true;
              conflictMessage = `This mobile number (+91 ${clean10}) is registered for a Patient account. You cannot sign in to the Clinic Portal with a Patient account. Please sign in via the Patient Portal (/login).`;
            } else if (ADMIN_ROLES.includes(phoneConflict.role || '')) {
              allowed = false;
              hasConflict = true;
              conflictMessage = `This mobile number (+91 ${clean10}) is registered for a System Admin account. Please sign in via the Admin Portal (/admin/login).`;
            } else if (CLINIC_ROLES.includes(phoneConflict.role || '')) {
              allowed = true;
              hasConflict = false;
            } else {
              allowed = false;
              hasConflict = true;
              conflictMessage = `This mobile number (+91 ${clean10}) is registered for a ${phoneConflict.roleLabel} account. You cannot sign in to the Clinic Portal with this account.`;
            }
          } else {
            // Phone is not registered in clinic
            allowed = false;
            hasConflict = true;
            conflictMessage = `No clinic account found for mobile number (+91 ${clean10}). If you are a new clinic, please select the "Create Account" tab to register.`;
          }
        } else if (cleanMail) {
          // If checking email login:
          if (emailConflict.exists) {
            if (PATIENT_ROLES.includes(emailConflict.role || '')) {
              allowed = false;
              hasConflict = true;
              conflictMessage = `This email (${cleanMail}) is registered for a Patient account. You cannot sign in to the Clinic Portal with a Patient account. Please sign in via the Patient Portal (/login).`;
            } else if (ADMIN_ROLES.includes(emailConflict.role || '')) {
              allowed = false;
              hasConflict = true;
              conflictMessage = `This email (${cleanMail}) is registered for a System Admin account. Please sign in via the Admin Portal (/admin/login).`;
            } else if (CLINIC_ROLES.includes(emailConflict.role || '')) {
              allowed = true;
              hasConflict = false;
            } else {
              allowed = false;
              hasConflict = true;
              conflictMessage = `This email (${cleanMail}) is registered for a ${emailConflict.roleLabel} account. You cannot sign in to the Clinic Portal with this account.`;
            }
          } else {
            // Email not registered
            allowed = false;
            hasConflict = true;
            conflictMessage = `No clinic account found for email (${cleanMail}). If you are a new clinic, please select the "Create Account" tab to register.`;
          }
        }
      } else if (portal === 'patient') {
        if (clean10 && phoneConflict.exists) {
          if (CLINIC_ROLES.includes(phoneConflict.role || '')) {
            allowed = false;
            hasConflict = true;
            conflictMessage = `This mobile number (+91 ${clean10}) is registered for a Clinic account (${phoneConflict.roleLabel}). Please sign in via the Clinic Portal (/clinic/login).`;
          } else if (ADMIN_ROLES.includes(phoneConflict.role || '')) {
            allowed = false;
            hasConflict = true;
            conflictMessage = `This mobile number (+91 ${clean10}) is registered for a System Admin account. Please sign in via the Admin Portal (/admin/login).`;
          }
        }
      } else if (portal === 'admin') {
        const currentRole = phoneConflict.role || emailConflict.role;
        if (currentRole && !ADMIN_ROLES.includes(currentRole)) {
          allowed = false;
          hasConflict = true;
          conflictMessage = `This account is registered as a ${phoneConflict.roleLabel || emailConflict.roleLabel} and does not have administrative access.`;
        }
      }
    } else {
      // ─── REGISTER FLOW ───
      if (phoneConflict.exists && emailConflict.exists) {
        allowed = false;
        hasConflict = true;
        if (phoneConflict.role === emailConflict.role) {
          if (PATIENT_ROLES.includes(phoneConflict.role || '')) {
            conflictMessage = `This mobile number (+91 ${clean10}) and email (${cleanMail}) are already registered for a Patient account. You cannot create a clinic account with patient credentials. Please sign in via the Patient Portal (/login).`;
          } else if (CLINIC_ROLES.includes(phoneConflict.role || '')) {
            conflictMessage = `This mobile number (+91 ${clean10}) and email (${cleanMail}) are already registered for a Clinic account. Please switch to the "Sign In" tab to access your account.`;
          } else {
            conflictMessage = `This mobile number (+91 ${clean10}) and email (${cleanMail}) are already registered for a ${phoneConflict.roleLabel} account. Please sign in instead.`;
          }
        } else {
          conflictMessage = `This mobile number (+91 ${clean10}) is registered for a ${phoneConflict.roleLabel} account, and this email (${cleanMail}) is registered for a ${emailConflict.roleLabel} account.`;
        }
      } else if (emailConflict.exists && !phoneConflict.exists) {
        allowed = false;
        hasConflict = true;
        if (PATIENT_ROLES.includes(emailConflict.role || '')) {
          conflictMessage = `This email (${cleanMail}) is already registered for a Patient account. You cannot create a clinic account with a patient email. Please sign in via the Patient Portal (/login) or use a different email address.`;
        } else if (CLINIC_ROLES.includes(emailConflict.role || '')) {
          conflictMessage = `This email (${cleanMail}) is already registered for a Clinic account. Please switch to the "Sign In" tab to access your account.`;
        } else {
          conflictMessage = `This email (${cleanMail}) is already registered for a ${emailConflict.roleLabel} account, but this mobile number is not registered. Please sign in with this email or use a different email address.`;
        }
      } else if (phoneConflict.exists && !emailConflict.exists) {
        allowed = false;
        hasConflict = true;
        if (PATIENT_ROLES.includes(phoneConflict.role || '')) {
          conflictMessage = `This mobile number (+91 ${clean10}) is already registered for a Patient account. You cannot create a clinic account with a patient mobile number. Please sign in via the Patient Portal (/login) or use a different mobile number.`;
        } else if (CLINIC_ROLES.includes(phoneConflict.role || '')) {
          conflictMessage = `This mobile number (+91 ${clean10}) is already registered for a Clinic account (${phoneConflict.roleLabel}). Please switch to the "Sign In" tab to access your account.`;
        } else {
          conflictMessage = `This mobile number (+91 ${clean10}) is already registered for a ${phoneConflict.roleLabel} account, but this email address is not registered. Please sign in with this mobile number or use a different number.`;
        }
      }
    }

    return {
      allowed,
      hasConflict,
      conflictMessage,
      phoneConflict,
      emailConflict,
    };
  }
);


// ============================================================================
// FIRESTORE TRIGGER: On Appointment Created
// ============================================================================
export const onAppointmentCreated = onDocumentCreated(
  {
    document: "appointments/{appointmentId}",
    region: "asia-south1",
    memory: "256MiB",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    if (data.status === 'cancelled') return;

    const clinicId = data.clinic_id;
    const patientId = data.patient_id;
    const doctorId = data.doctor_id;

    if (!clinicId || !patientId) return;

    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();

    const apptId = event.params.appointmentId;
    if (data.whatsapp_confirmed_sent_at) {
      console.log(`[onAppointmentCreated] Suppressed duplicate confirmation WhatsApp for appointment ${apptId} (already flagged)`);
      return;
    }

    // Distributed idempotency lock per appointment ID (Atomic create prevents concurrent duplicate execution)
    const apptLockRef = db.collection("whatsapp_dispatch_locks").doc(`appt_${apptId}_confirm`);
    try {
      await apptLockRef.create({
        appointment_id: apptId,
        dispatched_at_ms: Date.now(),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (_lockErr) {
      console.log(`[onAppointmentCreated] Suppressed duplicate confirmation WhatsApp for appointment ${apptId} (lock already acquired)`);
      return;
    }

    // 1. Fetch clinic
    const clinicDoc = await db.collection("clinics").doc(clinicId).get();
    const clinic = clinicDoc.data() || {};
    if (clinic.whatsapp_reminders_enabled === false) {
      console.log(`[onAppointmentCreated] WhatsApp disabled for clinic ${clinicId}`);
      return;
    }

    // 2. Fetch patient details with multi-tier fallback
    let patientPhone = data.patient_phone || data.phone;
    let patientName = data.patient_name;

    if (!patientPhone || !patientName) {
      // Tier A: Check patients/{patientId}
      const patientDoc = await db.collection("patients").doc(patientId).get();
      if (patientDoc.exists) {
        const pData = patientDoc.data() || {};
        patientPhone = patientPhone || pData.phone;
        patientName = patientName || pData.name || pData.full_name;
      }
      
      // Tier B: Check patient_accounts collection (using account_id or patientId)
      if (!patientPhone || !patientName) {
        const accId = data.account_id || patientId;
        const accDoc = await db.collection("patient_accounts").doc(accId).get();
        if (accDoc.exists) {
          const accData = accDoc.data() || {};
          patientPhone = patientPhone || accData.phone;
          patientName = patientName || accData.name || accData.full_name;
        }
      }

      // Tier C: Check users collection
      if (!patientPhone || !patientName) {
        const userDoc = await db.collection("users").doc(patientId).get();
        if (userDoc.exists) {
          const uData = userDoc.data() || {};
          patientPhone = patientPhone || uData.phone;
          patientName = patientName || uData.name || uData.display_name;
        }
      }
    }

    if (!patientPhone) {
      console.log(`[onAppointmentCreated] No phone found for patient ${patientId}`);
      return;
    }

    // 3. Fetch doctor
    let doctorName = 'Doctor';
    if (doctorId) {
      const docUser = await db.collection("users").doc(doctorId).get();
      if (docUser.exists) {
        doctorName = docUser.data()?.name || docUser.data()?.display_name || 'Doctor';
      }
    }

    const finalPatientName = patientName || 'Patient';
    const clinicName = clinic.name || 'Clinic';
    const clinicPhone = clinic.phone || '+91 73961 11081';

    // Determine template type
    let confirmType: 'online' | 'followup' | 'report' | 'walkin' | 'new_visit' = 'new_visit';
    const vType = (data.visit_type || data.type || '').toLowerCase();
    const reasonLower = (data.reason || '').toLowerCase();

    if (vType.includes('follow') || vType === 'followup' || vType === 'follow-up' || reasonLower.includes('followup') || reasonLower.includes('follow-up')) {
      confirmType = 'followup';
    } else if (vType.includes('report') || vType === 'diagnostic' || vType.includes('review') || reasonLower.includes('report review') || reasonLower.includes('diagnostic report')) {
      confirmType = 'report';
    } else if (data.booked_via === 'patient_app' || data.online_booking === true || vType.includes('online')) {
      confirmType = 'online';
    } else if (vType.includes('walkin') || vType.includes('walk-in') || data.is_walkin === true) {
      confirmType = 'walkin';
    } else {
      confirmType = 'new_visit';
    }

    const tokenOrQueue = data.display_token || (data.token_number ? `Token ${data.token_number}` : 'Slot 1');

    console.log(`[onAppointmentCreated] Sending WhatsApp confirmation (${confirmType}) to ${patientPhone}`);
    await sendAppointmentConfirmation({
      to: patientPhone,
      clinicId,
      type: confirmType,
      patientName: finalPatientName,
      doctorName,
      clinicName,
      date: formatDisplayDate(data.date),
      timeOrSlot: data.time_slot || 'Scheduled slot',
      tokenOrQueue,
      visitType: data.visit_type || (confirmType === 'online' ? 'Online Consultation' : 'In-person Consultation'),
      clinicPhone,
    });
  }
);

// ============================================================================
// FIRESTORE TRIGGER: On Lab Report Created
// ============================================================================
export const onLabReportCreated = onDocumentCreated(
  {
    document: "health_reports/{reportId}",
    region: "asia-south1",
    memory: "256MiB",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const clinicId = data.clinic_id;
    const patientId = data.patient_id;
    if (!clinicId || !patientId) return;

    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();

    const reportId = event.params.reportId;
    if (data.whatsapp_sent_at) {
      console.log(`[onLabReportCreated] Suppressed duplicate lab report WhatsApp for report ${reportId} (already flagged)`);
      return;
    }

    const labLockRef = db.collection("whatsapp_dispatch_locks").doc(`lab_${reportId}_ready`);
    try {
      await labLockRef.create({
        report_id: reportId,
        dispatched_at_ms: Date.now(),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (_lockErr) {
      console.log(`[onLabReportCreated] Suppressed duplicate lab report WhatsApp for report ${reportId} (lock already acquired)`);
      return;
    }

    // 1. Fetch clinic
    const clinicDoc = await db.collection("clinics").doc(clinicId).get();
    const clinic = clinicDoc.data() || {};
    if (clinic.whatsapp_reminders_enabled === false) return;

    // 2. Fetch patient
    let patientPhone = data.patient_phone || data.phone;
    let patientName = data.patient_name;

    if (!patientPhone || !patientName) {
      const patientDoc = await db.collection("patients").doc(patientId).get();
      if (patientDoc.exists) {
        const p = patientDoc.data() || {};
        patientPhone = patientPhone || p.phone;
        patientName = patientName || p.name || p.full_name;
      }
      if (!patientPhone) {
        const accDoc = await db.collection("patient_accounts").doc(patientId).get();
        if (accDoc.exists) {
          const acc = accDoc.data() || {};
          patientPhone = patientPhone || acc.phone;
          patientName = patientName || acc.name;
        }
      }
    }

    if (!patientPhone) return;

    let doctorName = data.doctor_name || data.prescribed_by;

    // 1. If doctorName is missing or generic "Doctor", check data.doctor_id in users
    if (!doctorName || doctorName.toLowerCase() === 'doctor' || doctorName.toLowerCase() === 'dr. doctor') {
      if (data.doctor_id) {
        try {
          const docUser = await db.collection("users").doc(data.doctor_id).get();
          if (docUser.exists) {
            doctorName = docUser.data()?.name || docUser.data()?.full_name;
          }
        } catch (e) {
          console.warn('[onLabReportCreated] error getting doctor by id:', e);
        }
      }
    }

    // 2. Check data.hospital_or_doctor if not clinic name
    if (!doctorName || doctorName.toLowerCase() === 'doctor' || doctorName.toLowerCase() === 'dr. doctor') {
      if (data.hospital_or_doctor && !data.hospital_or_doctor.toLowerCase().includes('clinic')) {
        doctorName = data.hospital_or_doctor;
      }
    }

    // 3. Check the patient document for assigned doctor
    if (!doctorName || doctorName.toLowerCase() === 'doctor' || doctorName.toLowerCase() === 'dr. doctor') {
      try {
        const pDoc = await db.collection("patients").doc(patientId).get();
        if (pDoc.exists) {
          const pData = pDoc.data() || {};
          doctorName = pData.doctor_name || pData.prescribed_by;
          if (!doctorName && pData.doctor_id) {
            const docUser = await db.collection("users").doc(pData.doctor_id).get();
            if (docUser.exists) {
              doctorName = docUser.data()?.name || docUser.data()?.full_name;
            }
          }
        }
      } catch (e) {
        console.warn('[onLabReportCreated] error checking patient doctor:', e);
      }
    }

    // 4. Query clinic users for doctor (e.g. Dr. Pavan)
    if (!doctorName || doctorName.toLowerCase() === 'doctor' || doctorName.toLowerCase() === 'dr. doctor') {
      try {
        const clinicDocSnap = await db.collection("users")
          .where("clinic_id", "==", clinicId)
          .where("role", "in", ["clinic_doctor", "doctor", "clinic_admin"])
          .limit(5)
          .get();
        if (!clinicDocSnap.empty) {
          const foundDoc = clinicDocSnap.docs.find((d: any) => {
            const n = (d.data()?.name || '').toLowerCase();
            return n && n !== 'doctor' && n !== 'admin' && n !== 'clinic';
          });
          if (foundDoc) {
            doctorName = foundDoc.data()?.name;
          } else {
            doctorName = clinicDocSnap.docs[0].data()?.name;
          }
        }
      } catch (e) {
        console.warn('[onLabReportCreated] error checking clinic users for doctor:', e);
      }
    }

    if (!doctorName || doctorName.toLowerCase() === 'doctor' || doctorName.toLowerCase() === 'dr. doctor') {
      doctorName = clinic.doctor_name || 'Treating Doctor';
    }

    const testName = data.title || data.test_name || data.report_type || data.name || 'Diagnostic Lab Report';
    const reportDate = formatDisplayDate(data.report_date || data.date || data.created_at);
    const formattedPatientName = formatProperName(patientName);

    console.log(`[onLabReportCreated] Sending WhatsApp lab report notification to ${patientPhone} (Patient: ${formattedPatientName}, Doctor: ${doctorName})`);
    await sendPatientLabReportReady({
      to: patientPhone,
      clinicId,
      patientName: formattedPatientName,
      clinicName: clinic.name || 'Clinic',
      testName,
      doctorName,
      reportDate,
      clinicPhone: clinic.phone || '+91 73961 11081',
    });
  }
);

// ============================================================================
// FIRESTORE TRIGGER: On Clinic Verification Status Changed
// ============================================================================
export const onClinicVerificationStatusChanged = onDocumentUpdated(
  {
    document: "clinics/{clinicId}",
    region: "asia-south1",
    memory: "256MiB",
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) return;

    const beforeStatus = beforeData.verification_status || beforeData.status;
    const afterStatus = afterData.verification_status || afterData.status;

    let clinicPhone = afterData.phone || afterData.contact_phone;
    if (!clinicPhone && (afterData.owner_user_id || afterData.admin_user_id)) {
      try {
        if (!admin.apps.length) admin.initializeApp();
        const uSnap = await admin.firestore().collection("users").doc(afterData.owner_user_id || afterData.admin_user_id).get();
        if (uSnap.exists) {
          clinicPhone = uSnap.data()?.phone;
        }
      } catch (uErr) {
        console.warn('Fallback read user phone warning in onClinicVerificationStatusChanged:', uErr);
      }
    }
    if (!clinicPhone) return;

    const clinicName = afterData.name || 'Clinic Partner';
    const adminName = afterData.owner_name || afterData.admin_name || 'Clinic Administrator';
    const clinicId = event.params.clinicId || afterData.id_number || afterData.clinic_code || 'CLINIC';

    // 1. Clinic submitted documents -> pending approval confirmation
    if (afterData.documents_uploaded === true && beforeData.documents_uploaded !== true) {
      const pendingLockRef = admin.firestore().collection("whatsapp_dispatch_locks").doc(`clinic_pending_${clinicId}`);
      try {
        await pendingLockRef.create({
          clinic_id: clinicId,
          dispatched_at_ms: Date.now(),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (_lockErr) {
        console.log(`[onClinicVerification] Suppressed duplicate pending approval notice for clinic ${clinicId}`);
        return;
      }

      console.log(`[onClinicVerification] Sending WhatsApp pending approval notice to ${clinicPhone}`);
      await sendClinicPendingApproval({
        to: clinicPhone,
        adminName,
        clinicName,
        clinicId,
        submissionDate: formatDisplayDate(new Date()),
      });
      return;
    }

    if (beforeStatus === afterStatus) return;

    // Distributed idempotency lock for clinic verification decisions
    const verifLockRef = admin.firestore().collection("whatsapp_dispatch_locks").doc(`clinic_verif_${clinicId}_${afterStatus}`);
    try {
      await verifLockRef.create({
        clinic_id: clinicId,
        status: afterStatus,
        dispatched_at_ms: Date.now(),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (_lockErr) {
      console.log(`[onClinicVerification] Suppressed duplicate verification notice for clinic ${clinicId} (${afterStatus})`);
      return;
    }

    // 2. Clinic approved
    if (afterStatus === 'verified' || afterStatus === 'approved') {
      console.log(`[onClinicVerification] Sending WhatsApp approval notice to ${clinicPhone}`);
      await sendClinicVerificationApproved({
        to: clinicPhone,
        adminName,
        clinicName,
        clinicId,
        approvedDate: formatDisplayDate(new Date()),
      });
    } 
    // 3. Clinic rejected
    else if (afterStatus === 'rejected') {
      console.log(`[onClinicVerification] Sending WhatsApp rejection notice to ${clinicPhone}`);
      await sendClinicVerificationRejected({
        to: clinicPhone,
        adminName,
        clinicName,
        reason: afterData.rejection_reason || 'Incomplete registration documents',
      });
    }
    // 4. Additional docs requested
    else if (afterStatus === 'docs_needed' || afterStatus === 'additional_docs_required') {
      console.log(`[onClinicVerification] Sending WhatsApp docs needed notice to ${clinicPhone}`);
      await sendClinicDocsNeeded({
        to: clinicPhone,
        adminName,
        clinicName,
        missingDocs: afterData.missing_documents || 'Clinical Registration & Doctor Certificates',
        deadline: formatDisplayDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      });
    }
  }
);

// ============================================================================
// FIRESTORE TRIGGER: On Clinic Subscription Status Changed
// Automatically dispatches WhatsApp template whenever subscription status updates in DB
// ============================================================================
export const onClinicSubscriptionStatusChanged = onDocumentUpdated(
  {
    document: "clinics/{clinicId}",
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) return;

    const beforeStatus = beforeData.subscription_status;
    const afterStatus = afterData.subscription_status;

    // Detect if this is a genuine new trial activation (status became trial OR trial mandate newly authorized)
    const isNewTrialActivation = (
      (afterStatus === 'trial' && beforeStatus !== 'trial') ||
      (afterStatus === 'trial' && Boolean(afterData.trial_activated) && !beforeData.trial_activated)
    );

    // Detect if this is a paid plan purchase, plan upgrade, or renewal payment
    const isNewPaymentOrPlanChange = (
      afterStatus === 'active' && (
        beforeStatus !== 'active' ||
        afterData.subscription_plan !== beforeData.subscription_plan ||
        (afterData.last_payment_id && afterData.last_payment_id !== beforeData.last_payment_id)
      )
    );

    if (beforeStatus === afterStatus && !isNewTrialActivation && !isNewPaymentOrPlanChange) return;

    // Skip WhatsApp if this was an admin override (AdminLiveSubscriptions already dispatches admin-specific template)
    const lastAdminOverrideAt = afterData.last_admin_override_at ? new Date(afterData.last_admin_override_at).getTime() : 0;
    const isAdminOverride = (Date.now() - lastAdminOverrideAt) < (2 * 60 * 1000);

    // Skip WhatsApp if this was a scheduled plan change resolving (WhatsApp was already sent when user scheduled the change)
    const lastScheduleResolvedAt = afterData.last_schedule_resolved_at ? new Date(afterData.last_schedule_resolved_at).getTime() : 0;
    const isScheduleResolution = (Date.now() - lastScheduleResolvedAt) < (2 * 60 * 1000);

    if ((isAdminOverride || isScheduleResolution) && !isNewTrialActivation) {
      console.log(`[onClinicSubscription] Skipping generic WhatsApp — ${isAdminOverride ? 'admin override' : 'scheduled plan change resolution'} already handled.`);
      return;
    }

    let clinicPhone = afterData.phone || afterData.contact_phone;
    if (!clinicPhone && (afterData.owner_user_id || afterData.admin_user_id)) {
      try {
        if (!admin.apps.length) admin.initializeApp();
        const uSnap = await admin.firestore().collection("users").doc(afterData.owner_user_id || afterData.admin_user_id).get();
        if (uSnap.exists) {
          clinicPhone = uSnap.data()?.phone;
        }
      } catch (uErr) {
        console.warn('Fallback read user phone warning in onClinicSubscriptionStatusChanged:', uErr);
      }
    }
    if (!clinicPhone) return;

    const clinicName = afterData.name || 'Clinic Partner';
    const adminName = afterData.owner_name || afterData.admin_name || 'Clinic Administrator';
    const clinicId = event.params.clinicId || afterData.clinic_id || 'CLINIC';
    const tier = afterData.subscription_plan || 'clinic';
    const cycle = afterData.subscription_billing_cycle || 'monthly';
    const now = Date.now();

    // Distributed idempotency lock per subscription status change event
    const paymentOrPlanMarker = isNewPaymentOrPlanChange
      ? (afterData.last_payment_id || afterData.subscription_plan || now)
      : isNewTrialActivation
        ? 'trial_init'
        : (afterData.subscription_activated_at || now);
    const subLockKey = `clinic_sub_${clinicId}_${afterStatus}_${paymentOrPlanMarker}`;
    const subLockRef = admin.firestore().collection("whatsapp_dispatch_locks").doc(subLockKey);
    try {
      await subLockRef.create({
        clinic_id: clinicId,
        status: afterStatus,
        dispatched_at_ms: now,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (_lockErr) {
      console.log(`[onClinicSubscription] Suppressed duplicate subscription WhatsApp for clinic ${clinicId} (${afterStatus})`);
      return;
    }

    // 1. Trial Activated (status became 'trial' OR trial mandate was newly activated)
    if (isNewTrialActivation) {
      console.log(`[onClinicSubscription] Dispatching viitsa_clinic_trial_activated to ${clinicPhone}`);
      await sendClinicTrialActivated({
        to: clinicPhone,
        adminName,
        clinicName,
        planTier: `${tier.toUpperCase()} Plan`,
        trialValidUntil: afterData.trial_ends_at 
          ? formatDisplayDate(afterData.trial_ends_at) 
          : formatDisplayDate(new Date(now + 30 * 86400000)),
        supportPhone: '+91 73961 11081',
        clinicId,
      });
    }

    // 2. Paid Subscription Activated or Plan Bought (status active with new payment / activation)
    else if (isNewPaymentOrPlanChange) {
      console.log(`[onClinicSubscription] Dispatching viitsa_clinic_sub_invoice (with PDF document) to ${clinicPhone}`);
      const planPricing: Record<string, Record<string, number>> = {
        solo: { monthly: 2999, annual: 29990 },
        clinic: { monthly: 5999, annual: 59990 },
        multispecialty: { monthly: 11999, annual: 119990 },
        test: { monthly: 1, annual: 1 },
      };
      const planAmount = planPricing[tier]?.[cycle] || (tier === 'test' ? 1 : tier === 'multispecialty' ? 11999 : tier === 'clinic' ? 5999 : 2999);
      const invNum = afterData.last_payment_id || `VIITSA-SUB-${now.toString().slice(-6)}`;
      const planDisplayName = tier === 'test' ? 'Test Plan (₹1)' : `${tier.toUpperCase()} Plan`;
      
      await sendClinicSubInvoice({
        to: clinicPhone,
        adminName,
        clinicName,
        invoiceNo: invNum,
        planName: planDisplayName,
        totalAmount: planAmount,
        invoiceDate: formatDisplayDate(new Date()),
        supportPhone: '+91 73961 11081',
        clinicId,
        customerEmail: afterData.email || '',
        customerPhone: clinicPhone,
        clinicAddress: afterData.address || '',
        cycle,
        tier,
        paymentMethod: 'Online (UPI / Card)',
        isTrial: false,
      });
    }

    // 3. Subscription Cancelled
    else if (afterStatus === 'cancelled' && beforeStatus !== 'cancelled') {
      if (beforeData.cancel_at_period_end || afterData.cancel_at_period_end) {
        console.log(`[onClinicSubscription] Skipping duplicate cancellation WhatsApp for clinic ${clinicId} (cancellation notice already dispatched upon scheduling).`);
        return;
      }
      console.log(`[onClinicSubscription] Dispatching viitsa_clinic_sub_cancelled to ${clinicPhone}`);
      await sendClinicSubCancelled({
        to: clinicPhone,
        adminName,
        clinicName,
        cancelledPlan: `${tier.toUpperCase()} Plan`,
        effectiveDate: formatDisplayDate(new Date()),
        supportPhone: '+91 73961 11081',
        clinicId,
      });
    }

    // 4. Subscription Deactivated / Halted
    else if (afterStatus === 'deactivated' && beforeStatus !== 'deactivated') {
      console.log(`[onClinicSubscription] Dispatching viitsa_clinic_sub_deactivated to ${clinicPhone}`);
      await sendClinicSubDeactivated({
        to: clinicPhone,
        adminName,
        clinicName,
        planName: `${tier.toUpperCase()} Plan`,
        deactivationDate: formatDisplayDate(new Date()),
        status: 'Deactivated - Overdue',
        supportPhone: '+91 73961 11081',
        clinicId,
      });
    }
  }
);

// ============================================================================
// FIRESTORE TRIGGER: On Doctor Verification Status Changed
// ============================================================================
export const onDoctorVerificationStatusChanged = onDocumentUpdated(
  {
    document: "users/{userId}",
    region: "asia-south1",
    memory: "256MiB",
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) return;
    if (afterData.role !== 'clinic_doctor' && afterData.role !== 'doctor') return;

    const beforeActive = beforeData.active;
    const afterActive = afterData.active;
    const beforeVerif = beforeData.verification_status;
    const afterVerif = afterData.verification_status;

    if (beforeActive === afterActive && beforeVerif === afterVerif) return;

    const doctorPhone = afterData.phone;
    if (!doctorPhone) return;

    const doctorName = afterData.name || afterData.full_name || 'Doctor';
    const clinicName = afterData.clinic_name || 'Clinic';
    const councilRegNo = afterData.registration_number || afterData.council_reg_no || 'Verified';

    const docLockRef = admin.firestore().collection("whatsapp_dispatch_locks").doc(`doc_verif_${event.params.userId}_${afterVerif}_${afterActive}`);
    try {
      await docLockRef.create({
        user_id: event.params.userId,
        verif: afterVerif,
        active: afterActive,
        dispatched_at_ms: Date.now(),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (_lockErr) {
      console.log(`[onDoctorVerification] Suppressed duplicate doctor verification notice for user ${event.params.userId}`);
      return;
    }

    if ((afterActive === true && beforeActive === false) || (afterVerif === 'approved' && beforeVerif !== 'approved')) {
      console.log(`[onDoctorVerification] Sending WhatsApp doctor approved notice to ${doctorPhone}`);
      await sendDoctorVerificationApproved({
        to: doctorPhone,
        recipientName: doctorName,
        doctorName,
        clinicName,
        email: afterData.email || 'Registered Email',
        councilRegNo,
        approvalDate: formatDisplayDate(new Date()),
      });
    } else if (afterVerif === 'rejected' && beforeVerif !== 'rejected') {
      console.log(`[onDoctorVerification] Sending WhatsApp doctor rejected notice to ${doctorPhone}`);
      await sendDoctorVerificationRejected({
        to: doctorPhone,
        adminName: afterData.clinic_admin_name || 'Clinic Administrator',
        doctorName,
        clinicName,
        reason: afterData.rejection_reason || 'State Medical Council verification incomplete',
      });
    }
  }
);

// ============================================================================
// RAZORPAY ORDERS & PAYMENT VERIFICATION
// ============================================================================
export const createRazorpayOrder = onCall(async (request) => {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  });

  const { amount, currency, receipt } = request.data || {};
  
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in to create an order.");
  }
  
  if (!amount || amount < 100) {
    throw new HttpsError("invalid-argument", "Amount must be at least 100 paise.");
  }
  
  try {
    const order = await razorpay.orders.create({
      amount: amount,
      currency: currency || "INR",
      receipt: receipt || "receipt_" + Date.now()
    });
    return order;
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    throw new HttpsError("internal", "Unable to create order.");
  }
});

export const verifyRazorpayPayment = onCall(async (request) => {
  const {
    razorpay_order_id,
    razorpay_subscription_id,
    razorpay_payment_id,
    razorpay_signature,
    razorpay_payment_link_id,
    razorpay_payment_link_reference_id,
    razorpay_payment_link_status,
    clinicId,
    clinic_id,
    userId,
    user_id,
    plan,
    tier,
    cycle,
    billing_cycle,
    is_trial
  } = request.data || {};
  
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in to verify payment.");
  }
  
  if (!razorpay_payment_id || !razorpay_signature) {
    throw new HttpsError("invalid-argument", "Missing payment ID or signature.");
  }

  if (!razorpay_order_id && !razorpay_subscription_id && !razorpay_payment_link_id) {
    throw new HttpsError("invalid-argument", "Missing order ID, subscription ID, or payment link ID.");
  }
  
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!keySecret) {
    console.error("[verifyRazorpayPayment] RAZORPAY_KEY_SECRET is not configured.");
    throw new HttpsError("internal", "Payment gateway configuration error.");
  }
  
  // Verify HMAC-SHA256 signature using timingSafeEqual
  let isValidSignature = false;

  const checkSignature = (payload: string): boolean => {
    try {
      const expected = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");
      const expBuf = Buffer.from(expected, "utf-8");
      const actBuf = Buffer.from(razorpay_signature, "utf-8");
      return expBuf.length === actBuf.length && crypto.timingSafeEqual(expBuf, actBuf);
    } catch (_e) {
      return false;
    }
  };

  if (razorpay_subscription_id) {
    isValidSignature = checkSignature(`${razorpay_payment_id}|${razorpay_subscription_id}`);
  } else if (razorpay_order_id) {
    isValidSignature = checkSignature(`${razorpay_order_id}|${razorpay_payment_id}`);
  } else if (razorpay_payment_link_id) {
    const status = razorpay_payment_link_status || "paid";
    if (razorpay_payment_link_reference_id) {
      isValidSignature = checkSignature(`${razorpay_payment_link_id}|${razorpay_payment_link_reference_id}|${status}|${razorpay_payment_id}`);
    }
    if (!isValidSignature) {
      isValidSignature = checkSignature(`${razorpay_payment_link_id}|${status}|${razorpay_payment_id}`);
    }
    if (!isValidSignature) {
      isValidSignature = checkSignature(`${razorpay_payment_link_id}|${razorpay_payment_id}`);
    }
  }

  if (!isValidSignature) {
    console.warn("[verifyRazorpayPayment] Cryptographic signature mismatch for payment:", razorpay_payment_id);
    throw new HttpsError("invalid-argument", "Invalid signature.");
  }

  // Resolve target clinic and user
  let targetClinicId = clinicId || clinic_id;
  const targetUserId = userId || user_id || request.auth.uid;
  const db = admin.firestore();

  if (!targetClinicId && targetUserId) {
    const userDoc = await db.collection("users").doc(targetUserId).get();
    if (userDoc.exists) {
      targetClinicId = userDoc.data()?.clinic_id;
    }
  }

  if (!targetClinicId) {
    throw new HttpsError("invalid-argument", "Unable to resolve target clinic ID for subscription activation.");
  }

  // Caller tenant authorization check
  if (request.auth.uid !== targetUserId) {
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    const callerData = callerDoc.data() || {};
    if (callerData.clinic_id !== targetClinicId && callerData.role !== "superadmin") {
      throw new HttpsError("permission-denied", "Unauthorized to activate subscription for this clinic.");
    }
  }

  // Calculate plan details and period end
  const activePlan = (plan || tier || "clinic").toLowerCase();
  const activeCycle = (billing_cycle || cycle || "monthly").toLowerCase();
  const isTrial = Boolean(is_trial);
  const durationDays = isTrial ? 30 : activeCycle === "annual" ? 365 : 30;
  const now = new Date();
  const nowIso = now.toISOString();
  const periodEndIso = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  // Perform genuine server-side activation in clinics/{clinicId}
  const clinicUpdates: Record<string, any> = {
    subscription_status: isTrial ? "trial" : "active",
    subscription_plan: activePlan,
    subscription_billing_cycle: activeCycle,
    plan: activePlan,
    billing_cycle: activeCycle,
    subscription_id: razorpay_subscription_id || null,
    razorpay_subscription_id: razorpay_subscription_id || null,
    razorpay_order_id: razorpay_order_id || null,
    last_payment_id: razorpay_payment_id,
    last_payment_status: "paid",
    subscription_activated_at: nowIso,
    subscription_period_end: periodEndIso,
    subscription_updated_at: nowIso,
    cancel_at_period_end: false,
    cancel_effective_date: null,
    change_scheduled: false,
    scheduled_plan: null,
    scheduled_billing_cycle: null,
    scheduled_effective_date: null,
    scheduled_change_type: null,
    subscription_auto_renew: true,
    updated_at: nowIso,
  };

  if (isTrial) {
    clinicUpdates.trial_used = true;
    clinicUpdates.has_used_trial = true;
    clinicUpdates.trial_activated = true;
    clinicUpdates.trial_completed = false;
    clinicUpdates.trial_status = "active_trial";
    clinicUpdates.trial_started_at = nowIso;
    clinicUpdates.trial_ends_at = periodEndIso;
  }

  await db.collection("clinics").doc(targetClinicId).set(clinicUpdates, { merge: true });

  // Update users/{userId} if resolved
  if (targetUserId) {
    const userUpdates: Record<string, any> = {
      clinic_subscription_status: isTrial ? "trial" : "active",
      subscription_plan: activePlan,
      subscription_billing_cycle: activeCycle,
      plan: activePlan,
      billing_cycle: activeCycle,
      updated_at: nowIso,
    };
    if (isTrial) {
      userUpdates.trial_used = true;
      userUpdates.has_used_trial = true;
      userUpdates.trial_completed = false;
      userUpdates.trial_ends_at = periodEndIso;
    }
    await db.collection("users").doc(targetUserId).set(userUpdates, { merge: true });
  }

  // Record in subscriptions collection for persistent billing audit trail
  await db.collection("subscriptions").add({
    clinic_id: targetClinicId,
    user_id: targetUserId || null,
    tier: activePlan,
    plan_name: isTrial ? `${activePlan.toUpperCase()} Plan (30-Day Free Trial)` : `${activePlan.toUpperCase()} Plan`,
    billing_cycle: activeCycle,
    status: isTrial ? "trial" : "active",
    is_trial: isTrial,
    trial_ends_at: isTrial ? periodEndIso : null,
    payment_id: razorpay_payment_id,
    order_id: razorpay_order_id || null,
    subscription_id: razorpay_subscription_id || null,
    payment_status: "paid",
    verified_server_side: true,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[verifyRazorpayPayment] Successfully verified payment ${razorpay_payment_id} and activated clinic ${targetClinicId} (${activePlan}/${activeCycle}).`);

  return {
    success: true,
    clinicId: targetClinicId,
    userId: targetUserId,
    status: isTrial ? "trial" : "active",
    plan: activePlan,
    billing_cycle: activeCycle,
    subscription_period_end: periodEndIso,
  };
});


