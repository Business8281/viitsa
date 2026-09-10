import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Zap, MessageCircle, X, Clock, User as UserIcon, Stethoscope, Sparkles } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, addDoc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { useClinicData } from '../lib/useClinicData';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import { AISummaryPanel } from '../components/AISummaryPanel';
import { EmptyState, Loading, SectionHeader } from '../components/ui';
import { formatDate, formatTime, statusBadgeClass, whatsappReminderLink, todayISO, localDateISO } from '../lib/format';
import type { Appointment, Patient, User as U } from '../lib/types';
import type { TriageSummary } from '../lib/aiService';

function generateDates(days: number): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

function generateSlots(openTime: string, closeTime: string, durationMin: number): string[] {
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  const start = oh * 60 + om;
  const end = ch * 60 + cm;
  const slots: string[] = [];
  for (let t = start; t < end; t += durationMin) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
}

const SLOT_CACHE: Record<string, string[]> = {};

async function fetchClinicHours(clinicId: string): Promise<{ open: string; close: string; slot: number }> {
  try {
    const docSnap = await getDoc(doc(db, 'clinic_settings', clinicId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      const slot = data.slot_duration_minutes ?? 20;
      return { open: '09:00', close: '19:00', slot };
    }
  } catch (e) {}
  return { open: '09:00', close: '19:00', slot: 20 };
}

export function AppointmentsScreen() {
  const { clinic, user } = useAuth();
  const { appointments, patients, loading, refresh, urgentQueue } = useClinicData();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [shift] = useState(0); // start from today, expand forward
  const [hours, setHours] = useState<{ open: string; close: string; slot: number }>({ open: '09:00', close: '19:00', slot: 20 });
  const [bookOpen, setBookOpen] = useState(false);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [doctors, setDoctors] = useState<U[]>([]);
  const [summaryAppt, setSummaryAppt] = useState<Appointment | null>(null);

  useEffect(() => {
    if (!clinic) return;
    fetchClinicHours(clinic.clinic_id).then(setHours);
    const q = query(collection(db, 'users'), where('clinic_id', '==', clinic.clinic_id), where('role', '==', 'doctor'), where('active', '==', true));
    getDocs(q).then((snap) => {
      setDoctors(snap.docs.map(d => ({ ...d.data(), id: d.id } as U)));
    }).catch(console.error);
  }, [clinic]);

  const dates = useMemo(() => generateDates(8), [shift]);
  const slotKey = `${hours.open}-${hours.close}-${hours.slot}`;
  if (!SLOT_CACHE[slotKey]) SLOT_CACHE[slotKey] = generateSlots(hours.open, hours.close, hours.slot);
  const slots = SLOT_CACHE[slotKey];

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of appointments) {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    return map;
  }, [appointments]);

  const selectedISO = localDateISO(selectedDate);
  const selectedAppts = appointmentsByDate[selectedISO] ?? [];

  const onRemind = (appt: Appointment, patient?: Patient) => {
    if (!clinic) return;
    if (!patient || !patient.phone) {
      toast('No phone number on file for this patient.', 'warning');
      return;
    }
    const link = whatsappReminderLink(patient.phone, patient.name, formatDate(appt.date), formatTime(appt.time_slot), clinic.name, clinic.phone);
    window.open(link, '_blank', 'noopener');
  };

  if (loading) return <Loading label="Loading appointments…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Appointments</h1>
          <p className="text-sm text-ink-muted">Today and the next 7 days · {formatDate(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWalkinOpen(true)} className="btn-outline">
            <Zap size={16} />
            Walk-in
          </button>
          <button onClick={() => setBookOpen(true)} className="btn-primary">
            <Plus size={16} />
            Book appointment
          </button>
        </div>
      </div>

      {urgentQueue.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-danger-bg border border-danger/20 px-3 py-2 text-sm text-danger font-semibold">
          <Zap size={14} /> {urgentQueue.length} urgent walk-in patient{urgentQueue.length > 1 ? 's' : ''} today.
        </div>
      )}

      {/* Calendar strip */}
      <div className="card">
        <SectionHeader title="Select day" subtitle="Tap a date to view its appointments" />
        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {dates.map((d) => {
            const iso = localDateISO(d);
            const appts = appointmentsByDate[iso] ?? [];
            const active = d.toDateString() === selectedDate.toDateString();
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(d)}
                className={`flex flex-col items-center justify-center min-w-[68px] py-3 px-2 rounded-lg border transition ${
                  active ? 'bg-primary border-primary text-white' : 'border-black/5 text-ink hover:border-primary/30'
                }`}
              >
                <span className={`text-[10px] uppercase tracking-wide ${active ? 'text-white/80' : 'text-ink-subtle'}`}>
                  {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                </span>
                <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
                <span className={`text-[10px] ${active ? 'text-white/80' : 'text-ink-subtle'}`}>
                  {isToday ? 'Today' : d.toLocaleDateString('en-IN', { month: 'short' })}
                </span>
                {appts.length > 0 && (
                  <span className={`mt-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-primary-50 text-primary'}`}>
                    {appts.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Appointment list for selected day */}
      <div className="card">
        <SectionHeader title={formatLongDateShort(selectedDate)} subtitle={`${selectedAppts.length} appointment${selectedAppts.length !== 1 ? 's' : ''}`} />
        {selectedAppts.length === 0 ? (
          <EmptyState icon={<CalendarDays size={18} />} title="No appointments this day" description="Book one above or set up as a walk-in." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {selectedAppts.map((a) => {
              const patient = patients.find((p) => p.patient_id === a.patient_id);
              return (
                <div key={a.appointment_id} className="rounded-lg border border-black/5 p-3 hover:border-primary/30 transition">
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary font-bold text-xs flex-shrink-0">
                      {formatTime(a.time_slot).slice(0, 5)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ink truncate">{patient?.name ?? 'Unknown'}</p>
                        {a.triage_level === 'urgent' && <span className="badge badge-urgent text-[10px]">Urgent</span>}
                        {a.online_booking && <span className="badge bg-purple-50 text-purple-700 text-[10px]">Online</span>}
                      </div>
                      <p className="text-xs text-ink-muted truncate">{a.reason ?? a.type}</p>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className={`badge ${statusBadgeClass(a.status)} text-[10px] capitalize`}>{a.status}</span>
                        <span className={`badge ${a.type === 'walk-in' ? 'bg-blue-50 text-blue-700' : 'bg-primary-50 text-primary'} text-[10px]`}>
                          {a.type === 'walk-in' ? 'Walk-in' : 'Scheduled'}
                        </span>
                        <span className="text-[10px] text-ink-subtle">Token #{a.token_number ?? '—'}</span>
                        {a.ai_summary && (
                          <button onClick={(e) => { e.stopPropagation(); setSummaryAppt(a); }} className="badge bg-accent-50 text-accent-600 text-[10px] flex items-center gap-1 hover:bg-accent-100 transition">
                            <Sparkles size={10} /> AI Summary
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-black/5">
                    <button
                      onClick={() => onRemind(a, patient)}
                      className="btn-ghost text-xs py-1 px-2"
                      title="Send WhatsApp reminder"
                    >
                      <MessageCircle size={12} />
                      Remind
                    </button>
                    <CancelApptButton appt={a} onDone={refresh} />
                    <RescheduleApptButton appt={a} onDone={refresh} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BookingModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onSaved={() => {
          void refresh();
          setBookOpen(false);
        }}
        patients={patients}
        doctors={doctors}
        clinicId={clinic?.clinic_id ?? ''}
        defaultDate={selectedDate}
        slots={slots}
        currentUser={user}
      />

      <WalkInModal
        open={walkinOpen}
        onClose={() => setWalkinOpen(false)}
        onSaved={() => {
          void refresh();
          setWalkinOpen(false);
        }}
        patients={patients}
        doctors={doctors}
        clinicId={clinic?.clinic_id ?? ''}
        currentUser={user}
      />
      {summaryAppt && (
        <Modal open onClose={() => setSummaryAppt(null)} title="AI Medical Summary" subtitle={`${summaryAppt.patient?.name ?? 'Patient'} · ${formatDate(summaryAppt.date)} ${formatTime(summaryAppt.time_slot)}`} size="md">
          <AISummaryPanel summary={summaryAppt.ai_summary as TriageSummary | null} />
        </Modal>
      )}
    </div>
  );
}

function formatLongDateShort(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function CancelApptButton({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const { toast } = useToast();
  if (appt.status === 'cancelled' || appt.status === 'done') return null;
  return (
    <button
      onClick={async () => {
        try {
          await updateDoc(doc(db, 'appointments', appt.appointment_id!), { status: 'cancelled' });
          toast('Appointment cancelled.', 'success');
          onDone();
        } catch(error) {
          toast('Unable to cancel. Please try again.', 'error');
        }
      }}
      className="btn-ghost text-xs py-1 px-2 text-danger"
    >
      <X size={12} />
      Cancel
    </button>
  );
}

function RescheduleApptButton({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(appt.date);
  const [time, setTime] = useState(appt.time_slot);
  const [saving, setSaving] = useState(false);

  if (appt.status === 'cancelled') return null;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost text-xs py-1 px-2">
        <Clock size={12} />
        Reschedule
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reschedule appointment"
        subtitle={`${appt.reason ?? 'Appointment'}`}
        size="sm"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-ghost">
              Close
            </button>
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await updateDoc(doc(db, 'appointments', appt.appointment_id!), { date, time_slot: time });
                  toast('Appointment rescheduled.', 'success');
                  setOpen(false);
                  onDone();
                } catch(error) {
                  toast('Unable to reschedule. Please try again.', 'error');
                } finally {
                  setSaving(false);
                }
              }}
              className="btn-primary"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">New date</label>
            <input type="date" min={todayISO()} className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">New time</label>
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
      </Modal>
    </>
  );
}

interface BookingProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  patients: Patient[];
  doctors: U[];
  clinicId: string;
  defaultDate: Date;
  slots: string[];
  currentUser: U | null;
}

interface WalkInProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  patients: Patient[];
  doctors: U[];
  clinicId: string;
  currentUser: U | null;
}

function BookingModal({ open, onClose, onSaved, patients, doctors, clinicId, defaultDate, slots, currentUser }: BookingProps) {
  const { toast } = useToast();
  const [patientQuery, setPatientQuery] = useState('');
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(localDateISO(defaultDate));
  const [time, setTime] = useState(slots[0] ?? '09:00');
  const [type, setType] = useState<'scheduled' | 'walk-in'>('scheduled');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Set default doctor when doctors list loads
  useEffect(() => {
    if (doctors.length > 0 && !doctorId) {
      setDoctorId(doctors[0].id!);
    }
  }, [doctors, doctorId]);

  const filtered = patientQuery
    ? patients
        .filter((p) => p.name.toLowerCase().includes(patientQuery.toLowerCase()) || p.phone?.includes(patientQuery))
        .slice(0, 5)
    : [];

  const submit = async () => {
    if (!patientId) return toast('Select a patient.', 'error');
    if (!doctorId) return toast('Select a doctor.', 'error');
    setSaving(true);
    
    try {
      const q = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId), where('date', '==', date), orderBy('token_number', 'desc'), limit(1));
      const existing = await getDocs(q);
      const nextToken = existing.empty ? 1 : ((existing.docs[0].data()?.token_number ?? 0) + 1);

      await addDoc(collection(db, 'appointments'), {
        clinic_id: clinicId,
        patient_id: patientId,
        doctor_id: doctorId || null,
        date,
        time_slot: time,
        type,
        status: 'waiting',
        reason: reason || null,
        token_number: nextToken,
        triage_level: 'normal',
        created_at: new Date().toISOString()
      });

      toast('Appointment booked.', 'success');
      setPatientQuery('');
      setPatientId('');
      setReason('');
      onSaved();
    } catch (error) {
      toast('Unable to book appointment. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Book new appointment"
      subtitle="Choose patient, doctor, date & time"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Booking…' : 'Book appointment'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Patient *</label>
          {patientId ? (
            <div className="flex items-center justify-between input">
              <span className="text-sm">{patients.find((p) => p.patient_id === patientId)?.name}</span>
              <button type="button" onClick={() => setPatientId('')} className="text-ink-subtle hover:text-danger">
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <input
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                className="input"
                placeholder="Search patient by name or phone…"
              />
              {filtered.length > 0 && (
                <div className="mt-1 border border-black/5 rounded-lg divide-y divide-black/5 max-h-44 overflow-y-auto">
                  {filtered.map((p) => (
                    <button
                      key={p.patient_id}
                      onClick={() => {
                        setPatientId(p.patient_id);
                        setPatientQuery('');
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-primary-50 transition text-sm"
                    >
                      <span className="font-medium text-ink">{p.name}</span>
                      <span className="text-xs text-ink-muted ml-2">{p.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" min={todayISO()} className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Time</label>
            <select className="select" value={time} onChange={(e) => setTime(e.target.value)}>
              {slots.map((s) => (
                <option key={s} value={s}>{formatTime(s)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Visit type</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as 'walk-in' | 'scheduled')}>
              <option value="scheduled">Scheduled</option>
              <option value="walk-in">Walk-in</option>
            </select>
          </div>
          <div>
            <label className="label">Doctor</label>
            <select className="select" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {doctors.length === 0 && <option value="">No doctors added yet</option>}
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Reason for visit</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. routine follow-up, fever, headache" />
        </div>
        {currentUser && (
          <p className="text-xs text-ink-subtle">
            Booking created by <span className="font-medium text-ink-muted">{currentUser.name}</span>.
          </p>
        )}
      </div>
    </Modal>
  );
}

function WalkInModal({ open, onClose, onSaved, patients, clinicId, doctors, currentUser }: WalkInProps) {
  const { toast } = useToast();
  const [patientSearch, setPatientSearch] = useState('');
  const [patientId, setPatientId] = useState('');
  const [reason, setReason] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [saving, setSaving] = useState(false);

  // Set default doctor when doctors list loads
  useEffect(() => {
    if (doctors.length > 0 && !doctorId) {
      setDoctorId(doctors[0].id!);
    }
  }, [doctors, doctorId]);

  const filtered = patientSearch
    ? patients.filter((p) => p.name.toLowerCase().includes(patientSearch.toLowerCase()) || p.phone?.includes(patientSearch)).slice(0, 5)
    : [];

  const submit = async () => {
    if (!patientId) return toast('Select a patient.', 'error');
    setSaving(true);
    const now = new Date();
    const timeSlot = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = localDateISO(now);

    try {
      const q = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId), where('date', '==', today), orderBy('token_number', 'desc'), limit(1));
      const existing = await getDocs(q);
      const nextToken = existing.empty ? 1 : (((existing.docs[0].data() as any)?.token_number ?? 0) + 1);

      await addDoc(collection(db, 'appointments'), {
        clinic_id: clinicId,
        patient_id: patientId,
        doctor_id: doctorId || null,
        date: today,
        time_slot: timeSlot,
        type: 'walk-in',
        status: 'waiting',
        reason: reason || null,
        token_number: nextToken,
        triage_level: 'normal',
        created_at: new Date().toISOString()
      });

      toast('Walk-in added to queue.', 'success');
      setPatientSearch('');
      setPatientId('');
      setReason('');
      onSaved();
    } catch (error) {
      toast('Unable to book appointment. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add walk-in patient"
      subtitle="Adds the patient to today's queue immediately"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            <Zap size={14} />
            {saving ? 'Adding…' : 'Add to queue'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Patient *</label>
          {patientId ? (
            <div className="flex items-center justify-between input">
              <span className="text-sm flex items-center gap-1.5"><UserIcon size={14} /> {patients.find((p) => p.patient_id === patientId)?.name}</span>
              <button onClick={() => setPatientId('')} className="text-ink-subtle hover:text-danger"><X size={14} /></button>
            </div>
          ) : (
            <>
              <input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} className="input" placeholder="Search patient…" />
              {filtered.length > 0 && (
                <div className="mt-1 border border-black/5 rounded-lg divide-y divide-black/5">
                  {filtered.map((p) => (
                    <button key={p.patient_id} onClick={() => { setPatientId(p.patient_id); setPatientSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-primary-50 transition text-sm">
                      <span className="font-medium text-ink">{p.name}</span>
                      <span className="text-xs text-ink-muted ml-2">{p.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div>
          <label className="label">Reason (optional)</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. fever, pain" />
        </div>
        <div>
          <label className="label">Doctor</label>
          <select className="select" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.length === 0 && <option value="">No doctors added yet</option>}
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        {currentUser && <p className="text-xs text-ink-subtle flex items-center gap-1"><Stethoscope size={12} /> Logged in as {currentUser.name}</p>}
      </div>
    </Modal>
  );
}
