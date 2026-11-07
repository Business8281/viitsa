import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {
  sendAppointmentCancelled,
  sendAppointmentRescheduled,
} from "./whatsappService";

function formatDisplayDate(dateStr: string | Date | undefined): string {
  if (!dateStr) return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDisplayTime(timeStr?: string): string {
  if (!timeStr) return 'Scheduled time';
  if (/(am|pm)/i.test(timeStr)) return timeStr;
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1] ? parts[1].slice(0, 2) : '00';
    if (!isNaN(hours)) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      return `${String(h12).padStart(2, '0')}:${minutes} ${ampm}`;
    }
  }
  return timeStr;
}

export const onAppointmentUpdated = onDocumentUpdated(
  {
    document: "appointments/{appointmentId}",
    region: "asia-south1",
    memory: "256MiB",
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) return;

    const clinicId = afterData.clinic_id;
    const patientId = afterData.patient_id;
    const doctorId = afterData.doctor_id;

    if (!clinicId || !patientId) return;

    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();

    // 1. Fetch clinic & check if WhatsApp is enabled
    const clinicDoc = await db.collection("clinics").doc(clinicId).get();
    const clinic = clinicDoc.data() || {};
    if (clinic.whatsapp_reminders_enabled === false) {
      console.log(`[onAppointmentUpdated] WhatsApp disabled for clinic ${clinicId}`);
      return;
    }

    // 2. Fetch patient details with multi-tier fallback
    let patientPhone = afterData.patient_phone || afterData.phone;
    let patientName = afterData.patient_name;

    if (!patientPhone || !patientName) {
      const patientDoc = await db.collection("patients").doc(patientId).get();
      if (patientDoc.exists) {
        const p = patientDoc.data() || {};
        patientPhone = patientPhone || p.phone;
        patientName = patientName || p.name || p.full_name;
      }
      if (!patientPhone || !patientName) {
        const accId = afterData.account_id || patientId;
        const accDoc = await db.collection("patient_accounts").doc(accId).get();
        if (accDoc.exists) {
          const acc = accDoc.data() || {};
          patientPhone = patientPhone || acc.phone;
          patientName = patientName || acc.name;
        }
      }
      if (!patientPhone || !patientName) {
        const userDoc = await db.collection("users").doc(patientId).get();
        if (userDoc.exists) {
          const u = userDoc.data() || {};
          patientPhone = patientPhone || u.phone;
          patientName = patientName || u.name || u.display_name;
        }
      }
    }

    if (!patientPhone) {
      console.log(`[onAppointmentUpdated] No phone found for patient ${patientId}`);
      return;
    }

    // 3. Fetch doctor details if available
    let doctorName = afterData.doctor_name || (afterData.doctor as any)?.name || 'Doctor';
    if (doctorId) {
      try {
        const docUser = await db.collection("users").doc(doctorId).get();
        if (docUser.exists) {
          doctorName = docUser.data()?.name || docUser.data()?.display_name || doctorName;
        }
      } catch (e) {
        console.warn('[onAppointmentUpdated] error fetching doctor user:', e);
      }
    }
    if (!doctorName || doctorName.toLowerCase() === 'doctor') {
      doctorName = clinic.doctor_name || 'Doctor';
    }

    const finalPatientName = patientName || 'Patient';
    const clinicName = clinic.name || 'Clinic';
    const clinicPhone = clinic.phone || '+91 73961 11081';
    const appointmentId = event.params.appointmentId;

    // Case A: Appointment Cancelled
    if (afterData.status === 'cancelled' && beforeData.status !== 'cancelled') {
      const cancelLockRef = db.collection("whatsapp_dispatch_locks").doc(`appt_${appointmentId}_cancelled`);
      try {
        await cancelLockRef.create({
          appointment_id: appointmentId,
          dispatched_at_ms: Date.now(),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (lockErr) {
        console.log(`[onAppointmentUpdated] Suppressed duplicate cancellation WhatsApp for appointment ${appointmentId}`);
        return;
      }

      console.log(`[onAppointmentUpdated] Sending WhatsApp cancellation to ${patientPhone}`);
      const cancelReason =
        afterData.cancellation_reason ||
        afterData.cancelled_reason ||
        afterData.reason ||
        'Cancelled upon patient / clinic request';

      await sendAppointmentCancelled({
        to: patientPhone,
        clinicId,
        patientName: finalPatientName,
        doctorName,
        clinicName,
        date: formatDisplayDate(afterData.date),
        time: formatDisplayTime(afterData.time_slot),
        reason: cancelReason,
        clinicPhone,
      });
      return;
    }

    // Case B: Appointment Rescheduled (Date or Time changed)
    const dateChanged = beforeData.date !== afterData.date;
    const timeChanged = beforeData.time_slot !== afterData.time_slot;

    if ((dateChanged || timeChanged) && afterData.status !== 'cancelled') {
      const reschedKey = `appt_${appointmentId}_resched_${afterData.date}_${afterData.time_slot}`;
      const reschedLockRef = db.collection("whatsapp_dispatch_locks").doc(reschedKey);
      try {
        await reschedLockRef.create({
          appointment_id: appointmentId,
          new_date: afterData.date,
          new_time: afterData.time_slot,
          dispatched_at_ms: Date.now(),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (lockErr) {
        console.log(`[onAppointmentUpdated] Suppressed duplicate reschedule WhatsApp for appointment ${appointmentId}`);
        return;
      }

      console.log(`[onAppointmentUpdated] Sending WhatsApp reschedule to ${patientPhone}`);
      const tokenSlot = afterData.display_token || (afterData.token_number ? `Token ${afterData.token_number}` : 'Confirmed');
      const rescheduleReason =
        afterData.reschedule_reason ||
        afterData.reason ||
        'Doctor / Clinic schedule update';

      await sendAppointmentRescheduled({
        to: patientPhone,
        clinicId,
        patientName: finalPatientName,
        doctorName,
        clinicName,
        newDate: formatDisplayDate(afterData.date),
        newTime: formatDisplayTime(afterData.time_slot),
        newTokenOrSlot: tokenSlot,
        reason: rescheduleReason,
        clinicPhone,
      });
    }
  }
);
