import { httpsCallable } from 'firebase/functions';
import { getDoc, doc } from 'firebase/firestore';
import { functions, db } from './firebase';
import { formatDate } from './format';

export interface SendEmailParams {
  to: string;
  template: "clinic_pending" | "clinic_approved" | "clinic_rejected" | "appointment_confirmed" | "appointment_cancelled" | "appointment_rescheduled" | "prescription" | "invoice" | "generic";
  subject?: string;
  data?: any;
  attachments?: Array<{
    filename: string;
    content: string; // base64 string
    contentType?: string;
  }>;
}

export function wrapEmailShell(content: string, options?: { subtitle?: string; title?: string }): string {
  const currentYear = new Date().getFullYear();
  const sub = options?.subtitle || 'Official Communication';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${options?.title || 'Viitsa Healthcare'}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 36px 16px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03);">
          <!-- Brand Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #063229 0%, #0F6E56 50%, #128064 100%); padding: 28px 24px; text-align: center;">
              <div style="font-size: 22px; font-weight: 800; letter-spacing: 2.5px; color: #ffffff; text-transform: uppercase; margin: 0 0 6px 0;">VIITSA</div>
              <div style="font-size: 11px; font-weight: 600; color: #bbf7d0; letter-spacing: 1.2px; text-transform: uppercase;">${sub}</div>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 28px 28px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                This is an official automated notification from <strong>Viitsa Healthcare</strong>.<br/>
                For support, reach out to us at <a href="mailto:support@viitsa.com" style="color: #0F6E56; font-weight: 600; text-decoration: none;">support@viitsa.com</a>
              </p>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #94a3b8;">
                © ${currentYear} Viitsa Healthcare Technologies. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildSubscriptionActivatedHtml(data: {
  clinicName: string;
  planName: string;
  cycle: string;
  isTrial?: boolean;
  trialEndsAt?: string;
  paymentId?: string;
  amount?: number | string;
}): string {
  const { clinicName, planName, cycle, isTrial, trialEndsAt, paymentId, amount } = data;
  const heading = isTrial ? '30-Day Free Trial Activated!' : 'Subscription Confirmed';
  const subtitle = isTrial ? 'Free Trial Activated' : 'Subscription Active';

  return wrapEmailShell(`
    <div style="text-align: center; margin-bottom: 22px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #ecfdf5; border: 1px solid #a7f3d0; margin-bottom: 12px;">
        <span style="font-size: 26px; line-height: 1; color: #0F6E56; font-weight: bold;">✓</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">${heading}</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0;">Clinic Subscription & Features Enabled</p>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Hello <strong>${clinicName}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      ${isTrial 
        ? `Your <strong>30-day free trial</strong> for the <strong>${planName} (${cycle})</strong> has been successfully activated. You have full access to all features.`
        : `We have successfully confirmed your subscription to the <strong>${planName} (${cycle})</strong>. Your clinic is active and synchronized in real time.`}
    </p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Subscription Plan</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${planName}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Billing Cycle</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${cycle.toUpperCase()}</td>
      </tr>
      ${isTrial && trialEndsAt ? `
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Trial Period Ends</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0F6E56; text-align: right; border-bottom: 1px solid #e2e8f0;">${trialEndsAt}</td>
      </tr>` : ''}
      ${amount !== undefined ? `
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Amount Paid</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${typeof amount === 'number' ? `₹${amount.toFixed(2)}` : amount}</td>
      </tr>` : ''}
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Payment Reference</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${paymentId || 'Autopay Mandate Active'}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b;">Status</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0F6E56; text-align: right;">${isTrial ? 'Active 30-Day Trial' : 'Active & Synced'} ✓</td>
      </tr>
    </table>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; font-size: 13px; color: #64748b; line-height: 1.5; margin: 18px 0;">
      Your clinic quotas, doctor seats, and clinical records are now fully accessible across all devices. Your official receipt has been attached to this email.
    </div>

    <div style="text-align: center; margin: 28px 0 12px 0;">
      <a href="https://viitsa.com/clinic/dashboard" target="_blank" style="display: inline-block; background-color: #0F6E56; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
        Go to Clinic Dashboard
      </a>
    </div>
  `, { subtitle, title: `${heading} | Viitsa Healthcare` });
}

