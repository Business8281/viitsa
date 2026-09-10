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
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { TriageSummary } from '../lib/aiService';

type PatientScreen = 'landing' | 'auth' | 'app';

function PatientInner() {
  const { account, clinic, clinicId, setClinicId } = usePatientAuth();
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
          Loading...
        </div>
      </div>
    );
  }

  // If user is a clinic admin or doctor, redirect to clinic dashboard
  if (user && user.role !== 'patient') {
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

  // Mandatory Profile Completion on First-Time Login
  const isProfileComplete = Boolean(
    account?.profile_completed ||
    (account?.dob &&
     account?.gender &&
     account?.blood_group &&
     account?.address &&
     account?.emergency_contact_name &&
     account?.emergency_contact_phone)
  );

  // If patient has not completed their mandatory profile, require completion before accessing dashboard
  if (!guestMode && account && !isProfileComplete) {
    return (
      <PatientOnboardingProfile
        onComplete={() => {
          navigate('/patient/dashboard', { replace: true });
        }}
      />
    );
  }

  return (
    <div className="relative">
      <Routes>
        <Route path="dashboard" element={<PatientHome onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} clinicId={clinicId} />} />
        <Route path="ai" element={<PatientAINavigator onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} clinicId={clinicId} patientId={patientId} onBookWithSummary={handleBookWithSummary} />} />
        <Route path="book" element={<PatientBooking onTab={(t) => { navigate(`/patient/${t === 'home' ? 'dashboard' : t}`); if (t === 'home') setPendingAISummary(null); }} clinic={clinic} patientId={patientId} aiSummary={pendingAISummary} />} />
        <Route path="records" element={<PatientRecords patientId={patientId} onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} />} />
        <Route path="payments" element={<PatientPayments patientId={patientId} onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} />} />
        <Route path="profile" element={<PatientProfile onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} />} />
        <Route path="family" element={<FamilyVault onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} />} />
        <Route path="timeline" element={<HealthTimeline onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} patientId={patientId} clinicId={clinicId} />} />
        <Route path="doctors" element={<PatientDoctorSearch onTab={(t) => navigate(`/patient/${t === 'home' ? 'dashboard' : t}`)} onSelectDoctor={(clinicObj, doctor) => navigate('/patient/book')} />} />
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
