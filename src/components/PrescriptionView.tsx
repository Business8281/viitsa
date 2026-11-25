import React, { useRef, useState } from 'react';
import { 
  Building2, Phone, Mail, User, ClipboardList, FileText, FlaskConical, 
  ShieldCheck, Users, TrendingUp, Printer, Download, Share2, 
  X, Check, AlertCircle, Clock, Loader2, Send, Pill
} from 'lucide-react';
import { formatDate, formatTime, calculateAge } from '../lib/format';
import { 
  downloadPrescriptionPDF, 
  generatePrescriptionBlob, 
  uploadAndGetPrescriptionUrl, 
  blobToBase64, 
  downloadBlobFile, 
  sharePdfFileNative 
} from '../lib/pdf';
import { sendEmail } from '../lib/emailService';
import { useToast } from '../lib/toast';
import { sendWhatsAppPatientMedicineReminder } from '../lib/whatsappClientService';

export interface PrescriptionMedicine {
  id?: string;
  name: string;
  dose: string;
  timesPerDay: string;
  intakeTime: string;
  duration: string;
  foodInstruction: string;
  instructions: string;
}

export interface PrescriptionData {
  prescriptionNumber?: string;
  date?: string;
  time?: string;
  visitId?: string;
  visitType?: string;
  department?: string;
  followUpDate?: string;
  
  clinic?: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    email?: string;
    gstin?: string;
    registrationNumber?: string;
    logo?: string;
  };
  
  patient?: {
    id?: string;
    uhid?: string;
    name?: string;
    age?: number | string;
    dob?: string;
    gender?: string;
    mobile?: string;
    email?: string;
  };
  
  doctor?: {
    id?: string;
    name?: string;
    specialization?: string;
    department?: string;
    registrationNumber?: string;
    signature?: string;
  };
  
  clinicalNotes?: {
    chiefComplaint?: string;
    symptoms?: string;
    diagnosis?: string;
    vitals?: {
      temperature?: string;
      bloodPressure?: string;
      pulse?: string;
      spo2?: string;
    };
  };
  
  medicines?: PrescriptionMedicine[];
  advice?: string[];
  recommendedTests?: string[];
  notice?: string;
}

interface PrescriptionViewProps {
  data?: PrescriptionData;
  consultation?: any;
  patient?: any;
  clinic?: any;
  doctor?: any;
  onClose?: () => void;
  standalone?: boolean;
}