export function buildSubscriptionCancelledHtml(data: {
  clinicName: string;
  planName: string;
  effectiveDate: string;
  reason?: string;
}): string {
  const { clinicName, planName, effectiveDate, reason } = data;
  return wrapEmailShell(`
    <div style="text-align: center; margin-bottom: 22px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #fef2f2; border: 1px solid #fecaca; margin-bottom: 12px;">
        <span style="font-size: 26px; line-height: 1; color: #dc2626; font-weight: bold;">✕</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Cancellation Scheduled</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0;">Full access remains active until period end</p>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Hello <strong>${clinicName}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">We have received your cancellation request for the <strong>${planName}</strong>. Auto-renewal has been turned off and no further charges will occur.</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Subscription Plan</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${planName}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Active & Accessible Until</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${effectiveDate}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Auto-Renewal Status</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #dc2626; text-align: right; border-bottom: 1px solid #e2e8f0;">Turned Off (No charges)</td>
      </tr>
      ${reason ? `
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b;">Feedback Recorded</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #475569; text-align: right;">${reason}</td>
      </tr>` : ''}
    </table>

    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 16px 0;">
      You retain complete, unrestricted access to all doctor seats and features until <strong>${effectiveDate}</strong>. If you change your mind, you can resume anytime before this date directly from your billing settings.
    </p>

    <div style="text-align: center; margin: 28px 0 12px 0;">
      <a href="https://viitsa.com/clinic/settings?tab=billing" target="_blank" style="display: inline-block; background-color: #0F6E56; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
        Manage Subscription Settings
      </a>
    </div>
  `, { subtitle: 'Subscription Update', title: `Subscription Cancellation Scheduled - ${planName}` });
}

export function buildSubscriptionPlanChangeScheduledHtml(data: {
  clinicName: string;
  currentPlan: string;
  newPlan: string;
  cycle: string;
  effectiveDate: string;
}): string {
  const { clinicName, currentPlan, newPlan, cycle, effectiveDate } = data;
  return wrapEmailShell(`
    <div style="text-align: center; margin-bottom: 22px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #eff6ff; border: 1px solid #bfdbfe; margin-bottom: 12px;">
        <span style="font-size: 26px; line-height: 1; color: #2563eb; font-weight: bold;">🔄</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Plan Change Scheduled</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0;">Takes effect at the end of your billing cycle</p>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Hello <strong>${clinicName}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">You have scheduled your clinic subscription to change to the <strong>${newPlan} (${cycle})</strong>.</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Current Active Plan</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${currentPlan} (Active)</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Upcoming New Plan</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0F6E56; text-align: right; border-bottom: 1px solid #e2e8f0;">${newPlan} (${cycle.toUpperCase()})</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b;">Effective Date</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">${effectiveDate}</td>
      </tr>
    </table>

    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 16px 0;">
      You retain complete, uninterrupted access to all doctor seats and features of your current plan until <strong>${effectiveDate}</strong>. Your new plan will activate automatically on that date.
    </p>

    <div style="text-align: center; margin: 28px 0 12px 0;">
      <a href="https://viitsa.com/clinic/settings?tab=billing" target="_blank" style="display: inline-block; background-color: #0F6E56; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
        Manage Subscription Settings
      </a>
    </div>
  `, { subtitle: 'Subscription Update', title: `Plan Change Scheduled - ${newPlan}` });
}

