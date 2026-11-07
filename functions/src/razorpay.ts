import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import Razorpay from "razorpay";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { generateSubscriptionInvoicePdf } from "./invoicePdf";
import {
  sendClinicTrialActivated,
  sendClinicSubActivated,
  sendClinicPaymentSuccess,
  sendClinicPaymentFailed,
  sendClinicSubCancelled,
  sendClinicSubDeactivated,
  sendClinicSubInvoice,
} from "./whatsappService";

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

const getDb = () => admin.firestore();

function buildRazorpayEmailHtml(options: {
  subtitle: string;
  badgeIcon: string;
  badgeBg: string;
  badgeColor: string;
  heading: string;
  recipientName: string;
  leadText: string;
  details: Array<{ label: string; value: string }>;
  subnote?: string;
  buttonText?: string;
  buttonUrl?: string;
}): string {
  const currentYear = new Date().getFullYear();
  const rows = options.details.map((d, i) => `
    <tr>
      <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: ${i < options.details.length - 1 ? '1px solid #e2e8f0' : 'none'}; width: 40%;">${d.label}</td>
      <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; border-bottom: ${i < options.details.length - 1 ? '1px solid #e2e8f0' : 'none'};">${d.value}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.heading}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 36px 16px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03);">
          <tr>
            <td style="background: linear-gradient(135deg, #063229 0%, #0F6E56 50%, #128064 100%); padding: 28px 24px; text-align: center;">
              <div style="font-size: 22px; font-weight: 800; letter-spacing: 2.5px; color: #ffffff; text-transform: uppercase; margin: 0 0 6px 0;">VIITSA</div>
              <div style="font-size: 11px; font-weight: 600; color: #bbf7d0; letter-spacing: 1.2px; text-transform: uppercase;">${options.subtitle}</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <div style="text-align: center; margin-bottom: 22px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background-color: ${options.badgeBg}; border: 1px solid ${options.badgeColor}; margin-bottom: 12px;">
                  <span style="font-size: 26px; line-height: 1; color: ${options.badgeColor}; font-weight: bold;">${options.badgeIcon}</span>
                </div>
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">${options.heading}</h2>
                <p style="font-size: 14px; color: #64748b; margin: 0;">Official Billing Notification</p>
              </div>

              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">Hello <strong>${options.recipientName}</strong>,</p>
              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                ${options.leadText}
              </p>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
                ${rows}
              </table>

              ${options.buttonText && options.buttonUrl ? `
              <div style="text-align: center; margin: 28px 0 12px 0;">
                <a href="${options.buttonUrl}" target="_blank" style="display: inline-block; background-color: #0F6E56; color: #ffffff; padding: 14px 34px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
                  ${options.buttonText}
                </a>
              </div>
              ` : ''}

              ${options.subnote ? `
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; font-size: 13px; color: #64748b; line-height: 1.5; margin: 18px 0;">
                ${options.subnote}
              </div>
              ` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 28px 28px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                This is an official automated notification from <strong>Viitsa Healthcare</strong>.<br/>
                For billing support, reach out to us at <a href="mailto:support@viitsa.com" style="color: #0F6E56; font-weight: 600; text-decoration: none;">support@viitsa.com</a>
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

const RAZORPAY_PLANS: Record<string, Record<string, string>> = {
  solo: {
    monthly: "plan_TkvpQ2LluCpPIu", // ₹2,999/mo
    annual: "plan_To64LXDx5Iy6r3",  // ₹29,990/yr
  },
  clinic: {
    monthly: "plan_TnqRGsRhOR9VyR", // ₹5,999/mo
    annual: "plan_To63wETrhPn4gF",  // ₹59,990/yr
  },
  multispecialty: {
    monthly: "plan_TnqRjtV2FJcvRj", // ₹11,999/mo
    annual: "plan_To65A7RUG0xsVs",  // ₹1,19,990/yr
  },
};

export const createClinicSubscription = onCall({ region: "asia-south1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in to create a subscription.");
  }
  
  const { clinicId, planId, skipTrial, tier = 'clinic', cycle = 'monthly' } = request.data || {};
  if (!clinicId) {
    throw new HttpsError("invalid-argument", "Missing clinicId.");
  }

  const resolvedPlanId = planId || RAZORPAY_PLANS[tier]?.[cycle] || RAZORPAY_PLANS['clinic']['monthly'];

  const clinicDoc = await getDb().collection("clinics").doc(clinicId).get();
  if (!clinicDoc.exists) {
    throw new HttpsError("not-found", "Clinic not found.");
  }
  const clinicData = clinicDoc.data() || {};
  
  let userData: any = {};
  if (request.auth.uid) {
    const userDoc = await getDb().collection("users").doc(request.auth.uid).get();
    userData = userDoc.data() || {};
  }

  const clinicEmail = (clinicData.email || userData.email || request.auth.token?.email || "").toLowerCase().trim();

  // STRICT ONE-TIME 30-DAY TRIAL ENFORCEMENT
  // A clinic or user has used a trial ONLY if they actually activated/completed a trial or are already an active paying subscriber.
  // Merely opening or closing the checkout without paying, or being in 'trial' onboarding state, NEVER consumes the free trial.
  const isAlreadyActivePaid = clinicData.subscription_status === 'active';
  const hasCompletedTrial = Boolean(
    clinicData.trial_completed === true ||
    userData.trial_completed === true ||
    ((clinicData.subscription_status === 'cancelled' || clinicData.subscription_status === 'deactivated') && clinicData.trial_completed === true)
  );

  let trialAlreadyUsed = Boolean(isAlreadyActivePaid || hasCompletedTrial);

  if (!trialAlreadyUsed && clinicEmail) {
    const trialRecordSnap = await getDb().collection("trial_records").where("email", "==", clinicEmail).limit(1).get();
    if (!trialRecordSnap.empty) {
      const trDoc = trialRecordSnap.docs[0].data();
      if (trDoc.status === "completed" || (trDoc.status === "active_trial" && isAlreadyActivePaid)) {
        trialAlreadyUsed = true;
      }
    }
  }

  const effectiveSkipTrial = Boolean(skipTrial || trialAlreadyUsed);

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  });

  try {
    const payload: any = {
      plan_id: resolvedPlanId,
      customer_notify: 1,
      total_count: cycle === 'annual' ? 10 : 120, // 10 cycles
      notes: {
        clinic_id: clinicId,
        tier: tier || 'clinic',
        cycle: cycle || 'monthly',
        is_trial: (!effectiveSkipTrial).toString()
      }
    };

    // If eligible for trial: set start_at to 30 days from now (Auto-debit begins after 30 days)
    // IMPORTANT: DO NOT write trial_used or trial_records here!
    // Database records are updated ONLY when Razorpay verifies payment authentication.
    if (!effectiveSkipTrial) {
      const trialDurationSeconds = 30 * 24 * 60 * 60;
      payload.start_at = Math.floor(Date.now() / 1000) + trialDurationSeconds;
    }
    
    const subscription = await razorpay.subscriptions.create(payload);

    return {
      ...subscription,
      is_trial: !effectiveSkipTrial,
      trial_already_used: trialAlreadyUsed
    };
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw new HttpsError("internal", "Unable to create subscription.");
  }
});

export const cancelClinicSubscription = onCall({ region: "asia-south1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in to cancel subscription.");
  }
  
  const { clinicId, reason, customReason, feedback } = request.data || {};
  if (!clinicId) {
    throw new HttpsError("invalid-argument", "Missing clinicId.");
  }

  try {
    const clinicDoc = await getDb().collection("clinics").doc(clinicId).get();
    if (!clinicDoc.exists) {
      throw new HttpsError("not-found", "Clinic not found.");
    }
    const clinicData = clinicDoc.data() || {};

    const razorpaySubId = clinicData.razorpay_subscription_id || clinicData.subscription_id;
    if (razorpaySubId && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      try {
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
        // cancel_at_cycle_end = true: keeps subscription running until paid period ends
        await razorpay.subscriptions.cancel(razorpaySubId, true);
      } catch (rzpErr) {
        console.warn("Could not cancel Razorpay subscription remotely:", rzpErr);
      }
    }

    const effectiveReason = reason === 'other' ? (customReason || 'Other reason') : reason;
    const nowIso = new Date().toISOString();

    const cycle = (clinicData.subscription_billing_cycle || 'monthly').toLowerCase();
    const periodEnd = clinicData.subscription_period_end 
      ? new Date(clinicData.subscription_period_end)
      : (clinicData.subscription_activated_at 
          ? new Date(new Date(clinicData.subscription_activated_at).getTime() + (cycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const periodEndIso = periodEnd.toISOString();
    const formattedPeriodEnd = periodEnd.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Plan stays ACTIVE until the end of the current billing cycle!
    await getDb().collection("clinics").doc(clinicId).update({
      cancel_at_period_end: true,
      cancel_effective_date: periodEndIso,
      cancellation_reason: effectiveReason,
      cancellation_feedback: feedback || "",
      subscription_auto_renew: false,
      subscription_period_end: periodEndIso,
      subscription_updated_at: nowIso
    });

    await getDb().collection("subscription_cancellations").add({
      clinic_id: clinicId,
      clinic_name: clinicData.name || "Clinic",
      user_id: request.auth.uid,
      cancelled_by_email: request.auth.token?.email || clinicData.email || "",
      plan: clinicData.subscription_plan || "clinic",
      billing_cycle: clinicData.subscription_billing_cycle || "monthly",
      reason: effectiveReason,
      feedback: feedback || "",
      effective_date: periodEndIso,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const adminEmail = request.auth.token?.email || clinicData.email || clinicData.contact_email;
    if (adminEmail) {
      try {
        const planName = `${(clinicData.subscription_plan || 'Clinic').toUpperCase()} Plan`;
        const clinicName = clinicData.name || "Your Clinic";

        const emailHtml = buildRazorpayEmailHtml({
          subtitle: "Subscription Update",
          badgeIcon: "✕",
          badgeBg: "#fef2f2",
          badgeColor: "#dc2626",
          heading: "Cancellation Scheduled",
          recipientName: clinicName,
          leadText: `This is an official confirmation that your subscription cancellation for the <strong>${planName}</strong> has been scheduled. Full access remains active until the end of your billing cycle.`,
          details: [
            { label: "Subscription Plan", value: planName },
            { label: "Active & Usable Until", value: formattedPeriodEnd },
            { label: "Auto-Renewal Status", value: "Turned Off (No charges)" },
            { label: "Reason Recorded", value: effectiveReason },
          ],
          subnote: "You retain complete, unrestricted access to all features, doctor seats, and clinic operations until your period ends.",
          buttonText: "Manage Subscription Settings",
          buttonUrl: "https://viitsa.com/clinic/settings?tab=billing"
        });

        let cancellationPdf: Buffer | null = null;
        const invNum = `VIITSA-CNCL-${Date.now().toString().slice(-6)}`;
        try {
          cancellationPdf = await generateSubscriptionInvoicePdf({
            invoiceNumber: invNum,
            invoiceDate: formattedPeriodEnd,
            status: "CANCELLED",
            clinicName,
            customerEmail: adminEmail,
            planName,
            tier: (clinicData.subscription_plan || 'clinic').toLowerCase(),
            cycle: (clinicData.subscription_billing_cycle || 'monthly').toLowerCase(),
            amount: 0,
            notes: `Cancellation scheduled for ${formattedPeriodEnd}. Reason: ${effectiveReason}`,
          });
        } catch (pdfErr) {
          console.warn("Could not generate cancellation notice PDF:", pdfErr);
        }

        const mailOptions: any = {
          from: `"Viitsa Healthcare" <${process.env.TITAN_EMAIL || "support@viitsa.com"}>`,
          to: adminEmail,
          subject: `Subscription Cancelled - ${planName} | Viitsa Healthcare`,
          html: emailHtml,
        };

        if (cancellationPdf) {
          mailOptions.attachments = [
            {
              filename: `Viitsa_Cancellation_Receipt_${invNum}.pdf`,
              content: cancellationPdf,
              contentType: 'application/pdf',
            },
          ];
        }

        await getTransporter().sendMail(mailOptions);
      } catch (emailErr) {
        console.error("Failed to send cancellation confirmation email:", emailErr);
      }
    }

    // Dispatch WhatsApp template viitsa_clinic_sub_cancelled
    const clinicPhone = clinicData.phone || clinicData.contact_phone;
    if (clinicPhone) {
      try {
        await sendClinicSubCancelled({
          to: clinicPhone,
          adminName: clinicData.owner_name || 'Doctor',
          clinicName: clinicData.name || 'Clinic',
          cancelledPlan: `${(clinicData.subscription_plan || 'Clinic').toUpperCase()} Plan`,
          effectiveDate: formattedPeriodEnd,
          supportPhone: '+91 73961 11081',
          clinicId,
        });
      } catch (waErr) {
        console.warn("Could not dispatch WhatsApp cancellation template:", waErr);
      }
    }

    return { success: true, cancelled_at: nowIso };
  } catch (err: any) {
    console.error("Error cancelling clinic subscription:", err);
    throw new HttpsError("internal", err?.message || "Failed to cancel clinic subscription.");
  }
});

export const razorpayWebhook = onRequest(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "viitsa_secret_123";
  const signature = req.headers["x-razorpay-signature"] as string;

  if (!signature) {
    res.status(400).send("Missing signature");
    return;
  }

  // Resilient signature validation: check raw bytes first (standard for Razorpay webhooks in Cloud Functions v2), then fallback to JSON representation
  let isSignatureValid = false;
  if ((req as any).rawBody) {
    const rawExpectedSignature = crypto
      .createHmac("sha256", secret)
      .update((req as any).rawBody)
      .digest("hex");
    if (rawExpectedSignature === signature) {
      isSignatureValid = true;
    }
  }

  if (!isSignatureValid) {
    const jsonExpectedSignature = crypto
      .createHmac("sha256", secret)
      .update(typeof req.body === "string" ? req.body : JSON.stringify(req.body))
      .digest("hex");
    if (jsonExpectedSignature === signature) {
      isSignatureValid = true;
    }
  }

  if (!isSignatureValid) {
    console.error("Webhook signature mismatch.");
    res.status(400).send("Invalid signature");
    return;
  }

  const event = req.body;
  if (!event || !event.event) {
    res.status(400).send("Invalid payload");
    return;
  }

  // Deterministic Idempotency Key across all webhook deliveries and retries
  const entityId = event.payload?.subscription?.entity?.id || 
                   event.payload?.payment?.entity?.id || 
                   event.payload?.payment_link?.entity?.id || 
                   event.payload?.invoice?.entity?.id || 
                   event.id || 
                   "generic";
  const eventKey = `${event.event}_${entityId}`;

  try {
    const eventRef = getDb().collection("processed_webhook_events").doc(eventKey);
    const eventSnap = await eventRef.get();
    if (eventSnap.exists) {
      console.log(`[RazorpayWebhook] Idempotency: Webhook event '${eventKey}' was already processed. Acknowledging immediately with 200 OK.`);
      res.status(200).send("OK: already processed");
      return;
    }

    // Mark event as processed immediately to lock out concurrent / retried requests
    await eventRef.set({
      event: event.event,
      entity_id: entityId,
      created_at: new Date().toISOString(),
      raw_created_at: event.created_at || null,
    });

    if (event.event === "subscription.authenticated" || event.event === "subscription.activated") {
      const sub = event.payload.subscription.entity;
      const clinicId = sub.notes?.clinic_id;
      const tier = sub.notes?.tier || "clinic";
      const cycle = sub.notes?.cycle || "monthly";
      const isTrial = sub.notes?.is_trial === "true" || (sub.start_at && (sub.start_at * 1000 > Date.now()));
      const trialEndsAt = isTrial 
        ? (sub.start_at ? new Date(sub.start_at * 1000).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString())
        : null;

      if (clinicId) {
        // Guard against reviving a cancelled subscription:
        // If user already cancelled/revoked autopay, an incoming authenticated/activated webhook MUST NOT revert status back to trial/active
        const existingClinicDoc = await getDb().collection("clinics").doc(clinicId).get();
        const existingClinicData = existingClinicDoc.data() || {};
        if (existingClinicData.subscription_status === "cancelled" || existingClinicData.subscription_status === "deactivated") {
          console.warn(`[RazorpayWebhook] Clinic ${clinicId} is currently '${existingClinicData.subscription_status}'. Suppressing re-activation from event ${event.event}.`);
          res.status(200).send("OK: clinic already cancelled");
          return;
        }
        await getDb().collection("subscriptions").doc(sub.id).set({
          id: sub.id,
          clinic_id: clinicId,
          plan_name: `${tier.toUpperCase()} Plan`,
          tier,
          billing_cycle: cycle,
          status: isTrial ? "trial" : "active",
          is_trial: Boolean(isTrial),
          trial_ends_at: trialEndsAt,
          auto_renew: true,
          created_at: new Date().toISOString(),
          payment_id: null,
          razorpay_subscription_id: sub.id
        }, { merge: true });

        const clinicUpdates: any = {
          subscription_status: isTrial ? "trial" : "active",
          subscription_plan: tier,
          subscription_billing_cycle: cycle,
          razorpay_subscription_id: sub.id,
          subscription_auto_renew: true,
          subscription_activated_at: new Date().toISOString(),
          subscription_updated_at: new Date().toISOString()
        };

        if (isTrial) {
          clinicUpdates.trial_used = true;
          clinicUpdates.has_used_trial = true;
          clinicUpdates.trial_activated = true;
          clinicUpdates.trial_completed = false;
          clinicUpdates.trial_status = "active_trial";
          clinicUpdates.trial_started_at = new Date().toISOString();
          clinicUpdates.trial_ends_at = trialEndsAt;

          // Record in trial_records upon confirmed authenticated payment
          const clinicDoc = await getDb().collection("clinics").doc(clinicId).get();
          const clinicData = clinicDoc.data() || {};
          const clinicEmail = (clinicData.email || "").toLowerCase().trim();

          await getDb().collection("trial_records").doc(clinicEmail || clinicId).set({
            email: clinicEmail,
            clinic_id: clinicId,
            tier,
            cycle,
            trial_started_at: new Date().toISOString(),
            trial_ends_at: trialEndsAt,
            trial_activated: true,
            status: "active_trial",
            created_at: new Date().toISOString()
          }, { merge: true });
        }

        await getDb().collection("clinics").doc(clinicId).update(clinicUpdates);

        // Update all users belonging to this clinic
        const clinicUsers = await getDb().collection("users").where("clinic_id", "==", clinicId).get();
        for (const uDoc of clinicUsers.docs) {
          const userUpdates: any = {
            clinic_subscription_status: isTrial ? "trial" : "active",
            subscription_plan: tier,
            subscription_billing_cycle: cycle
          };
          if (isTrial) {
            userUpdates.trial_used = true;
            userUpdates.has_used_trial = true;
            userUpdates.trial_completed = false;
            userUpdates.trial_ends_at = trialEndsAt;
          }
          await uDoc.ref.update(userUpdates).catch(() => {});
        }

        // Send email confirmation
        const targetEmail = sub.customer_details?.email || clinicUsers.docs[0]?.data()?.email;
        if (targetEmail) {
          try {
            const planPricing: Record<string, Record<string, number>> = {
              solo: { monthly: 2999, annual: 29990 },
              clinic: { monthly: 5999, annual: 59990 },
              multispecialty: { monthly: 11999, annual: 119990 },
            };
            const planAmount = planPricing[tier]?.[cycle] || (tier === 'multispecialty' ? 11999 : tier === 'clinic' ? 5999 : 2999);
            const invNum = `VIITSA-${isTrial ? 'TRL' : 'SUB'}-${Date.now().toString().slice(-6)}`;

            let invBuffer: Buffer | null = null;
            try {
              invBuffer = await generateSubscriptionInvoicePdf({
                invoiceNumber: invNum,
                invoiceDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                status: isTrial ? 'TRIAL ACTIVE' : 'ACTIVE',
                clinicName: sub.customer_details?.name || clinicUsers.docs[0]?.data()?.name || 'Clinic Partner',
                customerEmail: targetEmail,
                planName: `${tier.toUpperCase()} Plan (${cycle.toUpperCase()})`,
                tier,
                cycle,
                amount: isTrial ? 0 : planAmount,
                paymentId: sub.id,
                isTrial: !!isTrial,
                notes: isTrial ? '30-Day Free Trial Activated. Auto-mandate registered.' : 'Subscription plan activated.',
              });
            } catch (pdfErr) {
              console.error("Error generating subscription PDF:", pdfErr);
            }

            const mailOptions: any = {
              from: `"Viitsa Healthcare" <${process.env.TITAN_EMAIL || "support@viitsa.com"}>`,
              to: targetEmail,
              subject: isTrial
                ? `30-Day Free Trial Activated: ${tier.toUpperCase()} Plan | Viitsa Healthcare`
                : `Subscription Activated: ${tier.toUpperCase()} Plan (${cycle.toUpperCase()}) | Viitsa Healthcare`,
              html: buildRazorpayEmailHtml({
                subtitle: isTrial ? "Free Trial Activated" : "Subscription Active",
                badgeIcon: "✓",
                badgeBg: "#ecfdf5",
                badgeColor: "#0F6E56",
                heading: isTrial ? "30-Day Free Trial Activated!" : "Subscription Confirmed",
                recipientName: "Doctor / Clinic Administrator",
                leadText: isTrial 
                  ? `Your <strong>30-day free trial</strong> for the <strong>${tier.toUpperCase()} Plan (${cycle})</strong> has been successfully activated.` 
                  : `Your subscription to the <strong>${tier.toUpperCase()} Plan (${cycle})</strong> is active.`,
                details: [
                  { label: "Plan", value: `${tier.toUpperCase()} Plan` },
                  { label: "Billing Cycle", value: cycle.toUpperCase() },
                  ...(isTrial ? [{ label: "Trial Ends On", value: new Date(trialEndsAt!).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) }] : []),
                  { label: "Mandate", value: "Active (UPI Autopay / Card)" },
                  { label: "Auto-Debit", value: isTrial ? "Starts on Day 31 automatically" : "Recurring on schedule" },
                ],
                subnote: "We've attached your official document as a PDF to this email. You can cancel anytime before your trial ends from your clinic billing settings without being charged.",
                buttonText: "Go to Clinic Dashboard",
                buttonUrl: "https://viitsa.com/clinic/dashboard"
              })
            };

            if (invBuffer) {
              mailOptions.attachments = [
                {
                  filename: `Viitsa_${isTrial ? 'Trial_Receipt' : 'Invoice'}_${invNum}.pdf`,
                  content: invBuffer,
                  contentType: 'application/pdf',
                }
              ];
            }

            await getTransporter().sendMail(mailOptions);
          } catch (e) {
            console.warn("Could not send subscription activation email:", e);
          }
        }

        // Dispatch WhatsApp notification to clinic
        try {
          const clinicDoc = await getDb().collection("clinics").doc(clinicId).get();
          const clinicData = clinicDoc.data() || {};
          let cPhone = clinicData.phone || clinicData.contact_phone || sub.customer_details?.contact;
          if (!cPhone && clinicUsers.docs.length > 0) {
            cPhone = clinicUsers.docs[0].data()?.phone;
          }
          if (!cPhone && (clinicData.owner_user_id || clinicData.admin_user_id)) {
            const uSnap = await getDb().collection("users").doc(clinicData.owner_user_id || clinicData.admin_user_id).get();
            if (uSnap.exists) {
              cPhone = uSnap.data()?.phone;
            }
          }
          if (cPhone) {
            if (isTrial) {
              await sendClinicTrialActivated({
                to: cPhone,
                adminName: clinicData.owner_name || 'Doctor',
                clinicName: clinicData.name || 'Clinic',
                planTier: `${tier.toUpperCase()} Plan`,
                trialValidUntil: new Date(trialEndsAt!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                supportPhone: '+91 73961 11081',
                clinicId,
              });
              await getDb().collection("clinics").doc(clinicId).update({
                last_trial_wa_sent_at: new Date().toISOString()
              }).catch(() => {});
            } else {
              const planPricing: Record<string, Record<string, number>> = {
                solo: { monthly: 2999, annual: 29990 },
                clinic: { monthly: 5999, annual: 59990 },
                multispecialty: { monthly: 11999, annual: 119990 },
              };
              const planAmount = planPricing[tier]?.[cycle] || 5999;
              await sendClinicSubActivated({
                to: cPhone,
                adminName: clinicData.owner_name || 'Doctor',
                clinicName: clinicData.name || 'Clinic',
                planName: `${tier.toUpperCase()} Plan`,
                billingCycle: cycle.toUpperCase(),
                amountPaid: planAmount,
                nextRenewalDate: new Date(Date.now() + (cycle === 'annual' ? 365 : 30) * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                supportPhone: '+91 73961 11081',
                clinicId,
              });
            }
          }
        } catch (waErr) {
          console.warn("Could not dispatch WhatsApp subscription activation:", waErr);
        }
      }
    } else if (event.event === "subscription.charged") {
      const sub = event.payload.subscription.entity;
      const payment = event.payload.payment.entity;
      const clinicId = sub.notes?.clinic_id;
      const tier = sub.notes?.tier || "clinic";
      const cycle = sub.notes?.cycle || "monthly";

      // Detect if this is the initial free-trial token authentication charge (₹5 / ₹0) or if we are still within the 30-day trial window
      const isTrialSub = sub.notes?.is_trial === "true" || (sub.start_at && (sub.start_at * 1000 > Date.now()));
      const isTokenAmount = payment?.amount && payment.amount <= 500; // <= ₹5 token mandate charge
      const isTrialCharge = Boolean(isTrialSub || isTokenAmount);
      const trialEndsAt = sub.start_at 
        ? new Date(sub.start_at * 1000).toISOString() 
        : new Date(Date.now() + 30 * 86400000).toISOString();

      if (clinicId) {
        if (isTrialCharge) {
          // ── 30-DAY FREE TRIAL MANDATE CHARGE (₹5 Token / Setup) ──
          // The clinic is starting their 30-day trial period. Keep status as 'trial' and trial_completed as FALSE!
          await getDb().collection("subscriptions").doc(sub.id).set({
            id: sub.id,
            clinic_id: clinicId,
            plan_name: `${tier.toUpperCase()} Plan (30-Day Free Trial)`,
            tier,
            billing_cycle: cycle,
            status: "trial",
            is_trial: true,
            trial_ends_at: trialEndsAt,
            auto_renew: true,
            created_at: new Date().toISOString(),
            payment_id: payment?.id || null,
            razorpay_subscription_id: sub.id,
            amount: payment?.amount ? payment.amount / 100 : 5
          }, { merge: true });

          await getDb().collection("clinics").doc(clinicId).update({
            subscription_status: "trial",
            subscription_plan: tier,
            subscription_billing_cycle: cycle,
            trial_status: "active_trial",
            trial_completed: false,
            trial_used: true,
            trial_activated: true,
            trial_started_at: new Date().toISOString(),
            trial_ends_at: trialEndsAt,
            razorpay_subscription_id: sub.id,
            last_payment_id: payment?.id || null,
            last_payment_status: "paid",
            subscription_updated_at: new Date().toISOString()
          });

          const clinicUsers = await getDb().collection("users").where("clinic_id", "==", clinicId).get();
          for (const uDoc of clinicUsers.docs) {
            await uDoc.ref.update({
              clinic_subscription_status: "trial",
              subscription_plan: tier,
              subscription_billing_cycle: cycle,
              trial_completed: false,
              trial_used: true,
              trial_ends_at: trialEndsAt
            }).catch(() => {});
          }

          // NOTE: viitsa_clinic_trial_activated WhatsApp template is canonically dispatched by subscription.authenticated.
          // Skipping duplicate dispatch in subscription.charged to prevent double-messaging.
          console.log(`[RazorpayWebhook] subscription.charged: trial token charge confirmed for clinic ${clinicId}. Skipping duplicate trial activation WhatsApp dispatch.`);
        } else {
          // ── ACTUAL POST-TRIAL FULL PLAN RENEWAL CHARGE (e.g. ₹5,999) ──
          // The 30-day trial has completed and the recurring monthly/annual plan debit occurred
          await getDb().collection("subscriptions").add({
            id: `renewal_${Date.now()}`,
            clinic_id: clinicId,
            plan_name: `${tier.toUpperCase()} Plan Renewal`,
            tier,
            billing_cycle: cycle,
            status: "active",
            created_at: new Date().toISOString(),
            payment_id: payment?.id || null,
            razorpay_subscription_id: sub.id,
            amount: payment?.amount ? payment.amount / 100 : null
          });

          await getDb().collection("clinics").doc(clinicId).update({
            subscription_status: "active",
            subscription_plan: tier,
            subscription_billing_cycle: cycle,
            trial_status: "converted",
            trial_completed: true,
            last_renewal_at: new Date().toISOString(),
            last_payment_id: payment?.id || null,
            last_payment_status: "paid"
          });

          const clinicUsers = await getDb().collection("users").where("clinic_id", "==", clinicId).get();
          for (const uDoc of clinicUsers.docs) {
            await uDoc.ref.update({
              clinic_subscription_status: "active",
              subscription_plan: tier,
              subscription_billing_cycle: cycle,
              trial_completed: true
            }).catch(() => {});
          }

          // Send payment confirmation email and WhatsApp
          const targetEmail = sub.customer_details?.email || clinicUsers.docs[0]?.data()?.email;
          if (targetEmail) {
            try {
              const planPricing: Record<string, Record<string, number>> = {
                solo: { monthly: 2999, annual: 29990 },
                clinic: { monthly: 5999, annual: 59990 },
                multispecialty: { monthly: 11999, annual: 119990 },
              };
              const renewalAmount = payment?.amount ? (payment.amount / 100) : (planPricing[tier]?.[cycle] || 5999);
              const invNum = `VIITSA-REN-${Date.now().toString().slice(-6)}`;

              let renPdf: Buffer | null = null;
              try {
                renPdf = await generateSubscriptionInvoicePdf({
                  invoiceNumber: invNum,
                  invoiceDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                  status: "PAID",
                  clinicName: sub.customer_details?.name || clinicUsers.docs[0]?.data()?.name || 'Clinic Partner',
                  customerEmail: targetEmail,
                  planName: `${tier.toUpperCase()} Plan Renewal (${cycle.toUpperCase()})`,
                  tier,
                  cycle,
                  amount: renewalAmount,
                  paymentId: payment?.id || sub.id,
                  isTrial: false,
                  notes: 'Subscription renewal payment successfully processed via mandate.',
                });
              } catch (pdfErr) {
                console.error("Error generating renewal PDF:", pdfErr);
              }

              const mailOptions: any = {
                from: `"Viitsa Healthcare" <${process.env.TITAN_EMAIL || "support@viitsa.com"}>`,
                to: targetEmail,
                subject: `Subscription Renewed: ${tier.toUpperCase()} Plan (${cycle.toUpperCase()}) | Viitsa Healthcare`,
                html: buildRazorpayEmailHtml({
                  subtitle: "Subscription Renewed",
                  badgeIcon: "✓",
                  badgeBg: "#ecfdf5",
                  badgeColor: "#0F6E56",
                  heading: "Subscription Renewed Successfully",
                  recipientName: "Doctor / Clinic Administrator",
                  leadText: `Your recurring subscription payment for the <strong>${tier.toUpperCase()} Plan (${cycle.toUpperCase()})</strong> has been successfully processed.`,
                  details: [
                    { label: "Plan", value: `${tier.toUpperCase()} Plan` },
                    { label: "Billing Cycle", value: cycle.toUpperCase() },
                    { label: "Amount Paid", value: `₹${renewalAmount.toLocaleString('en-IN')}` },
                    { label: "Payment ID", value: payment?.id || 'Autopay Mandate' },
                    { label: "Next Renewal", value: new Date(Date.now() + (cycle === 'annual' ? 365 : 30) * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
                  ],
                  subnote: "Your clinic subscription remains fully active with continuous access to all doctor seats and features. Your official tax invoice PDF has been attached to this email.",
                  buttonText: "Go to Clinic Dashboard",
                  buttonUrl: "https://viitsa.com/clinic/dashboard"
                })
              };

              if (renPdf) {
                mailOptions.attachments = [
                  {
                    filename: `Viitsa_Renewal_Invoice_${invNum}.pdf`,
                    content: renPdf,
                    contentType: 'application/pdf',
                  }
                ];
              }

              await getTransporter().sendMail(mailOptions);
            } catch (e) {
              console.warn("Could not send subscription renewal confirmation email:", e);
            }
          }

          // Dispatch WhatsApp renewal notification
          try {
            const clinicDoc = await getDb().collection("clinics").doc(clinicId).get();
            const clinicData = clinicDoc.data() || {};
            let cPhone = clinicData.phone || clinicData.contact_phone || sub.customer_details?.contact || payment?.contact;
            if (!cPhone && clinicUsers.docs.length > 0) {
              cPhone = clinicUsers.docs[0].data()?.phone;
            }
            if (!cPhone && (clinicData.owner_user_id || clinicData.admin_user_id)) {
              const uSnap = await getDb().collection("users").doc(clinicData.owner_user_id || clinicData.admin_user_id).get();
              if (uSnap.exists) {
                cPhone = uSnap.data()?.phone;
              }
            }
            if (cPhone) {
              const planPricing: Record<string, Record<string, number>> = {
                solo: { monthly: 2999, annual: 29990 },
                clinic: { monthly: 5999, annual: 59990 },
                multispecialty: { monthly: 11999, annual: 119990 },
              };
              const paidAmt = payment?.amount ? (payment.amount / 100) : (planPricing[tier]?.[cycle] || 5999);
              await sendClinicPaymentSuccess({
                to: cPhone,
                adminName: clinicData.owner_name || 'Doctor',
                clinicName: clinicData.name || 'Clinic',
                planName: `${tier.toUpperCase()} Plan`,
                amount: paidAmt,
                transactionId: payment?.id || sub.id,
                nextRenewalDate: new Date(Date.now() + (cycle === 'annual' ? 365 : 30) * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                supportPhone: '+91 73961 11081',
                clinicId,
              });
            }
          } catch (waErr) {
            console.warn("Could not dispatch WhatsApp renewal notification:", waErr);
          }
        }
      }
    } else if (event.event === "subscription.cancelled" || event.event === "subscription.halted") {
      const sub = event.payload.subscription.entity;
      const clinicId = sub.notes?.clinic_id;
      
      if (clinicId) {
        const isHalted = event.event === "subscription.halted";
        const query = await getDb().collection("subscriptions").where("razorpay_subscription_id", "==", sub.id).get();
        const batch = getDb().batch();
        query.docs.forEach(doc => {
          batch.update(doc.ref, { status: isHalted ? "deactivated" : "cancelled" });
        });
        await batch.commit();

        const nowIso = new Date().toISOString();
        await getDb().collection("clinics").doc(clinicId).update({
          subscription_status: isHalted ? "deactivated" : "cancelled",
          subscription_cancelled_at: isHalted ? null : nowIso,
          subscription_deactivated_at: isHalted ? nowIso : null,
          last_sub_cancelled_wa_sent_at: isHalted ? null : nowIso,
        });

        // Dispatch WhatsApp template
        try {
          const clinicDoc = await getDb().collection("clinics").doc(clinicId).get();
          const clinicData = clinicDoc.data() || {};
          const cPhone = clinicData.phone || clinicData.contact_phone || sub.customer_details?.contact;
          if (cPhone) {
            if (isHalted) {
              await sendClinicSubDeactivated({
                to: cPhone,
                adminName: clinicData.owner_name || 'Doctor',
                clinicName: clinicData.name || 'Clinic',
                planName: `${(clinicData.subscription_plan || 'Clinic').toUpperCase()} Plan`,
                deactivationDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                status: 'Deactivated - Overdue',
                supportPhone: '+91 73961 11081',
                clinicId,
              });
            } else {
              await sendClinicSubCancelled({
                to: cPhone,
                adminName: clinicData.owner_name || 'Doctor',
                clinicName: clinicData.name || 'Clinic',
                cancelledPlan: `${(clinicData.subscription_plan || 'Clinic').toUpperCase()} Plan`,
                effectiveDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                supportPhone: '+91 73961 11081',
                clinicId,
              });
            }
          }
        } catch (waErr) {
          console.warn("Could not dispatch WhatsApp cancellation/deactivation template:", waErr);
        }
      }
    } else if (event.event === "payment.failed") {
      const payment = event.payload.payment?.entity;
      const clinicId = payment?.notes?.clinic_id;
      if (clinicId) {
        try {
          const clinicDoc = await getDb().collection("clinics").doc(clinicId).get();
          const clinicData = clinicDoc.data() || {};
          const cPhone = clinicData.phone || clinicData.contact_phone || payment?.contact;
          if (cPhone) {
            await sendClinicPaymentFailed({
              to: cPhone,
              adminName: clinicData.owner_name || 'Doctor',
              clinicName: clinicData.name || 'Clinic',
              planName: `${(clinicData.subscription_plan || 'Clinic').toUpperCase()} Plan`,
              dueAmount: payment?.amount ? (payment.amount / 100) : 5999,
              reason: payment?.error_description || 'Card expired or mandate declined',
              gracePeriodEnd: new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
              supportPhone: '+91 73961 11081',
              clinicId,
            });
          }
        } catch (waErr) {
          console.warn("Could not dispatch WhatsApp payment failed template:", waErr);
        }
      }
    } else if (event.event === "payment.captured") {
      const payment = event.payload.payment?.entity;
      const clinicId = payment?.notes?.clinic_id;
      if (clinicId && !payment?.subscription_id) {
        await getDb().collection("clinics").doc(clinicId).update({
          last_payment_id: payment.id,
          last_payment_status: "paid",
          subscription_updated_at: new Date().toISOString()
        }).catch(() => {});
      }
    } else if (event.event === "payment_link.paid") {
      const plink = event.payload.payment_link?.entity;
      const payment = event.payload.payment?.entity;
      let clinicId = plink?.notes?.clinic_id;

      let tier = plink?.notes?.tier;
      let cycle = plink?.notes?.cycle || "monthly";

      const urlOrId = `${plink?.short_url || ''} ${plink?.id || ''}`;

      // Annual links
      if (urlOrId.includes("xlfXiVqg") || plink?.amount === 2999000) {
        tier = "solo";
        cycle = "annual";
      } else if (urlOrId.includes("9OYAB40N") || plink?.amount === 5999000) {
        tier = "clinic";
        cycle = "annual";
      } else if (urlOrId.includes("0PqwSVE") || plink?.amount === 11999000) {
        tier = "multispecialty";
        cycle = "annual";
      } 
      // Monthly links
      else if (urlOrId.includes("OhKLJYzS") || plink?.amount === 599900) {
        tier = "clinic";
        cycle = "monthly";
      } else if (urlOrId.includes("XDAYYlHQ") || plink?.amount === 1199900) {
        tier = "multispecialty";
        cycle = "monthly";
      } else if (!tier) {
        tier = "clinic";
      }

      // If clinicId is not in notes, attempt lookup by customer email
      if (!clinicId && plink?.customer?.email) {
        const userSnap = await getDb().collection("users").where("email", "==", plink.customer.email.toLowerCase()).limit(1).get();
        if (!userSnap.empty) {
          clinicId = userSnap.docs[0].data().clinic_id;
        }
      }

      if (clinicId) {
        await getDb().collection("subscriptions").add({
          id: plink?.id || `plink_${Date.now()}`,
          clinic_id: clinicId,
          plan_name: `${tier.toUpperCase()} Plan`,
          tier,
          billing_cycle: cycle,
          status: "active",
          created_at: new Date().toISOString(),
          payment_id: payment?.id || null,
          payment_link_id: plink?.id || null,
          payment_status: "paid"
        });
        await getDb().collection("clinics").doc(clinicId).update({
          subscription_status: "active",
          subscription_plan: tier,
          subscription_billing_cycle: cycle,
          subscription_updated_at: new Date().toISOString(),
          last_payment_id: payment?.id || null,
          last_payment_link_id: plink?.id || null,
          last_payment_status: "paid"
        });

        // Also update users under this clinic
        const clinicUsers = await getDb().collection("users").where("clinic_id", "==", clinicId).get();
        for (const uDoc of clinicUsers.docs) {
          await uDoc.ref.update({
            clinic_subscription_status: "active",
            subscription_plan: tier,
            subscription_billing_cycle: cycle
          }).catch(() => {});
        }

        // Send confirmation email
        const targetEmail = plink?.customer?.email || clinicUsers.docs[0]?.data()?.email;
        if (targetEmail) {
          try {
            const planPricing: Record<string, Record<string, number>> = {
              solo: { monthly: 2999, annual: 29990 },
              clinic: { monthly: 5999, annual: 59990 },
              multispecialty: { monthly: 11999, annual: 119990 },
            };
            const linkAmount = payment?.amount ? (payment.amount / 100) : (plink?.amount ? plink.amount / 100 : (planPricing[tier]?.[cycle] || 5999));
            const invNum = `VIITSA-INV-${Date.now().toString().slice(-6)}`;

            let paidPdf: Buffer | null = null;
            try {
              paidPdf = await generateSubscriptionInvoicePdf({
                invoiceNumber: invNum,
                invoiceDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                status: "PAID",
                clinicName: plink?.customer?.name || clinicUsers.docs[0]?.data()?.name || 'Clinic Partner',
                customerEmail: targetEmail,
                planName: `${tier.toUpperCase()} Plan (${cycle.toUpperCase()})`,
                tier,
                cycle,
                amount: linkAmount,
                paymentId: payment?.id || plink?.id || 'Online Payment',
                notes: 'Payment confirmed via Razorpay Payment Link.',
              });
            } catch (pdfErr) {
              console.error("Error generating payment_link PDF:", pdfErr);
            }

            const mailOptions: any = {
              from: `"Viitsa Healthcare" <${process.env.TITAN_EMAIL || "support@viitsa.com"}>`,
              to: targetEmail,
              subject: `Subscription Confirmed: ${tier.toUpperCase()} Plan (${cycle.toUpperCase()}) | Viitsa Healthcare`,
              html: buildRazorpayEmailHtml({
                subtitle: "Subscription Confirmed",
                badgeIcon: "✓",
                badgeBg: "#ecfdf5",
                badgeColor: "#0F6E56",
                heading: "Subscription Payment Confirmed",
                recipientName: "Doctor / Clinic Administrator",
                leadText: `We have received payment for your <strong>${tier.toUpperCase()} Plan (${cycle.toUpperCase()})</strong>. Your clinic is active and synchronized in real time.`,
                details: [
                  { label: "Active Plan", value: `${tier.toUpperCase()} Plan` },
                  { label: "Cycle", value: cycle.toUpperCase() },
                  { label: "Payment ID", value: payment?.id || plink?.id || 'Paid Online' },
                  { label: "Status", value: "Active & Synced" },
                ],
                subnote: "Your clinic is fully active in real time. Your official tax invoice PDF has been attached to this email. Thank you for choosing Viitsa Healthcare!",
                buttonText: "Go to Clinic Dashboard",
                buttonUrl: "https://viitsa.com/clinic/dashboard"
              })
            };

            if (paidPdf) {
              mailOptions.attachments = [
                {
                  filename: `Viitsa_Tax_Invoice_${invNum}.pdf`,
                  content: paidPdf,
                  contentType: 'application/pdf',
                }
              ];
            }

            await getTransporter().sendMail(mailOptions);
          } catch (e) {
            console.warn("Could not send webhook confirmation email:", e);
          }
        }

        // Dispatch WhatsApp notification to clinic
        try {
          const clinicDoc = await getDb().collection("clinics").doc(clinicId).get();
          const clinicData = clinicDoc.data() || {};
          let cPhone = clinicData.phone || clinicData.contact_phone || plink?.customer?.contact || payment?.contact;
          if (!cPhone && clinicUsers.docs.length > 0) {
            cPhone = clinicUsers.docs[0].data()?.phone;
          }
          if (!cPhone && (clinicData.owner_user_id || clinicData.admin_user_id)) {
            const uSnap = await getDb().collection("users").doc(clinicData.owner_user_id || clinicData.admin_user_id).get();
            if (uSnap.exists) {
              cPhone = uSnap.data()?.phone;
            }
          }
          if (cPhone) {
            const planPricing: Record<string, Record<string, number>> = {
              solo: { monthly: 2999, annual: 29990 },
              clinic: { monthly: 5999, annual: 59990 },
              multispecialty: { monthly: 11999, annual: 119990 },
            };
            const paidAmt = payment?.amount ? (payment.amount / 100) : (plink?.amount ? plink.amount / 100 : (planPricing[tier]?.[cycle] || 5999));
            const durationDays = cycle === 'annual' ? 365 : 30;

            await sendClinicSubActivated({
              to: cPhone,
              adminName: clinicData.owner_name || plink?.customer?.name || 'Doctor',
              clinicName: clinicData.name || 'Clinic',
              planName: `${tier.toUpperCase()} Plan`,
              billingCycle: cycle.toUpperCase(),
              amountPaid: paidAmt,
              nextRenewalDate: new Date(Date.now() + durationDays * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
              supportPhone: '+91 73961 11081',
              clinicId,
            });
          }
        } catch (waErr) {
          console.warn("Could not dispatch WhatsApp payment link confirmation:", waErr);
        }
      }
    } else if (event.event === "invoice.paid") {
      const invoice = event.payload.invoice.entity;
      const email = invoice.customer_details?.email;
      const amountStr = (invoice.amount / 100).toFixed(2);
      const invoiceId = invoice.invoice_number || invoice.id || "UNKNOWN";
      
      const clinicId = invoice.notes?.clinic_id || event.payload.subscription?.entity?.notes?.clinic_id || invoice.customer_details?.name || "";

      try {
        await getDb().collection("invoices").doc(invoiceId).set({
          invoice_number: invoiceId,
          clinic_id: clinicId,
          clinic_name: invoice.customer_details?.name || 'Clinic',
          amount: invoice.amount / 100,
          status: 'paid',
          payment_status: 'paid',
          type: 'subscription',
          created_at: new Date(invoice.issued_at * 1000 || Date.now()).toISOString(),
          updated_at: new Date().toISOString(),
          description: 'Viitsa Clinic Pro - Subscription Plan',
          email: email || '',
          razorpay_invoice_id: invoice.id || '',
          razorpay_payment_id: invoice.payment_id || ''
        }, { merge: true });
      } catch (e) {
        console.error("Failed to save invoice to db:", e);
      }

      if (email) {
        try {
          // Generate Beautiful PDF
          const pdfBuffer = await new Promise<Buffer>((resolve) => {
            const doc = new PDFDocument({ margin: 0, size: 'A4' });
            const buffers: Buffer[] = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // Top Banner
            doc.rect(0, 0, 595.28, 10).fill('#05C994');

            // Header
            doc.fontSize(24).fillColor('#0f6e56').text('VIITSA', 40, 40);
            doc.fontSize(10).fillColor('#64748b').text('Smarter Healthcare, For Everyone', 40, 70);
            
            doc.fontSize(20).fillColor('#0f172a').text('SUBSCRIPTION INVOICE', 300, 40, { align: 'right' });
            
            // Meta details
            doc.fontSize(10).fillColor('#475569');
            doc.text(`Invoice No: ${invoiceId}`, 300, 70, { align: 'right' });
            doc.text(`Date: ${new Date(invoice.issued_at * 1000 || Date.now()).toLocaleDateString()}`, 300, 85, { align: 'right' });
            doc.text(`Status: PAID`, 300, 100, { align: 'right' });

            // Billed To
            doc.fontSize(12).fillColor('#0f172a').text('Billed To:', 40, 120);
            doc.fontSize(10).fillColor('#475569').text(invoice.customer_details?.name || 'Clinic', 40, 140);
            doc.text(email, 40, 155);
            doc.text(invoice.customer_details?.contact || '', 40, 170);

            // Table Header
            doc.rect(40, 210, 515.28, 30).fill('#f1f5f9');
            doc.fontSize(10).fillColor('#0f172a').text('Description', 50, 220);
            doc.text('Amount', 450, 220, { width: 90, align: 'right' });

            // Table Row
            doc.rect(40, 240, 515.28, 40).stroke('#e2e8f0');
            doc.fillColor('#334155').text('Viitsa Clinic Pro - Subscription Plan', 50, 255);
            doc.text(`Rs. ${amountStr}`, 450, 255, { width: 90, align: 'right' });

            // Total
            doc.fontSize(14).fillColor('#0f172a').text('Total Paid:', 350, 310);
            doc.fillColor('#05C994').text(`Rs. ${amountStr}`, 450, 310, { width: 90, align: 'right' });

            // Footer
            doc.fontSize(10).fillColor('#94a3b8').text('Thank you for choosing Viitsa. This is a computer-generated invoice.', 40, 800, { align: 'center', width: 515.28 });
            
            doc.end();
          });

          await getTransporter().sendMail({
            from: `"Viitsa Admin" <${process.env.TITAN_EMAIL || "support@viitsa.com"}>`,
            to: email,
            subject: `Your Viitsa Clinic Pro Invoice #${invoiceId}`,
            html: buildRazorpayEmailHtml({
              subtitle: "Invoice & Receipt",
              badgeIcon: "🧾",
              badgeBg: "#ecfdf5",
              badgeColor: "#0F6E56",
              heading: "Payment Receipt & Invoice",
              recipientName: "Doctor / Clinic Administrator",
              leadText: `Thank you for your payment. Your subscription renewal invoice <strong>#${invoiceId}</strong> has been processed successfully.`,
              details: [
                { label: "Invoice Number", value: `#${invoiceId}` },
                { label: "Description", value: "Viitsa Clinic Pro - Subscription Renewal" },
                { label: "Amount Paid", value: `₹${amountStr}` },
                { label: "Status", value: "Settled ✓" },
              ],
              subnote: "Your official tax invoice PDF is attached to this email. You can also view and download invoices anytime from your clinic billing settings.",
              buttonText: "View Billing History",
              buttonUrl: "https://viitsa.com/clinic/settings?tab=billing"
            }),
            attachments: [
              {
                filename: `Viitsa_Invoice_${invoiceId}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
              }
            ]
          });

          // Dispatch WhatsApp template viitsa_clinic_sub_invoice
          let contact = invoice.customer_details?.contact;
          if (!contact && clinicId) {
            try {
              const cDoc = await getDb().collection("clinics").doc(clinicId).get();
              if (cDoc.exists) {
                const cData = cDoc.data() || {};
                contact = cData.phone || cData.contact_phone;
                if (!contact && (cData.owner_user_id || cData.admin_user_id)) {
                  const uSnap = await getDb().collection("users").doc(cData.owner_user_id || cData.admin_user_id).get();
                  if (uSnap.exists) {
                    contact = uSnap.data()?.phone;
                  }
                }
              }
            } catch (cErr) {
              console.warn("Error fetching clinic phone for invoice WhatsApp:", cErr);
            }
          }
          if (contact) {
            try {
              await sendClinicSubInvoice({
                to: contact,
                adminName: invoice.customer_details?.name || 'Doctor',
                clinicName: invoice.customer_details?.name || 'Clinic',
                invoiceNo: invoiceId,
                planName: 'Clinic Pro Subscription',
                totalAmount: amountStr,
                invoiceDate: new Date(invoice.issued_at * 1000 || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                supportPhone: '+91 73961 11081',
                clinicId,
              });
            } catch (waErr) {
              console.warn("Could not dispatch WhatsApp invoice template:", waErr);
            }
          }
        } catch (e) {
          console.error("Error sending invoice email", e);
        }
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing webhook:", error);
    // Acknowledge Razorpay with 200 OK so downstream notification errors do not trigger retry storms
    res.status(200).send("Handled with errors");
  }
});