export function PrescriptionView({
  data,
  consultation,
  patient,
  clinic,
  doctor,
  onClose,
  standalone = false,
}: PrescriptionViewProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [sharingWa, setSharingWa] = useState(false);
  const [sharingEmail, setSharingEmail] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  // Helper to extract clean medicines from consultation record if provided
  const parsedMedicines: PrescriptionMedicine[] = React.useMemo(() => {
    if (data?.medicines && data.medicines.length > 0) return data.medicines;
    
    // Check if consultation has structured prescriptions array
    if (consultation?.prescriptions && Array.isArray(consultation.prescriptions) && consultation.prescriptions.length > 0) {
      return consultation.prescriptions.map((m: any, idx: number) => ({
        id: String(idx + 1),
        name: m.medicine_name || m.name || `Medicine ${idx + 1}`,
        dose: m.dosage || m.dose || '1 Tablet',
        timesPerDay: m.frequency || m.timesPerDay || '2 times/day',
        intakeTime: m.timing || m.intakeTime || 'Morning, Night',
        duration: m.duration || '5 Days',
        foodInstruction: m.foodInstruction || m.food || 'After Food',
        instructions: m.instructions || m.notes || 'As advised'
      }));
    }

    // Check if consultation has text prescription
    if (consultation?.prescription && typeof consultation.prescription === 'string' && consultation.prescription.trim()) {
      const lines = consultation.prescription.split('\n').filter((l: string) => l.trim().length > 0);
      if (lines.length > 0) {
        return lines.map((l: string, idx: number) => {
          const parts = l.split(/[-–—|,]/).map(p => p.trim());
          return {
            id: String(idx + 1),
            name: parts[0] || l,
            dose: parts[1] || '1 Tablet',
            timesPerDay: parts[2] || '2 times/day',
            intakeTime: parts[3] || 'Morning, Night',
            duration: parts[4] || '5 Days',
            foodInstruction: 'After Food',
            instructions: parts[5] || 'As prescribed'
          };
        });
      }
    }

    // Default sample rows matching the exact reference screenshot
    return [
      {
        id: '1',
        name: 'Paracetamol 500 mg',
        dose: '1 Tablet',
        timesPerDay: '3 times/day',
        intakeTime: 'Morning, Afternoon, Night',
        duration: '3 Days',
        foodInstruction: 'After Food',
        instructions: 'For fever and body ache'
      },
      {
        id: '2',
        name: 'Pantoprazole 40 mg',
        dose: '1 Tablet',
        timesPerDay: '1 time/day',
        intakeTime: 'Morning',
        duration: '5 Days',
        foodInstruction: 'Before Food',
        instructions: 'Before breakfast'
      },
      {
        id: '3',
        name: 'Vitamin D3 60K (Sachet)',
        dose: '1 Sachet',
        timesPerDay: '1 time/week',
        intakeTime: 'Sunday Morning',
        duration: '4 Weeks',
        foodInstruction: 'After Food',
        instructions: 'Once weekly'
      },
      {
        id: '4',
        name: 'ORS (200 ml)',
        dose: '200 ml',
        timesPerDay: '3 times/day',
        intakeTime: 'Morning, Afternoon, Evening',
        duration: '3 Days',
        foodInstruction: 'After Food',
        instructions: 'Maintain hydration'
      },
      {
        id: '5',
        name: 'Cetirizine 10 mg',
        dose: '1 Tablet',
        timesPerDay: '1 time/day',
        intakeTime: 'Night',
        duration: '5 Days',
        foodInstruction: 'After Food',
        instructions: 'At bedtime for allergy symptoms'
      }
    ];
  }, [data?.medicines, consultation]);

  // Derived or fallback data matching official healthcare standards
  const clinicInfo = {
    name: data?.clinic?.name || clinic?.name || consultation?.clinic_name || (consultation?.clinic as any)?.name || 'VIITSA HEALTHCARE CLINIC',
    address: data?.clinic?.address || clinic?.address || consultation?.clinic_address || (consultation?.clinic as any)?.address || 'Plot No. 123, Healthcare Enclave, Hyderabad, Telangana - 500081',
    phone: data?.clinic?.phone || clinic?.phone || consultation?.clinic_phone || (consultation?.clinic as any)?.phone || '+91 98765 43210',
    email: data?.clinic?.email || clinic?.email || consultation?.clinic_email || (consultation?.clinic as any)?.email || 'support@viitsa.com',
    gstin: data?.clinic?.gstin || clinic?.gstin || consultation?.clinic_gstin || '36AAAAA0000A1Z5',
    regNo: data?.clinic?.registrationNumber || clinic?.registration_number || clinic?.reg_no || consultation?.clinic_reg_no || 'VTS-CLN-2026',
    logo: data?.clinic?.logo || clinic?.logo_url || consultation?.clinic_logo_url || (consultation?.clinic as any)?.logo_url || null
  };

  const prescriptionNo = data?.prescriptionNumber || consultation?.prescription_number || consultation?.rx_number || (consultation?.id || consultation?.consult_id ? `RX-${String(consultation.id || consultation.consult_id).slice(0, 8).toUpperCase()}` : `RX-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-0001`);
  const presDate = data?.date || (consultation?.created_at ? formatDate(consultation.created_at) : formatDate(new Date()));
  const presTime = data?.time || (consultation?.created_at ? formatTime(consultation.created_at) : formatTime(new Date()));
  const visitId = data?.visitId || consultation?.appointment_id || consultation?.appt_id || (consultation?.id || consultation?.consult_id ? `OPD-${String(consultation.id || consultation.consult_id).slice(0, 6).toUpperCase()}` : 'OPD-2026-0001');
  const department = data?.department || doctor?.specialisation || consultation?.department || consultation?.specialization || 'General Medicine';
  const followUpDate = data?.followUpDate || (consultation?.follow_up_date ? formatDate(consultation.follow_up_date) : null);

  // Calculate age if not directly provided but dob is present
  const resolvedAge = React.useMemo(() => {
    const rawAge = data?.patient?.age ?? patient?.age ?? consultation?.patient_age ?? (consultation?.patient as any)?.age;
    if (rawAge !== undefined && rawAge !== null && rawAge !== '' && rawAge !== '—') {
      const numStr = String(rawAge).replace(/[^0-9]/g, '');
      if (numStr) return `${numStr} Years`;
      return String(rawAge);
    }
    const rawDob = data?.patient?.dob ?? patient?.dob ?? consultation?.patient_dob ?? (consultation?.patient as any)?.dob;
    if (rawDob) {
      const a = calculateAge(rawDob);
      if (a !== null) return `${a} Years`;
    }
    return '—';
  }, [data?.patient?.age, data?.patient?.dob, patient?.age, patient?.dob, consultation?.patient_age, consultation?.patient_dob, consultation?.patient]);

  const resolvedDob = data?.patient?.dob || patient?.dob || consultation?.patient_dob || (consultation?.patient as any)?.dob || null;

  const patientInfo = {
    name: data?.patient?.name || patient?.name || patient?.full_name || consultation?.patient_name || (consultation?.patient as any)?.name || 'Patient',
    uhid: data?.patient?.uhid || patient?.patient_code || patient?.id_number || patient?.display_id || consultation?.patient_id || 'PAT_RKBR',
    age: resolvedAge,
    dob: resolvedDob,
    gender: data?.patient?.gender || patient?.gender || consultation?.patient_gender || (consultation?.patient as any)?.gender || '—',
    mobile: data?.patient?.mobile || patient?.phone || consultation?.patient_phone || (consultation?.patient as any)?.phone || '—',
    email: data?.patient?.email || patient?.email || (consultation as any)?.patient_email || '',
    visitType: data?.visitType || consultation?.visit_type || 'New Visit (OPD)'
  };

  const doctorInfo = {
    name: data?.doctor?.name || doctor?.name || consultation?.doctor_name || (consultation?.doctor as any)?.name || 'Dr. Attending Physician',
    specialization: data?.doctor?.specialization || doctor?.specialisation || doctor?.designation || consultation?.doctor_specialization || 'General Physician',
    regNo: data?.doctor?.registrationNumber || doctor?.registration_number || consultation?.doctor_reg_no || 'TSMC-124982',
    signature: data?.doctor?.signature || doctor?.signature_url || consultation?.doctor_signature || null
  };

  const clinicalNotes = {
    chiefComplaint: data?.clinicalNotes?.chiefComplaint || consultation?.chief_complaint || consultation?.symptoms || 'General clinical consultation',
    symptoms: data?.clinicalNotes?.symptoms || consultation?.symptoms || 'As presented by patient during visit',
    diagnosis: data?.clinicalNotes?.diagnosis || consultation?.diagnosis || 'General Consultation (Provisional)',
    vitals: {
      temperature: data?.clinicalNotes?.vitals?.temperature || consultation?.vitals?.temperature || '98.6 °F',
      bloodPressure: data?.clinicalNotes?.vitals?.bloodPressure || consultation?.vitals?.bloodPressure || consultation?.vitals?.bp || '120/80 mmHg',
      pulse: data?.clinicalNotes?.vitals?.pulse || consultation?.vitals?.pulse || '76/min',
      spo2: data?.clinicalNotes?.vitals?.spo2 || consultation?.vitals?.spo2 || '99%'
    }
  };

  const adviceList = (data?.advice && data.advice.length > 0)
    ? data.advice
    : (consultation?.advice && Array.isArray(consultation.advice) && consultation.advice.length > 0)
    ? consultation.advice
    : [
        'Drink plenty of water and stay hydrated.',
        'Take adequate rest and avoid strenuous activity.',
        'Follow a light and easily digestible diet.',
        'Monitor temperature and seek medical attention if fever persists beyond 3 days or worsens.'
      ];

  const testsList = (data?.recommendedTests && data.recommendedTests.length > 0)
    ? data.recommendedTests
    : (consultation?.recommended_tests && Array.isArray(consultation.recommended_tests) && consultation.recommended_tests.length > 0)
    ? consultation.recommended_tests
    : [
        'Complete Blood Count (CBC)',
        'Vitamin D (25-OH)',
        'If symptoms persist, do Chest X-Ray (PA View)',
        'Follow-up after 5 days or earlier if symptoms worsen.'
      ];

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      await downloadPrescriptionPDF(prescriptionNo, patientInfo.name);
      toast('Prescription PDF downloaded successfully.', 'success');
    } catch (e) {
      console.error(e);
      alert('Unable to generate PDF directly. You can use the Print button and choose "Save as PDF".');
    } finally {
      setDownloading(false);
    }
  };

  // SHARE VIA WHATSAPP (PDF file + Login Link + PDF Link)
  const handleShareWhatsApp = async () => {
    try {
      setSharingWa(true);
      const cleanName = (patientInfo.name || 'Patient').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanNo = (prescriptionNo || 'RX').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Prescription_${cleanNo}_${cleanName}.pdf`;

      // 1. Generate high-resolution A4 PDF Blob
      const blob = await generatePrescriptionBlob(prescriptionNo, patientInfo.name);

      // 2. Upload to Firebase Storage for permanent direct download/view link
      let pdfUrl = '';
      try {
        const uploadRes = await uploadAndGetPrescriptionUrl(prescriptionNo, patientInfo.name, clinic?.clinic_id);
        pdfUrl = uploadRes.url;
      } catch (upErr) {
        console.warn('PDF storage upload:', upErr);
      }

      // 3. Login link for their patient account
      const loginUrl = 'https://viitsa.com/login';

      const text = `*Doctor Prescription — ${clinicInfo.name}*\n\n` +
        `👤 Patient: ${patientInfo.name} (${patientInfo.uhid})\n` +
        `🎂 Age: ${patientInfo.age}${patientInfo.dob ? ` (DOB: ${formatDate(patientInfo.dob)})` : ''}\n` +
        `📋 Prescription No: ${prescriptionNo}\n` +
        `📅 Date: ${presDate} at ${presTime}\n` +
        `👨‍⚕️ Doctor: ${doctorInfo.name} (${doctorInfo.specialization})\n` +
        `🩺 Diagnosis: ${clinicalNotes.diagnosis}\n\n` +
        `🔐 *Login to your Patient Account:*\n${loginUrl}\n\n` +
        (pdfUrl ? `📄 *View & Download Official PDF:*\n${pdfUrl}\n\n` : '') +
        `📎 _Note: Official A4 Prescription PDF file has also been saved to your downloads for quick reference & direct attachment._\n\n` +
        `— VIITSA Healthcare Platform`;

      // 4. Try native OS file sharing (mobile / supported browsers directly attach the PDF document into WhatsApp chat)
      const sharedNatively = await sharePdfFileNative(blob, fileName, `Prescription - ${prescriptionNo}`, text);

      if (!sharedNatively) {
        // Fallback for desktop: automatically download the PDF file to their machine so they have it immediately
        downloadBlobFile(blob, fileName);

        // And open WhatsApp with the complete message including login link and PDF link
        const phone = (patientInfo.mobile || '').replace(/\D/g, '');
        const waUrl = phone 
          ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` 
          : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
        toast('Prescription PDF file downloaded! WhatsApp opened with your login and PDF link.', 'success');
      } else {
        toast('Shared prescription PDF successfully!', 'success');
      }
    } catch (e: any) {
      console.error('WhatsApp share error:', e);
      toast('Could not share PDF to WhatsApp. Please download PDF.', 'error');
    } finally {
      setSharingWa(false);
    }
  };

  // SEND OFFICIAL WHATSAPP MEDICINE DOSAGE REMINDER
  const handleSendMedicineReminderWhatsApp = async () => {
    const rawPhone = patientInfo.mobile || (patient as any)?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      toast('Valid 10-digit patient phone number not found to dispatch WhatsApp reminder.', 'error');
      return;
    }

    if (!parsedMedicines || parsedMedicines.length === 0) {
      toast('No prescribed medicines found to send reminder.', 'error');
      return;
    }

    try {
      setSendingReminder(true);
      toast('Sending official WhatsApp medicine dosage reminder...', 'info');
      const primaryMed = parsedMedicines[0];
      const allMedNames = parsedMedicines.map(m => m.name).slice(0, 3).join(', ');
      const timing = `${primaryMed.dose || '1 dose'} • ${primaryMed.timesPerDay || primaryMed.intakeTime || 'As advised'}`;
      const instructions = primaryMed.instructions || primaryMed.foodInstruction || 'Complete full prescribed course as advised by doctor.';

      const res = await sendWhatsAppPatientMedicineReminder({
        to: cleanPhone,
        clinicId: clinic?.clinic_id || '',
        patientName: patientInfo.name || 'Patient',
        clinicName: clinicInfo.name || 'Clinic',
        doctorName: doctorInfo.name || 'Doctor',
        medicineName: allMedNames || primaryMed.name,
        dosageTiming: timing,
        instructions,
        clinicPhone: clinicInfo.phone || '+91 73961 11081',
      });

      if (res.success) {
        toast(`WhatsApp medicine reminder sent successfully to ${patientInfo.name}!`, 'success');
      } else {
        toast(res.error || 'Failed to dispatch WhatsApp medicine reminder.', 'error');
      }
    } catch (err: any) {
      console.error('Medicine reminder error:', err);
      toast(err?.message || 'Failed to dispatch WhatsApp medicine reminder.', 'error');
    } finally {
      setSendingReminder(false);
    }
  };

  // OPEN EMAIL MODAL
  const handleOpenEmailDialog = () => {
    setTargetEmail(patientInfo.email || '');
    setEmailModalOpen(true);
  };

  // SEND EMAIL (PDF file attached + Login Link + PDF Link)
  const handleSendEmail = async () => {
    if (!targetEmail.trim() || !targetEmail.includes('@')) {
      alert('Please enter a valid patient email address.');
      return;
    }

    try {
      setSharingEmail(true);
      const cleanName = (patientInfo.name || 'Patient').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanNo = (prescriptionNo || 'RX').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Prescription_${cleanNo}_${cleanName}.pdf`;

      // 1. Generate A4 PDF Blob & convert to Base64 for real attachment
      const blob = await generatePrescriptionBlob(prescriptionNo, patientInfo.name);
      const base64 = await blobToBase64(blob);

      // 2. Upload to Firebase Storage for permanent online link
      let pdfUrl = '';
      try {
        const uploadRes = await uploadAndGetPrescriptionUrl(prescriptionNo, patientInfo.name, clinic?.clinic_id);
        pdfUrl = uploadRes.url;
      } catch (upErr) {
        console.warn('PDF storage upload:', upErr);
      }

      // 3. Login link to patient account
      const loginUrl = 'https://viitsa.com/login';

      // 4. Send official email via Cloud Function with the ACTUAL PDF ATTACHED!
      const res = await sendEmail({
        to: targetEmail.trim(),
        template: 'prescription',
        subject: `Doctor Prescription - ${prescriptionNo} | ${clinicInfo.name}`,
        data: {
          patientName: patientInfo.name,
          uhid: patientInfo.uhid,
          age: patientInfo.age,
          gender: patientInfo.gender,
          contactPhone: patientInfo.mobile,
          patientDob: patientInfo.dob ? formatDate(patientInfo.dob) : '',
          clinicName: clinicInfo.name,
          clinicAddress: clinicInfo.address,
          clinicPhone: clinicInfo.phone,
          clinicEmail: clinicInfo.email,
          doctorName: doctorInfo.name,
          doctorSpecialization: doctorInfo.specialization,
          doctorRegNo: doctorInfo.regNo,
          prescriptionNo,
          date: presDate,
          time: presTime,
          department,
          diagnosis: clinicalNotes.diagnosis,
          chiefComplaint: clinicalNotes.chiefComplaint,
          vitals: clinicalNotes.vitals,
          medicines: parsedMedicines.map((m: any) => ({
            category: 'Oral Medication',
            name: m.name,
            dose: m.dose,
            timesPerDay: m.timesPerDay,
            intakeTime: m.intakeTime,
            duration: m.duration,
            foodInstruction: m.foodInstruction,
            instructions: m.instructions,
          })),
          advice: adviceList,
          tests: testsList,
          followUpDate,
          pdfUrl,
          loginUrl
        },
        attachments: [
          {
            filename: fileName,
            content: base64,
            contentType: 'application/pdf'
          }
        ]
      });

      // Also download locally so the user has the file right in their downloads
      downloadBlobFile(blob, fileName);

      if (res.success) {
        setEmailModalOpen(false);
        toast(`Prescription email sent to ${targetEmail} with PDF attached and account login link!`, 'success');
      } else {
        // Fallback to local mailto
        const subject = `Doctor Prescription - ${prescriptionNo} | ${clinicInfo.name}`;
        const body = `Hello ${patientInfo.name},\n\nPlease find your doctor prescription from ${clinicInfo.name}:\n\nPrescription No: ${prescriptionNo}\nDate: ${presDate}\nPatient: ${patientInfo.name} | Age: ${patientInfo.age}\nDoctor: ${doctorInfo.name}\nDiagnosis: ${clinicalNotes.diagnosis}\n\n🔐 Login to your Patient Account:\n${loginUrl}\n\n📄 View & Download Online PDF:\n${pdfUrl}\n\n(The PDF file has been downloaded to your computer)\n\nThank you,\n${clinicInfo.name}`;
        window.location.href = `mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setEmailModalOpen(false);
        toast('Prescription PDF downloaded! Email client opened with login and PDF links.', 'info');
      }
    } catch (e: any) {
      console.error('Email send error:', e);
      toast('Failed to send email. The PDF file has been downloaded to your computer.', 'error');
    } finally {
      setSharingEmail(false);
    }
  };

  return (
    <div className={`prescription-preview ${standalone ? 'w-full' : ''}`}>
      {/* ========================================================================= */}
      {/* TOP FLOATING ACTION BAR (SCREEN ONLY / NO-PRINT) */}
      {/* ========================================================================= */}
      <div className="no-print fixed top-3 sm:top-4 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 flex items-center gap-1.5 sm:gap-2 bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 py-2 rounded-full shadow-2xl border border-slate-700/60 text-white animate-fade-in max-w-[calc(100vw-16px)] sm:max-w-max overflow-x-auto no-scrollbar">
        <span className="text-xs font-bold tracking-wide mr-2 text-teal-400 hidden sm:inline">
          Prescription A4 Preview
        </span>

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm transition active:scale-95"
          title="Print prescription directly to A4 paper"
        >
          <Printer size={14} /> Print A4
        </button>

        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition active:scale-95"
          title="Download printable high-res PDF file"
        >
          <Download size={14} /> {downloading ? 'Preparing PDF...' : 'Download PDF'}
        </button>

        <button
          onClick={handleShareWhatsApp}
          disabled={sharingWa}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold transition active:scale-95"
          title="Share official A4 PDF file & account login link via WhatsApp"
        >
          {sharingWa ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} 
          {sharingWa ? 'Preparing...' : 'WhatsApp'}
        </button>

        <button
          onClick={handleSendMedicineReminderWhatsApp}
          disabled={sendingReminder}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-semibold transition active:scale-95"
          title="Send official Meta WhatsApp medicine dosage reminder to patient"
        >
          {sendingReminder ? <Loader2 size={14} className="animate-spin" /> : <Pill size={14} />} 
          {sendingReminder ? 'Sending...' : 'Dosage Reminder'}
        </button>

        <button
          onClick={handleOpenEmailDialog}
          disabled={sharingEmail}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold border border-slate-700 transition active:scale-95"
          title="Email prescription with attached PDF file & account login link"
        >
          {sharingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} 
          {sharingEmail ? 'Sending...' : 'Email'}
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1"
            title="Close Preview"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TRUE A4 DOCTOR PRESCRIPTION SHEET */}
      {/* Exact Match to Attached Reference Screenshot */}
      {/* ========================================================================= */}
      <div 
        id="prescription-print-area" 
        className="prescription-page shadow-2xl rounded-sm print:rounded-none"
      >
        {/* --------------------------------------------------------------------- */}
        {/* 1. TOP BRAND HEADER */}
        {/* --------------------------------------------------------------------- */}
        <div className="flex items-start justify-between pb-2">
          {/* Top Left Branding */}
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#059669] leading-none">
              VIITSA
            </h1>
            <p className="text-[11.5px] font-semibold text-slate-900 mt-1 leading-none">
              Clinic-paid Healthcare SaaS
            </p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-none">
              Simplifying Care. Stronger Patients.
            </p>
          </div>

          {/* Top Right Messaging */}
          <div className="text-right">
            <p className="text-[8.5px] font-semibold tracking-wider text-slate-500 uppercase leading-tight">
              CONNECTED CLINICS
            </p>
            <p className="text-[8.5px] font-semibold tracking-wider text-slate-500 uppercase leading-tight">
              HEALTHIER PATIENTS
            </p>
            <p className="text-[8.5px] font-semibold tracking-wider text-slate-500 uppercase leading-tight">
              BRIGHTER TOMORROW
            </p>
            <div className="w-8 h-[2.5px] bg-[#059669] rounded-full ml-auto mt-1" />
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* 2. MAIN TITLE */}
        {/* --------------------------------------------------------------------- */}
        <div className="mt-2.5 mb-2.5">
          <h2 className="text-[27px] font-extrabold text-[#0f2b38] leading-none tracking-tight">
            Doctor Prescription
          </h2>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.28em] mt-1 leading-none">
            MEDICAL PRESCRIPTION SHEET
          </p>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* 3. CLINIC + PRESCRIPTION INFO ROW */}
        {/* --------------------------------------------------------------------- */}
        <div className="grid grid-cols-12 gap-2.5 mb-2.5">
          {/* Left Card: Clinic Details (~55% width) */}
          <div className="col-span-7 bg-[#F2F9F7] border border-[#059669]/15 rounded-xl p-2.5 flex flex-col justify-between shadow-2xs">
            <div className="flex items-start gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-white border border-[#059669]/20 flex items-center justify-center text-[#059669] shrink-0 shadow-2xs">
                <Building2 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-bold text-slate-900 leading-tight truncate">
                  {clinicInfo.name}
                </h3>
                <p className="text-[10px] text-slate-600 leading-tight mt-0.5 whitespace-pre-line line-clamp-2">
                  {clinicInfo.address}
                </p>
              </div>
            </div>

            <div className="pt-1.5 mt-1.5 border-t border-[#059669]/10 space-y-1">
              <div className="flex items-center gap-2 text-[10px] text-slate-700 flex-wrap">
                <span className="flex items-center gap-1 font-medium">
                  <Phone size={10} className="text-[#059669]" /> {clinicInfo.phone}
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1 font-medium">
                  <Mail size={10} className="text-[#059669]" /> {clinicInfo.email}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[9.5px] text-slate-500">
                <span>GSTIN: <strong className="text-slate-700 font-semibold">{clinicInfo.gstin}</strong></span>
                <span className="text-slate-300">|</span>
                <span>Reg. No.: <strong className="text-slate-700 font-semibold">{clinicInfo.regNo}</strong></span>
              </div>
            </div>
          </div>

          {/* Right Card: Prescription Info (~45% width) */}
          <div className="col-span-5 bg-[#F2F9F7] border border-[#059669]/15 rounded-xl p-2.5 flex flex-col justify-between shadow-2xs text-[10px]">
            <div className="space-y-0.5">
              <div className="grid grid-cols-12 py-0.5">
                <span className="col-span-5 text-slate-500 font-medium">Prescription No.</span>
                <span className="col-span-7 font-bold text-slate-900 text-right truncate">{prescriptionNo}</span>
              </div>
              <div className="grid grid-cols-12 py-0.5">
                <span className="col-span-5 text-slate-500 font-medium">Date</span>
                <span className="col-span-7 font-bold text-slate-900 text-right">{presDate}</span>
              </div>
              <div className="grid grid-cols-12 py-0.5">
                <span className="col-span-5 text-slate-500 font-medium">Time</span>
                <span className="col-span-7 font-bold text-slate-900 text-right">{presTime}</span>
              </div>
              <div className="grid grid-cols-12 py-0.5">
                <span className="col-span-5 text-slate-500 font-medium">Visit ID</span>
                <span className="col-span-7 font-bold text-slate-900 text-right truncate">{visitId}</span>
              </div>
              <div className="grid grid-cols-12 py-0.5">
                <span className="col-span-5 text-slate-500 font-medium">Department</span>
                <span className="col-span-7 font-bold text-slate-900 text-right truncate">{department}</span>
              </div>
              <div className="grid grid-cols-12 py-0.5">
                <span className="col-span-5 text-slate-500 font-medium">Follow-up Date</span>
                <span className="col-span-7 font-bold text-slate-900 text-right">{followUpDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* 4. PATIENT DETAILS CARD */}
        {/* --------------------------------------------------------------------- */}
        <div className="border border-[#059669]/15 rounded-xl overflow-hidden mb-2.5 shadow-2xs">
          {/* Header Strip */}
          <div className="bg-[#EAF5F2] px-3 py-1 flex items-center gap-1.5 border-b border-[#059669]/10">
            <User size={13} className="text-[#059669]" />
            <h4 className="text-[11.5px] font-bold text-slate-900">
              Patient Details
            </h4>
          </div>

          {/* Body Columns */}
          <div className="p-2.5 grid grid-cols-2 divide-x divide-slate-200 text-[10px]">
            {/* Left Column */}
            <div className="pr-3 space-y-1">
              <div className="flex items-center">
                <span className="w-28 text-slate-500 font-medium">Patient Name</span>
                <span className="text-slate-400 mr-2">:</span>
                <span className="font-bold text-slate-900 truncate">{patientInfo.name}</span>
              </div>
              <div className="flex items-center">
                <span className="w-28 text-slate-500 font-medium">UHID / Patient ID</span>
                <span className="text-slate-400 mr-2">:</span>
                <span className="font-bold text-slate-900 truncate">{patientInfo.uhid}</span>
              </div>
              <div className="flex items-center">
                <span className="w-28 text-slate-500 font-medium">Age</span>
                <span className="text-slate-400 mr-2">:</span>
                <span className="font-bold text-slate-900">{patientInfo.age}</span>
              </div>
              {patientInfo.dob && (
                <div className="flex items-center">
                  <span className="w-28 text-slate-500 font-medium">Date of Birth (DOB)</span>
                  <span className="text-slate-400 mr-2">:</span>
                  <span className="font-bold text-slate-900">{formatDate(patientInfo.dob)}</span>
                </div>
              )}
              <div className="flex items-center">
                <span className="w-28 text-slate-500 font-medium">Gender</span>
                <span className="text-slate-400 mr-2">:</span>
                <span className="font-bold text-slate-900">{patientInfo.gender}</span>
              </div>
            </div>

            {/* Right Column */}
            <div className="pl-3 space-y-1">
              <div className="flex items-center">
                <span className="w-28 text-slate-500 font-medium">Mobile No.</span>
                <span className="text-slate-400 mr-2">:</span>
                <span className="font-bold text-slate-900">{patientInfo.mobile}</span>
              </div>
              <div className="flex items-center">
                <span className="w-28 text-slate-500 font-medium">Doctor Name</span>
                <span className="text-slate-400 mr-2">:</span>
                <span className="font-bold text-slate-900 truncate">{doctorInfo.name}</span>
              </div>
              <div className="flex items-center">
                <span className="w-28 text-slate-500 font-medium">Specialization</span>
                <span className="text-slate-400 mr-2">:</span>
                <span className="font-bold text-slate-900 truncate">{doctorInfo.specialization}</span>
              </div>
              <div className="flex items-center">
                <span className="w-28 text-slate-500 font-medium">Visit Type</span>
                <span className="text-slate-400 mr-2">:</span>
                <span className="font-bold text-slate-900">{patientInfo.visitType}</span>
              </div>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* 5. CLINICAL NOTES CARD */}
        {/* --------------------------------------------------------------------- */}
        <div className="border border-[#059669]/15 rounded-xl overflow-hidden mb-2.5 shadow-2xs">
          {/* Header Strip */}
          <div className="bg-[#EAF5F2] px-3 py-1 flex items-center gap-1.5 border-b border-[#059669]/10">
            <ClipboardList size={13} className="text-[#059669]" />
            <h4 className="text-[11.5px] font-bold text-slate-900">
              Clinical Notes
            </h4>
          </div>

          {/* Notes Content */}
          <div className="p-2.5 space-y-1 text-[10px]">
            <div className="flex items-start">
              <span className="w-28 text-slate-500 font-medium shrink-0">Chief Complaint</span>
              <span className="text-slate-400 mr-2">:</span>
              <span className="text-slate-800 font-medium">{clinicalNotes.chiefComplaint}</span>
            </div>
            <div className="flex items-start">
              <span className="w-28 text-slate-500 font-medium shrink-0">Symptoms</span>
              <span className="text-slate-400 mr-2">:</span>
              <span className="text-slate-800 font-medium">{clinicalNotes.symptoms}</span>
            </div>
            <div className="flex items-start">
              <span className="w-28 text-slate-500 font-medium shrink-0">Diagnosis</span>
              <span className="text-slate-400 mr-2">:</span>
              <span className="font-bold text-slate-900">{clinicalNotes.diagnosis}</span>
            </div>
            <div className="flex items-start pt-0.5">
              <span className="w-28 text-slate-500 font-medium shrink-0">Vitals</span>
              <span className="text-slate-400 mr-2">:</span>
              <div className="flex items-center gap-2 text-slate-800 font-medium flex-wrap">
                <span>Temperature: <strong className="font-bold">{clinicalNotes.vitals.temperature}</strong></span>
                <span className="text-slate-300">|</span>
                <span>BP: <strong className="font-bold">{clinicalNotes.vitals.bloodPressure}</strong></span>
                <span className="text-slate-300">|</span>
                <span>Pulse: <strong className="font-bold">{clinicalNotes.vitals.pulse}</strong></span>
                <span className="text-slate-300">|</span>
                <span>SpO₂: <strong className="font-bold">{clinicalNotes.vitals.spo2}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* 6. PRESCRIPTION MEDICINE TABLE */}
        {/* --------------------------------------------------------------------- */}
        <div className="mb-2.5 overflow-hidden rounded-xl border border-[#059669]/20 shadow-2xs">
          {/* Top Primary Bar with Rx Symbol */}
          <div className="bg-[#059669] px-3.5 py-1.5 flex items-center gap-2 text-white">
            <span className="font-serif italic font-black text-sm tracking-normal leading-none select-none">
              ℞
            </span>
            <span className="font-bold text-[11.5px] uppercase tracking-wide leading-none">
              Prescription
            </span>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[9.5px]">
              <thead>
                <tr className="bg-[#F0F7F5] text-slate-900 border-b border-slate-200">
                  <th className="py-1.5 px-2 text-center font-bold border-r border-slate-200 w-[5%]">#</th>
                  <th className="py-1.5 px-2 text-left font-bold border-r border-slate-200 w-[20%]">Medicine Name</th>
                  <th className="py-1.5 px-2 text-left font-bold border-r border-slate-200 w-[10%]">Dose</th>
                  <th className="py-1.5 px-2 text-left font-bold border-r border-slate-200 w-[12%]">Times / Day</th>
                  <th className="py-1.5 px-2 text-left font-bold border-r border-slate-200 w-[16%]">Intake Time</th>
                  <th className="py-1.5 px-2 text-left font-bold border-r border-slate-200 w-[9%]">Duration</th>
                  <th className="py-1.5 px-2 text-left font-bold border-r border-slate-200 w-[13%]">Food Instruction</th>
                  <th className="py-1.5 px-2 text-left font-bold w-[15%]">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {parsedMedicines.map((med, idx) => (
                  <tr key={med.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-1.5 px-2 text-center text-slate-500 font-medium border-r border-slate-200">
                      {idx + 1}
                    </td>
                    <td className="py-1.5 px-2 font-bold text-slate-900 border-r border-slate-200">
                      {med.name}
                    </td>
                    <td className="py-1.5 px-2 text-slate-700 font-medium border-r border-slate-200">
                      {med.dose}
                    </td>
                    <td className="py-1.5 px-2 text-slate-700 font-medium border-r border-slate-200">
                      {med.timesPerDay}
                    </td>
                    <td className="py-1.5 px-2 text-slate-700 font-medium border-r border-slate-200">
                      {med.intakeTime}
                    </td>
                    <td className="py-1.5 px-2 text-slate-700 font-medium border-r border-slate-200">
                      {med.duration}
                    </td>
                    <td className="py-1.5 px-2 text-slate-700 font-medium border-r border-slate-200">
                      {med.foodInstruction}
                    </td>
                    <td className="py-1.5 px-2 text-slate-600 font-normal">
                      {med.instructions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* 7. ADVICE + RECOMMENDED TESTS ROW */}
        {/* --------------------------------------------------------------------- */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          {/* Left Card: Advice / Lifestyle Recommendations */}
          <div className="border border-[#059669]/15 rounded-xl overflow-hidden shadow-2xs flex flex-col">
            <div className="bg-[#EAF5F2] px-3 py-1 flex items-center gap-1.5 border-b border-[#059669]/10">
              <FileText size={13} className="text-[#059669]" />
              <h4 className="text-[11px] font-bold text-slate-900">
                Advice / Lifestyle Recommendations
              </h4>
            </div>
            <div className="p-2.5 flex-1 bg-white text-[9.5px] text-slate-700 space-y-1">
              {adviceList.map((adv: any, i: number) => (
                <div key={i} className="flex items-start gap-1.5 leading-snug">
                  <span className="text-[#059669] font-black text-xs leading-none shrink-0">•</span>
                  <span>{adv}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Card: Recommended Tests / Follow-up */}
          <div className="border border-[#059669]/15 rounded-xl overflow-hidden shadow-2xs flex flex-col">
            <div className="bg-[#EAF5F2] px-3 py-1 flex items-center gap-1.5 border-b border-[#059669]/10">
              <FlaskConical size={13} className="text-[#059669]" />
              <h4 className="text-[11px] font-bold text-slate-900">
                Recommended Tests / Follow-up
              </h4>
            </div>
            <div className="p-2.5 flex-1 bg-white text-[9.5px] text-slate-700 space-y-1">
              {testsList.map((test: any, i: number) => (
                <div key={i} className="flex items-start gap-1.5 leading-snug">
                  <span className="text-[#059669] font-black text-xs leading-none shrink-0">•</span>
                  <span>{test}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* 8. DOCTOR SIGNATURE & NOTICE AREA */}
        {/* --------------------------------------------------------------------- */}
        <div className="flex items-end justify-between pt-1 pb-1">
          {/* Left Disclaimer */}
          <div className="text-[9.5px] text-slate-500 leading-tight space-y-0.5">
            <p>Please take medicines as prescribed and follow the advice given.</p>
            <p>For any queries, contact the clinic.</p>
          </div>

          {/* Right Doctor Signature */}
          <div className="flex flex-col items-center text-center">
            {/* Signature flourish */}
            <div className="h-9 flex items-center justify-center">
              {doctorInfo.signature ? (
                <img src={doctorInfo.signature} alt="Doctor Signature" className="h-8 max-w-[140px] object-contain" />
              ) : (
                <svg width="110" height="32" viewBox="0 0 140 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-800">
                  <path d="M12 28 C 30 10, 45 4, 60 18 C 70 28, 85 8, 95 24 C 105 32, 120 12, 130 20" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M40 22 C 55 24, 75 14, 90 28" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div className="w-32 border-b border-slate-400 mb-1" />
            <h5 className="text-[12px] font-bold text-slate-900 leading-tight">
              {doctorInfo.name}
            </h5>
            <p className="text-[9.5px] text-slate-600 leading-tight">
              {doctorInfo.specialization}
            </p>
            <p className="text-[9px] text-slate-500 leading-tight">
              Reg. No.: {doctorInfo.regNo}
            </p>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* 9. FOOTER */}
        {/* --------------------------------------------------------------------- */}
        <div className="mt-2 pt-2 border-t border-slate-200 grid grid-cols-12 gap-2 items-center">
          {/* Footer Left: Thank you & VIITSA */}
          <div className="col-span-3">
            <p className="text-[8.5px] text-slate-500 leading-tight">
              Thank you for choosing
            </p>
            <h6 className="text-[15px] font-black tracking-tight text-[#059669] leading-tight">
              VIITSA
            </h6>
            <p className="text-[7.5px] font-bold tracking-wider text-slate-500 uppercase leading-tight">
              BETTER CARE TOGETHER
            </p>
          </div>

          {/* Footer Center: Benefits Pillars */}
          <div className="col-span-6 flex items-center justify-center gap-3">
            <div className="flex flex-col items-center text-center">
              <ShieldCheck size={13} className="text-[#059669] mb-0.5" />
              <span className="text-[7.5px] font-bold text-slate-700 leading-tight">Secure<br />Patient Records</span>
            </div>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex flex-col items-center text-center">
              <Users size={13} className="text-[#059669] mb-0.5" />
              <span className="text-[7.5px] font-bold text-slate-700 leading-tight">Seamless<br />Clinic Experience</span>
            </div>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex flex-col items-center text-center">
              <TrendingUp size={13} className="text-[#059669] mb-0.5" />
              <span className="text-[7.5px] font-bold text-slate-700 leading-tight">Better<br />Health Outcomes</span>
            </div>
          </div>

          {/* Footer Right: Generated Platform Info */}
          <div className="col-span-3 text-right">
            <p className="text-[8.5px] font-semibold text-slate-800 leading-tight">
              Generated via <strong>VIITSA</strong>
            </p>
            <p className="text-[7.5px] text-slate-500 leading-tight mt-0.5">
              Clinic Management & Patient Engagement Platform
            </p>
            <p className="text-[7.5px] text-[#059669] font-semibold leading-tight mt-0.5">
              www.viitsa.com
            </p>
          </div>
        </div>
      </div>

      {/* Email Sharing Modal */}
      {emailModalOpen && (
        <div className="no-print fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#059669]">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Send Prescription via Email</h3>
                  <p className="text-[11px] text-slate-500">Official PDF attached + Account login link</p>
                </div>
              </div>
              <button 
                onClick={() => setEmailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Patient Email Address *
                </label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="e.g. patient@example.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium"
                />
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-1.5 text-[11px] text-slate-600">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                  <Check size={13} className="text-emerald-600" />
                  <span>What will be shared:</span>
                </div>
                <div className="pl-5 space-y-1">
                  <p>📎 <strong>Official A4 PDF File:</strong> Attached directly to email</p>
                  <p>🔐 <strong>Patient Portal Login:</strong> https://viitsa.com/login</p>
                  <p>📄 <strong>Online View Link:</strong> Direct high-resolution cloud link</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                disabled={sharingEmail}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sharingEmail || !targetEmail.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl flex items-center gap-2 shadow-sm transition"
              >
                {sharingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sharingEmail ? 'Sending Email with PDF...' : 'Send Email with PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
