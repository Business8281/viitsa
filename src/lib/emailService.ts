import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { formatDate } from './format';

export interface SendEmailParams {
  to: string;
  template: "clinic_pending" | "clinic_approved" | "clinic_rejected" | "appointment_confirmed" | "appointment_cancelled" | "appointment_rescheduled" | "prescription" | "invoice" | "generic";
  subject?: string;
  data?: any;
  attachments?: Array<{
    filename: string;
    content: string; // base64 string
    contentType?: string;
  }>;
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    let subject = params.subject || 'Notification from Viitsa';
    let htmlContent = '';

    const wrapHtml = (content: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #0E7490; margin: 0;">VIITSA</h1>
          <p style="color: #666; margin: 5px 0 0 0; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">Smarter Healthcare, For Everyone</p>
        </div>
        ${content}
        <br/>
        <p>Warm regards,<br/><strong>Viitsa Team</strong></p>
      </div>
    `;

    if (params.template === 'clinic_pending') {
      const { clinicName, clinicEmail, phone, address, city, workingHours, departments } = params.data;
      subject = `Verification Under Process - ${clinicName}`;
      htmlContent = wrapHtml(`
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="background-color: #FEF3C7; width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;"><span style="font-size: 32px;">🕒</span></div>
          <h2 style="color: #111; margin: 0;">Verification Under Process</h2>
        </div>
        <p>Dear <strong>${clinicName}</strong>,</p>
        <p>We have successfully received your registration details and verification documents. We will update you on your application status within <strong>24-48 hours</strong>.</p>
        <div style="background-color: #F8FAFC; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #0E7490;">
          <p style="margin: 8px 0;"><strong>Email Address:</strong> ${clinicEmail}</p>
          <p style="margin: 8px 0;"><strong>Phone Number:</strong> ${phone}</p>
          <p style="margin: 8px 0;"><strong>Address:</strong> ${address}, ${city}</p>
        </div>
      `);
    } else if (params.template === 'clinic_approved') {
      const { clinicName } = params.data;
      subject = `Clinic Approved - Welcome to Viitsa, ${clinicName}!`;
      htmlContent = wrapHtml(`
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="background-color: #D1FAE5; width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;"><span style="font-size: 32px;">✅</span></div>
          <h2 style="color: #111; margin: 0;">Clinic Approved Successfully!</h2>
        </div>
        <p>Dear <strong>${clinicName}</strong>,</p>
        <p>Congratulations! Your clinic details and documents have been successfully verified by our admin team.</p>
        <p>You now have full access to your Viitsa dashboard. You can log in and start managing your appointments, doctors, and patients.</p>
      `);
    } else if (params.template === 'clinic_rejected') {
      const { clinicName, rejectionReason } = params.data;
      subject = `Verification Rejected - Action Required for ${clinicName}`;
      htmlContent = wrapHtml(`
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="background-color: #FEE2E2; width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;"><span style="font-size: 32px;">❌</span></div>
          <h2 style="color: #111; margin: 0;">Verification Rejected</h2>
        </div>
        <p>Dear <strong>${clinicName}</strong>,</p>
        <p>Unfortunately, your clinic verification has been rejected by our administration team. Please review the reason below:</p>
        <div style="background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 15px; margin: 20px 0; color: #991B1B;">
          <p style="margin: 0;"><strong>Reason for Rejection:</strong><br/>${rejectionReason}</p>
        </div>
        <p>Please log in to your dashboard to correct any incorrect information and re-upload the correct verification documents.</p>
      `);
    } else if (params.template.startsWith('appointment_')) {
      const { patientName, doctorName, clinicName, date, time, token, type } = params.data;
      const isCancelled = params.template === 'appointment_cancelled';
      const isRescheduled = params.template === 'appointment_rescheduled';
      
      let title = "Appointment Confirmed";
      let icon = "✅";
      let color = "#0E7490";
      let bg = "#E0F2FE";
      let msg = `<p style="color: #0E7490;">Your appointment has been successfully booked.</p>`;
      
      if (isCancelled) {
        title = "Appointment Cancelled";
        icon = "❌";
        color = "#991B1B";
        bg = "#FEE2E2";
        msg = `<p style="color: #991B1B;">Your appointment has been successfully cancelled.</p>`;
      } else if (isRescheduled) {
        title = "Appointment Rescheduled";
        icon = "🔄";
        msg = `<p style="color: #0E7490;">Your appointment has been successfully rescheduled to a new time.</p>`;
      }
      
      subject = `${title} - ${clinicName}`;
      htmlContent = wrapHtml(`
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="background-color: ${bg}; width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
            <span style="font-size: 32px;">${icon}</span>
          </div>
          <h2 style="color: #111; margin: 0;">${title}</h2>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Booking Number</p>
          <div style="font-size: 36px; font-weight: bold; color: ${color}; letter-spacing: 3px; margin-top: 5px;">
            ${token || '—'}
          </div>
        </div>
        <p>Dear <strong>${patientName}</strong>,</p>
        ${msg}
        <div style="background-color: #F8FAFC; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #0E7490;">
          <p style="margin: 8px 0;"><strong>Clinic:</strong> ${clinicName}</p>
          <p style="margin: 8px 0;"><strong>Doctor:</strong> ${doctorName || 'Available Doctor'}</p>
          <p style="margin: 8px 0;"><strong>Date:</strong> ${date}</p>
          <p style="margin: 8px 0;"><strong>Time:</strong> ${time || '—'}</p>
        </div>
      `);
    } else if (params.template === 'prescription') {
      const { patientName, clinicName, doctorName, prescriptionNo, date, diagnosis, pdfUrl, loginUrl } = params.data || {};
      const loginLink = loginUrl || `${typeof window !== 'undefined' ? window.location.origin : 'https://viitsa.com'}/login`;
      subject = params.subject || `Doctor Prescription - ${prescriptionNo || 'Rx'} | ${clinicName || 'Viitsa'}`;
      htmlContent = wrapHtml(`
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="background-color: #CCFBF1; width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
            <span style="font-size: 32px;">💊</span>
          </div>
          <h2 style="color: #0F766E; margin: 0;">Doctor Prescription</h2>
          <p style="color: #666; font-size: 13px; margin: 5px 0 0 0;">Prescription No: <strong>${prescriptionNo || '—'}</strong></p>
        </div>
        <p>Dear <strong>${patientName || 'Patient'}</strong>,</p>
        <p>Your doctor prescription has been prepared and issued by <strong>${clinicName || 'your clinic'}</strong>.</p>
        
        <div style="background-color: #F8FAFC; border-radius: 10px; padding: 18px; margin: 18px 0; border-left: 4px solid #0F766E;">
          <p style="margin: 6px 0;"><strong>Doctor:</strong> ${doctorName || 'Doctor'}</p>
          <p style="margin: 6px 0;"><strong>Clinic:</strong> ${clinicName || 'Clinic'}</p>
          <p style="margin: 6px 0;"><strong>Date:</strong> ${date || 'Today'}</p>
          ${diagnosis ? `<p style="margin: 6px 0;"><strong>Diagnosis:</strong> ${diagnosis}</p>` : ''}
          <p style="margin: 6px 0; color: #0F766E; font-weight: bold;">📎 PDF Attachment: Your official A4 Doctor Prescription PDF is attached to this email.</p>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${loginLink}" style="display: inline-block; background-color: #0E7490; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            🔐 Login to Patient Portal
          </a>
          ${pdfUrl ? `<div style="margin-top: 12px;"><a href="${pdfUrl}" target="_blank" style="color: #0E7490; text-decoration: underline; font-size: 13px;">View or Download PDF Online</a></div>` : ''}
        </div>
        <p style="font-size: 12px; color: #777; text-align: center;">You can log in to your patient account anytime to view your complete medical history, lab reports, and prescriptions.</p>
      `);
    } else if (params.template === 'invoice') {
      const { patientName, clinicName, invoiceNo, amount, date, pdfUrl, loginUrl } = params.data || {};
      const loginLink = loginUrl || `${typeof window !== 'undefined' ? window.location.origin : 'https://viitsa.com'}/login`;
      subject = params.subject || `Invoice ${invoiceNo || ''} from ${clinicName || 'Viitsa'}`;
      htmlContent = wrapHtml(`
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="background-color: #E0F2FE; width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
            <span style="font-size: 32px;">🧾</span>
          </div>
          <h2 style="color: #0369A1; margin: 0;">Payment Invoice</h2>
          <p style="color: #666; font-size: 13px; margin: 5px 0 0 0;">Invoice No: <strong>${invoiceNo || '—'}</strong></p>
        </div>
        <p>Dear <strong>${patientName || 'Patient'}</strong>,</p>
        <p>Thank you for visiting <strong>${clinicName || 'our clinic'}</strong>. Here are the details of your invoice:</p>
        
        <div style="background-color: #F8FAFC; border-radius: 10px; padding: 18px; margin: 18px 0; border-left: 4px solid #0369A1;">
          <p style="margin: 6px 0;"><strong>Invoice Number:</strong> ${invoiceNo || '—'}</p>
          <p style="margin: 6px 0;"><strong>Date:</strong> ${date || 'Today'}</p>
          <p style="margin: 6px 0;"><strong>Total Amount:</strong> ${amount || '₹0'}</p>
          <p style="margin: 6px 0; color: #0369A1; font-weight: bold;">📎 PDF Attachment: Your official invoice PDF is attached to this email.</p>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${loginLink}" style="display: inline-block; background-color: #0E7490; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            🔐 Login to Patient Portal
          </a>
          ${pdfUrl ? `<div style="margin-top: 12px;"><a href="${pdfUrl}" target="_blank" style="color: #0E7490; text-decoration: underline; font-size: 13px;">View or Download PDF Online</a></div>` : ''}
        </div>
        <p style="font-size: 12px; color: #777; text-align: center;">You can log in to your patient account anytime to view billing history and receipts.</p>
      `);
    } else {
      htmlContent = wrapHtml(`<p>${params.data?.body || ''}</p>`);
    }

    const sendInstantEmail = httpsCallable(functions, 'sendInstantEmail');
    await sendInstantEmail({
      to: params.to,
      subject,
      htmlContent,
      attachments: params.attachments
    });

    return { success: true };
  } catch (error: any) {
    console.error('sendEmail Error:', error);
    return { success: false, error: error.message };
  }
}


import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

export async function sendInstantAppointmentEmail(
  apptId: string, 
  template: "appointment_confirmed" | "appointment_cancelled" | "appointment_rescheduled"
) {
  try {
    const apptSnap = await getDoc(doc(db, 'appointments', apptId));
    if (!apptSnap.exists()) return;
    const appt = apptSnap.data();

    let patientEmail = null;
    let patientName = "Patient";

    if (appt.patient_id) {
      const pSnap = await getDoc(doc(db, 'patient_accounts', appt.patient_id));
      if (pSnap.exists()) {
        patientEmail = pSnap.data().email;
        patientName = pSnap.data().name || pSnap.data().full_name || "Patient";
      } else {
        const p2Snap = await getDoc(doc(db, 'patients', appt.patient_id));
        if (p2Snap.exists()) {
          patientEmail = p2Snap.data().email;
          patientName = p2Snap.data().name || p2Snap.data().full_name || "Patient";
        }
      }
    }

    if (!patientEmail) return;

    let doctorName = "Your Doctor";
    if (appt.doctor_id) {
      const dSnap = await getDoc(doc(db, 'users', appt.doctor_id));
      if (dSnap.exists()) doctorName = dSnap.data().name || "Your Doctor";
    }

    let clinicName = "Viitsa Clinic";
    if (appt.clinic_id) {
      const cSnap = await getDoc(doc(db, 'clinics', appt.clinic_id));
      if (cSnap.exists()) clinicName = cSnap.data().name || "Viitsa Clinic";
    }

    const dateStr = formatDate(appt.date);
    const tokenDisplay = appt.display_token || (appt.token_number ? `ON-${String(appt.token_number).padStart(3, '0')}` : '—');

    await sendEmail({
      to: patientEmail,
      template,
      data: {
        patientName,
        doctorName,
        clinicName,
        date: dateStr,
        time: appt.time_slot || '—',
        token: tokenDisplay
      }
    });

  } catch (err) {
    console.error('Error sending instant appointment email:', err);
  }
}
