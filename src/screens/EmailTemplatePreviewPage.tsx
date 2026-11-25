import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, Copy, Shield, Calendar, FileText, CreditCard, Sparkles } from 'lucide-react';
import { ViitsaLogo } from '../components/ViitsaLogo';
import {
  buildPasswordResetHtml,
  buildVerificationHtml,
  buildClinicPendingHtml,
  buildClinicApprovedHtml,
  buildClinicRejectedHtml,
  buildAppointmentHtml,
  buildPrescriptionHtml,
  buildInvoiceHtml,
  buildSubscriptionActivatedHtml,
  buildSubscriptionPlanChangeScheduledHtml,
  buildSubscriptionCancelledHtml,
} from '../lib/emailService';

export type TemplateId =
  | 'reset_clinic'
  | 'reset_admin'
  | 'reset_patient'
  | 'verify_clinic'
  | 'verify_patient'
  | 'clinic_pending'
  | 'clinic_approved'
  | 'clinic_rejected'
  | 'appt_confirmed'
  | 'appt_rescheduled'
  | 'appt_cancelled'
  | 'prescription'
  | 'invoice'
  | 'sub_activated'
  | 'sub_change'
  | 'sub_cancelled';

type CategoryId = 'all' | 'auth' | 'clinic' | 'appointment' | 'clinical' | 'billing';

interface TemplateMeta {
  id: TemplateId;
  name: string;
  category: CategoryId;
  subject: string;
  targetLink: string;
  html: string;
}

