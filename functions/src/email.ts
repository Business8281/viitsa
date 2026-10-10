import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtpout.secureserver.net",
  port: 465,
  secure: true,
  auth: {
    user: process.env.TITAN_EMAIL,
    pass: process.env.TITAN_PASSWORD,
  },
  pool: true,
  maxConnections: 10,
});

export const sendInstantEmail = onCall(async (request) => {
  const { to, subject, htmlContent, attachments } = request.data;

  if (!to || !subject || !htmlContent) {
    throw new HttpsError("invalid-argument", "Missing required fields: to, subject, htmlContent");
  }

  try {
    const mailOptions: any = {
      from: `"Viitsa Healthcare" <${process.env.TITAN_EMAIL}>`,
      to,
      subject,
      html: htmlContent,
    };

    if (attachments && Array.isArray(attachments)) {
      mailOptions.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content,
        encoding: att.encoding || (att.content ? 'base64' : undefined),
        path: att.path,
        contentType: att.contentType || 'application/pdf',
      }));
    }

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("Email send error:", error);
    throw new HttpsError("internal", "Failed to send email", error.message);
  }
});
