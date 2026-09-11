/**
 * Email service — Firebase-only implementation.
 * Appointment confirmation emails are sent via Firebase Cloud Functions.
 * Supabase Edge Functions have been removed from this project.
 *
 * For now, this is a client-side no-op; production emails should be
 * triggered by a Firestore onCreate trigger on the `appointments` collection.
 */

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendEmail(_params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  // Email delivery is handled server-side via Firebase Cloud Functions.
  // No Supabase dependency required.
  return { success: true };
}