export function buildPasswordResetHtml(data: {
  email: string;
  resetLink: string;
  portal?: 'clinic' | 'admin' | 'patient';
}): string {
  const { email, resetLink, portal = 'clinic' } = data;
  const portalTitle = portal === 'admin' ? 'Admin Portal' : (portal === 'clinic' ? 'Clinic Portal' : 'Patient Portal');
  const greeting = portal === 'admin' ? 'Hello Administrator' : 'Hello';
  const roleName = portal === 'admin' ? 'Viitsa Administrator' : (portal === 'clinic' ? 'Viitsa Clinic' : 'Viitsa Patient');
  
  return wrapEmailShell(`
    <div style="text-align: center; margin-bottom: 22px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #f0fdfa; border: 1px solid #99f6e4; margin-bottom: 12px;">
        <span style="font-size: 26px; line-height: 1; color: #0F6E56; font-weight: bold;">🔐</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Reset Your Password</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0;">${portalTitle} Security Request</p>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">${greeting},</p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
      We received a request to reset the password for your ${roleName} account (<strong>${email}</strong>). Click the secure button below to choose a new password:
    </p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetLink}" target="_blank" style="display: inline-block; background-color: #0F6E56; color: #ffffff; padding: 14px 36px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
        Reset My Password
      </a>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 24px 0 0 0;">
      <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748b;">Direct Link Fallback:</p>
      <a href="${resetLink}" target="_blank" style="font-size: 12px; color: #0F6E56; word-break: break-all; line-height: 1.4; text-decoration: underline;">${resetLink}</a>
    </div>

    <div style="margin-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
      This link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this email; your account remains secure and your password will not change.
    </div>
  `, { subtitle: `${portalTitle} Security`, title: `Reset Your Viitsa ${portalTitle} Password` });
}

export function buildVerificationHtml(data: {
  email: string;
  verifyLink: string;
  portal?: 'clinic' | 'patient';
  name?: string;
}): string {
  const { email, verifyLink, portal = 'clinic', name } = data;
  const isClinic = portal === 'clinic';
  const portalTitle = isClinic ? 'Clinic Portal' : 'Patient Portal';
  const greeting = name ? `Hello <strong>${name}</strong>` : (isClinic ? 'Hello <strong>Doctor / Clinic Administrator</strong>' : 'Hello <strong>Patient</strong>');
  const bodyMessage = isClinic
    ? "Thank you for registering your clinic with Viitsa Healthcare. Please click the button below to verify your email address and activate your clinic administration account."
    : "Thank you for registering with Viitsa Healthcare. Please click the button below to verify your email address and activate your patient account.";
  const buttonText = isClinic ? "Verify My Clinic Account" : "Verify My Email Address";

  return wrapEmailShell(`
    <div style="text-align: center; margin-bottom: 22px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #ecfdf5; border: 1px solid #a7f3d0; margin-bottom: 12px;">
        <span style="font-size: 26px; line-height: 1; color: #0F6E56;">✓</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Verify Your Email Address</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0;">${portalTitle} Account Activation</p>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">${greeting},</p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 22px 0;">
      ${bodyMessage}
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyLink}" target="_blank" style="display: inline-block; background-color: #0F6E56; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
        ${buttonText}
      </a>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 24px 0 0 0;">
      <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748b;">Direct link fallback:</p>
      <a href="${verifyLink}" target="_blank" style="font-size: 12px; color: #0F6E56; word-break: break-all; line-height: 1.4; text-decoration: underline;">${verifyLink}</a>
    </div>

    <div style="margin-top: 22px; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
      If you did not register for an account with Viitsa Healthcare (${email}), you can safely disregard this email.
    </div>
  `, { subtitle: `${portalTitle} Verification`, title: `Verify your Viitsa ${portalTitle} Account` });
}