export function EmailTemplatePreviewPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('reset_clinic');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html' | 'links'>('preview');

  const templates: Record<TemplateId, TemplateMeta> = {
    reset_clinic: {
      id: 'reset_clinic',
      name: 'Password Reset (Clinic)',
      category: 'auth',
      subject: 'Reset Your Viitsa Clinic Portal Password',
      targetLink: 'https://viitsa.com/reset-password?mode=resetPassword&oobCode=SECURE_DEMO_TOKEN&return=%2Fclinic%2Flogin',
      html: buildPasswordResetHtml({
        email: 'doctor@cityclinic.com',
        resetLink: 'https://viitsa.com/reset-password?mode=resetPassword&oobCode=SECURE_DEMO_TOKEN&return=%2Fclinic%2Flogin',
        portal: 'clinic',
      }),
    },
    reset_admin: {
      id: 'reset_admin',
      name: 'Password Reset (Admin)',
      category: 'auth',
      subject: 'Reset Your Viitsa Admin Portal Password',
      targetLink: 'https://viitsa.com/reset-password?mode=resetPassword&oobCode=SECURE_DEMO_TOKEN&return=%2Fadmin%2Flogin',
      html: buildPasswordResetHtml({
        email: 'admin@viitsa.com',
        resetLink: 'https://viitsa.com/reset-password?mode=resetPassword&oobCode=SECURE_DEMO_TOKEN&return=%2Fadmin%2Flogin',
        portal: 'admin',
      }),
    },
    reset_patient: {
      id: 'reset_patient',
      name: 'Password Reset (Patient)',
      category: 'auth',
      subject: 'Reset Your Viitsa Patient Portal Password',
      targetLink: 'https://viitsa.com/reset-password?mode=resetPassword&oobCode=SECURE_DEMO_TOKEN&return=%2Flogin',
      html: buildPasswordResetHtml({
        email: 'patient@example.com',
        resetLink: 'https://viitsa.com/reset-password?mode=resetPassword&oobCode=SECURE_DEMO_TOKEN&return=%2Flogin',
        portal: 'patient',
      }),
    },
    verify_clinic: {
      id: 'verify_clinic',
      name: 'Email Verification (Clinic)',
      category: 'auth',
      subject: 'Verify your Viitsa Clinic Account',
      targetLink: 'https://viitsa.com/clinic/login?mode=verifyEmail&oobCode=SECURE_VERIFY_TOKEN&verified=true',
      html: buildVerificationHtml({
        email: 'administrator@healthplus.org',
        verifyLink: 'https://viitsa.com/clinic/login?mode=verifyEmail&oobCode=SECURE_VERIFY_TOKEN&verified=true',
        portal: 'clinic',
        name: 'Dr. Sarah Jenkins',
      }),
    },
    verify_patient: {
      id: 'verify_patient',
      name: 'Email Verification (Patient)',
      category: 'auth',
      subject: 'Verify your Viitsa Patient Account',
      targetLink: 'https://viitsa.com/login?mode=verifyEmail&oobCode=SECURE_VERIFY_TOKEN&verified=true',
      html: buildVerificationHtml({
        email: 'alex.morgan@gmail.com',
        verifyLink: 'https://viitsa.com/login?mode=verifyEmail&oobCode=SECURE_VERIFY_TOKEN&verified=true',
        portal: 'patient',
        name: 'Alex Morgan',
      }),
    },
    clinic_pending: {
      id: 'clinic_pending',
      name: 'Clinic Under Review',
      category: 'clinic',
      subject: 'Verification Under Process - Apollo Health Center',
      targetLink: 'https://viitsa.com/clinic/login',
      html: buildClinicPendingHtml({
        clinicName: 'Apollo Health Center',
        clinicEmail: 'contact@apollohealth.org',
        phone: '+91 98765 43210',
        address: 'Plot 42, Hitech City',
        city: 'Hyderabad',
      }),
    },
    clinic_approved: {
      id: 'clinic_approved',
      name: 'Clinic Approved',
      category: 'clinic',
      subject: 'Clinic Approved - Welcome to Viitsa, Apollo Health Center!',
      targetLink: 'https://viitsa.com/clinic/login',
      html: buildClinicApprovedHtml({
        clinicName: 'Apollo Health Center',
        clinicEmail: 'contact@apollohealth.org',
        phone: '+91 98765 43210',
        address: 'Plot 42, Hitech City',
        city: 'Hyderabad',
      }),
    },
    clinic_rejected: {
      id: 'clinic_rejected',
      name: 'Clinic Update Required',
      category: 'clinic',
      subject: 'Verification Rejected - Action Required for Apollo Health Center',
      targetLink: 'https://viitsa.com/clinic/login',
      html: buildClinicRejectedHtml({
        clinicName: 'Apollo Health Center',
        clinicEmail: 'contact@apollohealth.org',
        phone: '+91 98765 43210',
        address: 'Plot 42, Hitech City',
        city: 'Hyderabad',
        rejectionReason: 'Medical establishment certificate illegible. Please submit a high-resolution PDF or scan showing official seal.',
      }),
    },
    appt_confirmed: {
      id: 'appt_confirmed',
      name: 'Appointment Confirmed',
      category: 'appointment',
      subject: 'Appointment Confirmed - Apollo Health Center',
      targetLink: 'https://viitsa.com/login',
      html: buildAppointmentHtml({
        type: 'confirmed',
        patientName: 'Alex Morgan',
        uhid: 'UHID-2026-918',
        age: '34 Y',
        gender: 'Male',
        contactPhone: '+91 98765 43210',
        doctorName: 'Dr. Sarah Jenkins',
        doctorSpecialization: 'Internal Medicine & Cardiology',
        clinicName: 'Apollo Health Center',
        clinicAddress: 'Plot 42, Road No. 36, Jubilee Hills, Hyderabad',
        clinicPhone: '+91 90148 65154',
        clinicEmail: 'care@apollohealth.com',
        date: '28 Oct 2026',
        time: '10:30 AM',
        token: 'ON-014',
        department: 'General Medicine / OPD',
        room: 'Consultation Room 3 (OPD Wing)',
      }),
    },
    appt_rescheduled: {
      id: 'appt_rescheduled',
      name: 'Appointment Rescheduled',
      category: 'appointment',
      subject: 'Appointment Rescheduled - Apollo Health Center',
      targetLink: 'https://viitsa.com/login',
      html: buildAppointmentHtml({
        type: 'rescheduled',
        patientName: 'Alex Morgan',
        uhid: 'UHID-2026-918',
        age: '34 Y',
        gender: 'Male',
        contactPhone: '+91 98765 43210',
        doctorName: 'Dr. Sarah Jenkins',
        doctorSpecialization: 'Internal Medicine & Cardiology',
        clinicName: 'Apollo Health Center',
        clinicAddress: 'Plot 42, Road No. 36, Jubilee Hills, Hyderabad',
        clinicPhone: '+91 90148 65154',
        clinicEmail: 'care@apollohealth.com',
        date: '30 Oct 2026',
        time: '11:15 AM',
        token: 'ON-022',
        department: 'General Medicine / OPD',
        room: 'Consultation Room 3 (OPD Wing)',
      }),
    },
    appt_cancelled: {
      id: 'appt_cancelled',
      name: 'Appointment Cancelled',
      category: 'appointment',
      subject: 'Appointment Cancelled - Apollo Health Center',
      targetLink: 'https://viitsa.com/login',
      html: buildAppointmentHtml({
        type: 'cancelled',
        patientName: 'Alex Morgan',
        uhid: 'UHID-2026-918',
        age: '34 Y',
        gender: 'Male',
        contactPhone: '+91 98765 43210',
        doctorName: 'Dr. Sarah Jenkins',
        doctorSpecialization: 'Internal Medicine & Cardiology',
        clinicName: 'Apollo Health Center',
        clinicAddress: 'Plot 42, Road No. 36, Jubilee Hills, Hyderabad',
        clinicPhone: '+91 90148 65154',
        clinicEmail: 'care@apollohealth.com',
        date: '28 Oct 2026',
        time: '10:30 AM',
        token: 'ON-014',
        department: 'General Medicine / OPD',
        room: 'Consultation Room 3 (OPD Wing)',
      }),
    },
    prescription: {
      id: 'prescription',
      name: 'Prescription Issued',
      category: 'clinical',
      subject: 'Doctor Prescription - RX-9042 | Apollo Health Center',
      targetLink: 'https://viitsa.com/login',
      html: buildPrescriptionHtml({
        patientName: 'Alex Morgan',
        uhid: 'UHID-2026-918',
        age: '34 Y',
        gender: 'Male',
        contactPhone: '+91 98765 43210',
        doctorName: 'Dr. Sarah Jenkins',
        doctorSpecialization: 'Consultant Pulmonologist & General Physician',
        doctorRegNo: 'MCI-2018-84920',
        clinicName: 'Apollo Health Center',
        clinicAddress: 'Plot 42, Road No. 36, Jubilee Hills, Hyderabad',
        clinicPhone: '+91 90148 65154',
        clinicEmail: 'care@apollohealth.com',
        prescriptionNo: 'RX-9042',
        date: '27 Oct 2026',
        time: '10:15 AM',
        department: 'Pulmonology / OPD',
        diagnosis: 'Acute Bronchitis & Seasonal Allergies',
        chiefComplaint: 'Persistent dry cough & mild fever for 3 days',
        vitals: {
          temperature: '98.6°F',
          bloodPressure: '120/80 mmHg',
          pulse: '74 bpm',
          spo2: '99%',
        },
        medicines: [
          {
            category: 'Antibiotic',
            name: 'Tab. Augmentin 625mg (Amoxicillin + Clavulanic Acid)',
            dose: '625 mg',
            timesPerDay: '1 - 0 - 1',
            intakeTime: 'Morning & Night',
            duration: '5 Days',
            foodInstruction: 'After Food',
            instructions: 'Take with full glass of water after food',
          },
          {
            category: 'Analgesic / Antipyretic',
            name: 'Tab. Dolo 650mg (Paracetamol)',
            dose: '650 mg',
            timesPerDay: '1 - 0 - 1',
            intakeTime: 'SOS / If Fever',
            duration: '3 Days',
            foodInstruction: 'After Food',
            instructions: 'Take only in case of fever or body ache',
          },
          {
            category: 'Antiallergic',
            name: 'Tab. Montair-LC (Montelukast + Levocetirizine)',
            dose: '10mg / 5mg',
            timesPerDay: '0 - 0 - 1',
            intakeTime: 'Night only',
            duration: '7 Days',
            foodInstruction: 'Before Bedtime',
            instructions: 'Take at night before sleep; may cause slight drowsiness',
          },
          {
            category: 'Cough Relief',
            name: 'Syp. Ascoril-D Cough Relief (Sugar Free)',
            dose: '10 ml',
            timesPerDay: '1 - 1 - 1',
            intakeTime: 'Thrice Daily',
            duration: '5 Days',
            foodInstruction: 'After Meals',
            instructions: 'Do not drink cold water for 15 minutes after taking syrup',
          },
        ],
        advice: [
          'Drink 2.5 - 3 liters of warm water daily to stay well hydrated.',
          'Complete the full 5-day antibiotic course; do not stop early.',
          'Avoid cold beverages, deep-fried food, and direct exposure to air conditioning.',
          'Perform warm saline water gargles and steam inhalation twice daily.',
        ],
        tests: [
          'Complete Blood Count (CBC) with Platelet Indices & ESR',
          'Chest X-Ray (PA View if cough persists beyond 5 days)',
        ],
        followUpDate: '02 Nov 2026',
        pdfUrl: 'https://viitsa.com/login',
      }),
    },
    invoice: {
      id: 'invoice',
      name: 'Patient Invoice',
      category: 'clinical',
      subject: 'Medical Invoice & Receipt - INV-2026-08492 | XR Clinic',
      targetLink: 'https://viitsa.com/login',
      html: buildInvoiceHtml({
        patientName: 'Aarav Sharma',
        clinicName: 'XR',
        clinicAddress: 'Kukatpally',
        clinicPhone: '7075545960',
        clinicEmail: 'business8281@gmail.com',
        doctorName: 'Dr. XR',
        doctorSpecialization: 'Internal Medicine & Cardiology',
        uhid: 'UHID-2026-918',
        invoiceNo: 'INV-2026-08492',
        receiptNo: 'RCP-8921',
        date: '20 Nov 2026',
        time: '09:49',
        amount: 1350.0,
        subtotal: 1350.0,
        pdfUrl: 'https://viitsa.com/api/invoice/download/INV-2026-08492',
      }),
    },
    sub_activated: {
      id: 'sub_activated',
      name: 'Subscription Tax Invoice',
      category: 'billing',
      subject: 'Subscription Tax Invoice INV-2026-08492 — Viitsa Clinic Pro | XR Clinic',
      targetLink: 'https://viitsa.com/clinic/dashboard',
      html: buildSubscriptionActivatedHtml({
        clinicName: 'XR',
        clinicAddress: 'Kukatpally',
        clinicPhone: '7075545960',
        clinicEmail: 'business8281@gmail.com',
        doctorName: 'Dr. XR',
        doctorSpecialization: 'Internal Medicine & Cardiology',
        uhid: 'UHID-2026-918',
        invoiceNo: 'INV-2026-08492',
        receiptNo: 'RCP-8921',
        date: '20 Nov 2026',
        time: '09:49',
        paymentMethod: 'UPI',
        planName: 'Small Clinic Tier',
        cycle: 'monthly',
        isTrial: false,
        amount: 1999,
        paymentId: 'mandate_9941a82e',
      }),
    },
    sub_change: {
      id: 'sub_change',
      name: 'Plan Change Scheduled',
      category: 'billing',
      subject: 'Plan Change Scheduled - MULTISPECIALTY Plan | Apollo Health Center',
      targetLink: 'https://viitsa.com/clinic/settings?tab=billing',
      html: buildSubscriptionPlanChangeScheduledHtml({
        clinicName: 'Apollo Health Center',
        clinicAddress: 'Plot 42, Road No. 36, Jubilee Hills, Hyderabad',
        clinicPhone: '+91 90148 65154',
        clinicEmail: 'billing@apollohealth.com',
        currentPlan: 'CLINIC Plan',
        newPlan: 'MULTISPECIALTY Plan',
        cycle: 'annual',
        effectiveDate: '26 Nov 2026',
        requestDate: '20 Nov 2026',
        scheduleId: 'SCHED-2026-9482',
        newAmount: 119990,
        paymentMethod: 'UPI Auto-Pay',
        transitionType: 'TIER UPGRADE & EXPANSION',
      }),
    },
    sub_cancelled: {
      id: 'sub_cancelled',
      name: 'Cancellation Scheduled',
      category: 'billing',
      subject: 'Subscription Cancellation Scheduled - CLINIC Plan | Apollo Health Center',
      targetLink: 'https://viitsa.com/clinic/settings?tab=billing',
      html: buildSubscriptionCancelledHtml({
        clinicName: 'Apollo Health Center',
        clinicAddress: 'Plot 42, Road No. 36, Jubilee Hills, Hyderabad',
        clinicPhone: '+91 90148 65154',
        clinicEmail: 'billing@apollohealth.com',
        planName: 'CLINIC Plan',
        effectiveDate: '26 Nov 2026',
        requestDate: '20 Nov 2026',
        scheduleId: 'SCHED-CANC-2026-8812',
        reason: 'Temporary restructuring of satellite clinic operations.',
      }),
    },
  };

  const current = templates[selectedTemplate] || templates.reset_clinic;

  const categories: Array<{ id: CategoryId; label: string }> = [
    { id: 'all', label: 'All Templates' },
    { id: 'auth', label: 'Authentication & Security' },
    { id: 'clinic', label: 'Clinic Onboarding' },
    { id: 'appointment', label: 'Appointments' },
    { id: 'clinical', label: 'Prescriptions & Invoices' },
    { id: 'billing', label: 'Subscriptions' },
  ];

  const visibleTemplates = Object.values(templates).filter((t) =>
    selectedCategory === 'all' ? true : t.category === selectedCategory
  );

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(current.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            to="/clinic/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to App
          </Link>
          <ViitsaLogo size="sm" light={false} />
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold">
            <Mail className="w-3.5 h-3.5 text-emerald-700" />
            Unified Master Email Design System
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-2">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'preview' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Visual Preview
            </button>
            <button
              onClick={() => setActiveTab('links')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'links' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inspect Link URLs
            </button>
            <button
              onClick={() => setActiveTab('html')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'html' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Raw HTML
            </button>
          </div>
          <button
            onClick={handleCopyHtml}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#059669] hover:bg-[#047857] text-white px-3.5 py-2 rounded-xl shadow-xs transition"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied HTML' : 'Copy HTML'}
          </button>
        </div>
      </header>

      {/* Category Filter Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">Category:</span>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCategory(c.id);
                const firstInCat = Object.values(templates).find((t) => c.id === 'all' || t.category === c.id);
                if (firstInCat) setSelectedTemplate(firstInCat.id);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                selectedCategory === c.id
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template Selector Pills */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Template:</span>
          {visibleTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition border ${
                selectedTemplate === t.id
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 flex flex-col items-center justify-start max-w-5xl mx-auto w-full">
        {activeTab === 'preview' && (
          <div className="w-full space-y-4">
            {/* Email Meta Info Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-xs space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">Subject Line:</span>
                <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                  Production Standard — No Single-Sided Borders
                </span>
              </div>
              <p className="text-slate-900 font-bold text-sm">{current.subject}</p>
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4 text-slate-500">
                <span><strong>From:</strong> "Viitsa Healthcare" &lt;support@viitsa.com&gt;</span>
                <span><strong>To:</strong> user@example.com</span>
                <span><strong>Design Standard:</strong> Responsive Table Shell | Balanced 4-Sided Card</span>
              </div>
            </div>

            {/* Email Render Frame */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Inbox Rendering Simulation (Full HTML / CSS)</span>
                <span className="font-mono text-[11px] text-emerald-800 font-bold">Canonical: https://viitsa.com</span>
              </div>
              <div className="p-4 sm:p-10 flex justify-center bg-slate-50/50">
                <iframe
                  key={current.id}
                  title="Email Template Live Preview"
                  srcDoc={current.html}
                  className="w-full max-w-[720px] h-[900px] border-0 rounded-2xl bg-white shadow-md"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Canonical Link Target Verification</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every link and button inside this email template points strictly to the official production domain (<strong>https://viitsa.com</strong>).
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div>
                <span className="text-slate-400 uppercase tracking-wider block text-[10px] font-sans font-bold mb-1">
                  Primary Button Target Link:
                </span>
                <div className="bg-white border border-slate-200 p-3 rounded-lg text-emerald-800 break-all select-all font-semibold">
                  {current.targetLink}
                </div>
              </div>

              <div>
                <span className="text-slate-400 uppercase tracking-wider block text-[10px] font-sans font-bold mb-1">
                  Plaintext Fallback URL (displayed inside email):
                </span>
                <div className="bg-white border border-slate-200 p-3 rounded-lg text-slate-700 break-all select-all">
                  {current.targetLink}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 text-xs text-slate-600 space-y-2">
              <p className="font-bold text-slate-800">Email Safety & Design Guarantees:</p>
              <div className="space-y-1.5 text-slate-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Balanced 4-sided borders everywhere (<code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">border: 1px solid #e2e8f0; border-radius: 12px;</code>)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Zero single-sided accent borders (strictly <strong>NO</strong> <code className="text-rose-600 bg-rose-50 px-1 py-0.5 rounded font-mono">border-left</code>)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Table-based master shell ensuring 100% responsiveness in Gmail, Apple Mail, Outlook, and mobile clients</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Production links only: <strong>NO</strong> localhost or 127.0.0.1 references</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Official sender: <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">support@viitsa.com</code> with Titan SSL</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'html' && (
          <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 text-xs">
              <span className="font-mono text-slate-400">{current.id}.html ({current.name})</span>
              <button
                onClick={handleCopyHtml}
                className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-slate-300 font-semibold transition"
              >
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            <pre className="font-mono text-xs overflow-x-auto text-emerald-400 leading-relaxed max-h-[600px] select-all">
              {current.html}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}

