import { useEffect, useState } from 'react';
import {
  ChevronRight, CalendarClock, Stethoscope, BrainCircuit, FolderOpen, Receipt, Calendar,
  Activity, AlertTriangle, Pill, Phone, Heart, ChevronLeft, Share2, Users,
  Star, MapPin, UserCircle, ShieldCheck, Clock3, Sparkles, Building2, X, Check,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDoc, getDocs, doc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { usePatientAuth } from '../lib/patientAuth';
import { useAuth } from '../lib/auth';
import { claimPastAppointmentsForPhone } from '../lib/accountLinking';
import { formatDate, formatTime, localDateISO } from '../lib/format';
import type { Appointment, Consultation, Invoice, User, Clinic } from '../lib/types';
import type { PatientTab } from './PatientBottomNav';
import { ViitsaLogo } from '../components/ViitsaLogo';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Props { onTab: (t: PatientTab) => void; clinicId: string | null; }

export function PatientHome({ onTab, clinicId }: Props) {
  const { account, clinic, selectClinic, logout } = usePatientAuth();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [recentConsults, setRecentConsults] = useState<Consultation[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showClinicPicker, setShowClinicPicker] = useState(false);
  const [availableClinics, setAvailableClinics] = useState<Clinic[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [switchingClinicId, setSwitchingClinicId] = useState<string | null>(null);

  const fetchClinics = async () => {
    setLoadingClinics(true);
    try {
      const snap = await getDocs(collection(db, 'clinics'));
      const list = snap.docs.map(d => ({ ...d.data(), clinic_id: d.id } as Clinic));
      setAvailableClinics(list);
    } catch (e) {
      console.warn('fetchClinics error:', e);
    } finally {
      setLoadingClinics(false);
    }
  };

  const handleSelectClinic = async (targetClinic: Clinic) => {
    if (switchingClinicId) return;
    setSwitchingClinicId(targetClinic.clinic_id);
    try {
      await selectClinic(targetClinic);
      setTimeout(() => {
        setShowClinicPicker(false);
        setSwitchingClinicId(null);
      }, 350);
    } catch (err) {
      console.error('Failed to switch clinic:', err);
      setSwitchingClinicId(null);
    }
  };

  // Real-time live onSnapshot listeners for patient appointments, consultations, and invoices
  useEffect(() => {
    if (!account?.account_id) return;
    const pid = account.account_id;
    const rawPhone = account.phone || (account as any).mobile || user?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);

    // Retroactively claim any past emergency walk-in appointments for this phone
    if (cleanPhone) {
      claimPastAppointmentsForPhone(cleanPhone, pid).catch(() => {});
    }

    const apptMap = new Map<string, Appointment>();

    const syncAppts = async () => {
      const list = Array.from(apptMap.values());
      for (const appt of list) {
        if (appt.doctor_id && !appt.doctor) {
          try {
            const docSnap = await getDoc(doc(db, 'users', appt.doctor_id));
            if (docSnap.exists()) {
              appt.doctor = docSnap.data() as User;
            }
          } catch {}
        }
      }
      list.sort((a, b) => {
        const da = a.date || '';
        const dbDate = b.date || '';
        if (da !== dbDate) return dbDate.localeCompare(da);
        return (b.time_slot || '').localeCompare(a.time_slot || '');
      });
      setAppointments(list);
    };

    // 1. Appointments where patient_id == pid
    const apptQ1 = query(
      collection(db, 'appointments'),
      where('patient_id', '==', pid),
      limit(30)
    );
    const unsubAppt1 = onSnapshot(apptQ1, (snap) => {
      snap.docs.forEach((d) => {
        apptMap.set(d.id, { ...d.data(), appointment_id: d.id, appt_id: d.id } as Appointment);
      });
      syncAppts();
    }, (err) => console.warn('Appts by patient_id error:', err));

    // 2. Appointments where account_id == pid
    const apptQ2 = query(
      collection(db, 'appointments'),
      where('account_id', '==', pid),
      limit(30)
    );
    const unsubAppt2 = onSnapshot(apptQ2, (snap) => {
      snap.docs.forEach((d) => {
        apptMap.set(d.id, { ...d.data(), appointment_id: d.id, appt_id: d.id } as Appointment);
      });
      syncAppts();
    }, (err) => console.warn('Appts by account_id error:', err));

    // 3. Appointments where patient_phone == cleanPhone (unclaimed / past walk-in)
    let unsubAppt3: (() => void) | null = null;
    if (cleanPhone) {
      const apptQ3 = query(
        collection(db, 'appointments'),
        where('patient_phone', '==', cleanPhone),
        limit(30)
      );
      unsubAppt3 = onSnapshot(apptQ3, (snap) => {
        snap.docs.forEach((d) => {
          apptMap.set(d.id, { ...d.data(), appointment_id: d.id, appt_id: d.id } as Appointment);
        });
        syncAppts();
      }, (err) => console.warn('Appts by phone error:', err));
    }

    // Consultations listener (live real-time)
    const consQ = query(collection(db, 'consultations'), where('patient_id', '==', pid), orderBy('created_at', 'desc'), limit(5));
    const unsubCons = onSnapshot(consQ, (consSnap) => {
      setRecentConsults(consSnap.docs.map(d => ({ ...d.data(), consult_id: d.id } as Consultation)));
    }, (err) => console.warn('Live patient consults snapshot error:', err));

    // Invoices listener (live real-time)
    const invQ = query(collection(db, 'invoices'), where('patient_id', '==', pid), where('payment_status', '==', 'pending'));
    const unsubInv = onSnapshot(invQ, (invSnap) => {
      setPendingInvoices(invSnap.docs.map(d => ({ ...d.data(), invoice_id: d.id } as Invoice)));
    }, (err) => console.warn('Live patient invoices snapshot error:', err));

    // Reward points listener (live real-time)
    const ptsQ = query(collection(db, 'patient_reward_points'), where('account_id', '==', account.account_id));
    const unsubPts = onSnapshot(ptsQ, (snap) => {
      const total = snap.docs.reduce((s, r) => s + (r.data().points || 0), 0);
      setRewardPoints(total);
    }, (err) => console.warn('Live patient reward points error:', err));

    return () => {
      unsubAppt1();
      unsubAppt2();
      if (unsubAppt3) unsubAppt3();
      unsubCons();
      unsubInv();
      unsubPts();
    };
  }, [account?.account_id, account?.phone, user?.phone]);

  const sortedAppointments = [...appointments].sort((a, b) => {
    const da = a.date || '';
    const dbDate = b.date || '';
    if (da !== dbDate) return da.localeCompare(dbDate);
    return (a.time_slot || '').localeCompare(b.time_slot || '');
  });

  const todayStr = localDateISO();
  const upcomingAppointments = sortedAppointments.filter(a => a.date >= todayStr && a.status !== 'cancelled');
  const nextAppt = upcomingAppointments[0];
  const historyAppointments = appointments.filter(a => a.date < todayStr || a.status === 'cancelled').sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (showEmergency) {
    return (
      <div className="min-h-screen bg-red-50 pb-24">
        <div className="bg-red-600 px-4 pt-12 pb-4 flex items-center gap-3">
          <button onClick={() => setShowEmergency(false)} aria-label="Back" className="p-2 rounded-xl bg-white/10 text-white">
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-bold text-white">Emergency Health Card</p>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div className="bg-white rounded-2xl border-2 border-red-200 overflow-hidden">
            <div className="bg-red-600 px-4 py-3 text-center">
              <Heart size={24} className="text-white mx-auto mb-1" />
              <p className="text-white font-bold text-lg">EMERGENCY HEALTH CARD</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Name</span>
                <span className="text-sm font-semibold text-gray-900">{account?.name ?? 'Patient'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">DOB</span>
                <span className="text-sm font-semibold text-gray-900">{account?.dob ? formatDate(account.dob) : (account?.age ? `${account.age} yrs` : '—')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Blood Group</span>
                <span className="text-sm font-bold text-red-600">{account?.blood_group ?? 'Unknown'}</span>
              </div>
              {account?.chronic_conditions && account.chronic_conditions !== 'None' && (
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Medical Conditions</span>
                  <span className="text-sm font-semibold text-red-700">{account.chronic_conditions}</span>
                </div>
              )}
              {account?.allergies && account.allergies !== 'None' && (
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Allergies</span>
                  <span className="text-sm font-bold text-red-600">{account.allergies}</span>
                </div>
              )}
              {account?.current_medications && account.current_medications.length > 0 && (
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Current Medications</span>
                  <span className="text-sm font-semibold text-gray-800">{account.current_medications.join(', ')}</span>
                </div>
              )}
              {account?.emergency_contact_name && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Emergency Contact</p>
                  <p className="text-sm font-semibold text-gray-900">{account.emergency_contact_name}</p>
                  {account.emergency_contact_phone && (
                    <a href={`tel:${account.emergency_contact_phone}`} className="text-sm text-primary font-medium">
                      {account.emergency_contact_phone}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <a href="tel:108" className="w-full rounded-2xl py-4 bg-red-600 text-white font-bold text-base flex items-center justify-center gap-2">
              <Phone size={20} /> Call 108 Emergency
            </a>
            <button onClick={() => {
              const msg = `EMERGENCY HEALTH CARD\n\nName: ${account?.name}\nBlood Group: ${account?.blood_group}\nConditions: ${account?.chronic_conditions}\nAllergies: ${account?.allergies}\nMedications: ${account?.current_medications?.join(', ') || 'None'}\nEmergency Contact: ${account?.emergency_contact_name} - ${account?.emergency_contact_phone}\n\n- Shared via VIITSA`;
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            }} className="w-full rounded-2xl py-3 bg-green-500 text-white font-semibold text-sm flex items-center justify-center gap-2">
              <Share2 size={18} /> Share Emergency Card
            </button>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={16} className="text-gray-400" />
                <p className="text-sm font-semibold text-gray-900">Nearby Hospitals</p>
              </div>
              <p className="text-xs text-gray-500">Enable location to find emergency rooms near you.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-24">
      {/* Header */}
      <div className="bg-primary px-5 pt-12 pb-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0, transparent 50%)' }} />
        <div className="relative flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ViitsaLogo size="sm" light showText={false} />
            <div className="flex flex-col leading-none">
              <p className="text-sm font-bold text-white">VIITSA</p>
              <p className="text-[8px] text-white/50 uppercase tracking-wider">Smarter Healthcare, For Everyone</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onTab('profile')} aria-label="My profile" className="p-2 rounded-full bg-white/10">
              <UserCircle size={18} className="text-white" />
            </button>
            <button onClick={() => setShowEmergency(true)} aria-label="Emergency health card" className="p-2 rounded-full bg-red-500/20">
              <Phone size={18} className="text-red-200" />
            </button>
          </div>
        </div>
        <p className="text-white/80 text-sm">{greeting()},</p>
        <p className="text-2xl font-bold text-white">{account?.name?.split(' ')[0] ?? 'Patient'}</p>
        <p className="text-white/60 text-xs mt-1">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

        {nextAppt ? (
          <button onClick={() => onTab('book')} className="mt-4 bg-white/15 backdrop-blur rounded-2xl px-4 py-3 flex items-center gap-3 w-full text-left">
            <CalendarClock size={20} className="text-white shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/70">Next appointment {nextAppt.display_token ? `(Token: ${nextAppt.display_token.replace(/^EM-/, 'QR-')})` : ''}</p>
                {nextAppt.visit_type && (
                  <span className="text-[9px] uppercase font-bold text-white bg-white/20 px-1.5 py-0.5 rounded">
                    {nextAppt.visit_type.replace('-', ' ')}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-white">{formatDate(nextAppt.date)} at {formatTime(nextAppt.time_slot)}</p>
              <p className="text-xs text-white/70">
                {(nextAppt.doctor as { name?: string })?.name || 'Doctor'} • {(nextAppt.clinic as { name?: string })?.name || 'Clinic'}
              </p>
              {nextAppt.reason && <p className="text-xs text-white/50 truncate mt-0.5">"{nextAppt.reason}"</p>}
            </div>
            <ChevronRight size={16} className="text-white/50" />
          </button>
        ) : (
          <button onClick={() => onTab('book')} className="mt-4 bg-white/10 rounded-2xl px-4 py-3 w-full text-left">
            <p className="text-sm text-white/80">No upcoming appointments. <span className="text-white font-semibold underline">Book one today!</span></p>
          </button>
        )}
      </div>

      <div className="px-4 mt-5 space-y-5 pb-28">
        {/* Clinic Status & Selection Card */}
        {clinic ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Building2 size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Your Connected Clinic</p>
                <p className="text-sm font-bold text-gray-900">{clinic.name}</p>
                <p className="text-xs text-gray-500">{clinic.city || clinic.address || 'Clinic registered'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => { setShowClinicPicker(true); fetchClinics(); }}
                className="text-xs font-semibold text-primary px-3 py-1.5 rounded-xl border border-primary/20 hover:bg-primary/5 transition-colors"
              >
                Switch
              </button>
              <button
                onClick={async () => {
                  if (window.confirm(`Disconnect from ${clinic.name}? You can reconnect or choose another clinic anytime.`)) {
                    await selectClinic(null);
                  }
                }}
                className="text-xs font-semibold text-rose-600 px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 transition-colors"
                title="Disconnect from clinic"
              >
                Exit
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border border-teal-100 p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
                <Building2 size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Select Your Clinic</p>
                <p className="text-xs text-gray-600">Choose a clinic to connect with doctors and book visits.</p>
              </div>
            </div>
            <button
              onClick={() => { setShowClinicPicker(true); fetchClinics(); }}
              className="text-xs font-semibold text-white bg-primary px-3.5 py-2 rounded-xl shadow-sm hover:opacity-90 transition shrink-0"
            >
              Choose Clinic
            </button>
          </div>
        )}

        {/* Alerts */}
        {pendingInvoices.length > 0 && (
          <button onClick={() => onTab('payments')} className="w-full flex items-start gap-3 bg-yellow-50 rounded-2xl px-4 py-3 border border-yellow-100 text-left">
            <AlertTriangle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-800">Pending payment: ₹{pendingInvoices.reduce((s, i) => s + Number(i.total), 0).toLocaleString()}</p>
              <p className="text-xs text-yellow-700">Tap to view and pay.</p>
            </div>
            <ChevronRight size={16} className="text-yellow-500 shrink-0 mt-0.5" />
          </button>
        )}

        {/* Reward Points Banner */}
        {rewardPoints > 0 && (
          <button onClick={() => onTab('profile')} className="w-full flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl px-4 py-3 border border-amber-100">
            <div className="h-9 w-9 rounded-xl bg-amber-400 flex items-center justify-center shrink-0">
              <Star size={18} className="text-white fill-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-amber-800">{rewardPoints} Reward Points</p>
              <p className="text-xs text-amber-600">Earn points for every appointment</p>
            </div>
            <ChevronRight size={16} className="text-amber-400" />
          </button>
        )}

        {/* Primary Actions */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'ai' as PatientTab, label: 'AI Health Check', desc: 'Chat with AI', icon: BrainCircuit, color: 'bg-[#E1F5EE]', iconColor: 'text-primary', badge: 'Smart' },
              { key: 'book' as PatientTab, label: 'Book Appointment', desc: 'Choose doctor & slot', icon: Calendar, color: 'bg-blue-50', iconColor: 'text-blue-600', badge: null },
              { key: 'records' as PatientTab, label: 'My Records', desc: 'Reports & visits', icon: FolderOpen, color: 'bg-orange-50', iconColor: 'text-orange-600', badge: null },
              { key: 'payments' as PatientTab, label: 'Payments', desc: 'Bills & invoices', icon: Receipt, color: 'bg-violet-50', iconColor: 'text-violet-600', badge: pendingInvoices.length > 0 ? String(pendingInvoices.length) : null },
            ].map(({ key, label, desc, icon: Icon, color, iconColor, badge }) => (
              <button key={key} onClick={() => onTab(key)}
                className="relative flex flex-col items-start gap-3 rounded-2xl bg-white border border-gray-100 p-4 shadow-sm active:scale-95 transition-transform">
                {badge && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{badge}</span>
                )}
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                  <Icon size={20} className={iconColor} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 text-left">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* More Features */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">More Features</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'family' as PatientTab, label: 'Family Vault', desc: 'Manage family health', icon: Users, color: 'bg-pink-50', iconColor: 'text-pink-600' },
              { key: 'timeline' as PatientTab, label: 'Health Timeline', desc: 'Your health journey', icon: Clock3, color: 'bg-teal-50', iconColor: 'text-teal-600' },
              { key: 'doctors' as PatientTab, label: 'Find Doctors', desc: 'Search by specialty', icon: Stethoscope, color: 'bg-indigo-50', iconColor: 'text-indigo-600' },
              { key: 'profile' as PatientTab, label: 'My Profile', desc: 'Health card & info', icon: UserCircle, color: 'bg-gray-50', iconColor: 'text-gray-600' },
            ].map(({ key, label, desc, icon: Icon, color, iconColor }) => (
              <button key={key} onClick={() => onTab(key)}
                className="flex flex-col items-start gap-3 rounded-2xl bg-white border border-gray-100 p-4 shadow-sm active:scale-95 transition-transform">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                  <Icon size={20} className={iconColor} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 text-left">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Insurance placeholder */}
        <button onClick={() => onTab('profile')} className="w-full flex items-center gap-4 bg-gradient-to-r from-sky-50 to-blue-50 rounded-2xl p-4 border border-sky-100">
          <div className="h-11 w-11 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <ShieldCheck size={22} className="text-sky-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-sky-800">Health Insurance</p>
            <p className="text-xs text-sky-600">Link your insurance card for faster claims</p>
          </div>
          <span className="text-xs bg-sky-200 text-sky-700 font-semibold px-2 py-0.5 rounded-full">Soon</span>
        </button>

        {/* Upcoming appointments */}
        {appointments.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">Upcoming appointments</p>
              <button onClick={() => onTab('book')} className="text-xs text-primary font-semibold">See all</button>
            </div>
            <div className="space-y-2">
              {upcomingAppointments.slice(0, 3).map(a => (
                <div key={a.appt_id || a.appointment_id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-[#E1F5EE] flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold leading-none text-primary">{new Date(a.date).getDate()}</span>
                    <span className="text-[9px] uppercase tracking-wider font-bold mt-0.5 text-primary/70">{new Date(a.date).toLocaleString('default', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{(a.doctor as { name?: string } | null | undefined)?.name ?? 'Doctor'}</p>
                      {a.display_token && <span className="text-xs font-bold text-primary px-1.5 py-0.5 bg-primary/10 rounded-md">{a.display_token.replace(/^EM-/, 'QR-')}</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{(a.clinic as { name?: string } | null | undefined)?.name ?? 'Clinic'}</p>
                    <p className="text-xs text-gray-500">
                      {formatTime(a.time_slot)}
                      {a.visit_type && ` • ${a.visit_type.replace('-', ' ')}`}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 capitalize">{a.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Appointment history */}
        {historyAppointments.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">Appointment history</p>
            </div>
            <div className="space-y-2 opacity-80">
              {historyAppointments.slice(0, 5).map(a => (
                <div key={a.appt_id || a.appointment_id} className="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gray-200 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold leading-none text-gray-600">{new Date(a.date).getDate()}</span>
                    <span className="text-[9px] uppercase tracking-wider font-bold mt-0.5 text-gray-500">{new Date(a.date).toLocaleString('default', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{(a.doctor as { name?: string } | null | undefined)?.name ?? 'Doctor'}</p>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{(a.clinic as { name?: string } | null | undefined)?.name ?? 'Clinic'}</p>
                    <p className="text-xs text-gray-500">{formatTime(a.time_slot)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full capitalize ${a.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-gray-200 text-gray-700'}`}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent visits */}
        {recentConsults.length > 0 && (
          <div>
            <p className="text-sm font-bold text-gray-900 mb-3">Recent visits</p>
            <div className="space-y-2">
              {recentConsults.slice(0, 3).map(c => (
                <button key={c.consult_id} onClick={() => onTab('records')}
                  className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 text-left">
                  <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                    <FolderOpen size={16} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.diagnosis || 'Consultation'}</p>
                    <p className="text-xs text-gray-500">{formatDate(c.created_at)}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Health reminders */}
        <div>
          <p className="text-sm font-bold text-gray-900 mb-3">Health reminders</p>
          <div className="space-y-2">
            {account?.chronic_conditions && account.chronic_conditions !== 'None' && (
              <div className="flex items-start gap-3 bg-[#E1F5EE] rounded-2xl px-4 py-3">
                <Pill size={16} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-primary">Medicine reminder</p>
                  <p className="text-xs text-green-800">Take your medicines on time for {account.chronic_conditions}.</p>
                </div>
              </div>
            )}
            <button onClick={() => onTab('ai')} className="w-full flex items-start gap-3 bg-white rounded-2xl px-4 py-3 border border-gray-100 text-left">
              <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600">Use AI Health Check before your visit — it helps your doctor prepare faster.</p>
            </button>
          </div>
        </div>
      </div>

      {/* Clinic Picker Modal */}
      {showClinicPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Choose Your Clinic</h3>
                <p className="text-xs text-gray-500">Connect to a clinic for doctor visits and appointments</p>
              </div>
              <button onClick={() => setShowClinicPicker(false)} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 py-1">
              {loadingClinics ? (
                <div className="py-8 text-center text-xs text-gray-400 space-y-2">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Loading clinics from database...</p>
                </div>
              ) : availableClinics.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <Building2 size={36} className="text-gray-300 mx-auto" />
                  <p className="text-sm font-bold text-gray-800">No Clinics Registered Yet</p>
                  <p className="text-xs text-gray-500 max-w-xs mx-auto">
                    There are currently no clinics registered on the platform. When a clinic signs up, it will appear here.
                  </p>
                </div>
              ) : (
                availableClinics.map((c) => {
                  const activeClinicId = clinic?.clinic_id || account?.clinic_id;
                  const isSelected = activeClinicId === c.clinic_id;
                  const isSwitching = switchingClinicId === c.clinic_id;
                  return (
                    <div
                      key={c.clinic_id}
                      className={`p-4 rounded-2xl transition-all ${
                        isSelected
                          ? 'border-2 border-[#0B5C4D] bg-white shadow-xs'
                          : 'border border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{c.address || c.city || 'Clinic'}</p>
                          {c.phone && <p className="text-xs text-gray-500 mt-0.5">{c.phone}</p>}
                        </div>
                        <button
                          onClick={() => handleSelectClinic(c)}
                          disabled={isSelected || Boolean(switchingClinicId)}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-[#0B5C4D] text-white cursor-default'
                              : 'bg-[#E5F3EE] text-[#0C6A58] hover:bg-[#D5EBE4] cursor-pointer'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check size={13} className="stroke-[2.5]" /> Selected
                            </>
                          ) : isSwitching ? (
                            <span className="flex items-center gap-1">
                              <span className="h-3 w-3 border-2 border-[#0C6A58] border-t-transparent rounded-full animate-spin" />
                              Connecting...
                            </span>
                          ) : (
                            'Select'
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {clinic && (
              <div className="pt-3 mt-2 border-t border-gray-100">
                <button
                  onClick={async () => {
                    await selectClinic(null);
                    setShowClinicPicker(false);
                  }}
                  className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 transition-colors"
                >
                  Disconnect from {clinic.name} (Exit)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
