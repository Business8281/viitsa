import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

dotenv.config();

export const whatsappWebhook = onRequest(
  {
    region: "asia-south1",
    memory: "256MiB",
    cors: true,
  },
  async (req, res) => {
    // -------------------------------------------------------------
    // 1. GET Request: Meta Webhook Verification Challenge
    // -------------------------------------------------------------
    if (req.method === "GET") {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      const expectedToken =
        process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "viitsa_whatsapp_webhook_secret_2026";

      if (mode === "subscribe" && token === expectedToken) {
        console.log("[WhatsAppWebhook] Webhook successfully verified with Meta!");
        res.status(200).send(challenge);
        return;
      } else {
        console.warn("[WhatsAppWebhook] Verification token mismatch. Received:", token);
        res.status(403).send("Forbidden: Invalid verification token");
        return;
      }
    }

    // -------------------------------------------------------------
    // 2. POST Request: Inbound Events (Delivery Statuses & Messages)
    // -------------------------------------------------------------
    if (req.method === "POST") {
      const body = req.body;

      try {
        if (!admin.apps.length) admin.initializeApp();
        const db = admin.firestore();

        if (body?.object === "whatsapp_business_account" && Array.isArray(body?.entry)) {
          for (const entry of body.entry) {
            for (const change of entry.changes || []) {
              const val = change.value;
              if (!val) continue;

              // Handle message delivery status updates (sent -> delivered -> read / failed)
              if (Array.isArray(val.statuses)) {
                for (const statusObj of val.statuses) {
                  const messageId = statusObj.id;
                  const newStatus = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
                  const recipientId = statusObj.recipient_id;
                  const errors = statusObj.errors;

                  console.log(`[WhatsAppWebhook] Status Update: ${messageId} -> ${newStatus} (Recipient: ${recipientId || 'N/A'})`);

                  // Update matching document in `whatsapp_logs`
                  const logsSnap = await db
                    .collection("whatsapp_logs")
                    .where("meta_message_id", "==", messageId)
                    .limit(1)
                    .get();

                  if (!logsSnap.empty) {
                    const docRef = logsSnap.docs[0].ref;
                    await docRef.update({
                      status: newStatus,
                      recipient_phone: recipientId || undefined,
                      status_updated_at: admin.firestore.FieldValue.serverTimestamp(),
                      ...(errors ? { delivery_error: errors } : {}),
                    });
                  }
                }
              }

              // Handle incoming patient/user messages
              if (Array.isArray(val.messages)) {
                for (const msg of val.messages) {
                  const fromPhone = msg.from;
                  const msgId = msg.id;
                  const msgType = msg.type;
                  const textBody = msg.text?.body || "";
                  const timestamp = msg.timestamp;

                  console.log(`[WhatsAppWebhook] Inbound Message from ${fromPhone}: ${textBody}`);

                  await db.collection("whatsapp_inbound_messages").add({
                    from: fromPhone,
                    meta_message_id: msgId,
                    type: msgType,
                    body: textBody,
                    raw_payload: msg,
                    received_at: admin.firestore.FieldValue.serverTimestamp(),
                    timestamp,
                  });
                }
              }
            }
          }
        }

        res.status(200).send("EVENT_RECEIVED");
        return;
      } catch (err) {
        console.error("[WhatsAppWebhook] Error processing webhook event:", err);
        // Always respond 200 to acknowledge Meta and prevent delivery retries
        res.status(200).send("EVENT_RECEIVED");
        return;
      }
    }

    res.status(405).send("Method Not Allowed");
  }
);
