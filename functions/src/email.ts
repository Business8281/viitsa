import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as nodemailer from "nodemailer";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

import { generateSubscriptionInvoicePdf } from "./invoicePdf";

const getTransporter = () => {
  const user = process.env.TITAN_EMAIL || "support@viitsa.com";
  const pass = process.env.TITAN_PASSWORD || "Support@viitsa";
  return nodemailer.createTransport({
    host: "smtpout.secureserver.net",
    port: 465,
    secure: true,
    auth: { user, pass },
    pool: true,
    maxConnections: 10,
    maxMessages: Infinity,
  });
};

export const sendInstantEmail = onCall({ region: "asia-south1", memory: "256MiB", cors: true }, async (request) => {
  const { to, subject, htmlContent, attachments, invoiceData } = request.data || {};

  if (!to || !subject || !htmlContent) {
    throw new HttpsError("invalid-argument", "Missing required fields: to, subject, htmlContent");
  }

  try {
    const mailOptions: any = {
      from: `"VIITSA Health Care" <${process.env.TITAN_EMAIL || "support@viitsa.com"}>`,
      to,
      subject,
      html: htmlContent,
    };

    const finalAttachments: any[] = [];

    if (attachments && Array.isArray(attachments)) {
      finalAttachments.push(...attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content,
        encoding: att.encoding || (att.content ? 'base64' : undefined),
        path: att.path,
        contentType: att.contentType || 'application/pdf',
      })));
    }

    // Automatically generate and attach PDF invoice if invoiceData is passed
    if (invoiceData) {
      try {
        const pdfBuffer = await generateSubscriptionInvoicePdf(invoiceData);
        finalAttachments.push({
          filename: `Viitsa_Invoice_${invoiceData.invoiceNumber || Date.now()}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        });
      } catch (pdfErr) {
        console.error("Error generating invoice PDF in sendInstantEmail:", pdfErr);
      }
    }

    if (finalAttachments.length > 0) {
      mailOptions.attachments = finalAttachments;
    }

    const info = await getTransporter().sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error("Email send error:", error);
    throw new HttpsError("internal", "Failed to send email", error.message);
  }
});

export const sendVerificationEmail = onCall({
  region: "asia-south1",
  memory: "256MiB",
  cors: true,
}, async (request) => {
  const { email, displayName, continueUrl, portal } = request.data || {};

  if (!email) {
    throw new HttpsError("invalid-argument", "Missing required field: email");
  }

  const isClinic = portal === "clinic" || Boolean(continueUrl && continueUrl.includes("/clinic"));
  let baseOrigin = "https://viitsa.com";
  if (continueUrl) {
    try {
      const parsed = new URL(continueUrl);
      if (parsed.origin && !parsed.origin.includes('localhost') && !parsed.origin.includes('127.0.0.1')) {
        baseOrigin = parsed.origin;
      }
    } catch (_err) {
      // Continue with default baseOrigin if continueUrl is not a valid URL
    }
  }
  const defaultUrl = isClinic ? `${baseOrigin}/clinic/login?verified=true` : `${baseOrigin}/login?verified=true`;

  try {
    const cleanEmail = email.trim().toLowerCase();
    // Verify user exists in Firebase Auth
    try {
      await admin.auth().getUserByEmail(cleanEmail);
    } catch (userErr: any) {
      if (userErr.code === 'auth/user-not-found' || userErr.message?.includes('user-not-found') || userErr.message?.includes('no user record')) {
        throw new HttpsError("not-found", "No account found with this email address.");
      }
      throw userErr;
    }

    const actionCodeSettings = {
      url: defaultUrl,
      handleCodeInApp: true,
    };

    let rawLink: string = "";
    try {
      rawLink = await admin.auth().generateEmailVerificationLink(cleanEmail, actionCodeSettings);
    } catch (linkErr: any) {
      console.warn("generateEmailVerificationLink with actionCodeSettings failed, trying without actionCodeSettings:", linkErr);
      try {
        rawLink = await admin.auth().generateEmailVerificationLink(cleanEmail);
      } catch (innerErr: any) {
        console.error("generateEmailVerificationLink without actionCodeSettings failed:", innerErr);
        throw new HttpsError("internal", "Unable to generate verification link. Please try again.");
      }
    }

    // Extract oobCode and construct direct link
    let oobCode = "";
    try {
      const parsed = new URL(rawLink);
      oobCode = parsed.searchParams.get("oobCode") || "";
    } catch {
      const match = rawLink.match(/[?&]oobCode=([^&]+)/);
      if (match) oobCode = match[1];
    }

    const portalPath = isClinic ? "/clinic/login" : "/login";
    const link = oobCode
      ? `${baseOrigin}${portalPath}?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}&verified=true`
      : rawLink || defaultUrl;

    const name = displayName || (isClinic ? "Doctor / Clinic Administrator" : "Patient");
    const portalTitle = isClinic ? "Clinic Portal Verification" : "Patient Portal Verification";
    const bodyMessage = isClinic
      ? "Thank you for registering your clinic with Viitsa Healthcare. Please click the button below to verify your email address and activate your clinic administration account."
      : "Thank you for registering with Viitsa Healthcare. Please click the button below to verify your email address and activate your patient account.";
    const buttonText = isClinic ? "Verify My Clinic Account" : "Verify My Email Address";
    const subject = isClinic ? "Verify your Viitsa Clinic Account" : "Verify your Viitsa Healthcare Account";

    const headerGradient = "linear-gradient(135deg, #047857 0%, #059669 50%, #10b981 100%)";
    const buttonBg = "#059669";
    const currentYear = new Date().getFullYear();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 36px 16px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03);">
          <!-- Header -->
          <tr>
            <td style="background: ${headerGradient}; padding: 30px 24px; text-align: center;">
              <div style="font-size: 22px; font-weight: 800; letter-spacing: 2.5px; color: #ffffff; text-transform: uppercase; margin: 0 0 6px 0;">VIITSA</div>
              <div style="font-size: 11px; font-weight: 600; color: #ecfdf5; letter-spacing: 1.2px; text-transform: uppercase;">${portalTitle}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <div style="text-align: center; margin-bottom: 22px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #ecfdf5; border: 1px solid #a7f3d0; margin-bottom: 12px;">
                  <span style="font-size: 26px; line-height: 1; color: #059669;">✓</span>
                </div>
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Verify Your Email Address</h2>
                <p style="font-size: 14px; color: #64748b; margin: 0;">Account Activation</p>
              </div>

              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Hello <strong>${name}</strong>,</p>
              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 22px 0;">
                ${bodyMessage}
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${link}" target="_blank" style="display: inline-block; background-color: ${buttonBg}; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
                  ${buttonText}
                </a>
              </div>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 24px 0 0 0;">
                <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748b;">Direct link fallback:</p>
                <a href="${link}" target="_blank" style="font-size: 12px; color: ${buttonBg}; word-break: break-all; line-height: 1.4; text-decoration: underline;">${link}</a>
              </div>

              <div style="margin-top: 22px; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
                If you did not register for an account with Viitsa Healthcare, you can safely disregard this email.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 28px 28px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                This is an official automated notification from <strong>Viitsa Healthcare</strong>.<br/>
                For support, reach out to us at <a href="mailto:support@viitsa.com" style="color: #059669; font-weight: 600; text-decoration: none;">support@viitsa.com</a>
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
</html>
    `.trim();

    const mailOptions = {
      from: `"VIITSA Health Care" <${process.env.TITAN_EMAIL || "support@viitsa.com"}>`,
      to: email,
      subject,
      html: htmlContent,
    };

    const info = await getTransporter().sendMail(mailOptions);
    return { success: true, messageId: info.messageId, link };
  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error("Verification email error:", error);
    if (error.code === 'auth/user-not-found' || error.message?.includes('user-not-found') || error.message?.includes('no user record') || error.message?.includes('USER_NOT_FOUND')) {
      throw new HttpsError("not-found", "No account found with this email address.");
    }
    throw new HttpsError("internal", error.message || "Failed to send verification email");
  }
});

