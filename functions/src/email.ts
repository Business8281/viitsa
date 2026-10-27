import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as nodemailer from "nodemailer";
import * as admin from "firebase-admin";
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
      from: `"Viitsa Healthcare" <${process.env.TITAN_EMAIL || "support@viitsa.com"}>`,
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
    } catch {}
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

    const headerGradient = isClinic ? "linear-gradient(135deg, #063229 0%, #0F6E56 50%, #128064 100%)" : "linear-gradient(135deg, #0c4a6e 0%, #0284c7 50%, #0369a1 100%)";
    const buttonBg = isClinic ? "#0F6E56" : "#0284c7";
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
              <div style="font-size: 11px; font-weight: 600; color: #e0f2fe; letter-spacing: 1.2px; text-transform: uppercase;">${portalTitle}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <div style="text-align: center; margin-bottom: 22px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #ecfdf5; border: 1px solid #a7f3d0; margin-bottom: 12px;">
                  <span style="font-size: 26px; line-height: 1; color: #0F6E56;">✓</span>
                </div>
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Verify Your Email Address</h2>
                <p style="font-size: 14px; color: #64748b; margin: 0;">Account Activation</p>
              </div>

              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Hello <strong>${name}</strong>,</p>
              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 22px 0;">
                ${bodyMessage}
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${link}" target="_blank" style="display: inline-block; background-color: ${buttonBg}; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
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
</html>
    `.trim();

    const mailOptions = {
      from: `"Viitsa Healthcare" <${process.env.TITAN_EMAIL || "support@viitsa.com"}>`,
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
    } catch {}
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

    const headerGradient = isAdmin 
      ? "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)" 
      : (isClinic ? "linear-gradient(135deg, #063229 0%, #0F6E56 50%, #128064 100%)" : "linear-gradient(135deg, #0c4a6e 0%, #0284c7 50%, #0369a1 100%)");
    const buttonBg = isAdmin ? "#4f46e5" : (isClinic ? "#0F6E56" : "#0284c7");
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
              <div style="font-size: 11px; font-weight: 600; color: #e0f2fe; letter-spacing: 1.2px; text-transform: uppercase;">${portalTitle} - Security</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <div style="text-align: center; margin-bottom: 22px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: #eff6ff; border: 1px solid #bfdbfe; margin-bottom: 12px;">
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
                <a href="${resetLink}" target="_blank" style="display: inline-block; background-color: ${buttonBg}; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
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
</html>
    `.trim();

    const mailOptions = {
      from: `"Viitsa Healthcare" <${process.env.TITAN_EMAIL || "support@viitsa.com"}>`,
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


