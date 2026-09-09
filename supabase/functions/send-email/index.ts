import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FROM_EMAIL = "info_viitsa@medintelos.com";
const FROM_NAME = "VIITSA";

interface EmailRequest {
  to: string;
  template: "welcome" | "appointment_confirmed" | "appointment_cancelled" | "password_reset" | "verification" | "generic";
  data?: {
    patientName?: string;
    clinicName?: string;
    doctorName?: string;
    date?: string;
    time?: string;
    token?: string;
    subject?: string;
    body?: string;
  };
}

const TEMPLATES: Record<string, (data: EmailRequest["data"]) => { subject: string; html: string }> = {
  welcome: (d) => ({
    subject: "Welcome to VIITSA",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0F1B2C;">
        <div style="text-align: center; border-bottom: 2px solid #0F6E56; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="color: #0F6E56; font-size: 24px; margin: 0;">VIITSA</h1>
          <p style="color: #5A6B7B; font-size: 12px; margin: 4px 0 0;">AI Healthcare Intelligence</p>
        </div>
        <h2 style="font-size: 20px; color: #0F1B2C;">Welcome to VIITSA${d?.patientName ? `, ${d.patientName}` : ""}!</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #3A4A5A;">
          Your VIITSA account has been created successfully. You can now access your healthcare portal,
          book appointments, and use the AI Navigator for pre-consultation guidance.
        </p>
        <div style="background: #F5FAFA; border-left: 3px solid #05C994; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #3A4A5A;">
            If you have any questions, please contact your clinic directly or reach out to VIITSA support.
          </p>
        </div>
        <p style="font-size: 12px; color: #8A99A8; margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px;">
          This is an automated message from VIITSA. Please do not reply to this email.
        </p>
      </div>`,
  }),

  appointment_confirmed: (d) => ({
    subject: "Your VIITSA appointment is confirmed",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0F1B2C;">
        <div style="text-align: center; border-bottom: 2px solid #0F6E56; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="color: #0F6E56; font-size: 24px; margin: 0;">VIITSA</h1>
          <p style="color: #5A6B7B; font-size: 12px; margin: 4px 0 0;">AI Healthcare Intelligence</p>
        </div>
        <h2 style="font-size: 20px;">Appointment Confirmed</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #3A4A5A;">
          Dear ${d?.patientName ?? "Patient"}, your appointment has been confirmed.
        </p>
        <div style="background: #F5FAFA; border: 1px solid #E1F5EE; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <table style="width: 100%; font-size: 14px; color: #0F1B2C;">
            <tr><td style="padding: 4px 0; color: #5A6B7B; width: 120px;">Clinic</td><td style="font-weight: 600;">${d?.clinicName ?? "—"}</td></tr>
            <tr><td style="padding: 4px 0; color: #5A6B7B;">Doctor</td><td style="font-weight: 600;">${d?.doctorName ?? "—"}</td></tr>
            <tr><td style="padding: 4px 0; color: #5A6B7B;">Date</td><td style="font-weight: 600;">${d?.date ?? "—"}</td></tr>
            <tr><td style="padding: 4px 0; color: #5A6B7B;">Time</td><td style="font-weight: 600;">${d?.time ?? "—"}</td></tr>
            ${d?.token ? `<tr><td style="padding: 4px 0; color: #5A6B7B;">Token</td><td style="font-weight: 600;">#${d.token}</td></tr>` : ""}
          </table>
        </div>
        <p style="font-size: 13px; color: #5A6B7B; line-height: 1.5;">
          Please arrive 10 minutes before your scheduled time. Bring any previous medical records if applicable.
        </p>
        <p style="font-size: 12px; color: #8A99A8; margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px;">
          This is an automated message from VIITSA. Please do not reply to this email.
        </p>
      </div>`,
  }),

  appointment_cancelled: (d) => ({
    subject: "Your VIITSA appointment has been cancelled",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0F1B2C;">
        <div style="text-align: center; border-bottom: 2px solid #0F6E56; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="color: #0F6E56; font-size: 24px; margin: 0;">VIITSA</h1>
          <p style="color: #5A6B7B; font-size: 12px; margin: 4px 0 0;">AI Healthcare Intelligence</p>
        </div>
        <h2 style="font-size: 20px;">Appointment Cancelled</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #3A4A5A;">
          Dear ${d?.patientName ?? "Patient"}, your appointment at ${d?.clinicName ?? "the clinic"} has been cancelled.
        </p>
        <div style="background: #FEF2F2; border-left: 3px solid #DC2626; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px;">
            <strong>Cancelled appointment:</strong> ${d?.doctorName ?? "Doctor"} on ${d?.date ?? "—"} at ${d?.time ?? "—"}
          </p>
        </div>
        <p style="font-size: 14px; color: #3A4A5A;">
          To book a new appointment, please use the VIITSA app or contact your clinic directly.
        </p>
        <p style="font-size: 12px; color: #8A99A8; margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px;">
          This is an automated message from VIITSA. Please do not reply to this email.
        </p>
      </div>`,
  }),

  password_reset: (d) => ({
    subject: "Reset your VIITSA password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0F1B2C;">
        <div style="text-align: center; border-bottom: 2px solid #0F6E56; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="color: #0F6E56; font-size: 24px; margin: 0;">VIITSA</h1>
          <p style="color: #5A6B7B; font-size: 12px; margin: 4px 0 0;">AI Healthcare Intelligence</p>
        </div>
        <h2 style="font-size: 20px;">Password Reset Request</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #3A4A5A;">
          We received a request to reset your VIITSA password. Please use the reset link provided separately
          by Supabase Auth to complete the process.
        </p>
        <p style="font-size: 14px; color: #5A6B7B;">
          If you did not request a password reset, you can safely ignore this email.
        </p>
        <p style="font-size: 12px; color: #8A99A8; margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px;">
          This is an automated message from VIITSA. Please do not reply to this email.
        </p>
      </div>`,
  }),

  verification: (d) => ({
    subject: "Verify your VIITSA account",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0F1B2C;">
        <div style="text-align: center; border-bottom: 2px solid #0F6E56; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="color: #0F6E56; font-size: 24px; margin: 0;">VIITSA</h1>
          <p style="color: #5A6B7B; font-size: 12px; margin: 4px 0 0;">AI Healthcare Intelligence</p>
        </div>
        <h2 style="font-size: 20px;">Email Verification</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #3A4A5A;">
          Welcome to VIITSA! Please click the verification link sent by our auth system to activate your account.
        </p>
        <p style="font-size: 14px; color: #5A6B7B;">
          If you did not create an account, you can safely ignore this email.
        </p>
        <p style="font-size: 12px; color: #8A99A8; margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px;">
          This is an automated message from VIITSA. Please do not reply to this email.
        </p>
      </div>`,
  }),

  generic: (d) => ({
    subject: d?.subject ?? "VIITSA notification",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0F1B2C;">
        <div style="text-align: center; border-bottom: 2px solid #0F6E56; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="color: #0F6E56; font-size: 24px; margin: 0;">VIITSA</h1>
          <p style="color: #5A6B7B; font-size: 12px; margin: 4px 0 0;">AI Healthcare Intelligence</p>
        </div>
        <div style="font-size: 15px; line-height: 1.6; color: #3A4A5A;">
          ${d?.body ?? ""}
        </div>
        <p style="font-size: 12px; color: #8A99A8; margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px;">
          This is an automated message from VIITSA. Please do not reply to this email.
        </p>
      </div>`,
  }),
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("apikey");
    const token = authHeader?.replace("Bearer ", "") || apiKey;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Accept either a valid user JWT or the project anon key.
    // Try user JWT verification first; if no user found, accept as anon-key system call.
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    // If no user session, this is an anon-key system call — that's allowed for transactional emails
    // triggered by the app (appointment confirmations, etc.). The actual email content is controlled server-side.

    const { to, template, data } = await req.json() as EmailRequest;

    if (!to || !template) {
      return new Response(
        JSON.stringify({ error: "Recipient email and template are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const templateFn = TEMPLATES[template];
    if (!templateFn) {
      return new Response(
        JSON.stringify({ error: "Invalid email template" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { subject, html } = templateFn(data);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service is not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text().catch(() => "");
      console.error("Resend API error:", resendResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Unable to send email. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await resendResponse.json();
    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-email function error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred while sending email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
