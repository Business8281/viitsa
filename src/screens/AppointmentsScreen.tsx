import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Zap, MessageCircle, X, Clock, User as UserIcon, Stethoscope, Sparkles, CheckCircle, History, Search, ChevronLeft, ChevronRight, FolderHeart } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, addDoc, updateDoc, orderBy, limit, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { sendInstantAppointmentEmail } from '../lib/emailService';
import { useClinicData } from '../lib/useClinicData';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import { AISummaryPanel } from '../components/AISummaryPanel';
import { EmptyState, Loading, SectionHeader } from '../components/ui';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { PatientDetailModal } from '../components/PatientDetailModal';
import { formatDate, formatTime, statusBadgeClass, whatsappReminderLink, todayISO, localDateISO, matchesDateRange, type DateRangePreset, calculateAge, formatDobForInput } from '../lib/format';
import type { Appointment, Patient, User as U } from '../lib/types';
import type { TriageSummary } from '../lib/aiService';
import { sanitizeForFirestore } from '../lib/identityResolver';

function generateDates(days: number, offsetDays: number = 0): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays + i);
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

async function fetchClinicHours(clinicId: string): Promise<{ open: string; close: string; slot: number; holidays: string[] }> {
  try {
    const docSnap = await getDoc(doc(db, 'clinic_settings', clinicId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      const slot = data.slot_duration_minutes ?? 20;
      return { open: '09:00', close: '19:00', slot, holidays: data.holidays || [] };
    }
  } catch (e) {}
  return { open: '09:00', close: '19:00', slot: 20, holidays: [] };
}

export function AppointmentsScreen() {
  const { clinic, user } = useAuth();
  const { appointments, patients, loading, refresh, urgentQueue } = useClinicData();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<'schedule' | 'history'>('schedule');
  const [dayOffset, setDayOffset] = useState<number>(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'done' | 'waiting' | 'cancelled'>('all');
  const [historyDatePreset, setHistoryDatePreset] = useState<DateRangePreset>('all');
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [hours, setHours] = useState<{ open: string; close: string; slot: number; holidays: string[] }>({ open: '09:00', close: '19:00', slot: 20, holidays: [] });
  const [bookOpen, setBookOpen] = useState(false);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [doctors, setDoctors] = useState<U[]>([]);
  const [summaryAppt, setSummaryAppt] = useState<Appointment | null>(null);
  const [selectedPatientForModal, setSelectedPatientForModal] = useState<any | null>(null);

  useEffect(() => {
    if (!clinic) return;
    fetchClinicHours(clinic.clinic_id).then(setHours);
    const q = query(collection(db, 'users'), where('clinic_id', '==', clinic.clinic_id), where('role', '==', 'clinic_doctor'), where('active', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      setDoctors(snap.docs.map(d => ({ ...d.data(), id: d.id } as U)));
    }, console.error);
    return () => unsub();
  }, [clinic]);

  const dates = useMemo(() => generateDates(8, dayOffset), [dayOffset]);
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

  // All Past & Multi-period Appointments
  const todayStr = todayISO();
  const pastAppointments = useMemo(() => {
    return appointments
      .filter((a) => (a.date || '') < todayStr || a.status === 'done' || a.status === 'cancelled')
      .sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        if (da !== db) return db.localeCompare(da);
        return (b.time_slot || '').localeCompare(a.time_slot || '');
      });
  }, [appointments, todayStr]);

  const filteredHistory = useMemo(() => {
    let list = appointments
      .filter((a) => matchesDateRange(a.date, historyDatePreset, historyStart, historyEnd))
      .sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        if (da !== db) return db.localeCompare(da);
        return (b.time_slot || '').localeCompare(a.time_slot || '');
      });

    if (historyStatusFilter === 'done') list = list.filter((a) => a.status === 'done');
    else if (historyStatusFilter === 'waiting') list = list.filter((a) => a.status === 'waiting' || a.status === 'in-progress');
    else if (historyStatusFilter === 'cancelled') list = list.filter((a) => a.status === 'cancelled');

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter((a) => {
        const patient = a.patient || patients.find((p) => p.patient_id === a.patient_id);
        const patName = (patient?.name || (a as any).patient_name || '').toLowerCase();
        const patPhone = (patient?.phone || (a as any).patient_phone || '').toLowerCase();
        const reason = (a.reason || '').toLowerCase();
        const token = (a.display_token || String(a.token_number || '')).toLowerCase();
        const docName = ((a.doctor as any)?.name ?? doctors.find((d) => d.id === a.doctor_id)?.name ?? '').toLowerCase();
        return patName.includes(q) || patPhone.includes(q) || reason.includes(q) || token.includes(q) || docName.includes(q);
      });
    }
    return list;
  }, [appointments, historyDatePreset, historyStart, historyEnd, historyStatusFilter, historySearch, patients, doctors]);

  // Mark appointment as complete
  const completeAppointment = async (appt: Appointment) => {
    const apptId = appt.appointment_id || appt.appt_id;
    if (!apptId) return;
    setCompletingId(apptId);
    try {
      await updateDoc(doc(db, 'appointments', apptId), {
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

  const onRemind = (appt: Appointment, patient?: Patient) => {
    if (!clinic) return;
    if (!patient || !patient.phone) {
      toast('No phone number on file for this patient.', 'warning');
      return;
    }
    const link = whatsappReminderLink(patient.phone, patient.name, formatDate(appt.date), formatTime(appt.time_slot), clinic.name, clinic.phone);
    window.open(link, '_blank', 'noopener');
  };

  const addToClinic = async (appt: Appointment, patientInfo: any) => {
    if (!clinic) return;
    const patName = patientInfo?.name || (appt as any).patient_name;
    if (!patName) {
      toast('No patient details available to convert.', 'error');
      return;
    }

    try {
      const pId = appt.patient_id;
      const patientCode = `PAT-${Math.floor(Math.random() * 9000) + 1000}`;
      await setDoc(doc(db, 'patients', pId), sanitizeForFirestore({
        patient_id: pId,
        clinic_id: clinic.clinic_id,
        name: patName,
        full_name: patName,
        phone: patientInfo?.phone || (appt as any).patient_phone || null,
        email: patientInfo?.email || (appt as any).patient_email || null,
        gender: patientInfo?.gender || null,
        age: patientInfo?.age || null,
        patient_code: patientCode,
        display_id: patientCode,
        id_number: patientCode,
        created_at: serverTimestamp()
      }), { merge: true });
      toast('Patient added to clinic CRM.', 'success');
      void refresh();
    } catch (error) {
      console.error("addToClinic error:", error);
      toast('Failed to add patient to clinic.', 'error');
    }
  };



  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Appointments</h1>
          <p className="text-sm text-ink-muted">
            {viewMode === 'schedule'
              ? `Day schedule · ${formatDate(selectedDate)}`
              : `All past history · ${pastAppointments.length} past appointment${pastAppointments.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex bg-black/5 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('schedule')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${viewMode === 'schedule' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
            >
              <CalendarDays size={13} />
              Schedule
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${viewMode === 'history' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
            >
              <History size={13} />
              All & Past History ({appointments.length})
            </button>
          </div>
          <button onClick={() => setWalkinOpen(true)} className="btn-primary">
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

      {viewMode === 'schedule' ? (
        <>
          {/* Calendar strip with previous/next controls */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <SectionHeader title="Select day" subtitle="Tap a date to view its appointments" />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDayOffset((prev) => prev - 7)}
                  className="btn-outline p-1.5 text-xs"
                  title="Previous 7 days"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => {
                    setDayOffset(0);
                    setSelectedDate(new Date());
                  }}
                  className="btn-outline px-2.5 py-1 text-xs"
                >
                  Today
                </button>
                <button
                  onClick={() => setDayOffset((prev) => prev + 7)}
                  className="btn-outline p-1.5 text-xs"
                  title="Next 7 days"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
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
                      {!isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { weekday: 'short' }) : '—'}
                    </span>
                    <span className="text-lg font-bold leading-tight">{!isNaN(d.getTime()) ? d.getDate() : '—'}</span>
                    <span className={`text-[10px] ${active ? 'text-white/80' : 'text-ink-subtle'}`}>
                      {isToday ? 'Today' : (!isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { month: 'short' }) : '—')}
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
                  const patient = a.patient || patients.find((p) => p.patient_id === a.patient_id);
                  const isCompleting = completingId === (a.appointment_id || a.appt_id);
                  return (
                    <div key={a.appointment_id || a.appt_id} className="rounded-lg border border-black/5 p-3 hover:border-primary/30 transition">
                      <div className="flex items-start gap-3">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary font-bold text-xs flex-shrink-0">
                          {formatTime(a.time_slot).slice(0, 5)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPatientForModal(patient || { patient_id: a.patient_id, name: (a as any).patient_name, phone: (a as any).patient_phone });
                              }}
                              className="text-sm font-semibold text-ink hover:text-primary hover:underline truncate text-left cursor-pointer"
                              title="Click to view full patient medical records"
                            >
                              {patient?.name || (a as any).patient_name || 'Unknown'}
                            </button>
                            {a.display_token && <span className="badge bg-primary/10 text-primary font-bold text-[10px]">{a.display_token}</span>}
                            {a.triage_level === 'urgent' && <span className="badge badge-urgent text-[10px]">Urgent</span>}
                            {a.online_booking && <span className="badge bg-purple-50 text-purple-700 text-[10px]">Online</span>}
                          </div>
                          <p className="text-xs text-ink-muted truncate mt-0.5">
                            <span className="font-medium text-ink">{(a.doctor as any)?.name ?? doctors.find(d => d.id === a.doctor_id)?.name ?? 'Doctor'}</span>
                            {' • '}
                            {formatDate(a.date)} at {formatTime(a.time_slot)}
                          </p>
                          <p className="text-xs text-ink-muted truncate mt-0.5">
                            {patient?.phone || (a as any).patient_phone ? `${patient?.phone || (a as any).patient_phone} • ` : ''}
                            {patient?.email || (a as any).patient_email ? `${patient?.email || (a as any).patient_email} • ` : ''}
                            {(patient as any)?.emergency_contact_name ? `Attendant: ${(patient as any).emergency_contact_name} • ` : ''}
                            {a.visit_type ? `${a.visit_type.replace('-', ' ')} • ` : ''}
                            {a.reason ?? a.type}
                          </p>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className={`badge ${statusBadgeClass(a.status)} text-[10px] capitalize`}>{a.status}</span>
                            <span className={`badge ${a.type === 'walk-in' ? 'bg-blue-50 text-blue-700' : 'bg-primary-50 text-primary'} text-[10px]`}>
                              {a.type === 'walk-in' ? 'Walk-in' : 'Scheduled'}
                            </span>
                            {a.ai_summary && (
                              <button onClick={(e) => { e.stopPropagation(); setSummaryAppt(a); }} className="badge bg-accent-50 text-accent-600 text-[10px] flex items-center gap-1 hover:bg-accent-100 transition">
                                <Sparkles size={10} /> AI Summary
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-black/5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedPatientForModal(patient || { patient_id: a.patient_id, name: (a as any).patient_name, phone: (a as any).patient_phone })}
                          className="btn-ghost text-xs py-1 px-2 text-slate-700 hover:text-primary flex items-center gap-1"
                          title="View complete patient medical records"
                        >
                          <FolderHeart size={12} className="text-primary" /> Medical Records
                        </button>

                        {a.status !== 'done' && a.status !== 'cancelled' ? (
                          <button
                            onClick={() => completeAppointment(a)}
                            disabled={isCompleting}
                            className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1.5 shadow-sm"
                            title="Mark this appointment as complete"
                          >
                            <CheckCircle size={13} />
                            {isCompleting ? 'Completing…' : 'Complete Appointment'}
                          </button>
                        ) : a.status === 'done' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                            <CheckCircle size={13} className="text-emerald-600" />
                            Completed
                          </span>
                        ) : null}

                        <button
                          onClick={() => onRemind(a, patient)}
                          className="btn-ghost text-xs py-1 px-2"
                          title="Send WhatsApp reminder"
                        >
                          <MessageCircle size={12} />
                          Remind
                        </button>
                        {a.status !== 'done' && a.status !== 'cancelled' && (
                          <>
                            <CancelApptButton appt={a} onDone={refresh} />
                            <RescheduleApptButton appt={a} onDone={refresh} />
                          </>
                        )}
                        {!patients.some(p => p.patient_id === a.patient_id) && (
                          <button onClick={() => addToClinic(a, patient)} className="btn-ghost text-xs py-1 px-2 text-primary hover:bg-primary-50 ml-auto">
                            <Plus size={12} /> Save as Patient
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Full Past & Live Multi-period Appointments View */
        <div className="card space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <SectionHeader title="All Appointments & History" subtitle="Live past, present, and upcoming appointments across all periods" />
            </div>
            <span className="text-xs font-medium text-ink-muted">
              Showing <span className="font-bold text-ink">{filteredHistory.length}</span> appointment{filteredHistory.length !== 1 ? 's' : ''} ({historyDatePreset})
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-divider/60">
            <DateRangeFilter
              preset={historyDatePreset}
              onPresetChange={setHistoryDatePreset}
              customStart={historyStart}
              onCustomStartChange={setHistoryStart}
              customEnd={historyEnd}
              onCustomEndChange={setHistoryEnd}
              label="Calendar Period"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-black/5 p-1 rounded-lg text-xs">
                {(['all', 'done', 'waiting', 'cancelled'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setHistoryStatusFilter(st)}
                    className={`px-2.5 py-1 rounded capitalize font-medium transition ${historyStatusFilter === st ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
                  >
                    {st === 'waiting' ? 'Pending' : st}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-60">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search patient, doctor, reason…"
                  className="input pl-8 text-xs py-1.5 w-full"
                />
              </div>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <EmptyState
              icon={<History size={20} />}
              title="No past appointments match your filter"
              description="Past appointments will appear here as dates elapse or visits are marked complete."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              {filteredHistory.map((a) => {
                const patient = a.patient || patients.find((p) => p.patient_id === a.patient_id);
                const isCompleting = completingId === (a.appointment_id || a.appt_id);
                return (
                  <div key={a.appointment_id || a.appt_id} className="rounded-lg border border-black/5 p-3 hover:border-primary/30 transition bg-white">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-black/5 text-ink font-bold text-xs flex-shrink-0">
                        {formatTime(a.time_slot).slice(0, 5)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPatientForModal(patient || { patient_id: a.patient_id, name: (a as any).patient_name, phone: (a as any).patient_phone });
                            }}
                            className="text-sm font-semibold text-ink hover:text-primary hover:underline truncate text-left cursor-pointer"
                            title="Click to view full patient medical records"
                          >
                            {patient?.name || (a as any).patient_name || 'Unknown'}
                          </button>
                          {a.display_token && <span className="badge bg-primary/10 text-primary font-bold text-[10px]">{a.display_token}</span>}
                          <span className={`badge ${statusBadgeClass(a.status)} text-[10px] capitalize`}>{a.status}</span>
                        </div>
                        <p className="text-xs text-ink-muted truncate mt-0.5">
                          <span className="font-medium text-ink">{(a.doctor as any)?.name ?? doctors.find(d => d.id === a.doctor_id)?.name ?? 'Doctor'}</span>
                          {' • '}
                          {formatDate(a.date)} at {formatTime(a.time_slot)}
                        </p>
                        <p className="text-xs text-ink-muted truncate mt-0.5">
                          {patient?.phone ? `${patient.phone} • ` : ''}
                          {a.reason || 'General Consultation'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-1.5 pt-2 border-t border-black/5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPatientForModal(patient || { patient_id: a.patient_id, name: (a as any).patient_name, phone: (a as any).patient_phone })}
                          className="btn-ghost text-xs py-1 px-2 text-slate-700 hover:text-primary flex items-center gap-1"
                          title="View complete patient medical records"
                        >
                          <FolderHeart size={12} className="text-primary" /> Medical Records
                        </button>

                        {a.status !== 'done' && a.status !== 'cancelled' ? (
                          <button
                            onClick={() => completeAppointment(a)}
                            disabled={isCompleting}
                            className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1.5 shadow-sm"
                            title="Mark this appointment as complete"
                          >
                            <CheckCircle size={13} />
                            {isCompleting ? 'Completing…' : 'Complete Appointment'}
                          </button>
                        ) : a.status === 'done' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                            <CheckCircle size={13} className="text-emerald-600" />
                            Completed
                          </span>
                        ) : null}

                        {patient?.phone && (
                          <button
                            onClick={() => onRemind(a, patient)}
                            className="btn-ghost text-xs py-1 px-2"
                            title="WhatsApp reminder"
                          >
                            <MessageCircle size={12} />
                            WhatsApp
                          </button>
                        )}
                      </div>

                      {a.ai_summary && (
                        <button onClick={() => setSummaryAppt(a)} className="badge bg-accent-50 text-accent-600 text-[10px] flex items-center gap-1 hover:bg-accent-100 transition">
                          <Sparkles size={10} /> AI Summary
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <BookingModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onSaved={() => { refresh(); setBookOpen(false); }}
        patients={patients}
        doctors={doctors}
        clinicId={clinic!.clinic_id}
        defaultDate={selectedDate}
        slots={slots}
        currentUser={user}
        holidays={hours.holidays}
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

      <PatientDetailModal
        patient={selectedPatientForModal}
        onClose={() => setSelectedPatientForModal(null)}
      />
    </div>
  );
}

function formatLongDateShort(d: Date): string {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}

function CancelApptButton({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const { toast } = useToast();
  if (appt.status === 'cancelled' || appt.status === 'done') return null;
  return (
    <button
      onClick={async () => {
        try {
          await updateDoc(doc(db, 'appointments', appt.appointment_id!), { status: 'cancelled' });
          sendInstantAppointmentEmail(appt.appointment_id!, 'appointment_cancelled');
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
                  await updateDoc(doc(db, 'appointments', appt.appointment_id!), { date, time_slot: time, status: 'rescheduled' });
                  sendInstantAppointmentEmail(appt.appointment_id!, 'appointment_rescheduled');
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
            <input type="date" min={todayISO()} className="input" value={formatDobForInput(date)} onChange={(e) => setDate(e.target.value)} />
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

interface WalkInProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  patients: Patient[];
  doctors: U[];
  clinicId: string;
  currentUser: U | null;
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
  holidays: string[];
}

function BookingModal({ open, onClose, onSaved, patients, doctors, clinicId, defaultDate, slots, currentUser, holidays }: BookingProps) {
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
    if (holidays.includes(date)) return toast('The clinic is closed on this date (Holiday).', 'error');
    
    setSaving(true);
    
    try {
      const q = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId), where('date', '==', date));
      const existing = await getDocs(q);
      const existingData = existing.docs.map(d => d.data());
      
      const isDuplicate = existingData.some(a => 
        a.doctor_id === doctorId && 
        a.time_slot === time && 
        a.status !== 'cancelled'
      );

      if (isDuplicate) {
        setSaving(false);
        return toast('This time slot is already booked for this doctor. Please choose a different slot.', 'error');
      }

      const maxToken = existingData.reduce((max, appt) => Math.max(max, appt.token_number || 0), 0);
      const nextToken = maxToken + 1;

      const apptRef = await addDoc(collection(db, 'appointments'), {
        clinic_id: clinicId,
        patient_id: patientId,
        doctor_id: doctorId || null,
        date,
        time_slot: time,
        type,
        status: 'waiting',
        reason: reason || null,
        token_number: nextToken,
        display_token: 'MN-' + String(nextToken).padStart(3, '0'),
        booked_via: 'manual',
        triage_level: 'normal',
        created_at: serverTimestamp()
      });
      await updateDoc(apptRef, { appt_id: apptRef.id, appointment_id: apptRef.id });
      sendInstantAppointmentEmail(apptRef.id, 'appointment_confirmed');

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
            <input type="date" min={todayISO()} className="input" value={formatDobForInput(date)} onChange={(e) => setDate(e.target.value)} />
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
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientDob, setPatientDob] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [attendantName, setAttendantName] = useState('');
  const [reason, setReason] = useState('');
  const [doctorId, setDoctorId] = useState('');
  
  const now = new Date();
  const [date, setDate] = useState(localDateISO(now));
  const [timeSlot, setTimeSlot] = useState(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  
  const [saving, setSaving] = useState(false);

  const handlePatientDobChange = (newDob: string) => {
    const formatted = formatDobForInput(newDob);
    setPatientDob(formatted);
    if (newDob) {
      const computed = calculateAge(newDob);
      if (computed !== null && computed >= 0 && computed <= 125) {
        setPatientAge(String(computed));
      }
    }
  };

  const handlePatientAgeChange = (newAge: string) => {
    const cleanAge = newAge.replace(/\D/g, '').slice(0, 3);
    setPatientAge(cleanAge);
    const num = parseInt(cleanAge, 10);
    if (!patientDob && !isNaN(num) && num >= 0 && num <= 125) {
      const approxYear = new Date().getFullYear() - num;
      setPatientDob(`${approxYear}-01-01`);
    }
  };

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
    if (!patientId && !patientSearch.trim()) return toast('Select a patient or type a name.', 'error');
    if (!date) return toast('Select a date.', 'error');
    if (!timeSlot) return toast('Select a time.', 'error');
    
    setSaving(true);
    
    try {
      let finalPatientId = patientId;
      const parsedAge = patientAge ? parseInt(patientAge, 10) : (patientDob ? calculateAge(patientDob) : null);
      if (!finalPatientId && patientSearch.trim()) {
        const pRef = await addDoc(collection(db, 'patients'), {
          clinic_id: clinicId,
          name: patientSearch.trim(),
          phone: patientPhone.trim(),
          email: patientEmail.trim() || null,
          dob: patientDob || null,
          age: parsedAge,
          emergency_contact_name: attendantName.trim() || null,
          created_at: serverTimestamp()
        });
        await updateDoc(pRef, { patient_id: pRef.id });
        finalPatientId = pRef.id;
      }

      const q = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId), where('date', '==', date));
      const existingSnap = await getDocs(q);
      const existing = existingSnap.docs.map(d => d.data());
      const maxToken = existing.reduce((max, appt) => Math.max(max, appt.token_number || 0), 0);
      const nextToken = maxToken + 1;

      const apptRef = await addDoc(collection(db, 'appointments'), {
        clinic_id: clinicId,
        patient_id: finalPatientId,
        doctor_id: doctorId || null,
        date: date,
        time_slot: timeSlot,
        type: 'walk-in',
        status: 'waiting',
        reason: reason || null,
        token_number: nextToken,
        display_token: 'MN-' + String(nextToken).padStart(3, '0'),
        booked_via: 'manual',
        triage_level: 'normal',
        created_at: serverTimestamp()
      });
      await updateDoc(apptRef, { appt_id: apptRef.id, appointment_id: apptRef.id });
      sendInstantAppointmentEmail(apptRef.id, 'appointment_confirmed');

      toast('Walk-in added to queue.', 'success');
      setPatientSearch('');
      setPatientId('');
      setPatientPhone('');
      setPatientEmail('');
      setAttendantName('');
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
              <input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} className="input" placeholder="Search or Create new patient…" />
              {filtered.length > 0 && (
                <div className="mt-1 border border-black/5 rounded-lg divide-y divide-black/5 max-h-40 overflow-y-auto">
                  {filtered.map((p) => (
                    <button key={p.patient_id} onClick={() => { setPatientId(p.patient_id); setPatientSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-primary-50 transition text-sm">
                      <span className="font-medium text-ink">{p.name}</span>
                      <span className="text-xs text-ink-muted ml-2">{p.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {!patientId && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="label">Phone number</label>
                    <input className="input" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="Phone" />
                  </div>
                  <div>
                    <label className="label">Email address</label>
                    <input className="input" type="email" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} placeholder="Email (optional)" />
                  </div>
                  <div>
                    <label className="label">Date of Birth (DOB)</label>
                    <input
                      type="date"
                      max={localDateISO(new Date())}
                      className="input"
                      value={formatDobForInput(patientDob)}
                      onChange={(e) => handlePatientDobChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">
                      Age {patientDob && <span className="text-[10px] text-teal-700 font-normal">(Auto)</span>}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={125}
                      className="input font-mono"
                      placeholder="Age in years"
                      value={patientAge}
                      onChange={(e) => handlePatientAgeChange(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Attendant Name (optional)</label>
                    <input className="input" value={attendantName} onChange={(e) => setAttendantName(e.target.value)} placeholder="Emergency contact or guardian" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" min={todayISO()} className="input" value={formatDobForInput(date)} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" className="input" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} />
          </div>
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
