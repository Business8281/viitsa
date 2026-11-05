import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { PatientAuthProvider, usePatientAuth } from '../lib/patientAuth';
import { useAuth } from '../lib/auth';
import { ToastProvider } from '../lib/toast';
import { SectionErrorBoundary } from '../components/SectionErrorBoundary';
import { PatientLanding } from './PatientLanding';
import { PatientOnboardingProfile } from './PatientOnboardingProfile';
import { PatientHome } from './PatientHome';
import { PatientAINavigator } from './PatientAINavigator';
import { PatientBooking } from './PatientBooking';
import { PatientRecords } from './PatientRecords';
import { PatientPayments } from './PatientPayments';
import { PatientProfile } from './PatientProfile';
import { FamilyVault } from './FamilyVault';
import { HealthTimeline } from './HealthTimeline';
import { PatientDoctorSearch } from './PatientDoctorSearch';
import { PatientBottomNav, type PatientTab } from './PatientBottomNav';
import { auth, db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import type { TriageSummary } from '../lib/aiService';
import { PATIENT_ROLES, CLINIC_ROLES, ADMIN_ROLES } from '../lib/types';
import { QRWalkinPage } from '../screens/QRWalkinPage';

type PatientScreen = 'landing' | 'auth' | 'app';

function PatientInner() {
  const { account, clinic, clinicId, setClinicId, selectClinic } = usePatientAuth();
  const { user, loading: authLoading } = useAuth();
  const [screen, setScreen] = useState<PatientScreen>('app');
  const [pendingInvoiceCount, setPendingInvoiceCount] = useState(0);
  const [guestMode, setGuestMode] = useState(false);
  const [pendingAISummary, setPendingAISummary] = useState<TriageSummary | null>(null);
  const navigate = useNavigate();

  const patientId = account?.account_id || user?.patient_account_id || (user?.role === 'patient' ? `pat_${user.user_id}` : null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get('clinic');
    if (cid) setClinicId(cid);
  }, [setClinicId]);

  useEffect(() => {
    const stored = localStorage.getItem('viitsa_patient_v1');
    if (stored) {
      try {
        const { account_id } = JSON.parse(stored);
        if (account_id) setScreen('app');
      } catch {}
    }
  }, []);

  // Live onSnapshot for pending invoices count
  useEffect(() => {
    const pid = account?.account_id;
    if (!pid) return;
    const q = query(collection(db, 'invoices'), where('patient_id', '==', pid), where('payment_status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => {
      setPendingInvoiceCount(snap.size);
    }, (err) => console.warn('Pending invoices onSnapshot warning:', err));
    return () => unsub();
  }, [account?.account_id]);

  useEffect(() => {
    if (account?.otp_verified && screen === 'auth') {
      setScreen('app');
    }
  }, [account, screen]);

  // Check whether patient has genuinely completed onboarding profile (phone linked + profile details completed; email is optional)
  const isProfileComplete = Boolean(
    (user?.profile_completed === true || account?.profile_completed === true) &&
    (user?.phone || account?.phone)
  ) || Boolean(
    (account?.dob || (account as any)?.age) &&
    account?.gender &&
    account?.blood_group &&
    account?.address &&
    (user?.phone || account?.phone)
  );

  const handleBookWithSummary = (summary: TriageSummary) => {
    setPendingAISummary(summary);
    navigate('/patient/book');
  };

  if (screen === 'landing') {
    return (
      <PatientLanding
        clinic={clinic}
        onBook={() => {
          if (account?.otp_verified) {
            setScreen('app');
            navigate('/patient/book');
          } else {
            navigate('/login');
          }
        }}
        onAI={() => {
          if (account?.otp_verified) {
            setScreen('app');
            navigate('/patient/ai');
          } else {
            navigate('/login');
          }
        }}
        onLogin={() => navigate('/login')}
        onGuest={() => { setGuestMode(true); setScreen('app'); navigate('/patient/ai'); }}
      />
    );
  }

  // Show loading while global auth is resolving
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5FAFA] flex items-center justify-center">
        <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Loading PatientApp auth...
        </div>
      </div>
    );
  }

  // If user is a doctor, clinic admin, or admin, redirect to their proper dashboard
  if (user) {
    if (user.role === 'clinic_doctor' || user.role === 'doctor') {
      return <Navigate to="/doctor/dashboard" replace />;
    }
    if (CLINIC_ROLES.includes(user.role as any)) {
      return <Navigate to="/clinic/dashboard" replace />;
    }
    if (ADMIN_ROLES.includes(user.role as any)) {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  // Check if patient scanned a clinic QR code (?clinic=...)
  const currentParams = new URLSearchParams(window.location.search);
  const scanClinicId = currentParams.get('clinic') || clinicId;

  // If signed out or not logged in:
  if (!guestMode && !user && (!account || !account.otp_verified || screen === 'auth')) {
    // When visiting via a clinic QR scan link, present the emergency walkin booking form directly
    if (scanClinicId) {
      return <QRWalkinPage clinicIdOverride={scanClinicId} />;
    }
    return <Navigate to="/login" replace />;
  }

  // While user is logged in as patient but account state is finalizing
  if (!guestMode && user && !account) {
    return (
      <div className="min-h-screen bg-[#F5FAFA] flex items-center justify-center">
        <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Loading patient profile...
        </div>
      </div>
    );
  }

  // If patient has not completed their onboarding profile, require completion
  if (!guestMode && account && !isProfileComplete && user?.role !== 'patient_attendant') {
    return (
      <PatientOnboardingProfile
        onComplete={() => {
          sessionStorage.removeItem('viitsa_is_new_registration');
          navigate('/patient/dashboard', { replace: true });
        }}
      />
    );
  }

  return (
    <div className="relative">
      <Routes>
        <Route path="dashboard" element={
          <SectionErrorBoundary sectionName="Patient Home" fallbackUrl="/patient/dashboard">
            <PatientHome onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} clinicId={clinic?.clinic_id || clinicId} />
          </SectionErrorBoundary>
        } />
        <Route path="ai" element={
          <SectionErrorBoundary sectionName="AI Navigator" fallbackUrl="/patient/dashboard">
            <PatientAINavigator onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} clinicId={clinic?.clinic_id || clinicId} patientId={patientId} onBookWithSummary={handleBookWithSummary} />
          </SectionErrorBoundary>
        } />
        <Route path="book" element={
          <SectionErrorBoundary sectionName="Appointment Booking" fallbackUrl="/patient/dashboard">
            <PatientBooking onTab={(t) => { navigate(`/patient/${t === 'home' ? 'dashboard' : t}`); if (t === 'home') setPendingAISummary(null); }} clinic={clinic} patientId={patientId} aiSummary={pendingAISummary} />
          </SectionErrorBoundary>
        } />
        <Route path="records" element={
          <SectionErrorBoundary sectionName="Medical Records" fallbackUrl="/patient/dashboard">
            <PatientRecords patientId={patientId} onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} />
          </SectionErrorBoundary>
        } />
        <Route path="payments" element={
          <SectionErrorBoundary sectionName="Bills & Invoices" fallbackUrl="/patient/dashboard">
            <PatientPayments patientId={patientId} onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} />
          </SectionErrorBoundary>
        } />
        <Route path="profile" element={
          <SectionErrorBoundary sectionName="Patient Profile" fallbackUrl="/patient/dashboard">
            <PatientProfile onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} />
          </SectionErrorBoundary>
        } />
        <Route path="family" element={
          <SectionErrorBoundary sectionName="Family Vault" fallbackUrl="/patient/dashboard">
            <FamilyVault patientId={patientId} onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} />
          </SectionErrorBoundary>
        } />
        <Route path="timeline" element={
          <SectionErrorBoundary sectionName="Health Timeline" fallbackUrl="/patient/dashboard">
            <HealthTimeline onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} patientId={patientId} clinicId={clinic?.clinic_id || clinicId} />
          </SectionErrorBoundary>
        } />
        <Route path="doctors" element={
          <SectionErrorBoundary sectionName="Doctor Search" fallbackUrl="/patient/dashboard">
            <PatientDoctorSearch onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} onSelectDoctor={async (clinicObj, doctor) => { await selectClinic(clinicObj); navigate('/patient/book'); }} />
          </SectionErrorBoundary>
        } />
        <Route index element={<Navigate to="/patient/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/patient/dashboard" replace />} />
      </Routes>
      <PatientBottomNav paymentBadge={pendingInvoiceCount} />
    </div>
  );
}

export function PatientApp() {
  return (
    <ToastProvider>
      <PatientAuthProvider>
        <PatientInner />
      </PatientAuthProvider>
    </ToastProvider>
  );
}
