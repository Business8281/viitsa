import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  UserCheck,
  Activity,
  TrendingUp,
  AlertTriangle,
  LogOut,
  ShieldCheck,
  Clock,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  RefreshCw,
  Database,
  Stethoscope,
  Calendar,
  DollarSign,
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';

interface StatCard {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  sub?: string;
}

interface ClinicRow {
  id: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  owner_name: string;
  clinic_setup_complete?: boolean;
  created_at: string;
}

interface PatientRow {
  id: string;
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  id_number?: string;
  created_at?: string;
}

interface UserRow {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  user_type?: string;
  clinic_id?: string;
  created_at?: string;
}

interface AppointmentRow {
  id: string;
  patient_name?: string;
  clinic_name?: string;
  date?: string;
  status?: string;
  created_at?: string;
}

type ActiveTab = 'overview' | 'clinics' | 'patients' | 'users' | 'appointments';

const TABS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
  { id: 'clinics', label: 'Clinics', icon: <Building2 className="w-4 h-4" /> },
  { id: 'patients', label: 'Patients', icon: <Users className="w-4 h-4" /> },
  { id: 'users', label: 'Users', icon: <UserCheck className="w-4 h-4" /> },
  { id: 'appointments', label: 'Appointments', icon: <Calendar className="w-4 h-4" /> },
];

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${color}`}>
      {text}
    </span>
  );
}

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Live data
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Subscribe to Firestore collections in real-time
  useEffect(() => {
    setLoadingData(true);

    const unsubs: (() => void)[] = [];

    // Clinics
    const clinicsQ = query(collection(db, 'clinics'), orderBy('created_at', 'desc'), limit(200));
    unsubs.push(onSnapshot(clinicsQ, snap => {
      setClinics(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClinicRow)));
      setLoadingData(false);
      setLastRefresh(new Date());
    }, () => setLoadingData(false)));

    // Patient accounts
    const patientsQ = query(collection(db, 'patient_accounts'), orderBy('created_at', 'desc'), limit(200));
    unsubs.push(onSnapshot(patientsQ, snap => {
      setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() } as PatientRow)));
    }));

    // Users
    const usersQ = query(collection(db, 'users'), limit(200));
    unsubs.push(onSnapshot(usersQ, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserRow)));
    }));

    // Appointments
    const apptQ = query(collection(db, 'appointments'), orderBy('created_at', 'desc'), limit(100));
    unsubs.push(onSnapshot(apptQ, snap => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppointmentRow)));
    }));

    return () => unsubs.forEach(u => u());
  }, []);

  // Derived stats
  const totalClinics = clinics.length;
  const setupClinics = clinics.filter(c => c.clinic_setup_complete === true).length;
  const pendingClinics = clinics.filter(c => c.clinic_setup_complete !== true).length;
  const totalPatients = patients.length;
  const totalUsers = users.length;
  const adminUsers = users.filter(u => u.role === 'company_admin').length;
  const clinicAdmins = users.filter(u => u.role === 'admin').length;
  const doctorUsers = users.filter(u => u.role === 'doctor').length;
  const totalAppointments = appointments.length;
  const recentAppointments = appointments.slice(0, 5);

  const statCards: StatCard[] = [
    {
      label: 'Total Clinics',
      value: totalClinics,
      icon: <Building2 className="w-6 h-6" />,
      color: 'text-teal-400',
      bg: 'bg-teal-500/10 border-teal-500/20',
      sub: `${setupClinics} active · ${pendingClinics} pending`,
    },
    {
      label: 'Total Patients',
      value: totalPatients,
      icon: <Users className="w-6 h-6" />,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      sub: 'Registered patient accounts',
    },
    {
      label: 'System Users',
      value: totalUsers,
      icon: <UserCheck className="w-6 h-6" />,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10 border-violet-500/20',
      sub: `${clinicAdmins} clinic · ${doctorUsers} doctor · ${adminUsers} admin`,
    },
    {
      label: 'Appointments',
      value: totalAppointments,
      icon: <Calendar className="w-6 h-6" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      sub: 'All-time recorded appointments',
    },
  ];

  const roleColor = (role?: string) => {
    switch (role) {
      case 'company_admin': return 'bg-violet-900/60 text-violet-300 border border-violet-700/50';
      case 'admin': return 'bg-teal-900/60 text-teal-300 border border-teal-700/50';
      case 'doctor': return 'bg-blue-900/60 text-blue-300 border border-blue-700/50';
      case 'patient': return 'bg-slate-800 text-slate-300 border border-slate-700/50';
      default: return 'bg-slate-800 text-slate-400 border border-slate-700/50';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <ViitsaLogo size="sm" light={true} />
            <div className="hidden sm:flex items-center gap-1.5 bg-violet-500/15 border border-violet-500/30 rounded-full px-3 py-1">
              <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-bold text-violet-300 uppercase tracking-wide">Admin</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-white">{user?.name || user?.email}</p>
              <p className="text-[10px] text-slate-400">System Administrator</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              System Dashboard
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Real-time overview of the VIITSA platform
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Live · Updated {lastRefresh.toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-5 border-b border-slate-800 overflow-x-auto pb-0 scrollbar-none">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">

        {/* Loading spinner */}
        {loadingData && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Database className="w-8 h-8 text-violet-400 animate-pulse" />
              <p className="text-sm text-slate-400">Loading live data from Firestore...</p>
            </div>
          </div>
        )}

        {!loadingData && (
          <>
            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6 pt-4">
                {/* Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {statCards.map(card => (
                    <div
                      key={card.label}
                      className={`rounded-2xl border p-5 ${card.bg} transition-all`}
                    >
                      <div className={`${card.color} mb-3`}>{card.icon}</div>
                      <div className="text-2xl sm:text-3xl font-extrabold text-white mb-0.5">{card.value}</div>
                      <div className="text-xs font-bold text-slate-300 mb-1">{card.label}</div>
                      {card.sub && <div className="text-[10px] text-slate-500">{card.sub}</div>}
                    </div>
                  ))}
                </div>

                {/* Recent Clinics + Recent Appointments */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Recent Clinics */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-teal-400" />
                        <h3 className="text-sm font-bold text-white">Recent Clinics</h3>
                      </div>
                      <button onClick={() => setActiveTab('clinics')} className="text-xs text-slate-500 hover:text-violet-400 flex items-center gap-1">
                        View all <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="divide-y divide-slate-800">
                      {clinics.slice(0, 5).map(clinic => (
                        <div key={clinic.id} className="flex items-start gap-3 p-4">
                          <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-teal-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">{clinic.name || '—'}</p>
                            <p className="text-xs text-slate-500 truncate">{clinic.city} · {clinic.owner_name || '—'}</p>
                          </div>
                          <Badge
                            text={clinic.clinic_setup_complete ? 'Active' : 'Pending'}
                            color={clinic.clinic_setup_complete
                              ? 'bg-teal-900/60 text-teal-300 border border-teal-700/50'
                              : 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                            }
                          />
                        </div>
                      ))}
                      {clinics.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-6">No clinics registered yet</p>
                      )}
                    </div>
                  </div>

                  {/* Recent Appointments */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-bold text-white">Recent Appointments</h3>
                      </div>
                      <button onClick={() => setActiveTab('appointments')} className="text-xs text-slate-500 hover:text-violet-400 flex items-center gap-1">
                        View all <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="divide-y divide-slate-800">
                      {recentAppointments.map(appt => (
                        <div key={appt.id} className="flex items-start gap-3 p-4">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4 text-amber-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">{appt.patient_name || '—'}</p>
                            <p className="text-xs text-slate-500 truncate">{appt.clinic_name || '—'} · {formatDate(appt.date || appt.created_at)}</p>
                          </div>
                          {appt.status && (
                            <Badge
                              text={appt.status}
                              color={
                                appt.status === 'completed' ? 'bg-green-900/60 text-green-300 border border-green-700/50' :
                                appt.status === 'pending' ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50' :
                                'bg-slate-800 text-slate-400 border border-slate-700/50'
                              }
                            />
                          )}
                        </div>
                      ))}
                      {appointments.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-6">No appointments recorded yet</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* User breakdown */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <UserCheck className="w-4 h-4 text-violet-400" />
                    <h3 className="text-sm font-bold text-white">User Role Breakdown</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'System Admins', count: adminUsers, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                      { label: 'Clinic Admins', count: clinicAdmins, color: 'text-teal-400', bg: 'bg-teal-500/10' },
                      { label: 'Doctors', count: doctorUsers, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                      { label: 'Patients', count: totalPatients, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    ].map(item => (
                      <div key={item.label} className={`${item.bg} rounded-xl p-4 text-center`}>
                        <div className={`text-2xl font-extrabold ${item.color}`}>{item.count}</div>
                        <div className="text-xs text-slate-400 mt-0.5 font-semibold">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── CLINICS TAB ── */}
            {activeTab === 'clinics' && (
              <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-base font-bold text-white">All Registered Clinics ({totalClinics})</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{setupClinics} active · {pendingClinics} pending setup</span>
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide">Clinic</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Owner</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide hidden md:table-cell">Contact</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide hidden lg:table-cell">City</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide">Status</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {clinics.map(clinic => (
                          <tr key={clinic.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center shrink-0">
                                  <Building2 className="w-3.5 h-3.5 text-teal-400" />
                                </div>
                                <div>
                                  <p className="font-semibold text-white text-sm truncate max-w-[140px]">{clinic.name || '—'}</p>
                                  <p className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">{clinic.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-slate-300 text-xs hidden sm:table-cell">{clinic.owner_name || '—'}</td>
                            <td className="p-4 hidden md:table-cell">
                              <div className="text-xs text-slate-400 space-y-0.5">
                                {clinic.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{clinic.phone}</p>}
                                {clinic.email && <p className="flex items-center gap-1 truncate max-w-[160px]"><Mail className="w-3 h-3" />{clinic.email}</p>}
                              </div>
                            </td>
                            <td className="p-4 text-slate-400 text-xs hidden lg:table-cell">
                              {clinic.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{clinic.city}</span>}
                            </td>
                            <td className="p-4">
                              <Badge
                                text={clinic.clinic_setup_complete ? 'Active' : 'Pending'}
                                color={clinic.clinic_setup_complete
                                  ? 'bg-teal-900/60 text-teal-300 border border-teal-700/50'
                                  : 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                                }
                              />
                            </td>
                            <td className="p-4 text-slate-500 text-xs hidden lg:table-cell">{formatDate(clinic.created_at)}</td>
                          </tr>
                        ))}
                        {clinics.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-sm text-slate-500">No clinics registered yet</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── PATIENTS TAB ── */}
            {activeTab === 'patients' && (
              <div className="pt-4 space-y-4">
                <h2 className="text-base font-bold text-white">All Patient Accounts ({totalPatients})</h2>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide">Patient</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide hidden sm:table-cell">ID</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide hidden md:table-cell">Contact</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {patients.map(patient => (
                          <tr key={patient.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold text-blue-400">
                                    {(patient.name || patient.full_name || 'P').charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-semibold text-white text-sm truncate max-w-[140px]">
                                    {patient.name || patient.full_name || '—'}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-mono truncate">{patient.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-slate-400 text-xs font-mono hidden sm:table-cell">{patient.id_number || '—'}</td>
                            <td className="p-4 hidden md:table-cell">
                              <div className="text-xs text-slate-400 space-y-0.5">
                                {patient.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{patient.phone}</p>}
                                {patient.email && <p className="flex items-center gap-1 truncate max-w-[180px]"><Mail className="w-3 h-3" />{patient.email}</p>}
                              </div>
                            </td>
                            <td className="p-4 text-slate-500 text-xs hidden lg:table-cell">{formatDate(patient.created_at)}</td>
                          </tr>
                        ))}
                        {patients.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-sm text-slate-500">No patient accounts yet</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── USERS TAB ── */}
            {activeTab === 'users' && (
              <div className="pt-4 space-y-4">
                <h2 className="text-base font-bold text-white">All System Users ({totalUsers})</h2>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide">User</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Email</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide">Role</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Clinic ID</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold text-violet-400">
                                    {(u.name || 'U').charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-semibold text-white text-sm truncate max-w-[140px]">{u.name || '—'}</p>
                                  <p className="text-[10px] text-slate-500 font-mono truncate">{u.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-slate-400 text-xs hidden sm:table-cell truncate max-w-[180px]">{u.email || '—'}</td>
                            <td className="p-4">
                              <Badge text={u.role || u.user_type || 'unknown'} color={roleColor(u.role)} />
                            </td>
                            <td className="p-4 text-slate-500 text-[10px] font-mono hidden lg:table-cell truncate max-w-[120px]">{u.clinic_id || '—'}</td>
                            <td className="p-4 text-slate-500 text-xs hidden lg:table-cell">{formatDate(u.created_at)}</td>
                          </tr>
                        ))}
                        {users.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-sm text-slate-500">No users found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── APPOINTMENTS TAB ── */}
            {activeTab === 'appointments' && (
              <div className="pt-4 space-y-4">
                <h2 className="text-base font-bold text-white">All Appointments ({totalAppointments})</h2>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide">Patient</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Clinic</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide hidden md:table-cell">Date</th>
                          <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {appointments.map(appt => (
                          <tr key={appt.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-4">
                              <div>
                                <p className="font-semibold text-white text-sm truncate max-w-[140px]">{appt.patient_name || '—'}</p>
                                <p className="text-[10px] text-slate-500 font-mono truncate">{appt.id}</p>
                              </div>
                            </td>
                            <td className="p-4 text-slate-400 text-xs hidden sm:table-cell truncate max-w-[160px]">{appt.clinic_name || '—'}</td>
                            <td className="p-4 text-slate-400 text-xs hidden md:table-cell">{formatDate(appt.date || appt.created_at)}</td>
                            <td className="p-4">
                              {appt.status ? (
                                <Badge
                                  text={appt.status}
                                  color={
                                    appt.status === 'completed' ? 'bg-green-900/60 text-green-300 border border-green-700/50' :
                                    appt.status === 'pending' ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50' :
                                    appt.status === 'cancelled' ? 'bg-red-900/40 text-red-300 border border-red-700/50' :
                                    'bg-slate-800 text-slate-400 border border-slate-700/50'
                                  }
                                />
                              ) : <span className="text-slate-600 text-xs">—</span>}
                            </td>
                          </tr>
                        ))}
                        {appointments.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-sm text-slate-500">No appointments recorded yet</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
