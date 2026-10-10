import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { PatientAuthProvider, usePatientAuth } from '../lib/patientAuth';
import { useAuth } from '../lib/auth';
import { ToastProvider } from '../lib/toast';
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
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import type { TriageSummary } from '../lib/aiService';
import { PATIENT_ROLES, CLINIC_ROLES, ADMIN_ROLES } from '../lib/types';

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

  // Only brand-new registrations in the current session without a completed profile should see onboarding.
  // Already registered patients directly open the dashboard!
  const isNewRegistration = typeof window !== 'undefined' && sessionStorage.getItem('viitsa_is_new_registration') === 'true';
  const isProfileComplete = user?.profile_completed === true || account?.profile_completed === true || !isNewRegistration;

  // Auto-heal: Ensure already registered patients have profile_completed permanently set to true
  useEffect(() => {
    if (user && !isNewRegistration) {
      if (user.profile_completed !== true || account?.profile_completed !== true) {
        try {
          if (user.user_id) {
            updateDoc(doc(db, 'users', user.user_id), { profile_completed: true, updated_at: new Date().toISOString() }).catch(() => {});
          }
          const accId = account?.account_id || user.patient_account_id || `pat_${user.user_id}`;
          if (accId) {
            updateDoc(doc(db, 'patient_accounts', accId), { profile_completed: true, updated_at: new Date().toISOString() }).catch(() => {});
          }
        } catch {}
      }
    }
  }, [user, account, isNewRegistration]);

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

  // If user is a clinic admin or doctor, redirect to clinic dashboard
  if (user && (CLINIC_ROLES.includes(user.role as any) || ADMIN_ROLES.includes(user.role as any))) {
    return <Navigate to="/clinic/dashboard" replace />;
  }

  // If signed out or not logged in, redirect to unified login page
  if (!guestMode && !user && (!account || !account.otp_verified || screen === 'auth')) {
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

  // If patient is a brand-new registration who has not completed their profile, require completion
  if (!guestMode && account && isNewRegistration && !isProfileComplete && user?.role !== 'patient_attendant') {
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
        <Route path="dashboard" element={<PatientHome onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} clinicId={clinic?.clinic_id || clinicId} />} />
        <Route path="ai" element={<PatientAINavigator onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} clinicId={clinic?.clinic_id || clinicId} patientId={patientId} onBookWithSummary={handleBookWithSummary} />} />
        <Route path="book" element={<PatientBooking onTab={(t) => { navigate(`/patient/${t === 'home' ? 'dashboard' : t}`); if (t === 'home') setPendingAISummary(null); }} clinic={clinic} patientId={patientId} aiSummary={pendingAISummary} />} />
        <Route path="records" element={<PatientRecords patientId={patientId} onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} />} />
        <Route path="payments" element={<PatientPayments patientId={patientId} onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} />} />
        <Route path="profile" element={<PatientProfile onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} />} />
        <Route path="family" element={<FamilyVault onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} />} />
        <Route path="timeline" element={<HealthTimeline onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} patientId={patientId} clinicId={clinic?.clinic_id || clinicId} />} />
        <Route path="doctors" element={<PatientDoctorSearch onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} onSelectDoctor={async (clinicObj, doctor) => { await selectClinic(clinicObj); navigate('/patient/book'); }} />} />
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
