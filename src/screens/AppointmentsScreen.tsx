import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Zap, MessageCircle, X, Clock, User as UserIcon, Stethoscope, Sparkles, CheckCircle, History, Search, ChevronLeft, ChevronRight, FolderHeart, RotateCcw, CheckCircle2, Phone, Mail, Users, Layers, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
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
import { sendWhatsAppAppointmentReminderViaAPI } from '../lib/whatsappClientService';
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

function getApptTypeLabel(a?: Appointment): string {
  if (!a) return 'Clinic';
  if (a.booked_via === 'qr_walkin' || a.display_token?.startsWith('QR-') || a.display_token?.startsWith('EM-')) return 'Walk-in';
  if (a.type === 'walk-in' || (a as any).walkin) return 'Walk-in';
  if (a.online_booking) return 'Online';
  return 'Clinic';
}

function formatDisplayToken(token?: string | null, tokenNumber?: number | null): string {
  if (!token) return tokenNumber ? `#${tokenNumber}` : '—';
  if (token.startsWith('EM-')) {
    return token.replace(/^EM-/, 'QR-');
  }
  return token;
}

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
  const [dayTab, setDayTab] = useState<'queue' | 'tokens'>('queue');
  const [dayStatusFilter, setDayStatusFilter] = useState<'all' | 'waiting' | 'done' | 'cancelled'>('all');
  const [daySearch, setDaySearch] = useState('');
  const [expandedPatientKey, setExpandedPatientKey] = useState<string | null>(null);
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null);

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
    const q = query(collection(db, 'users'), where('clinic_id', '==', clinic.clinic_id));
    const unsub = onSnapshot(q, (snap) => {
      const allClinicUsers = snap.docs.map(d => ({ ...d.data(), id: d.id, user_id: d.id } as U));
      
      // Doctors include clinic_doctor, doctor, and clinic_admin (who often acts as the chief/attending doctor)
      const docUsers = allClinicUsers.filter(u => 
        (u.role === 'clinic_doctor' || u.role === 'doctor' || u.role === 'clinic_admin' || (u as any).user_type === 'clinic_doctor' || (u as any).user_type === 'clinic_admin') &&
        u.active !== false
      );

      // If currentUser belongs to this clinic, ensure they are present in docUsers
      if (user) {
        const currentUserId = user.id || (user as any).user_id || (user as any).uid;
        if (!docUsers.some(d => d.id === currentUserId || (d as any).user_id === currentUserId || (d.name && user.name && d.name.toLowerCase() === user.name.toLowerCase()))) {
          docUsers.unshift({
            ...user,
            id: currentUserId,
            user_id: currentUserId,
            name: user.name || 'Doctor',
          } as unknown as U);
        }
      }

      // If clinic.doctor_name is specified and not represented, add it as well
      if ((clinic as any).doctor_name) {
        const cDocName = (clinic as any).doctor_name;
        if (!docUsers.some(d => (d.name || '').toLowerCase().includes(cDocName.toLowerCase()))) {
          docUsers.unshift({
            id: `doc_${clinic.clinic_id}`,
            user_id: `doc_${clinic.clinic_id}`,
            name: cDocName,
            role: 'clinic_doctor',
            active: true,
          } as unknown as U);
        }
      }

      // If there are real named doctors, filter out any generic placeholder account named "Clinic Doctor" or "Doctor"
      const realNamedDocs = docUsers.filter(d => {
        const n = (d.name || '').trim().toLowerCase();
        return n !== 'clinic doctor' && n !== 'doctor' && n !== 'admin';
      });

      const finalDocs = realNamedDocs.length > 0 ? realNamedDocs : docUsers;
      setDoctors(finalDocs.length > 0 ? finalDocs : allClinicUsers.filter(u => u.active !== false));
    }, console.error);
    return () => unsub();
  }, [clinic, user]);

  // Automatically migrate any legacy EM- tokens in Firestore to QR-
  useEffect(() => {
    const legacyEMs = appointments.filter(a => a.display_token?.startsWith('EM-'));
    if (legacyEMs.length > 0) {
      for (const a of legacyEMs) {
        const aId = a.appointment_id || a.appt_id;
        if (aId) {
          updateDoc(doc(db, 'appointments', aId), {
            display_token: a.display_token!.replace(/^EM-/, 'QR-'),
            type: 'walk-in',
            online_booking: false,
          }).catch(console.warn);
        }
      }
    }
  }, [appointments]);

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
    for (const d in map) {
      map[d].sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || ''));
    }
    return map;
  }, [appointments]);

  const selectedISO = localDateISO(selectedDate);
  const selectedAppts = appointmentsByDate[selectedISO] ?? [];

  // Statistics for selected day
  const dayStats = useMemo(() => {
    let waiting = 0;
    let done = 0;
    let cancelled = 0;
    for (const a of selectedAppts) {
      if (a.status === 'done') done++;
      else if (a.status === 'cancelled') cancelled++;
      else waiting++;
    }
    const uniquePatients = new Set(selectedAppts.map(a => a.patient_id || (a as any).patient_phone || (a as any).patient_name)).size;
    return {
      total: selectedAppts.length,
      waiting,
      done,
      cancelled,
      uniquePatients,
    };
  }, [selectedAppts]);

  // Helper to get a stable unique patient key across bookings
  const getPatientKey = (a: Appointment) => {
    const rawPhone = ((a.patient?.phone || (a as any).patient_phone || (a as any).phone || '') as string).replace(/\D/g, '').slice(-10);
    if (rawPhone && rawPhone.length === 10) return `phone_${rawPhone}`;
    if (a.patient_id) return `id_${a.patient_id}`;
    const rawName = ((a.patient?.name || (a as any).patient_name || (a as any).name || '') as string).trim().toLowerCase();
    if (rawName) return `name_${rawName}`;
    return `appt_${a.appointment_id || a.appt_id || Math.random()}`;
  };

  const parseTokenOrder = (tokenStr?: string, tokenNum?: number | null): number => {
    if (typeof tokenNum === 'number' && !isNaN(tokenNum)) return tokenNum;
    if (!tokenStr) return 999999;
    const match = tokenStr.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
    return 999999;
  };

  // Grouped unique patient queue (each patient appears ONCE with their upcoming appointment)
  interface PatientQueueGroup {
    key: string;
    patientId: string;
    patientName: string;
    patientPhone: string;
    patientEmail: string;
    attendantName: string;
    attendantPhone: string;
    patient?: Patient;
    upcomingAppt: Appointment;
    allAppts: Appointment[];
    totalBookings: number;
    waitingCount: number;
    doneCount: number;
    cancelledCount: number;
    hasWaiting: boolean;
  }

  const patientQueueGroups = useMemo<PatientQueueGroup[]>(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of selectedAppts) {
      const key = getPatientKey(a);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }

    const groups: PatientQueueGroup[] = [];

    for (const key in map) {
      const appts = map[key].sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || ''));
      const waiting = appts.filter(a => a.status !== 'done' && a.status !== 'cancelled');
      const done = appts.filter(a => a.status === 'done');
      const cancelled = appts.filter(a => a.status === 'cancelled');

      // Upcoming slot: earliest waiting slot; if none, latest completed; if none, latest cancelled
      const upcomingAppt = waiting[0] || done[done.length - 1] || cancelled[cancelled.length - 1] || appts[0];

      const refAppt = upcomingAppt;
      const patient = refAppt.patient || patients.find(p => p.patient_id === refAppt.patient_id);
      const patientName = patient?.name || (refAppt as any).patient_name || 'Patient';
      const patientPhone = patient?.phone || (refAppt as any).patient_phone || (refAppt as any).phone || '';
      const patientEmail = patient?.email || (refAppt as any).patient_email || '';
      const attendantName = (patient as any)?.emergency_contact_name || (patient as any)?.attendant_name || (refAppt as any)?.emergency_contact_name || (refAppt as any)?.attendant_name || '';
      const attendantPhone = (patient as any)?.emergency_contact_phone || (patient as any)?.attendant_phone || (refAppt as any)?.emergency_contact_phone || (refAppt as any)?.attendant_phone || '';

      groups.push({
        key,
        patientId: refAppt.patient_id,
        patientName,
        patientPhone,
        patientEmail,
        attendantName,
        attendantPhone,
        patient,
        upcomingAppt,
        allAppts: appts,
        totalBookings: appts.length,
        waitingCount: waiting.length,
        doneCount: done.length,
        cancelledCount: cancelled.length,
        hasWaiting: waiting.length > 0,
      });
    }

    // Sort: patients with active waiting appointments first (by time), then completed, then cancelled
    return groups.sort((a, b) => {
      if (a.hasWaiting && !b.hasWaiting) return -1;
      if (!a.hasWaiting && b.hasWaiting) return 1;
      return (a.upcomingAppt.time_slot || '').localeCompare(b.upcomingAppt.time_slot || '');
    });
  }, [selectedAppts, patients]);

  // Filtered Patient Queue
  const filteredPatientQueue = useMemo(() => {
    let list = [...patientQueueGroups];

    if (dayStatusFilter === 'waiting') {
      list = list.filter(g => g.waitingCount > 0);
    } else if (dayStatusFilter === 'done') {
      list = list.filter(g => g.doneCount > 0 && g.waitingCount === 0);
    } else if (dayStatusFilter === 'cancelled') {
      list = list.filter(g => g.cancelledCount > 0 && g.waitingCount === 0 && g.doneCount === 0);
    }

    if (daySearch.trim()) {
      const q = daySearch.toLowerCase().trim();
      list = list.filter(g => {
        const matchName = g.patientName.toLowerCase().includes(q);
        const matchPhone = g.patientPhone.toLowerCase().includes(q);
        const matchEmail = g.patientEmail.toLowerCase().includes(q);
        const matchAttendant = g.attendantName.toLowerCase().includes(q) || g.attendantPhone.toLowerCase().includes(q);
        const matchAnyAppt = g.allAppts.some(a => {
          const token = (a.display_token || String(a.token_number || '')).toLowerCase();
          const reason = (a.reason || '').toLowerCase();
          const doc = ((a.doctor as any)?.name || (a as any).doctor_name || '').toLowerCase();
          return token.includes(q) || reason.includes(q) || doc.includes(q);
        });
        return matchName || matchPhone || matchEmail || matchAttendant || matchAnyAppt;
      });
    }

    return list;
  }, [patientQueueGroups, dayStatusFilter, daySearch]);

  // All Appointments sorted token-wise
  const tokenWiseAppts = useMemo(() => {
    let list = [...selectedAppts];

    if (dayStatusFilter === 'waiting') {
      list = list.filter(a => a.status !== 'done' && a.status !== 'cancelled');
    } else if (dayStatusFilter === 'done') {
      list = list.filter(a => a.status === 'done');
    } else if (dayStatusFilter === 'cancelled') {
      list = list.filter(a => a.status === 'cancelled');
    }

    if (daySearch.trim()) {
      const q = daySearch.toLowerCase().trim();
      list = list.filter(a => {
        const patient = a.patient || patients.find(p => p.patient_id === a.patient_id);
        const name = (patient?.name || (a as any).patient_name || '').toLowerCase();
        const phone = (patient?.phone || (a as any).patient_phone || '').toLowerCase();
        const email = (patient?.email || (a as any).patient_email || '').toLowerCase();
        const token = (a.display_token || String(a.token_number || '')).toLowerCase();
        const docName = ((a.doctor as any)?.name || (a as any).doctor_name || '').toLowerCase();
        const reason = (a.reason || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q) || token.includes(q) || docName.includes(q) || reason.includes(q);
      });
    }

    return list.sort((a, b) => {
      const ordA = parseTokenOrder(a.display_token, a.token_number);
      const ordB = parseTokenOrder(b.display_token, b.token_number);
      if (ordA !== ordB) return ordA - ordB;
      return (a.time_slot || '').localeCompare(b.time_slot || '');
    });
  }, [selectedAppts, dayStatusFilter, daySearch, patients]);

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

  const onRemind = async (appt: Appointment, patient?: Patient) => {
    if (!clinic) return;
    const phone = patient?.phone || (appt as any).patient_phone || (appt as any).phone;
    const patName = patient?.name || (appt as any).patient_name || (appt as any).name || 'Patient';

    if (!phone) {
      toast('No phone number on file for this patient.', 'warning');
      return;
    }

    const matchedDoc = doctors.find(d => 
      (d.id && d.id === appt.doctor_id) || 
      ((d as any).uid && (d as any).uid === appt.doctor_id) || 
      ((d as any).user_id && (d as any).user_id === appt.doctor_id)
    );

    let docName = (appt.doctor as any)?.name || 
                  (appt as any).doctor_name || 
                  matchedDoc?.name || 
                  (clinic as any).doctor_name || 
                  (user?.role === 'clinic_doctor' || user?.role === 'doctor' ? user.name : '') || 
                  (doctors.length === 1 ? doctors[0].name : '') || 
                  '';

    if (!docName || !docName.trim()) {
      docName = 'Doctor';
    }

    // Strip leading "Dr." or "Dr " prefix so Meta template doesn't duplicate "Dr. Dr. ..."
    docName = docName.replace(/^(Dr\.?|Doctor)\s+/i, '').trim() || 'Doctor';

    const dateFormatted = formatDate(appt.date);
    const timeFormatted = formatTime(appt.time_slot);

    // Attempt direct delivery via Meta WhatsApp Cloud API template
    if (clinic.whatsapp_reminders_enabled !== false) {
      toast('Sending WhatsApp reminder...', 'info');
      try {
        const res = await sendWhatsAppAppointmentReminderViaAPI({
          to: phone,
          clinicId: clinic.clinic_id,
          patientName: patName,
          doctorName: docName,
          clinicName: clinic.name,
          date: dateFormatted,
          time: timeFormatted,
          location: clinic.address || clinic.name,
          clinicPhone: clinic.phone || '+91 73961 11081',
        });

        if (res.success) {
          toast(`WhatsApp reminder sent to ${patName}!`, 'success');
          return;
        } else {
          console.warn('[onRemind] Cloud API error, falling back to WhatsApp link:', res.error);
        }
      } catch (err) {
        console.warn('[onRemind] Cloud API error, falling back to WhatsApp link:', err);
      }
    }

    // Fallback: Open wa.me link
    const link = whatsappReminderLink(phone, patName, dateFormatted, timeFormatted, clinic.name, clinic.phone);
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
          <div className="card space-y-4">
            {/* Header: Date Title & Stats + Quick Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {formatLongDateShort(selectedDate)}
                </h2>
                <p className="text-xs font-medium text-slate-600 mt-0.5">
                  <span className="font-bold text-slate-900">{patientQueueGroups.length}</span> unique patient{patientQueueGroups.length !== 1 ? 's' : ''} · <span className="font-bold text-slate-900">{dayStats.total}</span> total booking{dayStats.total !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Quick Search */}
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={dayTab === 'queue' ? 'Filter patient, phone, doctor...' : 'Filter token, name, phone...'}
                  value={daySearch}
                  onChange={(e) => setDaySearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-600 shadow-2xs transition"
                />
                {daySearch && (
                  <button
                    type="button"
                    onClick={() => setDaySearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* View Mode Tabs: Patient Queue vs All Appointments (Token-wise) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t border-slate-100">
              <div className="inline-flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDayTab('queue')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    dayTab === 'queue'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users size={14} className={dayTab === 'queue' ? 'text-teal-700' : 'text-slate-400'} />
                  <span>Patient Queue</span>
                  <span className="text-[11px] font-semibold text-slate-500">({filteredPatientQueue.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDayTab('tokens')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    dayTab === 'tokens'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers size={14} className={dayTab === 'tokens' ? 'text-teal-700' : 'text-slate-400'} />
                  <span>All Appointments (Token-wise)</span>
                  <span className="text-[11px] font-semibold text-slate-500">({tokenWiseAppts.length})</span>
                </button>
              </div>

              {/* Status Sub-Filters (Clean Underlines, NO background colors, NO borders) */}
              <div className="flex items-center gap-5 text-xs overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setDayStatusFilter('all')}
                  className={`pb-1.5 font-bold whitespace-nowrap transition ${
                    dayStatusFilter === 'all'
                      ? 'border-b-2 border-slate-900 text-slate-900'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({dayTab === 'queue' ? patientQueueGroups.length : dayStats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setDayStatusFilter('waiting')}
                  className={`pb-1.5 font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                    dayStatusFilter === 'waiting'
                      ? 'border-b-2 border-amber-600 text-amber-800'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  Waiting in Queue ({dayStats.waiting})
                </button>
                <button
                  type="button"
                  onClick={() => setDayStatusFilter('done')}
                  className={`pb-1.5 font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                    dayStatusFilter === 'done'
                      ? 'border-b-2 border-emerald-600 text-emerald-800'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                  Completed ({dayStats.done})
                </button>
                <button
                  type="button"
                  onClick={() => setDayStatusFilter('cancelled')}
                  className={`pb-1.5 font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                    dayStatusFilter === 'cancelled'
                      ? 'border-b-2 border-slate-600 text-slate-800'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                  Cancelled ({dayStats.cancelled})
                </button>
              </div>
            </div>

            {/* Table / Queue Content */}
            {selectedAppts.length === 0 ? (
              <EmptyState icon={<CalendarDays size={18} />} title="No appointments this day" description="Book one above or set up as a walk-in." />
            ) : dayTab === 'queue' ? (
              /* TAB 1: PATIENT QUEUE (Deduplicated — Each patient shown once with upcoming appointment) */
              filteredPatientQueue.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm font-bold text-slate-800">No patients matching filter</p>
                  <p className="text-xs text-slate-500 mt-1">Try switching status tab or clearing the search query.</p>
                  <button
                    type="button"
                    onClick={() => { setDayStatusFilter('all'); setDaySearch(''); }}
                    className="btn-outline text-xs mt-3 px-3 py-1 font-semibold"
                  >
                    Reset Filter
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-2xs">
                  {/* Table Header */}
                  <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 bg-slate-100/90 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <div className="col-span-1">Token</div>
                    <div className="col-span-2">Time & Type</div>
                    <div className="col-span-3">Patient</div>
                    <div className="col-span-2">Doctor</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-100">
                    {filteredPatientQueue.map((group) => {
                      const upcoming = group.upcomingAppt;
                      const upcomingId = upcoming.appointment_id || upcoming.appt_id || '';
                      const isWaiting = upcoming.status !== 'done' && upcoming.status !== 'cancelled';
                      const isDone = upcoming.status === 'done';
                      const isCancelled = upcoming.status === 'cancelled';
                      const isCompleting = completingId === upcomingId;
                      const isExpanded = expandedPatientKey === group.key;

                      const docDisplay = (upcoming.doctor as any)?.name ?? (upcoming as any).doctor_name ?? doctors.find(d => d.id === upcoming.doctor_id)?.name ?? 'Doctor';

                      return (
                        <div
                          key={group.key}
                          className={`transition-colors ${
                            isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/40'
                          } ${!group.hasWaiting && group.doneCount === 0 ? 'opacity-65' : ''}`}
                        >
                          {/* Row: Single Patient with Upcoming Slot */}
                          <div
                            className="grid grid-cols-12 gap-3 px-4 py-3 items-center cursor-pointer"
                            onClick={() => setExpandedPatientKey(isExpanded ? null : group.key)}
                          >
                            {/* Token */}
                            <div className="col-span-3 md:col-span-1">
                              <span className="font-mono font-bold text-xs text-teal-800 tracking-tight">
                                {formatDisplayToken(upcoming.display_token, upcoming.token_number)}
                              </span>
                            </div>

                            {/* Time & Type */}
                            <div className="col-span-4 md:col-span-2">
                              <span className={`font-mono text-xs ${isCancelled ? 'line-through text-slate-400' : 'font-bold text-slate-900'}`}>
                                {formatTime(upcoming.time_slot)}
                              </span>
                              <span className="text-[11px] text-slate-600 block font-medium">
                                {getApptTypeLabel(upcoming)}
                              </span>
                            </div>

                            {/* Patient & Booking Summary */}
                            <div className="col-span-5 md:col-span-3 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-slate-900 hover:text-teal-700 transition truncate">
                                  {group.patientName}
                                </span>
                                {group.totalBookings > 1 && (
                                  <span className="text-xs font-semibold text-indigo-700 whitespace-nowrap">
                                    • {group.totalBookings} bookings today
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 truncate mt-0.5">
                                {upcoming.reason || 'General consultation'}
                              </p>
                            </div>

                            {/* Doctor */}
                            <div className="hidden md:block col-span-2 min-w-0">
                              <span className="text-xs text-slate-800 font-bold truncate block">
                                {docDisplay.startsWith('Dr.') ? docDisplay : `Dr. ${docDisplay}`}
                              </span>
                            </div>

                            {/* Status */}
                            <div className="col-span-6 md:col-span-2">
                              {isWaiting ? (
                                <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                  </span>
                                  Waiting in Queue
                                </span>
                              ) : isDone ? (
                                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                                  Completed
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 line-through">
                                  <span className="h-2 w-2 rounded-full bg-slate-300"></span>
                                  Cancelled
                                </span>
                              )}
                            </div>

                            {/* Actions: Info button + Complete button */}
                            <div
                              className="col-span-6 md:col-span-2 flex items-center justify-end gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isWaiting && (
                                <button
                                  type="button"
                                  onClick={() => completeAppointment(upcoming)}
                                  disabled={isCompleting}
                                  className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs py-1.5 px-3 rounded-lg shadow-2xs transition disabled:opacity-50"
                                  title="Mark upcoming appointment as completed"
                                >
                                  {isCompleting ? '...' : 'Complete'}
                                </button>
                              )}

                              {/* Info Button */}
                              <button
                                type="button"
                                onClick={() => setExpandedPatientKey(isExpanded ? null : group.key)}
                                className={`text-xs py-1.5 px-2.5 rounded-lg font-semibold flex items-center gap-1.5 transition border ${
                                  isExpanded
                                    ? 'bg-slate-200 border-slate-300 text-slate-900 shadow-inner'
                                    : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
                                }`}
                                title="View patient booking timeline and details"
                              >
                                <Info size={13} className="text-teal-700" />
                                <span>Info</span>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            </div>
                          </div>

                          {/* EXPANDED INFO & CHRONOLOGICAL TIMELINE PANEL */}
                          {isExpanded && (
                            <div className="px-5 py-4 bg-slate-50/90 border-t border-slate-200/90 text-xs space-y-4">
                              {/* Details Grid (STRICT RULE: NO background colors, NO borders on labels!) */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Patient Contact</span>
                                  <p className="font-bold text-slate-900 text-xs mt-1">{group.patientPhone || 'No phone on file'}</p>
                                  <p className="text-slate-600 text-xs mt-0.5">{group.patientEmail || 'No email on file'}</p>
                                </div>

                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Attendant / Guardian</span>
                                  <p className="font-bold text-slate-900 text-xs mt-1">{group.attendantName || 'None listed'}</p>
                                  {group.attendantPhone && <p className="text-slate-600 text-xs font-mono mt-0.5">{group.attendantPhone}</p>}
                                </div>

                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Attending Doctor</span>
                                  <p className="font-bold text-slate-900 text-xs mt-1">{docDisplay.startsWith('Dr.') ? docDisplay : `Dr. ${docDisplay}`}</p>
                                  <p className="text-slate-600 text-xs mt-0.5">Active Slot: {formatDate(upcoming.date)} at {formatTime(upcoming.time_slot)}</p>
                                </div>

                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Upcoming Visit Reason</span>
                                  <p className="font-bold text-slate-900 text-xs mt-1">{upcoming.reason || 'General consultation'}</p>
                                  {isCancelled && ((upcoming as any).cancellation_reason || (upcoming as any).cancelled_reason) && (
                                    <p className="text-rose-700 text-xs font-medium mt-0.5">Cancellation reason: {(upcoming as any).cancellation_reason || (upcoming as any).cancelled_reason}</p>
                                  )}
                                </div>
                              </div>

                              {/* Complete Event Chronology: When he booked the first one, when cancelled, every event in detail */}
                              <div className="pt-3 border-t border-slate-200">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
                                  Event Chronology & Bookings Today ({group.allAppts.length})
                                </span>

                                <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                                  {group.allAppts.map((appt, idx) => {
                                    const isApptWaiting = appt.status !== 'done' && appt.status !== 'cancelled';
                                    const isApptDone = appt.status === 'done';
                                    const isApptCancelled = appt.status === 'cancelled';
                                    const apptDoc = (appt.doctor as any)?.name ?? (appt as any).doctor_name ?? doctors.find(d => d.id === appt.doctor_id)?.name ?? 'Doctor';
                                    const cancelReason = (appt as any).cancellation_reason || (appt as any).cancelled_reason || (appt as any).cancel_reason || '';
                                    const bookedAtTime = formatEventTime(appt.created_at || (appt as any).booked_at);
                                    const completedAtTime = formatEventTime((appt as any).completed_at);
                                    const cancelledAtTime = formatEventTime((appt as any).cancelled_at);

                                    return (
                                      <div key={appt.appointment_id || appt.appt_id || idx} className="relative">
                                        {/* Marker dot */}
                                        <div className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-xs ${
                                          isApptDone ? 'bg-emerald-500' : isApptCancelled ? 'bg-rose-500' : 'bg-amber-500 ring-2 ring-amber-200'
                                        }`} />

                                        <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                                          <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-mono font-bold text-xs text-slate-900">{formatTime(appt.time_slot)}</span>
                                              <span className="font-mono font-bold text-xs text-teal-800">{formatDisplayToken(appt.display_token, appt.token_number)}</span>
                                              <span className="text-xs text-slate-600 font-medium">
                                                {getApptTypeLabel(appt) === 'Online' ? 'Online Booking' : 'Walk-in'}
                                              </span>
                                              <span className="text-xs text-slate-500">• Slot {idx + 1} of {group.allAppts.length}</span>
                                            </div>

                                            <div>
                                              {isApptDone ? (
                                                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                                                  <CheckCircle2 size={13} className="text-emerald-600" /> Completed
                                                </span>
                                              ) : isApptCancelled ? (
                                                <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                                                  <X size={13} className="text-rose-600" /> Cancelled
                                                </span>
                                              ) : (
                                                <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                                                  <Clock size={13} className="text-amber-600" /> Waiting in Queue
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-3 text-xs text-slate-700 flex-wrap pt-0.5">
                                            <span><strong className="text-slate-900 font-semibold">Reason:</strong> {appt.reason || 'General consultation'}</span>
                                            <span><strong className="text-slate-900 font-semibold">Doctor:</strong> {apptDoc.startsWith('Dr.') ? apptDoc : `Dr. ${apptDoc}`}</span>
                                            {bookedAtTime && <span className="text-slate-500">Booked at {bookedAtTime}</span>}
                                            {completedAtTime && <span className="text-emerald-700 font-medium">Finished at {completedAtTime}</span>}
                                            {cancelledAtTime && <span className="text-rose-600 font-medium">Cancelled at {cancelledAtTime}</span>}
                                          </div>

                                          {isApptCancelled && cancelReason && (
                                            <p className="text-xs text-rose-700 pt-0.5 font-medium">
                                              Cancellation Reason: {cancelReason}
                                            </p>
                                          )}
                                          {(appt as any).rescheduled && (
                                            <p className="text-xs text-indigo-700 pt-0.5 font-medium">
                                              Rescheduled from {(appt as any).rescheduled_from_time} • {(appt as any).reschedule_reason}
                                            </p>
                                          )}

                                          {/* Direct Slot Actions if waiting in queue */}
                                          {isApptWaiting && (
                                            <div className="flex items-center gap-2 pt-2 mt-1.5 border-t border-slate-100 flex-wrap">
                                              <button
                                                type="button"
                                                onClick={() => completeAppointment(appt)}
                                                disabled={completingId === (appt.appointment_id || appt.appt_id)}
                                                className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-[11px] py-1 px-2.5 rounded-md shadow-2xs transition disabled:opacity-50 flex items-center gap-1"
                                                title="Mark this slot as completed"
                                              >
                                                <CheckCircle size={12} />
                                                {completingId === (appt.appointment_id || appt.appt_id) ? '...' : 'Complete Slot'}
                                              </button>
                                              <RescheduleApptButton
                                                appt={appt}
                                                onDone={refresh}
                                                className="btn-ghost text-[11px] py-1 px-2 text-slate-700 hover:text-teal-700 flex items-center gap-1 font-semibold"
                                              />
                                              <CancelApptButton
                                                appt={appt}
                                                onDone={refresh}
                                                className="btn-ghost text-[11px] py-1 px-2 text-rose-600 hover:bg-rose-50 flex items-center gap-1 font-semibold"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Action Buttons in Info Panel */}
                              <div className="pt-3 flex items-center gap-2 flex-wrap border-t border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPatientForModal(group.patient || { patient_id: group.patientId, name: group.patientName, phone: group.patientPhone })}
                                  className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 font-semibold"
                                >
                                  <FolderHeart size={13} className="text-teal-700" /> Medical Records
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onRemind(upcoming, group.patient)}
                                  className="btn-ghost text-xs py-1.5 px-3 text-slate-800 hover:text-emerald-800 flex items-center gap-1.5 font-semibold"
                                >
                                  <MessageCircle size={13} className="text-emerald-600" /> WhatsApp Remind
                                </button>

                                {upcoming.ai_summary && (
                                  <button
                                    type="button"
                                    onClick={() => setSummaryAppt(upcoming)}
                                    className="btn-ghost text-xs py-1.5 px-2.5 text-purple-700 flex items-center gap-1.5 font-semibold"
                                  >
                                    <Sparkles size={13} /> AI Summary
                                  </button>
                                )}

                                {!patients.some(p => p.patient_id === group.patientId) && (
                                  <button
                                    type="button"
                                    onClick={() => addToClinic(upcoming, group.patient)}
                                    className="btn-ghost text-xs py-1.5 px-2.5 text-teal-700 ml-auto font-semibold"
                                  >
                                    <Plus size={13} /> Save to Clinic CRM
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ) : (
              /* TAB 2: ALL APPOINTMENTS (TOKEN-WISE) */
              tokenWiseAppts.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm font-bold text-slate-800">No appointments matching filter</p>
                  <p className="text-xs text-slate-500 mt-1">Try switching status tab or clearing the search query.</p>
                  <button
                    type="button"
                    onClick={() => { setDayStatusFilter('all'); setDaySearch(''); }}
                    className="btn-outline text-xs mt-3 px-3 py-1 font-semibold"
                  >
                    Reset Filter
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-2xs">
                  {/* Table Header */}
                  <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 bg-slate-100/90 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <div className="col-span-1">Token</div>
                    <div className="col-span-2">Time & Type</div>
                    <div className="col-span-3">Patient</div>
                    <div className="col-span-2">Doctor</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-100">
                    {tokenWiseAppts.map((a) => {
                      const apptId = a.appointment_id || a.appt_id || '';
                      const patient = a.patient || patients.find((p) => p.patient_id === a.patient_id);
                      const patientName = patient?.name || (a as any).patient_name || 'Patient';
                      const patientPhone = patient?.phone || (a as any).patient_phone || (a as any).phone || '';
                      const patientEmail = patient?.email || (a as any).patient_email || '';
                      const attendantName = (patient as any)?.emergency_contact_name || (patient as any)?.attendant_name || (a as any)?.emergency_contact_name || (a as any)?.attendant_name || '';
                      const attendantPhone = (patient as any)?.emergency_contact_phone || (patient as any)?.attendant_phone || (a as any)?.emergency_contact_phone || (a as any)?.attendant_phone || '';

                      const isWaiting = a.status !== 'done' && a.status !== 'cancelled';
                      const isDone = a.status === 'done';
                      const isCancelled = a.status === 'cancelled';
                      const isCompleting = completingId === apptId;
                      const isExpanded = expandedApptId === apptId;

                      const docDisplay = (a.doctor as any)?.name ?? (a as any).doctor_name ?? doctors.find(d => d.id === a.doctor_id)?.name ?? 'Doctor';

                      return (
                        <div
                          key={apptId}
                          className={`transition-colors ${
                            isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/40'
                          } ${isCancelled ? 'opacity-65' : ''}`}
                        >
                          <div
                            className="grid grid-cols-12 gap-3 px-4 py-3 items-center cursor-pointer"
                            onClick={() => setExpandedApptId(isExpanded ? null : apptId)}
                          >
                            {/* Token */}
                            <div className="col-span-3 md:col-span-1">
                              <span className="font-mono font-bold text-xs text-teal-800 tracking-tight">
                                {formatDisplayToken(a.display_token, a.token_number)}
                              </span>
                            </div>

                            {/* Time & Type */}
                            <div className="col-span-4 md:col-span-2">
                              <span className={`font-mono text-xs ${isCancelled ? 'line-through text-slate-400' : 'font-bold text-slate-900'}`}>
                                {formatTime(a.time_slot)}
                              </span>
                              <span className="text-[11px] text-slate-600 block font-medium">
                                {getApptTypeLabel(a)}
                              </span>
                            </div>

                            {/* Patient */}
                            <div className="col-span-5 md:col-span-3 min-w-0">
                              <span className="text-sm font-bold text-slate-900 hover:text-teal-700 transition truncate block">
                                {patientName}
                              </span>
                              <p className="text-xs text-slate-600 truncate mt-0.5">
                                {a.reason || 'Consultation'}
                              </p>
                            </div>

                            {/* Doctor */}
                            <div className="hidden md:block col-span-2 min-w-0">
                              <span className="text-xs text-slate-800 font-bold truncate block">
                                {docDisplay.startsWith('Dr.') ? docDisplay : `Dr. ${docDisplay}`}
                              </span>
                            </div>

                            {/* Status */}
                            <div className="col-span-6 md:col-span-2">
                              {isWaiting ? (
                                <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                  </span>
                                  Waiting in Queue
                                </span>
                              ) : isDone ? (
                                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                                  Completed
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 line-through">
                                  <span className="h-2 w-2 rounded-full bg-slate-300"></span>
                                  Cancelled
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div
                              className="col-span-6 md:col-span-2 flex items-center justify-end gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isWaiting && (
                                <button
                                  type="button"
                                  onClick={() => completeAppointment(a)}
                                  disabled={isCompleting}
                                  className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs py-1.5 px-3 rounded-lg shadow-2xs transition disabled:opacity-50"
                                  title="Mark appointment as completed"
                                >
                                  {isCompleting ? '...' : 'Complete'}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setExpandedApptId(isExpanded ? null : apptId)}
                                className={`text-xs py-1.5 px-2.5 rounded-lg font-semibold flex items-center gap-1.5 transition border ${
                                  isExpanded
                                    ? 'bg-slate-200 border-slate-300 text-slate-900 shadow-inner'
                                    : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
                                }`}
                                title="View appointment info"
                              >
                                <Info size={13} className="text-teal-700" />
                                <span>Info</span>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Info for Token-wise view */}
                          {isExpanded && (
                            <div className="px-5 py-4 bg-slate-50/90 border-t border-slate-200/90 text-xs space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Patient Contact</span>
                                  <p className="font-bold text-slate-900 text-xs mt-1">{patientPhone || 'No phone on file'}</p>
                                  <p className="text-slate-600 text-xs mt-0.5">{patientEmail || 'No email on file'}</p>
                                </div>

                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Attendant / Guardian</span>
                                  <p className="font-bold text-slate-900 text-xs mt-1">{attendantName || 'None listed'}</p>
                                  {attendantPhone && <p className="text-slate-600 text-xs font-mono mt-0.5">{attendantPhone}</p>}
                                </div>

                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Attending Doctor</span>
                                  <p className="font-bold text-slate-900 text-xs mt-1">{docDisplay.startsWith('Dr.') ? docDisplay : `Dr. ${docDisplay}`}</p>
                                  <p className="text-slate-600 text-xs mt-0.5">{formatDate(a.date)} at {formatTime(a.time_slot)}</p>
                                </div>

                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Visit Reason</span>
                                  <p className="font-bold text-slate-900 text-xs mt-1">{a.reason || 'General consultation'}</p>
                                  {isCancelled && ((a as any).cancellation_reason || (a as any).cancelled_reason) && (
                                    <p className="text-rose-700 text-xs font-medium mt-0.5">Cancellation reason: {(a as any).cancellation_reason || (a as any).cancelled_reason}</p>
                                  )}
                                </div>
                              </div>

                              <div className="pt-3 flex items-center gap-2 flex-wrap border-t border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPatientForModal(patient || { patient_id: a.patient_id, name: patientName, phone: patientPhone })}
                                  className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 font-semibold"
                                >
                                  <FolderHeart size={13} className="text-teal-700" /> Medical Records
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onRemind(a, patient)}
                                  className="btn-ghost text-xs py-1.5 px-3 text-slate-800 hover:text-emerald-800 flex items-center gap-1.5 font-semibold"
                                >
                                  <MessageCircle size={13} className="text-emerald-600" /> WhatsApp Remind
                                </button>

                                {isWaiting && (
                                  <>
                                    <RescheduleApptButton appt={a} onDone={refresh} />
                                    <CancelApptButton appt={a} onDone={refresh} />
                                  </>
                                )}

                                {a.ai_summary && (
                                  <button
                                    type="button"
                                    onClick={() => setSummaryAppt(a)}
                                    className="btn-ghost text-xs py-1.5 px-2.5 text-purple-700 flex items-center gap-1.5 font-semibold"
                                  >
                                    <Sparkles size={13} /> AI Summary
                                  </button>
                                )}

                                {!patients.some(p => p.patient_id === a.patient_id) && (
                                  <button
                                    type="button"
                                    onClick={() => addToClinic(a, patient)}
                                    className="btn-ghost text-xs py-1.5 px-2.5 text-teal-700 ml-auto font-semibold"
                                  >
                                    <Plus size={13} /> Save to Clinic CRM
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
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
                          {a.display_token && <span className="badge bg-primary/10 text-primary font-bold text-[10px]">{formatDisplayToken(a.display_token, a.token_number)}</span>}
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

                        {(patient?.phone || (a as any).patient_phone || (a as any).phone) && (
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

function formatEventTime(val: any): string {
  if (!val) return '';
  try {
    let dateObj: Date;
    if (typeof val === 'string') {
      dateObj = new Date(val);
    } else if (val && typeof val.toDate === 'function') {
      dateObj = val.toDate();
    } else if (val && val.seconds) {
      dateObj = new Date(val.seconds * 1000);
    } else {
      dateObj = new Date(val);
    }
    if (isNaN(dateObj.getTime())) return '';
    return dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

function CancelApptButton({
  appt,
  allWaitingAppts,
  onDone,
  className,
}: {
  appt?: Appointment;
  allWaitingAppts?: Appointment[];
  onDone: () => void;
  className?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('Patient requested cancellation');
  const [customReason, setCustomReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Available waiting appointments
  const waitingList = useMemo(() => {
    if (allWaitingAppts && allWaitingAppts.length > 0) {
      return allWaitingAppts.filter((a) => a.status !== 'done' && a.status !== 'cancelled');
    }
    if (appt && appt.status !== 'done' && appt.status !== 'cancelled') {
      return [appt];
    }
    return [];
  }, [allWaitingAppts, appt]);

  const [targetId, setTargetId] = useState<string>('all');

  useEffect(() => {
    if (open) {
      if (appt && (appt.appointment_id || appt.appt_id)) {
        setTargetId(appt.appointment_id || appt.appt_id || '');
      } else if (waitingList.length > 0) {
        setTargetId(waitingList[0].appointment_id || waitingList[0].appt_id || '');
      }
    }
  }, [open, appt, waitingList]);

  if (waitingList.length === 0) return null;

  const quickReasons = [
    'Patient requested cancellation',
    'Doctor unavailable / Emergency',
    'Patient no-show',
    'Scheduling conflict',
    'Other reason',
  ];

  const handleConfirmCancel = async () => {
    setSaving(true);
    const finalReason = reason === 'Other reason'
      ? (customReason.trim() || 'Cancelled per clinic request')
      : (customReason.trim() ? `${reason} (${customReason.trim()})` : reason);

    try {
      const toCancel: Appointment[] = targetId === 'all'
        ? waitingList
        : waitingList.filter((a) => (a.appointment_id || a.appt_id) === targetId);

      if (toCancel.length === 0) {
        toast('No appointment selected to cancel.', 'error');
        setSaving(false);
        return;
      }

      for (const item of toCancel) {
        const aId = item.appointment_id || item.appt_id;
        if (!aId) continue;
        await updateDoc(doc(db, 'appointments', aId), {
          status: 'cancelled',
          cancellation_reason: finalReason,
          cancelled_reason: finalReason,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        sendInstantAppointmentEmail(aId, 'appointment_cancelled');
      }

      toast(toCancel.length > 1 ? `${toCancel.length} appointments cancelled.` : 'Appointment cancelled.', 'success');
      setOpen(false);
      onDone();
    } catch (error) {
      toast('Unable to cancel. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const patientName = (appt as any)?.patient_name || appt?.patient?.name || (waitingList[0] as any)?.patient_name || waitingList[0]?.patient?.name || 'Patient';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || "btn-ghost text-xs py-1.5 px-3 text-rose-600 hover:bg-rose-50 flex items-center gap-1 font-semibold"}
        title="Cancel appointment"
      >
        <X size={13} />
        Cancel
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel Appointment"
        subtitle={`Patient: ${patientName} • ${waitingList.length} active waiting booking${waitingList.length > 1 ? 's' : ''}`}
        size="sm"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-ghost" disabled={saving}>
              Keep Appointment
            </button>
            <button
              disabled={saving}
              onClick={handleConfirmCancel}
              className="btn-danger flex items-center gap-1.5"
            >
              <X size={13} />
              {saving ? 'Cancelling…' : targetId === 'all' && waitingList.length > 1 ? `Cancel All (${waitingList.length})` : 'Confirm Cancel'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* If there are multiple waiting appointments, let user choose which one to cancel! */}
          {waitingList.length > 1 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Which appointment do you want to cancel? *
              </span>
              <div className="space-y-1.5">
                {waitingList.map((item) => {
                  const itemId = item.appointment_id || item.appt_id || '';
                  const isChecked = targetId === itemId;
                  const docName = (item.doctor as any)?.name ?? (item as any).doctor_name ?? 'Doctor';
                  return (
                    <label
                      key={itemId}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        isChecked ? 'border-rose-400 bg-rose-50/70 text-slate-900 font-semibold shadow-xs' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`cancel_target_${patientName}`}
                        checked={isChecked}
                        onChange={() => setTargetId(itemId)}
                        className="accent-rose-600 mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-teal-800 text-xs">{formatDisplayToken(item.display_token, item.token_number)}</span>
                          <span className="font-mono font-bold text-slate-900 text-xs">{formatTime(item.time_slot)}</span>
                          <span className="text-slate-500 font-normal">({getApptTypeLabel(item)})</span>
                        </div>
                        <p className="text-xs text-slate-600 font-normal mt-0.5">
                          <strong>Reason:</strong> {item.reason || 'General'} • <strong>Doctor:</strong> {docName.startsWith('Dr.') ? docName : `Dr. ${docName}`}
                        </p>
                      </div>
                    </label>
                  );
                })}

                <label
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                    targetId === 'all' ? 'border-rose-500 bg-rose-50 text-rose-900 font-bold shadow-xs' : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                  }`}
                >
                  <input
                    type="radio"
                    name={`cancel_target_${patientName}`}
                    checked={targetId === 'all'}
                    onChange={() => setTargetId('all')}
                    className="accent-rose-600"
                  />
                  <span>Cancel ALL {waitingList.length} waiting appointments for {patientName}</span>
                </label>
              </div>
            </div>
          )}

          {waitingList.length === 1 && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-0.5">
              <div className="flex items-center gap-2 font-mono font-bold text-slate-900">
                <span className="text-teal-800">{formatDisplayToken(waitingList[0].display_token, waitingList[0].token_number)}</span>
                <span>{formatTime(waitingList[0].time_slot)}</span>
                <span className="text-slate-500 font-normal">({getApptTypeLabel(waitingList[0])})</span>
              </div>
              <p className="text-slate-600">Reason: {waitingList[0].reason || 'General consultation'}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Reason for Cancellation
            </span>
            <div className="space-y-1.5">
              {quickReasons.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                    reason === r ? 'border-rose-300 bg-rose-50/50 text-rose-800 font-medium' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name={`cancel_reason_${targetId}`}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-rose-600"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
              {reason === 'Other reason' ? 'Specify Reason *' : 'Additional Notes (optional)'}
            </span>
            <input
              type="text"
              placeholder={reason === 'Other reason' ? 'e.g. Clinic closed due to weather' : 'Optional note for the patient'}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="input text-xs w-full"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

function RescheduleApptButton({
  appt,
  allWaitingAppts,
  onDone,
  className,
}: {
  appt?: Appointment;
  allWaitingAppts?: Appointment[];
  onDone: () => void;
  className?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Available waiting appointments
  const waitingList = useMemo(() => {
    if (allWaitingAppts && allWaitingAppts.length > 0) {
      return allWaitingAppts.filter((a) => a.status !== 'done' && a.status !== 'cancelled');
    }
    if (appt && appt.status !== 'done' && appt.status !== 'cancelled') {
      return [appt];
    }
    return [];
  }, [allWaitingAppts, appt]);

  const [selectedApptId, setSelectedApptId] = useState<string>('');

  useEffect(() => {
    if (open) {
      if (appt && (appt.appointment_id || appt.appt_id)) {
        setSelectedApptId(appt.appointment_id || appt.appt_id || '');
      } else if (waitingList.length > 0) {
        setSelectedApptId(waitingList[0].appointment_id || waitingList[0].appt_id || '');
      }
    }
  }, [open, appt, waitingList]);

  const currentAppt = waitingList.find((a) => (a.appointment_id || a.appt_id) === selectedApptId) || waitingList[0];

  const [date, setDate] = useState(currentAppt?.date || todayISO());
  const [time, setTime] = useState(currentAppt?.time_slot || '');
  const [reason, setReason] = useState('Patient requested reschedule');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (currentAppt) {
      setDate(currentAppt.date);
      setTime(currentAppt.time_slot);
    }
  }, [selectedApptId]);

  if (waitingList.length === 0) return null;

  const quickReasons = [
    'Patient requested reschedule',
    'Doctor schedule change',
    'Clinic timing update',
    'Doctor emergency / unavailable',
    'Other reason',
  ];

  const handleConfirmReschedule = async () => {
    if (!currentAppt) return;
    const apptId = currentAppt.appointment_id || currentAppt.appt_id || (currentAppt as any).id;
    if (!apptId) {
      toast('Appointment reference not found.', 'error');
      return;
    }

    setSaving(true);
    const finalReason = reason === 'Other reason'
      ? (customReason.trim() || 'Schedule update')
      : (customReason.trim() ? `${reason} (${customReason.trim()})` : reason);

    try {
      await updateDoc(doc(db, 'appointments', apptId), {
        date,
        time_slot: time,
        status: 'waiting',
        rescheduled: true,
        reschedule_reason: finalReason,
        rescheduled_at: new Date().toISOString(),
        rescheduled_from_date: currentAppt.date,
        rescheduled_from_time: currentAppt.time_slot,
        updated_at: new Date().toISOString(),
      });
      sendInstantAppointmentEmail(apptId, 'appointment_rescheduled');
      toast(`Appointment rescheduled to ${formatDate(date)} at ${formatTime(time)}.`, 'success');
      setOpen(false);
      onDone();
    } catch (error) {
      toast('Unable to reschedule. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const patientName = (currentAppt as any)?.patient_name || currentAppt?.patient?.name || 'Patient';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || "btn-ghost text-xs py-1.5 px-3 flex items-center gap-1 font-semibold text-slate-800 hover:text-teal-700"}
        title="Reschedule appointment"
      >
        <Clock size={13} />
        Reschedule
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reschedule Appointment"
        subtitle={`Patient: ${patientName} • Current: ${formatDate(currentAppt?.date || '')} at ${formatTime(currentAppt?.time_slot || '')}`}
        size="sm"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-ghost" disabled={saving}>
              Close
            </button>
            <button
              disabled={saving || !date || !time}
              onClick={handleConfirmReschedule}
              className="btn-primary flex items-center gap-1.5"
            >
              <Clock size={13} />
              {saving ? 'Saving…' : 'Confirm Reschedule'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {waitingList.length > 1 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Which appointment do you want to reschedule? *
              </span>
              <div className="space-y-1.5">
                {waitingList.map((item) => {
                  const itemId = item.appointment_id || item.appt_id || '';
                  const isChecked = selectedApptId === itemId;
                  const docName = (item.doctor as any)?.name ?? (item as any).doctor_name ?? 'Doctor';
                  return (
                    <label
                      key={itemId}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        isChecked ? 'border-teal-600 bg-teal-50/70 text-slate-900 font-semibold shadow-xs' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`reschedule_target_${patientName}`}
                        checked={isChecked}
                        onChange={() => setSelectedApptId(itemId)}
                        className="accent-teal-700 mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-teal-800 text-xs">{formatDisplayToken(item.display_token, item.token_number)}</span>
                          <span className="font-mono font-bold text-slate-900 text-xs">{formatTime(item.time_slot)}</span>
                          <span className="text-slate-500 font-normal">({getApptTypeLabel(item)})</span>
                        </div>
                        <p className="text-xs text-slate-600 font-normal mt-0.5">
                          <strong>Reason:</strong> {item.reason || 'General'} • <strong>Doctor:</strong> {docName.startsWith('Dr.') ? docName : `Dr. ${docName}`}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">New Date</span>
            <input
              type="date"
              min={todayISO()}
              className="input text-xs w-full"
              value={formatDobForInput(date)}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">New Time Slot</span>
            <input
              type="time"
              className="input text-xs w-full"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Reason for Rescheduling</span>
            <div className="space-y-1.5">
              {quickReasons.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                    reason === r ? 'border-teal-600 bg-teal-50/50 text-teal-900 font-medium' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name={`reschedule_reason_${selectedApptId}`}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-teal-700"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
              {reason === 'Other reason' ? 'Specify Reason *' : 'Additional Notes (optional)'}
            </span>
            <input
              type="text"
              placeholder={reason === 'Other reason' ? 'e.g. Clinic maintenance or doctor conference' : 'Optional note for the patient'}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="input text-xs w-full"
            />
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
  const [visitType, setVisitType] = useState<'new-visit' | 'follow-up' | 'report-discussion'>('new-visit');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const availableDoctors = useMemo(() => {
    let list = [...doctors];
    if (currentUser?.name) {
      const exists = list.some(d => 
        (d.id && currentUser.id && d.id === currentUser.id) ||
        ((d as any).user_id && currentUser.id && (d as any).user_id === currentUser.id) ||
        (d.name && d.name.toLowerCase().includes(currentUser.name.toLowerCase()))
      );
      if (!exists) {
        list.unshift({
          id: currentUser.id || (currentUser as any).user_id || 'current_user',
          name: currentUser.name,
          role: 'clinic_doctor',
          active: true,
        } as unknown as U);
      }
    }

    const named = list.filter(d => {
      const n = (d.name || '').trim().toLowerCase();
      return n !== 'clinic doctor' && n !== 'doctor' && n !== 'admin';
    });

    if (named.length > 0) return named;

    if (currentUser?.name) {
      return [{
        id: currentUser.id || (currentUser as any).user_id || 'current_user',
        name: currentUser.name,
        role: 'clinic_doctor',
        active: true,
      } as unknown as U];
    }
    return list;
  }, [doctors, currentUser]);

  // Set default doctor when doctors list loads
  useEffect(() => {
    if (availableDoctors.length > 0) {
      const currentDoc = currentUser
        ? availableDoctors.find(d => 
            d.id === currentUser.id || 
            (d as any).user_id === currentUser.id || 
            (d as any).uid === currentUser.id ||
            (d.name && currentUser.name && d.name.toLowerCase() === currentUser.name.toLowerCase())
          )
        : null;

      if (currentDoc) {
        setDoctorId(currentDoc.id!);
      } else if (!doctorId || !availableDoctors.some(d => d.id === doctorId)) {
        setDoctorId(availableDoctors[0].id!);
      }
    }
  }, [availableDoctors, currentUser]);

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

      const patObj = patients.find(p => p.patient_id === patientId);
      const selectedDoc = availableDoctors.find(d => d.id === doctorId);
      const docName = selectedDoc?.name || (currentUser?.name ? currentUser.name : 'Doctor');
      const cleanDoc = docName.replace(/^(Dr\.?|Doctor)\s+/i, '').trim();

      const apptRef = doc(collection(db, 'appointments'));
      await setDoc(apptRef, {
        clinic_id: clinicId,
        patient_id: patientId,
        patient_phone: patObj?.phone || null,
        patient_name: patObj?.name || patientQuery || null,
        doctor_id: doctorId || null,
        doctor_name: cleanDoc ? `Dr. ${cleanDoc}` : 'Doctor',
        date,
        time_slot: time,
        type,
        visit_type: visitType,
        status: 'waiting',
        reason: reason || null,
        token_number: nextToken,
        display_token: 'MN-' + String(nextToken).padStart(3, '0'),
        booked_via: 'manual',
        triage_level: 'normal',
        appt_id: apptRef.id,
        appointment_id: apptRef.id,
        created_at: serverTimestamp()
      });
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Schedule Type</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as 'walk-in' | 'scheduled')}>
              <option value="scheduled">Scheduled</option>
              <option value="walk-in">Walk-in</option>
            </select>
          </div>
          <div>
            <label className="label">Consultation Purpose</label>
            <select className="select" value={visitType} onChange={(e) => setVisitType(e.target.value as any)}>
              <option value="new-visit">New Visit</option>
              <option value="follow-up">Follow-up Consultation</option>
              <option value="report-discussion">Report / Diagnostic Review</option>
            </select>
          </div>
          <div>
            <label className="label text-xs font-semibold text-ink">Attending Doctor *</label>
            <select className="select text-xs w-full font-medium" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {availableDoctors.length === 0 && <option value="">No doctors available</option>}
              {availableDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name?.startsWith('Dr.') ? d.name : `Dr. ${d.name}`} {d.specialisation ? `— ${d.specialisation}` : ''}
                </option>
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
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [bloodGroup, setBloodGroup] = useState('Unknown');
  const [attendantName, setAttendantName] = useState('');
  const [attendantPhone, setAttendantPhone] = useState('');
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
      } else {
        setPatientAge('');
      }
    } else {
      setPatientAge('');
    }
  };

  const handleSelectPatient = (p: Patient) => {
    setPatientId(p.patient_id);
    setPatientSearch(p.name);
    setPatientPhone(p.phone || '');
    setPatientEmail(p.email || '');
    const dobFormatted = p.dob ? formatDobForInput(p.dob) : '';
    setPatientDob(dobFormatted);
    const computedAge = dobFormatted ? calculateAge(dobFormatted) : p.age;
    setPatientAge(computedAge !== null && computedAge !== undefined ? String(computedAge) : '');
    if (p.gender && ['Male', 'Female', 'Other'].includes(p.gender as any)) {
      setGender(p.gender as any);
    }
    if (p.blood_group) {
      setBloodGroup(p.blood_group);
    }
    setAttendantName(p.emergency_contact_name || (p as any).attendant_name || '');
    setAttendantPhone(p.emergency_contact_phone || (p as any).attendant_phone || (p as any).attender_phone || '');
  };

  const handleClearPatient = () => {
    setPatientId('');
    setPatientSearch('');
    setPatientPhone('');
    setPatientEmail('');
    setPatientDob('');
    setPatientAge('');
    setGender('Male');
    setBloodGroup('Unknown');
    setAttendantName('');
    setAttendantPhone('');
  };

  const availableDoctors = useMemo(() => {
    let list = [...doctors];
    if (currentUser?.name) {
      const exists = list.some(d => 
        (d.id && currentUser.id && d.id === currentUser.id) ||
        ((d as any).user_id && currentUser.id && (d as any).user_id === currentUser.id) ||
        (d.name && d.name.toLowerCase().includes(currentUser.name.toLowerCase()))
      );
      if (!exists) {
        list.unshift({
          id: currentUser.id || (currentUser as any).user_id || 'current_user',
          name: currentUser.name,
          role: 'clinic_doctor',
          active: true,
        } as unknown as U);
      }
    }

    const named = list.filter(d => {
      const n = (d.name || '').trim().toLowerCase();
      return n !== 'clinic doctor' && n !== 'doctor' && n !== 'admin';
    });

    if (named.length > 0) return named;

    if (currentUser?.name) {
      return [{
        id: currentUser.id || (currentUser as any).user_id || 'current_user',
        name: currentUser.name,
        role: 'clinic_doctor',
        active: true,
      } as unknown as U];
    }
    return list;
  }, [doctors, currentUser]);

  // Set default doctor when doctors list loads, prioritizing logged-in doctor/admin
  useEffect(() => {
    if (availableDoctors.length > 0) {
      const currentDoc = currentUser
        ? availableDoctors.find(d => 
            d.id === currentUser.id || 
            (d as any).user_id === currentUser.id || 
            (d as any).uid === currentUser.id ||
            (d.name && currentUser.name && d.name.toLowerCase() === currentUser.name.toLowerCase())
          )
        : null;

      if (currentDoc) {
        setDoctorId(currentDoc.id!);
      } else if (!doctorId || !availableDoctors.some(d => d.id === doctorId)) {
        setDoctorId(availableDoctors[0].id!);
      }
    }
  }, [availableDoctors, currentUser]);

  const filtered = !patientId && patientSearch.trim()
    ? patients.filter((p) => 
        p.name.toLowerCase().includes(patientSearch.toLowerCase()) || 
        (p.phone && p.phone.includes(patientSearch.trim()))
      ).slice(0, 5)
    : [];

  const submit = async () => {
    const finalPatientName = (patientSearch.trim() || patients.find((p) => p.patient_id === patientId)?.name || '').trim();
    if (!finalPatientName) {
      return toast('Please enter or select a patient name.', 'error');
    }

    const cleanPhone = patientPhone.replace(/[^\d]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      return toast('Please enter a valid 10-digit mobile phone number.', 'error');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!patientEmail.trim() || !emailRegex.test(patientEmail.trim())) {
      return toast('Please enter a valid patient email address (required).', 'error');
    }

    if (!attendantName.trim()) {
      return toast('Please enter the attendant / guardian name.', 'error');
    }

    const cleanAttendantPhone = attendantPhone.replace(/[^\d]/g, '');
    if (!cleanAttendantPhone || cleanAttendantPhone.length < 10) {
      return toast('Please enter a valid 10-digit attendant phone number.', 'error');
    }

    if (!patientDob) {
      return toast('Please provide the patient Date of Birth (DOB).', 'error');
    }

    if (!reason.trim()) {
      return toast('Please enter the reason for visit (required).', 'error');
    }

    if (!doctorId) {
      return toast('Please select an attending doctor.', 'error');
    }

    if (!date) return toast('Select appointment date.', 'error');
    if (!timeSlot) return toast('Select appointment time.', 'error');
    
    setSaving(true);
    
    try {
      let finalPatientId = patientId;
      const parsedAge = patientDob ? calculateAge(patientDob) : (patientAge ? parseInt(patientAge, 10) : null);

      if (!finalPatientId) {
        const patientCode = `PAT-${Math.floor(Math.random() * 9000) + 1000}`;
        const pRef = await addDoc(collection(db, 'patients'), {
          clinic_id: clinicId,
          name: finalPatientName,
          full_name: finalPatientName,
          phone: patientPhone.trim(),
          email: patientEmail.trim().toLowerCase(),
          dob: patientDob || null,
          age: parsedAge,
          gender: gender,
          blood_group: bloodGroup,
          emergency_contact_name: attendantName.trim(),
          attendant_name: attendantName.trim(),
          emergency_contact_phone: attendantPhone.trim(),
          attendant_phone: attendantPhone.trim(),
          attender_phone: attendantPhone.trim(),
          patient_code: patientCode,
          display_id: patientCode,
          id_number: patientCode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        await updateDoc(pRef, { patient_id: pRef.id });
        finalPatientId = pRef.id;
      } else {
        // Keep patient document updated with any new/modified details
        await updateDoc(doc(db, 'patients', finalPatientId), {
          phone: patientPhone.trim(),
          email: patientEmail.trim().toLowerCase(),
          emergency_contact_name: attendantName.trim(),
          attendant_name: attendantName.trim(),
          emergency_contact_phone: attendantPhone.trim(),
          attendant_phone: attendantPhone.trim(),
          attender_phone: attendantPhone.trim(),
          gender: gender,
          blood_group: bloodGroup,
          ...(patientDob ? { dob: patientDob } : {}),
          ...(parsedAge !== null ? { age: parsedAge } : {}),
          updated_at: new Date().toISOString(),
        }).catch(console.warn);
      }

      const q = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId), where('date', '==', date));
      const existingSnap = await getDocs(q);
      const existing = existingSnap.docs.map(d => d.data());
      const maxToken = existing.reduce((max, appt) => Math.max(max, appt.token_number || 0), 0);
      const nextToken = maxToken + 1;

      const selectedDoc = availableDoctors.find(d => d.id === doctorId);
      const docName = selectedDoc?.name || (currentUser?.name ? currentUser.name : 'Doctor');
      const cleanDoc = docName.replace(/^(Dr\.?|Doctor)\s+/i, '').trim();

      const apptRef = doc(collection(db, 'appointments'));
      await setDoc(apptRef, {
        clinic_id: clinicId,
        patient_id: finalPatientId,
        patient_phone: patientPhone.trim(),
        patient_name: finalPatientName,
        patient_email: patientEmail.trim().toLowerCase(),
        doctor_id: doctorId || null,
        doctor_name: cleanDoc ? `Dr. ${cleanDoc}` : 'Doctor',
        attendant_name: attendantName.trim(),
        emergency_contact_name: attendantName.trim(),
        attendant_phone: attendantPhone.trim(),
        emergency_contact_phone: attendantPhone.trim(),
        patient_dob: patientDob || null,
        patient_age: parsedAge,
        gender: gender,
        blood_group: bloodGroup,
        date: date,
        time_slot: timeSlot,
        type: 'walk-in',
        status: 'waiting',
        reason: reason.trim(),
        token_number: nextToken,
        display_token: 'WN-' + String(nextToken).padStart(3, '0'),
        booked_via: 'walk-in',
        triage_level: 'normal',
        appt_id: apptRef.id,
        appointment_id: apptRef.id,
        created_at: new Date().toISOString(),
      });
      sendInstantAppointmentEmail(apptRef.id, 'appointment_confirmed');

      toast(`Walk-in added to queue for Dr. ${cleanDoc || 'Doctor'}!`, 'success');
      handleClearPatient();
      setReason('');
      onSaved();
      onClose();
    } catch (error) {
      console.error('[WalkInModal] error:', error);
      toast('Unable to book walk-in appointment. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Walk-In Patient"
      subtitle="Registers patient and adds directly to today's queue"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary flex items-center gap-1.5">
            <Zap size={14} />
            {saving ? 'Adding to Queue…' : 'Add to Queue'}
          </button>
        </>
      }
    >
      <div className="space-y-3.5">
        {/* Patient Selection / Name */}
        <div>
          <label className="label text-xs font-semibold text-ink">Patient Full Name *</label>
          {patientId ? (
            <div className="flex items-center justify-between input bg-primary-50/40 border-primary/30">
              <span className="text-sm font-semibold text-ink flex items-center gap-1.5">
                <UserIcon size={14} className="text-primary" /> {patientSearch || patients.find((p) => p.patient_id === patientId)?.name}
              </span>
              <button
                type="button"
                onClick={handleClearPatient}
                className="text-xs text-ink-subtle hover:text-danger flex items-center gap-1 px-2 py-0.5 rounded hover:bg-black/5"
                title="Change patient"
              >
                <X size={13} /> Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="input text-sm w-full"
                placeholder="Type patient full name or search existing…"
              />
              {filtered.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100 max-h-44 overflow-y-auto">
                  {filtered.map((p) => (
                    <button
                      key={p.patient_id}
                      type="button"
                      onClick={() => handleSelectPatient(p)}
                      className="w-full text-left px-3 py-2 hover:bg-primary-50 transition flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-ink">{p.name}</span>
                        {p.phone && <span className="text-ink-muted ml-2">📞 {p.phone}</span>}
                      </div>
                      <span className="text-[10px] text-primary font-medium bg-primary-50 px-2 py-0.5 rounded">Existing Patient</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Gender (Radio buttons) & Blood Group */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 bg-slate-50/60 rounded-xl border border-slate-100">
          <div>
            <label className="label text-xs font-semibold text-ink mb-1.5">Gender *</label>
            <div className="flex items-center gap-4 mt-1">
              {(['Male', 'Female', 'Other'] as const).map((g) => (
                <label key={g} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-medium hover:text-primary">
                  <input
                    type="radio"
                    name="walkin_patient_gender"
                    value={g}
                    checked={gender === g}
                    onChange={() => setGender(g)}
                    className="accent-primary"
                  />
                  <span>{g}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label text-xs font-semibold text-ink mb-1">Blood Group *</label>
            <select
              className="select text-xs w-full bg-white"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
            >
              {['Unknown', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        {/* DOB & Age (Disabled input auto-computed from DOB) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs font-semibold text-ink">Date of Birth (DOB) *</label>
            <input
              type="date"
              max={localDateISO(new Date())}
              className="input text-xs w-full"
              value={formatDobForInput(patientDob)}
              onChange={(e) => handlePatientDobChange(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs font-semibold text-ink">
              Age (Years) * <span className="text-[10px] text-teal-700 font-normal">(Auto-calculated)</span>
            </label>
            <input
              type="text"
              disabled
              readOnly
              tabIndex={-1}
              className="input text-xs font-mono w-full bg-slate-100 text-slate-700 font-semibold cursor-not-allowed select-none border-slate-200"
              placeholder="Select DOB to compute age"
              value={patientAge ? `${patientAge} yrs` : '—'}
            />
          </div>
        </div>

        {/* Contact Details (Phone & Email mandatory) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs font-semibold text-ink">Patient Mobile Phone *</label>
            <input
              className="input text-xs w-full"
              value={patientPhone}
              onChange={(e) => setPatientPhone(e.target.value)}
              placeholder="10-digit mobile number"
            />
          </div>
          <div>
            <label className="label text-xs font-semibold text-ink">Patient Email Address *</label>
            <input
              className="input text-xs w-full"
              type="email"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              placeholder="patient@example.com"
            />
          </div>
        </div>

        {/* Attendant Details (Name & Phone mandatory) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs font-semibold text-ink">Attendant / Guardian Name *</label>
            <input
              className="input text-xs w-full"
              value={attendantName}
              onChange={(e) => setAttendantName(e.target.value)}
              placeholder="e.g. Spouse, Parent, Attendant"
            />
          </div>
          <div>
            <label className="label text-xs font-semibold text-ink">Attendant Mobile Phone *</label>
            <input
              className="input text-xs w-full"
              value={attendantPhone}
              onChange={(e) => setAttendantPhone(e.target.value)}
              placeholder="10-digit attendant phone"
            />
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs font-semibold text-ink">Appointment Date *</label>
            <input
              type="date"
              min={todayISO()}
              className="input text-xs w-full"
              value={formatDobForInput(date)}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs font-semibold text-ink">Time Slot *</label>
            <input
              type="time"
              className="input text-xs w-full"
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
            />
          </div>
        </div>

        {/* Reason for Visit (Mandatory) */}
        <div>
          <label className="label text-xs font-semibold text-ink">Reason for Visit *</label>
          <input
            className="input text-xs w-full"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Acute fever, cough, routine checkup"
          />
        </div>

        {/* Attending Doctor */}
        <div>
          <label className="label text-xs font-semibold text-ink">Attending Doctor *</label>
          <select
            className="select text-xs w-full font-medium"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            {availableDoctors.length === 0 && <option value="">No doctors available</option>}
            {availableDoctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name?.startsWith('Dr.') ? d.name : `Dr. ${d.name}`} {d.specialisation ? `— ${d.specialisation}` : ''}
              </option>
            ))}
          </select>
          {currentUser && (
            <p className="text-[11px] text-ink-subtle flex items-center gap-1 mt-1">
              <Stethoscope size={11} className="text-primary" /> Logged in as: <strong>{currentUser.name}</strong>
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