export function buildClinicPendingHtml(data: {
  clinicName: string;
  clinicEmail?: string;
  phone?: string;
  address?: string;
  city?: string;
}): string {
  const { clinicName, clinicEmail = '—', phone = '—', address = '—', city = '—' } = data;
  return wrapEmailShell(`
    <div style="text-align: center; margin-bottom: 22px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #fffbeb; border: 1px solid #fde68a; margin-bottom: 12px;">
        <span style="font-size: 26px; line-height: 1;">🕒</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Verification Under Process</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0;">Clinic Registration & Compliance Review</p>
    </div>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Dear <strong>${clinicName}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">We have successfully received your clinic registration details and verification documents. Our medical compliance team is currently reviewing your application.</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Email Address</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${clinicEmail}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Phone Number</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${phone}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b;">Clinic Location</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">${address}${city ? ', ' + city : ''}</td>
      </tr>
    </table>

    <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 14px 18px; font-size: 13px; color: #92400e; line-height: 1.5; margin-top: 18px;">
      <strong>⏱ Estimated Review Window:</strong> Your application will be evaluated within <strong>24 to 48 hours</strong>. You will receive an email notification once your clinic dashboard is activated.
    </div>
  `, { subtitle: 'Clinic Verification', title: `Verification Under Process - ${clinicName}` });
}

export function buildClinicApprovedHtml(data: { clinicName: string }): string {
  const { clinicName } = data;
  return wrapEmailShell(`
    <div style="text-align: center; margin-bottom: 22px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #ecfdf5; border: 1px solid #a7f3d0; margin-bottom: 12px;">
        <span style="font-size: 26px; line-height: 1; color: #0F6E56;">✓</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Clinic Approved Successfully!</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0;">Welcome to the Viitsa Healthcare Network</p>
    </div>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Dear <strong>${clinicName}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">Congratulations! Your clinic details and verification documents have been successfully approved by the Viitsa Medical Administration team.</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Clinic Name</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${clinicName}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Verification Status</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0F6E56; text-align: right; border-bottom: 1px solid #e2e8f0;">Active & Verified ✓</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b;">Dashboard Access</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">Full Clinical Access Enabled</td>
      </tr>
    </table>

    <div style="text-align: center; margin: 28px 0 12px 0;">
      <a href="https://viitsa.com/clinic/login" target="_blank" style="display: inline-block; background-color: #0F6E56; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
        Log In to Clinic Portal
      </a>
    </div>
  `, { subtitle: 'Clinic Verification', title: `Clinic Approved - Welcome to Viitsa, ${clinicName}!` });
}

export function buildClinicRejectedHtml(data: { clinicName: string; rejectionReason?: string }): string {
  const { clinicName, rejectionReason } = data;
  return wrapEmailShell(`
    <div style="text-align: center; margin-bottom: 22px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #fef2f2; border: 1px solid #fecaca; margin-bottom: 12px;">
        <span style="font-size: 26px; line-height: 1; color: #dc2626;">✕</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Verification Update Required</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0;">Action needed on your clinic application</p>
    </div>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Dear <strong>${clinicName}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">Our medical compliance team reviewed your clinic registration application. Unfortunately, we were unable to approve your application with the current information provided.</p>

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 18px; margin: 20px 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
      <p style="margin: 0 0 6px 0; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.8px;">Reason for Rejection:</p>
      <p style="margin: 0; font-weight: 500;">${rejectionReason || 'Uploaded documentation was incomplete or unverified.'}</p>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #334155;">Please log in to your clinic portal to correct your clinic details and re-upload the valid registration documents.</p>

    <div style="text-align: center; margin: 28px 0 12px 0;">
      <a href="https://viitsa.com/clinic/login" target="_blank" style="display: inline-block; background-color: #0F6E56; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
        Review & Re-upload Documents
      </a>
    </div>
  `, { subtitle: 'Compliance Notice', title: `Verification Rejected - Action Required for ${clinicName}` });
}

