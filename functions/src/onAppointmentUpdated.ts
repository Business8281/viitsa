import { onDocumentUpdated } from "firebase-functions/v2/firestore";
export const onAppointmentUpdated = onDocumentUpdated("appointments/{appointmentId}", async (event) => {
  return;
});
