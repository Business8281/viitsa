import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, Siren, Clock, User, ArrowRight, FileText, Printer, Save, Sparkles, AlertTriangle, Activity, Receipt, CheckCircle, Search, History, FolderHeart, Pill, Eye } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { useClinicData } from '../lib/useClinicData';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import { AISummaryPanel } from '../components/AISummaryPanel';
import { EmptyState, Loading, SectionHeader, Avatar } from '../components/ui';
import { formatTime, formatDate, formatRs, isSameDay, statusBadgeClass, todayISO, matchesDateRange, type DateRangePreset, calculateAge, formatDobForInput } from '../lib/format';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { PatientDetailModal } from '../components/PatientDetailModal';
import type { Appointment, Consultation, Patient, AISession, Vital } from '../lib/types';
import type { TriageSummary } from '../lib/aiService';
import { PrescriptionView } from '../components/PrescriptionView';
import { WritePrescriptionModal } from '../components/WritePrescriptionModal';
import { logClinicalRecordCreated } from '../lib/auditLogger';

export function DoctorDashboard() {
  const { user } = useAuth();
  const { appointments, bills, loading, refresh } = useClinicData();
  const { toast } = useToast();
  const [openAppt, setOpenAppt] = useState<Appointment | null>(null);
  const [viewingPatientRecords, setViewingPatientRecords] = useState<Patient | any | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [writingPrescriptionAppt, setWritingPrescriptionAppt] = useState<Appointment | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'done' | 'waiting' | 'cancelled'>('all');

  // Live Calendar Filters
  const [billingDatePreset, setBillingDatePreset] = useState<DateRangePreset>('all');
  const [billingStart, setBillingStart] = useState('');
  const [billingEnd, setBillingEnd] = useState('');

  const [apptDatePreset, setApptDatePreset] = useState<DateRangePreset>('all');
  const [apptStart, setApptStart] = useState('');
  const [apptEnd, setApptEnd] = useState('');

  const getBillAmount = (b: any): number => {
    const raw = b.amount !== undefined && b.amount !== null && b.amount !== '' ? b.amount : (b.total !== undefined && b.total !== null && b.total !== '' ? b.total : (b.subtotal ?? 0));
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw || 0).replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const getBillDate = (b: any) => {
    return b.created_at || (b as any).createdAt || (b as any).date || (b as any).payment_date || (b as any).timestamp || (b as any).visit_date;
  };

  const isBillPaid = (b: any): boolean => {
    const st = String(b.payment_status || b.status || '').toLowerCase().trim();
    return st === 'paid' || st === 'completed' || st === 'success' || st === 'cleared';
  };

  const isBillCancelled = (b: any): boolean => {
    const st = String(b.payment_status || b.status || '').toLowerCase().trim();
    return st === 'cancelled' || st === 'void';
  };

  const billingStats = useMemo(() => {
    let allTimeCollections = 0;
    let allTimePaidTransactions = 0;
    let periodCollections = 0;
    let periodPaidTransactions = 0;
    let periodPending = 0;
    let periodPendingCount = 0;
    let totalPendingAllTime = 0;
    let totalPendingCount = 0;

    const relevantBills = bills.filter(b => {
      if (!user) return true;
      if (user.role === 'clinic_doctor') {
        return !b.doctor_id || b.doctor_id === user.user_id || b.doctor_id === user.id;
      }
      return true;
    });

    relevantBills.forEach((b) => {
      const amt = getBillAmount(b);
      const isPaid = isBillPaid(b);
      const isCancelled = isBillCancelled(b);
      const inRange = matchesDateRange(getBillDate(b), billingDatePreset, billingStart, billingEnd);

      if (isPaid) {
        allTimeCollections += amt;
        allTimePaidTransactions += 1;
        if (inRange) {
          periodCollections += amt;
          periodPaidTransactions += 1;
        }
      } else if (!isCancelled) {
        totalPendingAllTime += amt;
        totalPendingCount += 1;
        if (inRange) {
          periodPending += amt;
          periodPendingCount += 1;
        }
      }
    });

    return {
      allTimeCollections,
      allTimePaidTransactions,
      periodCollections,
      periodPaidTransactions,
      periodPending,
      periodPendingCount,
      totalPendingAllTime,
      totalPendingCount,
    };
  }, [bills, user, billingDatePreset, billingStart, billingEnd]);

  const billingPresetLabel = useMemo(() => {
    return {
      all: 'All-Time',
      today: "Today's",
      week: 'This Week',
      month: 'This Month',
      '3months': '3 Months',
      custom: 'Custom Range',
    }[billingDatePreset];
  }, [billingDatePreset]);

  const completeAppointment = async (appt: Appointment) => {
    const id = appt.appointment_id || appt.appt_id;
    if (!id) return;
    setCompletingId(id);
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status: 'done',
        completed_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      toast('Appointment marked as complete.', 'success');
      void refresh();
    } catch (e) {
      console.error('Error completing appointment:', e);
      toast('Failed to mark appointment as complete.', 'error');
    } finally {
      setCompletingId(null);
    }
  };

  const myQueue = useMemo(() => {
    if (!user) return [];
    const today = todayISO();
    return appointments
      .filter((a) => a.doctor_id === user.user_id && a.date === today && a.status !== 'cancelled')
      .sort((a, b) => {
        const au = a.triage_level === 'urgent' ? 0 : 1;
        const bu = b.triage_level === 'urgent' ? 0 : 1;
        if (au !== bu) return au - bu;
        return (a.token_number ?? 0) - (b.token_number ?? 0);
      });
  }, [appointments, user]);

  const myAppointments = useMemo(() => {
    if (!user) return [];
    return appointments
      .filter((a) => a.doctor_id === user.user_id)
      .sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        if (da !== db) return db.localeCompare(da);
        return (b.time_slot || '').localeCompare(a.time_slot || '');
      });
  }, [appointments, user]);

  const filteredAppointments = useMemo(() => {
    let list = myAppointments.filter((a) =>
      matchesDateRange(a.date || a.created_at, apptDatePreset, apptStart, apptEnd)
    );

    if (historyFilter === 'done') list = list.filter((a) => a.status === 'done');
    else if (historyFilter === 'waiting') list = list.filter((a) => a.status === 'waiting' || a.status === 'in-progress');
    else if (historyFilter === 'cancelled') list = list.filter((a) => a.status === 'cancelled');

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter((a) => {
        const p = a.patient;
        const name = (p?.name || (a as any).patient_name || '').toLowerCase();
        const reason = (a.reason || '').toLowerCase();
        const date = (a.date || '').toLowerCase();
        const token = (a.display_token || '').toLowerCase();
        return name.includes(q) || reason.includes(q) || date.includes(q) || token.includes(q);
      });
    }
    return list;
  }, [myAppointments, apptDatePreset, apptStart, apptEnd, historyFilter, historySearch]);

  const nextPatient = myQueue.find((a) => a.status === 'waiting') ?? null;



  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Welcome, {user?.name}</h1>
          <p className="text-sm text-ink-muted">Your patient queue for today · {myQueue.length} patient{myQueue.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/clinic/billing" className="btn-outline text-xs self-start sm:self-auto flex items-center gap-1.5">
          <Receipt size={14} /> View All Billing
        </Link>
      </div>

      {/* Live Billing Overview */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <SectionHeader title="Billing & Collections Overview" subtitle={`Live financials · Period: ${billingPresetLabel}`} />
          <DateRangeFilter
            preset={billingDatePreset}
            onPresetChange={setBillingDatePreset}
            customStart={billingStart}
            onCustomStartChange={setBillingStart}
            customEnd={billingEnd}
            onCustomEndChange={setBillingEnd}
            label="Live Billing Range"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link to="/clinic/billing" className="card bg-primary text-white border-none hover:opacity-95 transition-opacity">
            <div className="flex items-center justify-between">
              <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">Total Collections (All Time)</p>
              <Receipt size={16} className="text-white/70" />
            </div>
            <p className="text-2xl font-bold mt-1">{formatRs(billingStats.allTimeCollections)}</p>
            <p className="text-xs text-white/70 mt-2">{billingStats.allTimePaidTransactions} paid transactions all-time</p>
          </Link>
          <Link to="/clinic/billing" className="card hover:shadow-card-hover transition-shadow border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <p className="text-primary text-xs font-semibold uppercase tracking-wider">{billingPresetLabel} Collections</p>
              <Receipt size={16} className="text-primary" />
            </div>
            <p className="text-2xl font-bold text-ink mt-1">{formatRs(billingStats.periodCollections)}</p>
            <p className="text-xs text-ink-subtle mt-2">{billingStats.periodPaidTransactions} paid transaction{billingStats.periodPaidTransactions !== 1 ? 's' : ''}</p>
          </Link>
          <Link to="/clinic/billing" className="card bg-accent text-white border-none hover:opacity-95 transition-opacity">
            <div className="flex items-center justify-between">
              <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">Total Pending (All Time)</p>
              <Clock size={16} className="text-white/70" />
            </div>
            <p className="text-2xl font-bold mt-1">{formatRs(billingStats.totalPendingAllTime)}</p>
            <p className="text-xs text-white/70 mt-2">{billingStats.totalPendingCount > 0 ? `${billingStats.totalPendingCount} pending bills` : 'No pending dues'}</p>
          </Link>
          <Link to="/clinic/billing" className="card hover:shadow-card-hover transition-shadow border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center justify-between">
              <p className="text-amber-800 text-xs font-semibold uppercase tracking-wider">{billingPresetLabel} Pending</p>
              <Clock size={16} className="text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-ink mt-1">{formatRs(billingStats.periodPending)}</p>
            <p className="text-xs text-ink-subtle mt-2">{billingStats.periodPendingCount > 0 ? `${billingStats.periodPendingCount} pending in period` : 'Cleared in this period'}</p>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card">
          <SectionHeader title="Today's patient queue" subtitle="Sorted by urgency, then token" />
          {myQueue.length === 0 ? (
            <EmptyState icon={<User size={18} />} title="No patients assigned" description="Your queue will appear here as appointments are booked." />
          ) : (
            <div className="space-y-2">
              {myQueue.map((a) => (
                <DoctorQueueRow
                  key={a.appointment_id || a.appt_id}
                  appt={a}
                  patient={a.patient}
                  onOpen={() => setOpenAppt(a)}
                  onViewDossier={() => setViewingPatientRecords(a.patient || { patient_id: a.patient_id, name: (a as any).patient_name, phone: (a as any).patient_phone })}
                  onWritePrescription={() => setWritingPrescriptionAppt(a)}
                  onComplete={() => completeAppointment(a)}
                  completing={completingId === (a.appointment_id || a.appt_id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <SectionHeader title="AI pre-consultation" subtitle="Insights for next patient" />
          {nextPatient ? (
            <NextPatientPanel 
              appt={nextPatient} 
              patient={nextPatient.patient} 
              onViewDossier={(p) => setViewingPatientRecords(p || nextPatient.patient || { patient_id: nextPatient.patient_id, name: (nextPatient as any).patient_name, phone: (nextPatient as any).patient_phone })} 
            />
          ) : (
            <EmptyState icon={<Sparkles size={18} />} title="No next patient" description="All caught up — patients will appear here." />
          )}
        </div>
      </div>

      {/* Complete Appointments & History Section with Live Calendar Filter */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <SectionHeader
              title="All Appointments & History"
              subtitle={`Showing ${filteredAppointments.length} of ${myAppointments.length} total doctor appointments · Live across past, present & future`}
            />
          </div>
          <span className="text-xs font-medium text-ink-muted">
            Filtered: <span className="font-bold text-ink capitalize">{apptDatePreset}</span>
          </span>
        </div>

        {/* Date Filter & Search toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-divider/60">
          <DateRangeFilter
            preset={apptDatePreset}
            onPresetChange={setApptDatePreset}
            customStart={apptStart}
            onCustomStartChange={setApptStart}
            customEnd={apptEnd}
            onCustomEndChange={setApptEnd}
            label="Calendar Filter"
          />

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-black/5 p-1 rounded-lg text-xs">
              {(['all', 'done', 'waiting', 'cancelled'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setHistoryFilter(st)}
                  className={`px-2.5 py-1 rounded capitalize font-medium transition ${historyFilter === st ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
                >
                  {st === 'done' ? 'Completed' : st === 'waiting' ? 'In-Queue' : st}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search patient, token, date…"
                className="input pl-8 text-xs py-1.5 w-full"
              />
            </div>
          </div>
        </div>

        {filteredAppointments.length === 0 ? (
          <EmptyState
            icon={<History size={18} />}
            title="No appointments found"
            description="No appointments found for the selected calendar range and status."
          />
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filteredAppointments.map((a) => (
              <DoctorQueueRow
                key={a.appointment_id || a.appt_id}
                appt={a}
                patient={a.patient}
                onOpen={() => setOpenAppt(a)}
                onViewDossier={() => setViewingPatientRecords(a.patient || { patient_id: a.patient_id, name: (a as any).patient_name, phone: (a as any).patient_phone })}
                onWritePrescription={() => setWritingPrescriptionAppt(a)}
                onComplete={() => completeAppointment(a)}
                completing={completingId === (a.appointment_id || a.appt_id)}
              />
            ))}
          </div>
        )}
      </div>

      {openAppt && (
        <ConsultationModal
          appt={openAppt}
          onClose={() => setOpenAppt(null)}
          onViewDossier={(p) => setViewingPatientRecords(p)}
          onSaved={() => {
            void refresh();
            setOpenAppt(null);
          }}
        />
      )}

      {/* Write & Fill Doctor Prescription Modal */}
      {writingPrescriptionAppt && (
        <WritePrescriptionModal
          open={Boolean(writingPrescriptionAppt)}
          appointment={writingPrescriptionAppt}
          patient={writingPrescriptionAppt.patient || { patient_id: writingPrescriptionAppt.patient_id, name: (writingPrescriptionAppt as any).patient_name, phone: (writingPrescriptionAppt as any).patient_phone }}
          onClose={() => setWritingPrescriptionAppt(null)}
          onSaved={() => {
            void refresh();
          }}
        />
      )}

      <PatientDetailModal
        patient={viewingPatientRecords}
        onClose={() => setViewingPatientRecords(null)}
      />
    </div>
  );
}

function DoctorQueueRow({
  appt,
  patient,
  onOpen,
  onViewDossier,
  onWritePrescription,
  onComplete,
  completing,
}: {
  appt: Appointment;
  patient?: Patient;
  onOpen: () => void;
  onViewDossier?: () => void;
  onWritePrescription?: () => void;
  onComplete?: () => void;
  completing?: boolean;
}) {
  const isDone = appt.status === 'done';
  const tone =
    appt.triage_level === 'urgent'
      ? 'border-danger/20 bg-danger-bg/30'
      : appt.status === 'in-progress'
        ? 'border-primary/30 bg-primary-50/40'
        : isDone
          ? 'border-black/5 bg-black/[0.01]'
          : 'border-black/5';

  return (
    <div
      onClick={onOpen}
      className={`w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border px-3 py-3 transition hover:shadow-card cursor-pointer ${tone} hover:border-primary/40`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ink/5 text-ink font-bold text-xs shrink-0">
          {appt.display_token || (appt.token_number ? `#${appt.token_number}` : '—')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-ink truncate">{patient?.name ?? (appt as any).patient_name ?? 'Unknown'}</p>
            {appt.triage_level === 'urgent' && <span className="badge badge-urgent text-[10px]"><Siren size={10} /> Urgent</span>}
            {appt.triage_level === 'moderate' && <span className="badge badge-waiting text-[10px]">Moderate</span>}
            <span className={`badge ${statusBadgeClass(appt.status)} text-[10px] capitalize`}>{appt.status}</span>
          </div>
          <p className="text-xs text-ink-muted truncate mt-0.5">
            {patient?.age ? `${patient.age} yrs · ` : ''}{patient?.gender ? `${patient.gender} · ` : ''}{formatDate(appt.date)} at {formatTime(appt.time_slot)} · {appt.reason ?? 'Consultation'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onWritePrescription?.();
          }}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold border-teal-300 text-[#0F6E56] hover:bg-teal-100 transition shadow-2xs"
          title="Write & Fill Official A4 Doctor Prescription"
        >
          <Pill size={13} className="text-[#0F6E56]" />
          Write Prescription
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewDossier?.();
          }}
          className="btn-outline text-xs py-1.5 px-2.5 flex items-center gap-1.5 text-slate-700 hover:text-primary hover:border-primary transition"
          title="View complete patient medical records, lab reports, and files"
        >
          <FolderHeart size={13} className="text-primary" />
          Records
        </button>

        {!isDone && appt.status !== 'cancelled' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onComplete?.();
            }}
            disabled={completing}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
            title="Mark this appointment as complete"
          >
            <CheckCircle size={13} />
            {completing ? 'Completing…' : 'Complete'}
          </button>
        ) : isDone ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
            <CheckCircle size={13} className="text-emerald-600" /> Done
          </span>
        ) : null}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="btn-ghost text-xs p-1.5 text-ink-muted hover:text-ink"
          title="Open consultation"
        >
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

function NextPatientPanel({ appt, patient, onViewDossier }: { appt: Appointment; patient?: Patient; onViewDossier?: (p: Patient) => void }) {
  const [aiSession, setAiSession] = useState<AISession | null>(null);
  const [vitals, setVitals] = useState<Vital | null>(null);

  useEffect(() => {
    if (!patient) {
      setAiSession(null);
      setVitals(null);
      return;
    }
    
    const qAi = query(collection(db, 'ai_sessions'), where('patient_id', '==', patient.patient_id));
    const unsubAi = onSnapshot(qAi, (snap) => {
      if (!snap.empty) {
        const sorted = snap.docs.map(d => d.data() as AISession);
        sorted.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setAiSession(sorted[0] || null);
      } else {
        setAiSession(null);
      }
    });

    const qVitals = query(collection(db, 'vitals'), where('patient_id', '==', patient.patient_id));
    const unsubVitals = onSnapshot(qVitals, (snap) => {
      if (!snap.empty) {
        const sorted = snap.docs.map(d => d.data() as Vital);
        sorted.sort((a, b) => new Date(b.recorded_at || (b as any).created_at || 0).getTime() - new Date(a.recorded_at || (a as any).created_at || 0).getTime());
        setVitals(sorted[0] || null);
      } else {
        setVitals(null);
      }
    });

    return () => {
      unsubAi();
      unsubVitals();
    };
  }, [patient]);

  if (!patient) {
    return <EmptyState icon={<User size={18} />} title="No patient data" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={patient.name} size={42} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{patient.name}</p>
          <p className="text-xs text-ink-muted">{patient.age} yrs · {patient.gender}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Info label="Blood" value={patient.blood_group ?? '—'} />
        <Info label="Token" value={`#${appt.token_number ?? '—'}`} />
        <Info label="Time" value={formatTime(appt.time_slot)} />
        <Info label="Triage" value={appt.triage_level.toUpperCase()} tone={appt.triage_level === 'urgent' ? 'danger' : appt.triage_level === 'moderate' ? 'warning' : 'normal'} />
      </div>

      <button
        type="button"
        onClick={() => onViewDossier?.(patient)}
        className="w-full btn-outline text-xs py-2 flex items-center justify-center gap-1.5 text-primary border-primary/30 hover:bg-primary-50 transition font-semibold"
      >
        <FolderHeart size={14} /> Full Patient Medical Records
      </button>

      {(patient.allergies || patient.chronic_conditions) && (
        <div className="space-y-2">
          {patient.allergies && patient.allergies !== 'None' && (
            <div className="flex items-start gap-2 rounded-lg bg-danger-bg/40 border border-danger/15 p-2.5">
              <AlertTriangle size={12} className="text-danger mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-danger uppercase">Allergies</p>
                <p className="text-xs text-ink">{patient.allergies}</p>
              </div>
            </div>
          )}
          {patient.chronic_conditions && patient.chronic_conditions !== 'None' && (
            <div className="flex items-start gap-2 rounded-lg bg-warning-bg/40 border border-warning/15 p-2.5">
              <Activity size={12} className="text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-warning uppercase">Chronic conditions</p>
                <p className="text-xs text-ink">{patient.chronic_conditions}</p>
              </div>
            </div>
          )}
        </div>
      )}
      {vitals && (
        <div>
          <p className="label">Last vitals</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Info label="BP" value={vitals.systolic_bp && vitals.diastolic_bp ? `${vitals.systolic_bp}/${vitals.diastolic_bp}` : '—'} />
            <Info label="Pulse" value={vitals.pulse ? `${vitals.pulse} bpm` : '—'} />
            <Info label="Temp" value={vitals.temperature ? `${vitals.temperature}°F` : '—'} />
            <Info label="SpO2" value={vitals.spo2 ? `${vitals.spo2}%` : '—'} />
          </div>
        </div>
      )}
      {appt.ai_summary ? (
        <AISummaryPanel summary={appt.ai_summary as TriageSummary | null} />
      ) : aiSession ? (
        <div className="rounded-lg bg-accent-50 border border-accent-600/20 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-accent-600" />
            <p className="text-[10px] font-semibold text-accent-600 uppercase">AI Navigator summary</p>
          </div>
          <p className="text-xs text-ink mb-2">
            <span className="font-medium">Symptoms:</span> {aiSession.symptoms_entered ?? '—'}
          </p>
          {aiSession.recommendations && aiSession.recommendations.length > 0 && (
            <ul className="space-y-1">
              {aiSession.recommendations.slice(0, 3).map((r, i) => (
                <li key={i} className="text-xs text-ink-muted flex items-start gap-1.5">
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${r.level === 'urgent' ? 'bg-danger' : r.level === 'caution' ? 'bg-warning' : 'bg-accent-600'}`} />
                  {r.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-ink-subtle">No AI Navigator session — direct intake by reception.</p>
      )}
    </div>
  );
}

function Info({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'danger' | 'warning' }) {
  const toneClass = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-ink';
  return (
    <div className="rounded-lg bg-primary-50/40 px-2.5 py-1.5">
      <p className="text-[10px] text-ink-subtle uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function ConsultationModal({ 
  appt, 
  onClose, 
  onSaved,
  onViewDossier,
}: { 
  appt: Appointment; 
  onClose: () => void; 
  onSaved: () => void;
  onViewDossier?: (p: Patient) => void;
}) {
  const { user, clinic } = useAuth();
  const { patients } = useClinicData();
  const { toast } = useToast();
  const [aiSession, setAiSession] = useState<AISession | null>(null);
  const [prevConsults, setPrevConsults] = useState<Consultation[]>([]);
  const [vitals, setVitals] = useState<Vital | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showA4Rx, setShowA4Rx] = useState(false);

  const patient = patients.find((p) => p.patient_id === appt.patient_id) ?? appt.patient;

  useEffect(() => {
    if (!patient) return;
    const fetchAll = async () => {
      try {
        const q1 = query(collection(db, 'ai_sessions'), where('patient_id', '==', patient.patient_id));
        const snap1 = await getDocs(q1);
        if (!snap1.empty) {
          const sList = snap1.docs.map(d => d.data() as AISession);
          sList.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
          const s = sList[0];
          setAiSession(s);
          if (s.symptoms_entered) setSymptoms(s.symptoms_entered);
        }

        const q2 = query(collection(db, 'consultations'), where('patient_id', '==', patient.patient_id));
        const snap2 = await getDocs(q2);
        let cList = snap2.docs.map(d => ({ ...d.data(), consult_id: d.id } as Consultation));
        cList.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        
        // Clinic data isolation: If viewing from a previous clinic, only view records from that clinic
        const doctorClinicId = clinic?.clinic_id || user?.clinic_id;
        const activeClinicId = (patient as any).current_clinic_id || patient.clinic_id;
        const isTreatingActiveClinic = !doctorClinicId || !activeClinicId || doctorClinicId === activeClinicId || (appt && appt.clinic_id === doctorClinicId);
        if (!isTreatingActiveClinic && doctorClinicId) {
          cList = cList.filter(c => c.clinic_id === doctorClinicId);
        }
        setPrevConsults(cList.slice(0, 3));

        const q3 = query(collection(db, 'vitals'), where('patient_id', '==', patient.patient_id));
        const snap3 = await getDocs(q3);
        if (!snap3.empty) {
          const vList = snap3.docs.map(d => d.data() as Vital);
          vList.sort((a, b) => new Date(b.recorded_at || (b as any).created_at || 0).getTime() - new Date(a.recorded_at || (a as any).created_at || 0).getTime());
          setVitals(vList[0] || null);
        }
      } catch (err) {
        console.warn('Consultation modal data lookup warning:', err);
      }
    };
    fetchAll();
  }, [patient]);

  if (!patient) {
    return (
      <Modal open onClose={onClose} title="Consultation" size="lg">
        <EmptyState title="Patient data not found" />
      </Modal>
    );
  }

  const save = async (markDone: boolean) => {
    if (!diagnosis.trim()) return toast('Diagnosis is required.', 'error');
    setSaving(true);
    const targetClinicId = clinic?.clinic_id || user?.clinic_id || 'cln_viitsa_main';
    const payload = {
      appointment_id: appt.appointment_id,
      patient_id: patient.patient_id,
      patient_name: patient.name,
      patient_age: patient.age ?? calculateAge(patient.dob) ?? null,
      patient_dob: patient.dob ?? null,
      patient_gender: patient.gender ?? null,
      patient_phone: patient.phone ?? null,
      doctor_id: user!.user_id,
      doctor_name: user!.name,
      clinic_id: targetClinicId,
      symptoms: symptoms.trim(),
      diagnosis: diagnosis.trim(),
      prescription: prescription.trim(),
      follow_up_date: followUp || null,
      notes: notes.trim(),
      created_at: new Date().toISOString()
    };
    try {
      const docRef = await addDoc(collection(db, 'consultations'), payload);
      logClinicalRecordCreated(
        user!.user_id,
        'clinic_doctor',
        targetClinicId,
        patient.patient_id,
        'consultation',
        docRef.id
      );
      if (markDone) {
        await updateDoc(doc(db, 'appointments', appt.appointment_id!), { status: 'done' });
      }
      toast(markDone ? 'Consultation saved & marked done.' : 'Consultation saved.', 'success');
      onSaved();
    } catch(error) {
      toast('Unable to save consultation. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const printPrescription = () => {
    setShowA4Rx(true);
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`Consultation — ${patient.name}`}
        subtitle={`${patient.age ?? '—'} yrs · ${patient.gender ?? '—'} · Token #${appt.token_number ?? '—'} · ${formatTime(appt.time_slot)}`}
        size="xl"
        footer={
          <>
            <button 
              type="button" 
              onClick={() => setShowA4Rx(true)} 
              className="btn-outline flex items-center gap-1.5 text-[#0F6E56] border-teal-300 hover:bg-teal-50"
              title="Preview production-ready A4 Doctor Prescription"
            >
              <FileText size={14} />
              Preview A4 Rx
            </button>
            <button onClick={printPrescription} className="btn-outline">
              <Printer size={14} />
              Print Rx
            </button>
            <button onClick={onClose} className="btn-ghost">Close</button>
            <button onClick={() => save(false)} disabled={saving} className="btn-secondary">
              <Save size={14} />
              Save draft
            </button>
            <button onClick={() => save(true)} disabled={saving} className="btn-primary">
              <Stethoscope size={14} />
              Save & mark done
            </button>
          </>
        }
      >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Previous visits */}
          <div className="rounded-lg border border-black/5 p-3">
            <SectionHeader title="Previous visits" subtitle="Last 3 consultations for this patient" />
            {prevConsults.length === 0 ? (
              <p className="text-xs text-ink-subtle">No previous consultations on record.</p>
            ) : (
              <div className="space-y-2">
                {prevConsults.map((c, i) => (
                  <div key={i} className="rounded-lg bg-primary-50/40 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-ink">{formatDate(c.created_at)}</p>
                      {c.follow_up_date && (
                        <span className="text-[10px] text-ink-muted flex items-center gap-1"><Clock size={10} /> Follow-up: {formatDate(c.follow_up_date)}</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted"><span className="font-medium">Dx:</span> {c.diagnosis || '—'}</p>
                    <p className="text-xs text-ink-muted"><span className="font-medium">Rx:</span> {c.prescription || '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consultation form */}
          <div className="rounded-lg border border-black/5 p-3 space-y-3">
            <SectionHeader title="Consultation notes" />
            <div>
              <label className="label">Symptoms</label>
              <textarea className="input min-h-[70px]" rows={3} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Patient-reported and observed symptoms" />
            </div>
            <div>
              <label className="label">Diagnosis *</label>
              <textarea className="input min-h-[70px]" rows={3} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Working diagnosis" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Prescription (Rx)</label>
                <button
                  type="button"
                  onClick={() => setShowA4Rx(true)}
                  className="text-xs font-bold text-[#0F6E56] hover:underline flex items-center gap-1"
                >
                  <Eye size={12} /> Preview A4 Layout
                </button>
              </div>
              <textarea 
                className="input min-h-[90px]" 
                rows={4} 
                value={prescription} 
                onChange={(e) => setPrescription(e.target.value)} 
                placeholder="Medication, dosage, frequency, duration (e.g. Paracetamol 500 mg | 1 Tab | 3 times/day | 3 Days | After Food)" 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Follow-up date</label>
                <input type="date" min={todayISO()} className="input" value={formatDobForInput(followUp)} onChange={(e) => setFollowUp(e.target.value)} />
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional clinical notes" />
              </div>
            </div>
          </div>
        </div>

        {/* RHS: patient summary + AI */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => onViewDossier?.(patient)}
            className="w-full px-3 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition"
          >
            <FolderHeart size={16} /> Open Complete Medical Records
          </button>

          <div className="rounded-lg bg-primary-50/40 p-3">
            <SectionHeader title="Patient summary" />
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={patient.name} size={44} />
              <div>
                <p className="text-sm font-semibold text-ink">{patient.name}</p>
                <p className="text-xs text-ink-muted">{patient.age ?? calculateAge(patient.dob) ?? '—'} yrs · {patient.gender} · {patient.blood_group ?? 'Unknown'}</p>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <p><span className="text-ink-muted">Allergies:</span> <span className="font-medium text-danger">{patient.allergies || 'None'}</span></p>
              <p><span className="text-ink-muted">Chronic:</span> <span className="font-medium text-warning">{patient.chronic_conditions || 'None'}</span></p>
              <p><span className="text-ink-muted">Emergency:</span> {patient.emergency_contact_name ?? '—'} · {patient.emergency_contact_phone ?? '—'}</p>
            </div>
            {vitals && (
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <Info label="BP" value={vitals.systolic_bp && vitals.diastolic_bp ? `${vitals.systolic_bp}/${vitals.diastolic_bp}` : '—'} />
                <Info label="Pulse" value={vitals.pulse ? `${vitals.pulse} bpm` : '—'} />
                <Info label="Temp" value={vitals.temperature ? `${vitals.temperature}°F` : '—'} />
                <Info label="SpO2" value={vitals.spo2 ? `${vitals.spo2}%` : '—'} />
              </div>
            )}
          </div>

          {appt.ai_summary ? (
            <AISummaryPanel summary={appt.ai_summary as TriageSummary | null} />
          ) : aiSession ? (
            <div className="rounded-lg bg-accent-50 border border-accent-600/20 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={12} className="text-accent-600" />
                <p className="text-[10px] font-semibold text-accent-600 uppercase">AI Navigator output</p>
              </div>
              <div className="space-y-2 text-xs">
                <p><span className="font-medium text-ink-muted">Patient symptoms:</span> {aiSession.symptoms_entered ?? '—'}</p>
                <p className="flex items-center gap-1.5">
                  <span className="font-medium text-ink-muted">Triage:</span>
                  <span className={`badge ${aiSession.triage_level === 'urgent' ? 'badge-urgent' : aiSession.triage_level === 'moderate' ? 'badge-waiting' : 'badge-done'} text-[10px] uppercase`}>{aiSession.triage_level}</span>
                </p>
                {aiSession.ai_response && (
                  <p className="rounded bg-white/60 p-2 text-ink-muted">{aiSession.ai_response}</p>
                )}
                {aiSession.recommendations && aiSession.recommendations.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {aiSession.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-ink-muted">
                        <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${r.level === 'urgent' ? 'bg-danger' : r.level === 'caution' ? 'bg-warning' : 'bg-accent-600'}`} />
                        {r.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          <p className="text-[11px] text-ink-subtle flex items-start gap-1.5">
            <FileText size={10} className="mt-0.5 shrink-0" />
            Consultation notes are stored within the clinic's VIITSA database only.
          </p>
        </div>
      </div>
    </Modal>

    {/* Production-Ready A4 Doctor Prescription Modal */}
    {showA4Rx && (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex justify-center p-2 sm:p-4 animate-fade-in">
        <div className="relative max-w-4xl w-full my-auto">
          <PrescriptionView
            consultation={{
              prescription,
              diagnosis,
              symptoms,
              patient_name: patient.name,
              patient_age: patient.age ?? calculateAge(patient.dob),
              patient_dob: patient.dob,
              patient_gender: patient.gender,
              patient_phone: patient.phone,
              doctor_name: user?.name,
              chief_complaint: appt.reason || symptoms || 'General Consultation',
              vitals: vitals ? {
                temperature: vitals.temperature ? `${vitals.temperature} °F` : undefined,
                bloodPressure: vitals.blood_pressure || (vitals.bp_sys ? `${vitals.bp_sys}/${vitals.bp_dia} mmHg` : undefined),
                pulse: vitals.pulse ? `${vitals.pulse}/min` : undefined,
                spo2: vitals.spo2 ? `${vitals.spo2}%` : undefined
              } : undefined,
              follow_up_date: followUp
            }}
            patient={patient}
            clinic={clinic}
            doctor={{
              name: user?.name,
              specialization: user?.specialisation || 'General Physician',
              registrationNumber: user?.registration_number || '123456 (TSMC)'
            }}
            onClose={() => setShowA4Rx(false)}
          />
        </div>
      </div>
    )}
    </>
  );
}