export function buildAppointmentHtml(data: {
  patientName: string;
  doctorName?: string;
  clinicName: string;
  date: string;
  time?: string;
  token?: string;
  type?: 'confirmed' | 'cancelled' | 'rescheduled';
}): string {
  const { patientName, doctorName, clinicName, date, time, token, type = 'confirmed' } = data;
  const isCancelled = type === 'cancelled';
  const isRescheduled = type === 'rescheduled';
  
  let title = "Appointment Confirmed";
  let icon = "✓";
  let iconColor = "#0F6E56";
  let badgeBg = "#ecfdf5";
  let badgeBorder = "#a7f3d0";
  let msg = `Your appointment has been successfully booked with <strong>${clinicName}</strong>.`;
  
  if (isCancelled) {
    title = "Appointment Cancelled";
    icon = "✕";
    iconColor = "#dc2626";
    badgeBg = "#fef2f2";
    badgeBorder = "#fecaca";
    msg = `Your appointment with <strong>${clinicName}</strong> has been cancelled.`;
  } else if (isRescheduled) {
    title = "Appointment Rescheduled";
    icon = "🔄";
    iconColor = "#2563eb";
    badgeBg = "#eff6ff";
    badgeBorder = "#bfdbfe";
    msg = `Your appointment with <strong>${clinicName}</strong> has been rescheduled to a new date and time.`;
  }

  return wrapEmailShell(`
    <div style="text-align: center; margin-bottom: 22px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; margin-bottom: 12px;">
        <span style="font-size: 26px; line-height: 1; color: ${iconColor}; font-weight: bold;">${icon}</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">${title}</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0;">Patient Appointment Notification</p>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
      <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 6px;">Queue Token / Booking Number</div>
      <div style="font-size: 32px; font-weight: 800; color: #0F6E56; letter-spacing: 2px;">${token || '—'}</div>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Dear <strong>${patientName}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">${msg}</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Clinic</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${clinicName}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Consulting Doctor</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${doctorName || 'Available Doctor'}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Date</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${date}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b;">Time Slot</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">${time || '—'}</td>
      </tr>
    </table>

    <div style="text-align: center; margin: 28px 0 12px 0;">
      <a href="https://viitsa.com/login" target="_blank" style="display: inline-block; background-color: #0F6E56; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
        Manage Appointment in Portal
      </a>
    </div>
  `, { subtitle: 'Appointment Notification', title: `${title} - ${clinicName}` });
}

export function buildPrescriptionHtml(data: {
  patientName?: string;
  clinicName?: string;
  doctorName?: string;
  prescriptionNo?: string;
  date?: string;
  diagnosis?: string;
  pdfUrl?: string;
}): string {
  const { patientName, clinicName, doctorName, prescriptionNo, date, diagnosis, pdfUrl } = data || {};
  const loginLink = 'https://viitsa.com/login';
  return wrapEmailShell(`
    <div style="text-align: center; margin-bottom: 22px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #f0fdfa; border: 1px solid #99f6e4; margin-bottom: 12px;">
        <span style="font-size: 26px; line-height: 1;">💊</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Doctor Prescription Issued</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0;">Prescription No: <strong>${prescriptionNo || '—'}</strong></p>
    </div>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Dear <strong>${patientName || 'Patient'}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">Your official medical prescription has been prepared and issued by <strong>${clinicName || 'your clinic'}</strong>.</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Prescription No</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${prescriptionNo || '—'}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Consulting Doctor</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${doctorName || 'Doctor'}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Clinic</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${clinicName || 'Clinic'}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Issue Date</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${date || 'Today'}</td>
      </tr>
      ${diagnosis ? `
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Clinical Diagnosis</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${diagnosis}</td>
      </tr>` : ''}
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b;">Medical PDF</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0F6E56; text-align: right;">Attached to Email (PDF)</td>
      </tr>
    </table>

    <div style="text-align: center; margin: 28px 0 12px 0;">
      <a href="${loginLink}" target="_blank" style="display: inline-block; background-color: #0F6E56; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
        View Records in Patient Portal
      </a>
      ${pdfUrl ? `<div style="margin-top: 12px;"><a href="${pdfUrl}" target="_blank" style="color: #0F6E56; text-decoration: underline; font-size: 13px; font-weight: 600;">Download Prescription PDF Online</a></div>` : ''}
    </div>
  `, { subtitle: 'Medical Prescription', title: `Doctor Prescription - ${prescriptionNo || 'Rx'} | ${clinicName || 'Viitsa'}` });
}

