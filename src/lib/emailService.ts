const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface SendEmailParams {
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

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      return { success: false, error: "Unable to send email at this time" };
    }

    const result = await response.json();
    if (result.error) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Unable to send email at this time" };
  }
}
