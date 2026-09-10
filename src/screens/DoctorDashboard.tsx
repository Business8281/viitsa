import { useEffect, useMemo, useState } from 'react';
import { Stethoscope, Siren, Clock, User, ArrowRight, FileText, Printer, Save, Sparkles, AlertTriangle, Activity } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { useClinicData } from '../lib/useClinicData';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import { AISummaryPanel } from '../components/AISummaryPanel';
import { EmptyState, Loading, SectionHeader, Avatar } from '../components/ui';
import { formatTime, formatDate, statusBadgeClass, todayISO } from '../lib/format';
import type { Appointment, Consultation, Patient, AISession, Vital } from '../lib/types';
import type { TriageSummary } from '../lib/aiService';

export function DoctorDashboard() {
  const { user } = useAuth();
  const { appointments, loading, refresh } = useClinicData();
  const [openAppt, setOpenAppt] = useState<Appointment | null>(null);

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

  const nextPatient = myQueue.find((a) => a.status === 'waiting') ?? null;

  if (loading) return <Loading label="Loading your queue…" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink">Welcome, {user?.name}</h1>
        <p className="text-sm text-ink-muted">Your patient queue for today · {myQueue.length} patient{myQueue.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card">
          <SectionHeader title="Today's patient queue" subtitle="Sorted by urgency, then token" />
          {myQueue.length === 0 ? (
            <EmptyState icon={<User size={18} />} title="No patients assigned" description="Your queue will appear here as appointments are booked." />
          ) : (
            <div className="space-y-2">
              {myQueue.map((a) => (
                <DoctorQueueRow key={a.appointment_id} appt={a} patient={a.patient} onOpen={() => setOpenAppt(a)} />
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <SectionHeader title="AI pre-consultation" subtitle="Insights for next patient" />
          {nextPatient ? (
            <NextPatientPanel appt={nextPatient} patient={nextPatient.patient} />
          ) : (
            <EmptyState icon={<Sparkles size={18} />} title="No next patient" description="All caught up — patients will appear here." />
          )}
        </div>
      </div>

      {openAppt && (
        <ConsultationModal
          appt={openAppt}
          onClose={() => setOpenAppt(null)}
          onSaved={() => {
            void refresh();
            setOpenAppt(null);
          }}
        />
      )}
    </div>
  );
}

function DoctorQueueRow({
  appt,
  patient,
  onOpen,
}: {
  appt: Appointment;
  patient?: Patient;
  onOpen: () => void;
}) {
  const tone =
    appt.triage_level === 'urgent'
      ? 'border-danger/20 bg-danger-bg/30'
      : appt.status === 'in-progress'
        ? 'border-primary/30 bg-primary-50/40'
        : appt.status === 'done'
          ? 'border-black/5 opacity-70'
          : 'border-black/5';
  return (
    <button onClick={onOpen} disabled={appt.status === 'done'} className={`w-full text-left flex items-center gap-3 rounded-lg border px-3 py-3 transition hover:shadow-card ${tone} ${appt.status === 'done' ? 'cursor-default' : 'hover:border-primary/40'}`}>
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ink/5 text-ink font-bold text-xs">
        #{appt.token_number ?? '—'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink truncate">{patient?.name ?? 'Unknown'}</p>
          {appt.triage_level === 'urgent' && <span className="badge badge-urgent text-[10px]"><Siren size={10} /> Urgent</span>}
          {appt.triage_level === 'moderate' && <span className="badge badge-waiting text-[10px]">Moderate</span>}
        </div>
        <p className="text-xs text-ink-muted truncate">
          {patient?.age ?? '—'} yrs · {patient?.gender ?? '—'} · {appt.reason ?? 'Consultation'}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-medium text-ink">{formatTime(appt.time_slot)}</p>
        <span className={`badge ${statusBadgeClass(appt.status)} text-[10px] capitalize`}>{appt.status}</span>
      </div>
      {appt.status !== 'done' && <ArrowRight size={16} className="text-ink-subtle" />}
    </button>
  );
}

function NextPatientPanel({ appt, patient }: { appt: Appointment; patient?: Patient }) {
  const [aiSession, setAiSession] = useState<AISession | null>(null);
  const [vitals, setVitals] = useState<Vital | null>(null);

  useEffect(() => {
    if (!patient) return;
    const fetchAiSession = async () => {
      const q = query(collection(db, 'ai_sessions'), where('patient_id', '==', patient.patient_id), orderBy('created_at', 'desc'), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) setAiSession(snap.docs[0].data() as AISession);
    };
    const fetchVitals = async () => {
      const q = query(collection(db, 'vitals'), where('patient_id', '==', patient.patient_id), orderBy('recorded_at', 'desc'), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) setVitals(snap.docs[0].data() as Vital);
    };
    fetchAiSession();
    fetchVitals();
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

function ConsultationModal({ appt, onClose, onSaved }: { appt: Appointment; onClose: () => void; onSaved: () => void }) {
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

  const patient = patients.find((p) => p.patient_id === appt.patient_id) ?? appt.patient;

  useEffect(() => {
    if (!patient) return;
    const fetchAll = async () => {
      const q1 = query(collection(db, 'ai_sessions'), where('patient_id', '==', patient.patient_id), orderBy('created_at', 'desc'), limit(1));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        const s = snap1.docs[0].data() as AISession;
        setAiSession(s);
        if (s.symptoms_entered) setSymptoms(s.symptoms_entered);
      }

      const q2 = query(collection(db, 'consultations'), where('patient_id', '==', patient.patient_id), orderBy('created_at', 'desc'), limit(3));
      const snap2 = await getDocs(q2);
      setPrevConsults(snap2.docs.map(d => d.data() as Consultation));

      const q3 = query(collection(db, 'vitals'), where('patient_id', '==', patient.patient_id), orderBy('recorded_at', 'desc'), limit(1));
      const snap3 = await getDocs(q3);
      if (!snap3.empty) setVitals(snap3.docs[0].data() as Vital);
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
    const payload = {
      appointment_id: appt.appointment_id,
      patient_id: patient.patient_id,
      doctor_id: user!.user_id,
      symptoms: symptoms.trim(),
      diagnosis: diagnosis.trim(),
      prescription: prescription.trim(),
      follow_up_date: followUp || null,
      notes: notes.trim(),
      created_at: new Date().toISOString()
    };
    try {
      await addDoc(collection(db, 'consultations'), payload);
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
    const win = window.open('', '_blank', 'width=600,height=800');
    if (!win) return toast('Allow pop-ups to print.', 'warning');
    const html = `<!doctype html><html><head><title>Prescription — ${patient.name}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; color: #0F1B2C; }
      .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0F6E56; padding-bottom: 12px; margin-bottom: 20px; }
      .clinic { font-size: 20px; font-weight: 700; color: #0F6E56; }
      .meta { font-size: 12px; color: #5A6B7B; }
      .row { margin: 10px 0; font-size: 14px; }
      .label { font-weight: 600; color: #0F6E56; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; margin-bottom: 4px; }
      .rx { font-family: 'Courier New', monospace; padding: 12px; background: #F5FAFA; border-left: 3px solid #05C994; white-space: pre-wrap; min-height: 60px; }
      .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 11px; color: #8A99A8; }
      .sign { margin-top: 30px; text-align: right; }
      .sign .line { display: inline-block; border-top: 1px solid #000; padding-top: 4px; width: 200px; font-size: 12px; }
    </style></head><body>
      <div class="header">
        <div>
          <div class="clinic">${clinic?.name ?? 'VIITSA Clinic'}</div>
          <div class="meta">${clinic?.address ?? ''}${clinic?.city ? ', ' + clinic.city : ''}</div>
          <div class="meta">Phone: ${clinic?.phone ?? ''}</div>
        </div>
        <div class="meta">Rx · ${formatDate(new Date())}</div>
      </div>
      <div class="row"><strong>Patient:</strong> ${patient.name} · ${patient.age ?? '—'} yrs · ${patient.gender ?? '—'}</div>
      <div class="row"><strong>Blood group:</strong> ${patient.blood_group ?? '—'} · <strong>Allergies:</strong> ${patient.allergies || 'None'}</div>
      <div class="label">Diagnosis</div>
      <div class="row">${diagnosis.replace(/</g, '&lt;') || '—'}</div>
      <div class="label">Prescription (Rx)</div>
      <div class="rx">${(prescription || '—').replace(/</g, '&lt;')}</div>
      ${followUp ? `<div class="row"><strong>Follow-up:</strong> ${formatDate(followUp)}</div>` : ''}
      <div class="sign"><div class="line">Dr. ${user?.name ?? ''}</div></div>
      <div class="footer">
        This prescription is system-generated by VIITSA at ${clinic?.name ?? 'VIITSA Clinic'}.<br>
        For queries call ${clinic?.phone ?? ''}.
      </div>
      </body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Consultation — ${patient.name}`}
      subtitle={`${patient.age ?? '—'} yrs · ${patient.gender ?? '—'} · Token #${appt.token_number ?? '—'} · ${formatTime(appt.time_slot)}`}
      size="xl"
      footer={
        <>
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
              <label className="label">Prescription</label>
              <textarea className="input min-h-[90px]" rows={4} value={prescription} onChange={(e) => setPrescription(e.target.value)} placeholder="Medication, dosage, frequency, duration" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Follow-up date</label>
                <input type="date" min={todayISO()} className="input" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
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
          <div className="rounded-lg bg-primary-50/40 p-3">
            <SectionHeader title="Patient summary" />
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={patient.name} size={44} />
              <div>
                <p className="text-sm font-semibold text-ink">{patient.name}</p>
                <p className="text-xs text-ink-muted">{patient.age} yrs · {patient.gender} · {patient.blood_group ?? 'Unknown'}</p>
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
  );
}