export function buildInvoiceHtml(data: {
  patientName?: string;
  clinicName?: string;
  invoiceNo?: string;
  amount?: string | number;
  date?: string;
  pdfUrl?: string;
}): string {
  const { patientName, clinicName, invoiceNo, amount, date, pdfUrl } = data || {};
  const displayAmount = typeof amount === 'number' ? `₹${amount.toLocaleString('en-IN')}` : (amount || '₹0');
  const loginLink = 'https://viitsa.com/login';
  return wrapEmailShell(`
    <div style="text-align: center; margin-bottom: 22px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #f0f9ff; border: 1px solid #bae6fd; margin-bottom: 12px;">
        <span style="font-size: 26px; line-height: 1;">🧾</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Payment Invoice</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0;">Invoice No: <strong>${invoiceNo || '—'}</strong></p>
    </div>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Dear <strong>${patientName || 'Patient'}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">Thank you for visiting <strong>${clinicName || 'our clinic'}</strong>. Here are the billing details and statement for your visit:</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Invoice Number</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${invoiceNo || '—'}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Clinic</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${clinicName || 'Clinic'}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Date</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${date || 'Today'}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Total Amount</td>
        <td style="padding: 12px 18px; font-size: 15px; font-weight: 800; color: #0F6E56; text-align: right; border-bottom: 1px solid #e2e8f0;">${displayAmount}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b;">Official Statement</td>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0F6E56; text-align: right;">Attached to Email (PDF)</td>
      </tr>
    </table>

    <div style="text-align: center; margin: 28px 0 12px 0;">
      <a href="${loginLink}" target="_blank" style="display: inline-block; background-color: #0F6E56; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
        View Invoices in Patient Portal
      </a>
      ${pdfUrl ? `<div style="margin-top: 12px;"><a href="${pdfUrl}" target="_blank" style="color: #0F6E56; text-decoration: underline; font-size: 13px; font-weight: 600;">Download Invoice PDF Online</a></div>` : ''}
    </div>
  `, { subtitle: 'Billing & Receipt', title: `Invoice ${invoiceNo || ''} from ${clinicName || 'Viitsa'}` });
}

export function buildGenericHtml(data: { body?: string; title?: string }): string {
  return wrapEmailShell(`
    <div style="font-size: 14px; line-height: 1.6; color: #334155;">
      ${data?.body || ''}
    </div>
  `, { subtitle: data?.title || 'Notification' });
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    let subject = params.subject || 'Notification from Viitsa';
    let htmlContent = '';

    if (params.template === 'clinic_pending') {
      subject = `Verification Under Process - ${params.data?.clinicName || 'Clinic'}`;
      htmlContent = buildClinicPendingHtml(params.data);
    } else if (params.template === 'clinic_approved') {
      subject = `Clinic Approved - Welcome to Viitsa, ${params.data?.clinicName || 'Clinic'}!`;
      htmlContent = buildClinicApprovedHtml(params.data);
    } else if (params.template === 'clinic_rejected') {
      subject = `Verification Rejected - Action Required for ${params.data?.clinicName || 'Clinic'}`;
      htmlContent = buildClinicRejectedHtml(params.data);
    } else if (params.template.startsWith('appointment_')) {
      const type = params.template === 'appointment_cancelled' 
        ? 'cancelled' 
        : (params.template === 'appointment_rescheduled' ? 'rescheduled' : 'confirmed');
      const title = type === 'cancelled' ? 'Appointment Cancelled' : (type === 'rescheduled' ? 'Appointment Rescheduled' : 'Appointment Confirmed');
      subject = `${title} - ${params.data?.clinicName || 'Viitsa'}`;
      htmlContent = buildAppointmentHtml({ ...params.data, type });
    } else if (params.template === 'prescription') {
      const { prescriptionNo, clinicName } = params.data || {};
      subject = params.subject || `Doctor Prescription - ${prescriptionNo || 'Rx'} | ${clinicName || 'Viitsa'}`;
      htmlContent = buildPrescriptionHtml(params.data);
    } else if (params.template === 'invoice') {
      const { invoiceNo, clinicName } = params.data || {};
      subject = params.subject || `Invoice ${invoiceNo || ''} from ${clinicName || 'Viitsa'}`;
      htmlContent = buildInvoiceHtml(params.data);
    } else {
      htmlContent = buildGenericHtml(params.data);
    }

    const sendInstantEmail = httpsCallable(functions, 'sendInstantEmail');
    await sendInstantEmail({
      to: params.to,
      subject,
      htmlContent,
      attachments: params.attachments
    });

    return { success: true };
  } catch (error: any) {
    console.error('sendEmail Error:', error);
    return { success: false, error: error.message };
  }
}

