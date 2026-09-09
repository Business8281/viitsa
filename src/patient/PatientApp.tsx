import { useEffect, useState } from 'react';
import { PatientAuthProvider, usePatientAuth } from '../lib/patientAuth';
import { ToastProvider } from '../lib/toast';
import { PatientAuthFlow } from './PatientAuthFlow';
import { PatientLanding } from './PatientLanding';
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
import { supabase } from '../lib/supabase';
import type { TriageSummary } from '../lib/aiService';

type PatientScreen = 'landing' | 'auth' | 'app';

function PatientInner() {
  const { account, clinic, clinicId, setClinicId } = usePatientAuth();
  const [screen, setScreen] = useState<PatientScreen>('landing');
  const [tab, setTab] = useState<PatientTab>('home');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [pendingInvoiceCount, setPendingInvoiceCount] = useState(0);
  const [guestMode, setGuestMode] = useState(false);
  const [pendingAISummary, setPendingAISummary] = useState<TriageSummary | null>(null);

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

  useEffect(() => {
    if (!account || !clinicId) return;
    supabase
      .from('patient_clinic_links')
      .select('patient_id')
      .eq('account_id', account.account_id)
      .eq('clinic_id', clinicId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPatientId((data as { patient_id: string }).patient_id);
      });
  }, [account, clinicId]);

  useEffect(() => {
    if (!patientId) return;
    supabase.from('invoices').select('invoice_id', { count: 'exact' })
      .eq('patient_id', patientId).eq('payment_status', 'pending')
      .then(({ count }) => setPendingInvoiceCount(count ?? 0));
  }, [patientId]);

  useEffect(() => {
    if (account?.otp_verified && account.name !== 'New Patient' && screen === 'auth') {
      setScreen('app');
    }
  }, [account, screen]);

  const handleBookWithSummary = (summary: TriageSummary) => {
    setPendingAISummary(summary);
    setTab('book');
  };

  if (screen === 'landing') {
    return (
      <PatientLanding
        clinic={clinic}
        onBook={() => setScreen(account?.otp_verified ? 'app' : 'auth')}
        onAI={() => setScreen(account?.otp_verified ? 'app' : 'auth')}
        onLogin={() => setScreen('auth')}
        onGuest={() => { setGuestMode(true); setScreen('app'); setTab('ai'); }}
      />
    );
  }

  if (!guestMode && (screen === 'auth' || !account || !account.otp_verified || account.name === 'New Patient')) {
    return <PatientAuthFlow clinic={clinic} onDone={() => { setGuestMode(false); setScreen('app'); }} />;
  }

  const renderTab = () => {
    switch (tab) {
      case 'home':
        return <PatientHome onTab={setTab} clinicId={clinicId} />;
      case 'ai':
        return (
          <PatientAINavigator
            onTab={setTab}
            clinicId={clinicId}
            patientId={patientId}
            onBookWithSummary={handleBookWithSummary}
          />
        );
      case 'book':
        return (
          <PatientBooking
            onTab={(t) => { setTab(t); if (t === 'home') setPendingAISummary(null); }}
            clinic={clinic}
            patientId={patientId}
            aiSummary={pendingAISummary}
          />
        );
      case 'records':
        return <PatientRecords patientId={patientId} onTab={setTab} />;
      case 'payments':
        return <PatientPayments patientId={patientId} onTab={setTab} />;
      case 'profile':
        return <PatientProfile onTab={setTab} />;
      case 'family':
        return <FamilyVault onTab={setTab} />;
      case 'timeline':
        return <HealthTimeline onTab={setTab} patientId={patientId} clinicId={clinicId} />;
      case 'doctors':
        return (
          <PatientDoctorSearch
            onTab={setTab}
            onSelectDoctor={(clinicObj, doctor) => {
              setTab('book');
            }}
          />
        );
      default:
        return <PatientHome onTab={setTab} clinicId={clinicId} />;
    }
  };

  return (
    <div className="relative">
      {renderTab()}
      <PatientBottomNav active={tab} onTab={setTab} paymentBadge={pendingInvoiceCount} />
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