export const sendPasswordResetEmail = onCall({
  region: "asia-south1",
  memory: "256MiB",
  cors: true,
}, async (request) => {
  const { email, continueUrl, returnUrl, portal } = request.data || {};

  if (!email) {
    throw new HttpsError("invalid-argument", "Missing required field: email");
  }

  const cleanEmail = email.trim().toLowerCase();
  const isClinic = portal === "clinic" || Boolean(returnUrl && returnUrl.includes("/clinic")) || Boolean(continueUrl && continueUrl.includes("/clinic"));
  const isAdmin = portal === "admin" || Boolean(returnUrl && returnUrl.includes("/admin")) || Boolean(continueUrl && continueUrl.includes("/admin"));

  let baseOrigin = "https://viitsa.com";
  if (continueUrl) {
    try {
      const parsed = new URL(continueUrl);
      if (parsed.origin && !parsed.origin.includes('localhost') && !parsed.origin.includes('127.0.0.1')) {
        baseOrigin = parsed.origin;
      }
    } catch (_err) {
      // Continue with default baseOrigin if continueUrl is not a valid URL
    }
  }

  const defaultReturn = isAdmin ? "/admin/login" : (isClinic ? "/clinic/login" : "/login");
  const actualReturn = returnUrl || defaultReturn;
  const continueTarget = `${baseOrigin}/reset-password?return=${encodeURIComponent(actualReturn)}&completed=true`;
  try {
    console.log("[sendPasswordResetEmail] Initiated for:", cleanEmail);

    // Verify user exists in Firebase Auth, with Firestore account fallback
    try {
      await admin.auth().getUserByEmail(cleanEmail);
    } catch (userErr: any) {
      if (userErr.code === 'auth/user-not-found' || userErr.message?.includes('user-not-found') || userErr.message?.includes('no user record')) {
        // Check if user account exists in Firestore (users or patient_accounts)
        const firestore = admin.firestore();
        let accountExists = false;
        try {
          const userSnap = await firestore.collection('users').where('email', '==', cleanEmail).limit(1).get();
          if (!userSnap.empty) {
            accountExists = true;
          } else {
            const patSnap = await firestore.collection('patient_accounts').where('email', '==', cleanEmail).limit(1).get();
            if (!patSnap.empty) accountExists = true;
          }
        } catch (dbErr) {
          console.warn("[sendPasswordResetEmail] Firestore account check error:", dbErr);
        }

        if (accountExists) {
          try {
            console.log("[sendPasswordResetEmail] Auto-creating Auth record for existing Firestore user:", cleanEmail);
            await admin.auth().createUser({ email: cleanEmail, emailVerified: true });
          } catch (createErr: any) {
            console.error("[sendPasswordResetEmail] Failed to create auth user:", createErr);
            throw new HttpsError("internal", "Unable to prepare account for password reset.");
          }
        } else {
          console.warn("[sendPasswordResetEmail] Account not found in Auth or Firestore for:", cleanEmail);
          throw new HttpsError("not-found", "No account found with this email address.");
        }
      } else {
        throw userErr;
      }
    }

    const actionCodeSettings = {
      url: continueTarget,
      handleCodeInApp: false,
    };

    let rawLink: string = "";
    try {
      rawLink = await admin.auth().generatePasswordResetLink(cleanEmail, actionCodeSettings);
    } catch (linkErr: any) {
      console.warn("generatePasswordResetLink with actionCodeSettings failed, trying without actionCodeSettings:", linkErr);
      try {
        rawLink = await admin.auth().generatePasswordResetLink(cleanEmail);
      } catch (innerErr: any) {
        console.error("generatePasswordResetLink without actionCodeSettings failed:", innerErr);
        throw new HttpsError("internal", "Unable to generate password reset link. Please try again.");
      }
    }

    // Extract oobCode and construct direct link
    let oobCode = "";
    try {
      const parsed = new URL(rawLink);
      oobCode = parsed.searchParams.get("oobCode") || "";
    } catch {
      const match = rawLink.match(/[?&]oobCode=([^&]+)/);
      if (match) oobCode = match[1];
    }

    const resetLink = oobCode
      ? `${baseOrigin}/reset-password?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}&return=${encodeURIComponent(actualReturn)}`
      : rawLink;

    const portalTitle = isAdmin ? "Administrator Portal" : (isClinic ? "Clinic Administration Portal" : "Patient Portal");
    const subject = isAdmin ? "Viitsa Admin — Password Reset Request" : (isClinic ? "Viitsa Clinic — Password Reset Request" : "Viitsa Healthcare — Password Reset Request");

    const headerGradient = "linear-gradient(135deg, #047857 0%, #059669 50%, #10b981 100%)";
    const buttonBg = "#059669";
    const currentYear = new Date().getFullYear();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 36px 16px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03);">
          <!-- Header -->
          <tr>
            <td style="background: ${headerGradient}; padding: 30px 24px; text-align: center;">
              <div style="font-size: 22px; font-weight: 800; letter-spacing: 2.5px; color: #ffffff; text-transform: uppercase; margin: 0 0 6px 0;">VIITSA</div>
              <div style="font-size: 11px; font-weight: 600; color: #ecfdf5; letter-spacing: 1.2px; text-transform: uppercase;">${portalTitle} - Security</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <div style="text-align: center; margin-bottom: 22px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #ecfdf5; border: 1px solid #a7f3d0; margin-bottom: 12px;">
                  <span style="font-size: 26px; line-height: 1;">🔐</span>
                </div>
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Password Reset Request</h2>
                <p style="font-size: 14px; color: #64748b; margin: 0;">Secure Password Authorization</p>
              </div>

              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Hello,</p>
              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 22px 0;">
                We received a request to reset the password for your Viitsa account (<strong>${cleanEmail}</strong>). Please click the secure button below to set your new password:
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" target="_blank" style="display: inline-block; background-color: ${buttonBg}; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
                  Reset My Password
                </a>
              </div>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 24px 0 0 0;">
                <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748b;">Direct link fallback:</p>
                <a href="${resetLink}" target="_blank" style="font-size: 12px; color: ${buttonBg}; word-break: break-all; line-height: 1.4; text-decoration: underline;">${resetLink}</a>
              </div>

              <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 14px 18px; font-size: 12px; color: #92400e; line-height: 1.5; margin-top: 20px;">
                <strong>⏱ Security Notice:</strong> This link is valid for <strong>1 hour</strong>. If you didn't initiate this request, you can safely ignore this email — your account remains fully secure.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 28px 28px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                This is an official automated security notification from <strong>Viitsa Healthcare</strong>.<br/>
                For support, reach out to us at <a href="mailto:support@viitsa.com" style="color: #059669; font-weight: 600; text-decoration: none;">support@viitsa.com</a>
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
</html>
    `.trim();

    const mailOptions = {
      from: `"VIITSA Health Care" <${process.env.TITAN_EMAIL || "support@viitsa.com"}>`,
      to: cleanEmail,
      subject,
      html: htmlContent,
    };

    const info = await getTransporter().sendMail(mailOptions);
    return { success: true, messageId: info.messageId, link: resetLink };
  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error("Password reset email error:", error);
    if (error.code === 'auth/user-not-found' || error.message?.includes('user-not-found') || error.message?.includes('no user record') || error.message?.includes('USER_NOT_FOUND')) {
      throw new HttpsError("not-found", "No account found with this email address.");
    }
    throw new HttpsError("internal", error.message || "Failed to send password reset email");
  }
});

// ============================================================================
// CALLABLE: Send Email Auth OTP (Generates 6-digit code, stores in DB, sends via Titan SMTP)
// ============================================================================
export const sendEmailAuthOtp = onCall(
  {
    region: "asia-south1",
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const { email, name } = request.data || {};
    if (!email) {
      throw new HttpsError("invalid-argument", "Email address is required.");
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new HttpsError("invalid-argument", "Please enter a valid email address.");
    }

    // Generate cryptographically sound 6-digit OTP
    const otpCode = String(crypto.randomInt(100000, 1000000));

    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();

    // Store in email_otps collection with 10-minute expiry
    await db.collection("email_otps").doc(cleanEmail).set({
      email: cleanEmail,
      code: otpCode,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      expires_at: Date.now() + 10 * 60 * 1000,
      verified: false,
    });

    const recipientName = name ? String(name).trim() : "Doctor / Clinic Administrator";
    const currentYear = new Date().getFullYear();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VIITSA Email Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="540" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 24px 32px; background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">VIITSA</h1>
              <p style="margin: 6px 0 0 0; color: #ccfbf1; font-size: 12px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase;">VIITSA Health Care</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <p style="margin: 0 0 14px 0; font-size: 15px; font-weight: 600; color: #0f172a;">
                Dear ${recipientName},
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Thank you for registering with <strong>VIITSA Health Care</strong>. Please use the following 6-digit one-time verification code to confirm your email address:
              </p>

              <!-- OTP Code Display Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdfa; border: 2px dashed #0d9488; border-radius: 14px; margin: 0 0 22px 0;">
                <tr>
                  <td align="center" style="padding: 22px 16px;">
                    <div style="font-size: 11px; font-weight: 700; color: #0f766e; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
                      Email Verification Code
                    </div>
                    <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0f766e; font-family: 'Courier New', Courier, monospace; line-height: 1.2;">
                      ${otpCode}
                    </div>
                    <div style="font-size: 12px; font-weight: 500; color: #64748b; margin-top: 10px;">
                      ⏳ Valid for <strong>10 minutes</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #475569;">
                Enter this 6-digit code alongside your WhatsApp mobile OTP in the clinic registration page to submit your application for administrative approval.
              </p>

              <div style="padding: 12px 16px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; margin-bottom: 8px;">
                <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 1.5;">
                  🔒 <strong>Security Warning:</strong> Never share this verification code with anyone. VIITSA will never contact you asking for your verification code.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                If you did not request this verification, please safely ignore this email.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                © ${currentYear} VIITSA Health Care. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    try {
      await getTransporter().sendMail({
        from: `"VIITSA Health Care" <${process.env.TITAN_EMAIL || "support@viitsa.com"}>`,
        to: cleanEmail,
        subject: `Your VIITSA Health Care Verification Code: ${otpCode}`,
        html: htmlContent,
      });

      return { success: true, message: "Verification code sent to your email successfully." };
    } catch (sendErr: any) {
      console.error("[sendEmailAuthOtp] SMTP error:", sendErr);
      throw new HttpsError("internal", sendErr.message || "Failed to dispatch verification email.");
    }
  }
);

// ============================================================================
// CALLABLE: Verify Email Auth OTP
// ============================================================================
export const verifyEmailAuthOtp = onCall(
  {
    region: "asia-south1",
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const { email, otp } = request.data || {};
    if (!email || !otp) {
      throw new HttpsError("invalid-argument", "Email address and verification code are required.");
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();

    const otpDoc = await db.collection("email_otps").doc(cleanEmail).get();
    if (!otpDoc.exists) {
      throw new HttpsError("not-found", "No verification code requested for this email or session expired.");
    }

    const otpData = otpDoc.data() || {};
    if (Date.now() > (otpData.expires_at || 0)) {
      throw new HttpsError("deadline-exceeded", "Verification code has expired. Please request a new code.");
    }

    if (otpData.code !== cleanOtp) {
      throw new HttpsError("permission-denied", "Incorrect verification code. Please check your email and try again.");
    }

    await otpDoc.ref.update({
      verified: true,
      verified_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      const authUser = await admin.auth().getUserByEmail(cleanEmail);
      if (authUser) {
        await admin.auth().updateUser(authUser.uid, { emailVerified: true });
      }
    } catch (_authErr) {
      // Ignore if user not found in auth yet
    }

    return { success: true, message: "Email verified successfully." };
  }
);

// ============================================================================
// CALLABLE: Mark Firebase Auth User Email as Verified
// ============================================================================
export const markEmailVerified = onCall(
  {
    region: "asia-south1",
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required to mark email as verified.");
    }
    const { email, uid } = request.data || {};
    if (!admin.apps.length) admin.initializeApp();
    const cleanEmail = email ? String(email).trim().toLowerCase() : undefined;
    const callerUid = request.auth.uid;

    // Verify administrator authority directly from trusted Firestore user record (not client-selected token claims)
    let isAdmin = false;
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (callerDoc.exists) {
      const callerRole = callerDoc.data()?.role;
      isAdmin = callerRole === 'admin' || callerRole === 'company_admin';
    }

    // Must be self or admin
    if (!isAdmin && uid && uid !== callerUid) {
      throw new HttpsError("permission-denied", "Unauthorized to update email verification for another user.");
    }

    const targetUid = uid || callerUid;

    // Retrieve target user from Firebase Auth to bind verification to their actual registered email
    const targetUser = await admin.auth().getUser(targetUid);
    const targetEmail = targetUser.email ? targetUser.email.trim().toLowerCase() : undefined;
    if (!targetEmail) {
      throw new HttpsError("failed-precondition", "Target user has no email address associated with their account.");
    }

    // Non-admin updates require verified evidence of OTP ownership bound to the target account's Auth email
    if (!isAdmin) {
      if (cleanEmail && cleanEmail !== targetEmail) {
        throw new HttpsError("permission-denied", "Provided email does not match account registered email.");
      }

      const otpDoc = await admin.firestore().collection("email_otps").doc(targetEmail).get();
      if (!otpDoc.exists || !otpDoc.data()?.verified) {
        throw new HttpsError("permission-denied", "Email OTP has not been verified for this email address.");
      }
    }

    try {
      await admin.auth().updateUser(targetUid, { emailVerified: true });
      return { success: true };
    } catch (err: any) {
      console.warn("[markEmailVerified] warning:", err);
      return { success: false, error: err.message };
    }
  }
);



