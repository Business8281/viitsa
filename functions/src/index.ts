import {setGlobalOptions} from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import Razorpay from "razorpay";
import * as crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

import { aiChat } from './aiChat';
import { sendInstantEmail, sendVerificationEmail, sendPasswordResetEmail } from './email';
import { createClinicSubscription, cancelClinicSubscription, razorpayWebhook } from './razorpay';

export { aiChat, sendInstantEmail, sendVerificationEmail, sendPasswordResetEmail, createClinicSubscription, cancelClinicSubscription, razorpayWebhook };

if (!admin.apps.length) {
  admin.initializeApp();
}

setGlobalOptions({
  region: "asia-south1",
  memory: "256MiB",
});

export const onAppointmentCreated = onDocumentCreated("appointments/{appointmentId}", async (event) => {
  return;
});

export const onClinicVerificationStatusChanged = onDocumentUpdated("clinics/{clinicId}", async (event) => {
  return;
});

export const createRazorpayOrder = onCall(async (request) => {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  });

  const { amount, currency, receipt } = request.data;
  
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
  const { razorpay_order_id, razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = request.data;
  
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in to verify payment.");
  }
  
  if (!razorpay_payment_id || !razorpay_signature) {
    throw new HttpsError("invalid-argument", "Missing payment ID or signature.");
  }

  if (!razorpay_order_id && !razorpay_subscription_id) {
    throw new HttpsError("invalid-argument", "Missing order ID or subscription ID.");
  }
  
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  
  // For subscriptions, the signature payload is payment_id|subscription_id
  // For orders, it's order_id|payment_id
  let body = "";
  if (razorpay_subscription_id) {
    body = razorpay_payment_id + "|" + razorpay_subscription_id;
  } else {
    body = razorpay_order_id + "|" + razorpay_payment_id;
  }
  
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body.toString())
    .digest("hex");
    
  if (expectedSignature === razorpay_signature) {
    return { success: true };
  } else {
    throw new HttpsError("invalid-argument", "Invalid signature.");
  }
});