export async function sendInstantAppointmentEmail(
  apptId: string, 
  template: "appointment_confirmed" | "appointment_cancelled" | "appointment_rescheduled"
) {
  try {
    const apptSnap = await getDoc(doc(db, 'appointments', apptId));
    if (!apptSnap.exists()) return;
    const appt = apptSnap.data();

    let patientEmail = null;
    let patientName = "Patient";

    if (appt.patient_id) {
      const pSnap = await getDoc(doc(db, 'patient_accounts', appt.patient_id));
      if (pSnap.exists()) {
        patientEmail = pSnap.data().email;
        patientName = pSnap.data().name || pSnap.data().full_name || "Patient";
      } else {
        const p2Snap = await getDoc(doc(db, 'patients', appt.patient_id));
        if (p2Snap.exists()) {
          patientEmail = p2Snap.data().email;
          patientName = p2Snap.data().name || p2Snap.data().full_name || "Patient";
        }
      }
    }

    if (!patientEmail) return;

    let doctorName = "Your Doctor";
    if (appt.doctor_id) {
      const dSnap = await getDoc(doc(db, 'users', appt.doctor_id));
      if (dSnap.exists()) doctorName = dSnap.data().name || "Your Doctor";
    }

    let clinicName = "Viitsa Clinic";
    if (appt.clinic_id) {
      const cSnap = await getDoc(doc(db, 'clinics', appt.clinic_id));
      if (cSnap.exists()) clinicName = cSnap.data().name || "Viitsa Clinic";
    }

    const dateStr = formatDate(appt.date);
    const tokenDisplay = appt.display_token || (appt.token_number ? `ON-${String(appt.token_number).padStart(3, '0')}` : '—');

    await sendEmail({
      to: patientEmail,
      template,
      data: {
        patientName,
        doctorName,
        clinicName,
        date: dateStr,
        time: appt.time_slot || '—',
        token: tokenDisplay
      }
    });

  } catch (err) {
    console.error('Error sending instant appointment email:', err);
  }
}

