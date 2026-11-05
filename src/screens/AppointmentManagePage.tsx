import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { sendInstantAppointmentEmail } from '../lib/emailService';
import { formatDate, formatLongDate, localDateISO, formatDobForInput } from '../lib/format';

type Appointment = {
  appt_id: string;
  appointment_id: string;
  display_token?: string;
  token_number?: number;
  date: string;
  time_slot?: string;
  status: string;
  reason?: string;
  doctor_id?: string;
  clinic_id?: string;
  manage_token?: string;
};

type Clinic = {
  name: string;
  phone?: string;
  address?: string;
};

type Doctor = {
  name: string;
};

type ViewState = 'loading' | 'invalid' | 'view' | 'cancelled' | 'already_cancelled';

export function AppointmentManagePage() {
  const [params] = useSearchParams();
  const apptId = params.get('id');
  const manageToken = params.get('token');
  const actionParam = params.get('action'); // 'reschedule' | 'cancel'

  const [view, setView] = useState<ViewState>('loading');
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('Cancelled upon patient request');
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!apptId || !manageToken) {
      setView('invalid');
      return;
    }

    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'appointments', apptId));
        if (!snap.exists()) { setView('invalid'); return; }

        const data = snap.data() as Appointment;
        // Verify the manage token matches
        if (data.manage_token !== manageToken) { setView('invalid'); return; }

        setAppointment({ ...data, appt_id: apptId });

        if (data.status === 'cancelled') {
          setView('already_cancelled');
          return;
        }

        // Load clinic info
        if (data.clinic_id) {
          const cSnap = await getDoc(doc(db, 'clinics', data.clinic_id));
          if (cSnap.exists()) setClinic(cSnap.data() as Clinic);
        }
        // Load doctor info
        if (data.doctor_id) {
          const dSnap = await getDoc(doc(db, 'users', data.doctor_id));
          if (dSnap.exists()) setDoctor(dSnap.data() as Doctor);
        }

        setView('view');

        // Auto-open reschedule or cancel action from email link
        if (actionParam === 'reschedule') setShowReschedule(true);
        if (actionParam === 'cancel') setConfirmCancel(true);
      } catch {
        setView('invalid');
      }
    };

    load();
  }, [apptId, manageToken, actionParam]);

  const handleCancel = async () => {
    if (!appointment) return;
    setCancelling(true);
    try {
      const reasonToSave = cancelReason.trim() || 'Cancelled upon patient request';
      await updateDoc(doc(db, 'appointments', appointment.appt_id), {
        status: 'cancelled',
        updated_at: new Date().toISOString(),
        cancellation_reason: reasonToSave,
        cancelled_reason: reasonToSave,
        cancelled_at: new Date().toISOString(),
      });
      // Send Instant Email
      sendInstantAppointmentEmail(appointment.appt_id, 'appointment_cancelled');
      setView('cancelled');
    } catch {
      setCancelling(false);
    }
  };

  const handleReschedule = async () => {
    if (!appointment || !newDate || !newTime) return;
    setRescheduling(true);
    try {
      await updateDoc(doc(db, 'appointments', appointment.appt_id), {
        date: newDate,
        time_slot: newTime,
        status: 'waiting',
        updated_at: new Date().toISOString(),
        rescheduled_by: 'patient_email_link',
      });
      // Send Instant Email
      sendInstantAppointmentEmail(appointment.appt_id, 'appointment_rescheduled');
      setSuccessMsg(`Your appointment has been rescheduled to ${formatDate(newDate)} at ${newTime}.`);
      setShowReschedule(false);
      setAppointment(prev => prev ? { ...prev, date: newDate, time_slot: newTime } : null);
    } catch {
      // ignore
    }
    setRescheduling(false);
  };

  const rawToken = appointment?.display_token
    || (appointment?.token_number ? `ON-${String(appointment.token_number).padStart(3, '0')}` : '—');
  const tokenDisplay = rawToken.replace(/^EM-/, 'QR-');

  const apptDateFormatted = formatLongDate(appointment?.date);

  const BASE = 'min-h-screen bg-gradient-to-br from-[#F0FDFA] to-[#E0F2FE] flex items-center justify-center p-4';

  if (view === 'loading') {
    return (
      <div className={BASE}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#0E7490] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading your appointment…</p>
        </div>
      </div>
    );
  }

  if (view === 'invalid') {
    return (
      <div className={BASE}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">❌</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid or Expired Link</h2>
          <p className="text-gray-500 text-sm">This appointment management link is invalid or has expired. Please contact the clinic directly.</p>
        </div>
      </div>
    );
  }

  if (view === 'already_cancelled') {
    return (
      <div className={BASE}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Already Cancelled</h2>
          <p className="text-gray-500 text-sm">This appointment has already been cancelled. Please book a new appointment if needed.</p>
        </div>
      </div>
    );
  }

  if (view === 'cancelled') {
    return (
      <div className={BASE}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Appointment Cancelled</h2>
          <p className="text-gray-500 text-sm">Your appointment has been successfully cancelled. We hope to see you again soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={BASE}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-[#0E7490]">VIITSA</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Smarter Healthcare, For Everyone</p>
        </div>

        {/* Token */}
        <div className="text-center mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Booking Number</p>
          <div className="text-4xl font-black text-[#0E7490] tracking-widest">{tokenDisplay}</div>
        </div>

        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm text-center mb-4">
            ✅ {successMsg}
          </div>
        )}

        {/* Appointment Details */}
        <div className="bg-[#F8FAFC] border-l-4 border-[#0E7490] rounded-xl p-4 mb-6 space-y-2">
          <p className="text-sm"><span className="font-semibold text-gray-700">Doctor:</span> {doctor?.name || 'Your Doctor'}</p>
          <p className="text-sm"><span className="font-semibold text-gray-700">Date:</span> {apptDateFormatted}</p>
          <p className="text-sm"><span className="font-semibold text-gray-700">Time:</span> {appointment?.time_slot || '—'}</p>
          {clinic && (
            <>
              <p className="text-sm"><span className="font-semibold text-gray-700">Clinic:</span> {clinic.name}</p>
              {clinic.address && <p className="text-sm"><span className="font-semibold text-gray-700">Location:</span> {clinic.address}</p>}
              {clinic.phone && <p className="text-sm"><span className="font-semibold text-gray-700">Phone:</span> {clinic.phone}</p>}
            </>
          )}
          {appointment?.reason && <p className="text-sm"><span className="font-semibold text-gray-700">Reason:</span> {appointment.reason}</p>}
          <p className="text-sm">
            <span className="font-semibold text-gray-700">Status:</span>{' '}
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
              appointment?.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
              appointment?.status === 'completed' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-600'
            }`}>
              {appointment?.status?.charAt(0).toUpperCase()}{appointment?.status?.slice(1)}
            </span>
          </p>
        </div>

        {/* Reschedule Form */}
        {showReschedule && (
          <div className="border border-[#0E7490]/20 rounded-xl p-4 mb-4 bg-[#F0FDFA] space-y-3">
            <p className="font-semibold text-[#0E7490] text-sm">Pick a new date and time</p>
            <div>
              <label className="text-xs text-gray-500 block mb-1">New Date</label>
              <input
                type="date"
                value={formatDobForInput(newDate)}
                min={localDateISO(new Date())}
                onChange={e => setNewDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7490]/30"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">New Time</label>
              <input
                type="time"
                value={newTime}
                onChange={e => setNewTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7490]/30"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReschedule}
                disabled={rescheduling || !newDate || !newTime}
                className="flex-1 bg-[#0E7490] text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {rescheduling ? 'Rescheduling…' : 'Confirm Reschedule'}
              </button>
              <button
                onClick={() => setShowReschedule(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Cancel Confirmation */}
        {confirmCancel && (
          <div className="border border-red-200 rounded-xl p-4 mb-4 bg-red-50 space-y-3">
            <p className="font-semibold text-red-700 text-sm">Are you sure you want to cancel this appointment?</p>
            <p className="text-xs text-red-500">This action cannot be undone.</p>
            <div>
              <label className="text-xs text-gray-700 font-medium block mb-1">Reason for cancellation</label>
              <select
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value="Cancelled upon patient request">Cancelled upon patient request</option>
                <option value="Personal emergency / cannot attend">Personal emergency / cannot attend</option>
                <option value="Feeling better / no longer required">Feeling better / no longer required</option>
                <option value="Scheduling conflict">Scheduling conflict</option>
                <option value="Other personal reason">Other personal reason</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Keep It
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!showReschedule && !confirmCancel && appointment?.status !== 'cancelled' && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowReschedule(true)}
              className="flex-1 bg-[#0E7490] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0c637d] transition"
            >
              📅 Reschedule
            </button>
            <button
              onClick={() => setConfirmCancel(true)}
              className="flex-1 bg-red-50 text-red-700 border border-red-200 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-100 transition"
            >
              ✕ Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
