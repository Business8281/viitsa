import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import Razorpay from "razorpay";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

const transporter = nodemailer.createTransport({
  host: "smtpout.secureserver.net",
  port: 465,
  secure: true,
  auth: {
    user: process.env.TITAN_EMAIL,
    pass: process.env.TITAN_PASSWORD,
  },
});

const getDb = () => admin.firestore();

export const createClinicSubscription = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in to create a subscription.");
  }
  
  const { clinicId, planId, skipTrial } = request.data;
  if (!clinicId || !planId) {
    throw new HttpsError("invalid-argument", "Missing clinicId or planId.");
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  });

  try {
    const payload: any = {
      plan_id: planId,
      customer_notify: 1,
      total_count: 120, // 10 years
      notes: {
        clinic_id: clinicId
      }
    };

    if (!skipTrial) {
      payload.start_at = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days from now
    }
    
    const subscription = await razorpay.subscriptions.create(payload);

    return subscription;
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw new HttpsError("internal", "Unable to create subscription.");
  }
});

export const razorpayWebhook = onRequest(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "viitsa_secret_123";
  const signature = req.headers["x-razorpay-signature"] as string;

  if (!signature) {
    res.status(400).send("Missing signature");
    return;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (expectedSignature !== signature) {
    console.error("Webhook signature mismatch.");
    res.status(400).send("Invalid signature");
    return;
  }

  const event = req.body;

  try {
    if (event.event === "subscription.authenticated") {
      const sub = event.payload.subscription.entity;
      const clinicId = sub.notes?.clinic_id;
      
      if (clinicId) {
        await getDb().collection("subscriptions").doc(sub.id).set({
          id: sub.id,
          clinic_id: clinicId,
          plan_name: "Pro Plan",
          status: "active",
          created_at: new Date().toISOString(),
          payment_id: null,
          razorpay_subscription_id: sub.id
        });
      }
    } else if (event.event === "subscription.charged") {
      const sub = event.payload.subscription.entity;
      const payment = event.payload.payment.entity;
      const clinicId = sub.notes?.clinic_id;
      
      if (clinicId) {
        await getDb().collection("subscriptions").add({
          id: sub.id,
          clinic_id: clinicId,
          plan_name: "Pro Plan",
          status: "active",
          created_at: new Date().toISOString(),
          payment_id: payment.id,
          razorpay_subscription_id: sub.id
        });
      }
    } else if (event.event === "subscription.cancelled" || event.event === "subscription.halted") {
      const sub = event.payload.subscription.entity;
      const clinicId = sub.notes?.clinic_id;
      
      if (clinicId) {
        const query = await getDb().collection("subscriptions").where("razorpay_subscription_id", "==", sub.id).get();
        const batch = getDb().batch();
        query.docs.forEach(doc => {
          batch.update(doc.ref, { status: "cancelled" });
        });
        await batch.commit();
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

          await transporter.sendMail({
            from: `"Viitsa Admin" <${process.env.TITAN_EMAIL}>`,
            to: email,
            subject: `Your Viitsa Clinic Pro Invoice #${invoiceId}`,
            html: `
              <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #05C994; padding: 20px; text-align: center; color: white;">
                  <h2 style="margin:0;">Payment Successful!</h2>
                </div>
                <div style="padding: 30px;">
                  <p>Hello,</p>
                  <p>Thank you for your payment. Your subscription to Viitsa Clinic Pro has been renewed successfully.</p>
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin:0; color: #475569; font-size: 14px;">Amount Paid</p>
                    <p style="margin:5px 0 0 0; font-size: 24px; font-weight: bold; color: #0f172a;">Rs. ${amountStr}</p>
                  </div>
                  <p>We've attached your official subscription invoice as a PDF to this email for your records.</p>
                  <p>Regards,<br/>The Viitsa Team</p>
                </div>
              </div>
            `,
            attachments: [
              {
                filename: `Viitsa_Invoice_${invoiceId}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
              }
            ]
          });
        } catch (e) {
          console.error("Error sending invoice email", e);
        }
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).send("Internal Server Error");
  }
});