export async function sendVerificationNotificationEmail(
  email: string,
  displayName?: string,
  continueUrl?: string,
  portal?: 'clinic' | 'patient'
): Promise<{ success: boolean; error?: string }> {
  const isClinic = portal === 'clinic' || Boolean(continueUrl && continueUrl.includes('/clinic')) || (typeof window !== 'undefined' && window.location.pathname.startsWith('/clinic'));
  const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
    ? window.location.origin
    : 'https://viitsa.com';
  const url = continueUrl || (isClinic 
    ? `${origin}/clinic/login?verified=true`
    : `${origin}/login?verified=true`);

  // 1. Primary: Cloud Function in asia-south1 using Titan SMTP (support@viitsa.com) and branded HTML
  try {
    const sendVerifAsia = httpsCallable(functions, 'sendVerificationEmail');
    const roleName = displayName || (isClinic ? 'Doctor / Clinic Administrator' : 'Patient');
    const res: any = await sendVerifAsia({ email: email.trim().toLowerCase(), displayName: roleName, continueUrl: url, portal: isClinic ? 'clinic' : 'patient' });
    if (res?.data?.success) {
      return { success: true };
    }
  } catch (err: any) {
    console.warn('Cloud Function sendVerificationEmail error:', err);
    if (err.code === 'functions/not-found' || err.message?.includes('not-found') || err.message?.includes('No account found')) {
      return {
        success: false,
        error: 'No account found with this email address. Please check your spelling or register a new account.'
      };
    }
  }

  // 2. Secondary fallback: Firebase Authentication Client SDK
  try {
    const { auth } = await import('./firebase');
    if (auth.currentUser && auth.currentUser.email?.toLowerCase() === email.trim().toLowerCase()) {
      const { sendEmailVerification: fbSendVerif } = await import('firebase/auth');
      try {
        await fbSendVerif(auth.currentUser, { url, handleCodeInApp: true });
        return { success: true };
      } catch (urlErr: any) {
        if (urlErr.code === 'auth/unauthorized-continue-uri') {
          console.warn('sendEmailVerification with continueUrl unauthorized, sending standard verification:', urlErr);
          await fbSendVerif(auth.currentUser);
          return { success: true };
        }
        throw urlErr;
      }
    }
  } catch (clientErr: any) {
    console.warn('Firebase Auth sendEmailVerification client note:', clientErr);
  }

  return { 
    success: false, 
    error: 'Verification service is temporarily busy. Please wait a moment and try resending your verification link.' 
  };
}

export async function sendPasswordResetNotificationEmail(
  email: string,
  returnUrl?: string,
  portal?: 'clinic' | 'patient' | 'admin'
): Promise<{ success: boolean; error?: string; code?: string }> {
  const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
    ? window.location.origin
    : 'https://viitsa.com';
  const cleanEmail = email.trim().toLowerCase();
  const isClinic = portal === 'clinic' || Boolean(returnUrl && returnUrl.includes('/clinic'));
  const isAdmin = portal === 'admin' || Boolean(returnUrl && returnUrl.includes('/admin'));
  const defaultReturn = isAdmin ? '/admin/login' : (isClinic ? '/clinic/login' : '/login');
  const actualReturn = returnUrl || defaultReturn;
  const continueUrl = `${origin}/reset-password?return=${encodeURIComponent(actualReturn)}&completed=true`;

  try {
    const sendResetAsia = httpsCallable(functions, 'sendPasswordResetEmail');
    const res: any = await sendResetAsia({
      email: cleanEmail,
      returnUrl: actualReturn,
      continueUrl,
      portal: portal || (isAdmin ? 'admin' : (isClinic ? 'clinic' : 'patient')),
    });
    if (res?.data?.success) {
      return { success: true };
    }
  } catch (fnErr: any) {
    console.warn('Cloud Function sendPasswordResetEmail note:', fnErr);
    const code = fnErr.code || '';
    const msg = fnErr.message || '';
    if (code === 'functions/not-found' || msg.includes('No account found') || msg.includes('not-found')) {
      return {
        success: false,
        error: 'No account found with this email address. Please check your spelling or register a new account.',
        code: 'auth/user-not-found'
      };
    }
    if (code === 'functions/invalid-argument' || msg.includes('invalid-argument') || msg.includes('Missing required')) {
      return {
        success: false,
        error: 'Please enter a valid email address.',
        code: 'auth/invalid-email'
      };
    }
    return {
      success: false,
      error: msg || 'Failed to send password reset email. Please try again.',
      code: code
    };
  }

  return {
    success: false,
    error: 'Failed to send password reset email. Please try again.'
  };
}


