import { useEffect, useState } from 'react';
import {
  ChevronRight, CalendarClock, Stethoscope, BrainCircuit, FolderOpen, Receipt, Calendar,
  Activity, AlertTriangle, Pill, Phone, Heart, ChevronLeft, Share2, Users,
  Star, MapPin, UserCircle, ShieldCheck, Clock3, Sparkles,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import { usePatientAuth } from '../lib/patientAuth';
import { formatDate, formatTime, localDateISO } from '../lib/format';
import type { Appointment, Consultation, Invoice } from '../lib/types';
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
  const { account, logout } = usePatientAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [recentConsults, setRecentConsults] = useState<Consultation[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [showEmergency, setShowEmergency] = useState(false);

  useEffect(() => {
    if (!account || !clinicId) return;
    const fetchHomeData = async () => {
      const q = query(collection(db, 'patient_clinic_links'), where('account_id', '==', account.account_id), where('clinic_id', '==', clinicId));
      const snap = await getDocs(q);
      if (snap.empty) return;
      const pid = snap.docs[0].data().patient_id;

      // Appointments
      const apptQ = query(collection(db, 'appointments'), where('patient_id', '==', pid), where('date', '>=', localDateISO()), orderBy('date'), limit(3));
      const apptSnap = await getDocs(apptQ);
      const appts = apptSnap.docs.map(d => d.data() as Appointment).filter(a => a.status !== 'cancelled');
      for (const appt of appts) {
        if (appt.doctor_id) {
          const docSnap = await getDoc(doc(db, 'users', appt.doctor_id));
          if (docSnap.exists()) {
            appt.doctor = docSnap.data();
          }
        }
      }
      setAppointments(appts);

      // Consultations
      const consQ = query(collection(db, 'consultations'), where('patient_id', '==', pid), orderBy('created_at', 'desc'), limit(3));
      const consSnap = await getDocs(consQ);
      setRecentConsults(consSnap.docs.map(d => d.data() as Consultation));

      // Invoices
      const invQ = query(collection(db, 'invoices'), where('patient_id', '==', pid), where('payment_status', '==', 'pending'));
      const invSnap = await getDocs(invQ);
      setPendingInvoices(invSnap.docs.map(d => d.data() as Invoice));
    };
    fetchHomeData();
  }, [account, clinicId]);

  useEffect(() => {
    if (!account) return;
    const q = query(collection(db, 'patient_reward_points'), where('account_id', '==', account.account_id));
    getDocs(q).then((snap) => {
      const total = snap.docs.reduce((s, r) => s + (r.data().points || 0), 0);
      setRewardPoints(total);
    });
  }, [account]);

  const nextAppt = appointments[0];

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
                <span className="text-sm font-semibold text-gray-900">{account?.dob ? new Date(account.dob).toLocaleDateString('en-IN') : (account?.age ? `${account.age} yrs` : '—')}</span>
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
              <p className="text-xs text-white/70">Next appointment</p>
              <p className="text-sm font-semibold text-white">{formatDate(nextAppt.date)} at {formatTime(nextAppt.time_slot)}</p>
              {nextAppt.doctor && <p className="text-xs text-white/70">{(nextAppt.doctor as { name?: string }).name}</p>}
            </div>
            <ChevronRight size={16} className="text-white/50" />
          </button>
        ) : (
          <button onClick={() => onTab('book')} className="mt-4 bg-white/10 rounded-2xl px-4 py-3 w-full text-left">
            <p className="text-sm text-white/80">No upcoming appointments. <span className="text-white font-semibold underline">Book one today!</span></p>
          </button>
        )}
      </div>

      <div className="px-4 mt-5 space-y-5">
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
              {appointments.slice(0, 2).map(a => (
                <div key={a.appt_id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-[#E1F5EE] flex items-center justify-center shrink-0">
                    <Stethoscope size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{(a.doctor as { name?: string } | null | undefined)?.name ?? 'Doctor'}</p>
                    <p className="text-xs text-gray-500">{formatDate(a.date)} at {formatTime(a.time_slot)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    a.status === 'done' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                  }`}>{a.status}</span>
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
    </div>
  );
}
