import { useState, useEffect } from 'react';
import { LogOut, Menu, X, Building2, Users, UserCheck, Activity, Calendar, ChevronRight, RefreshCw, Phone, Mail, MapPin, ShieldCheck, Home } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { Avatar } from '../components/ui';
import { SectionHeader, EmptyState, Loading } from '../components/ui';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ClinicRow { id: string; name: string; city: string; phone: string; email: string; owner_name: string; clinic_setup_complete?: boolean; created_at: string; }
interface PatientRow { id: string; name?: string; full_name?: string; email?: string; phone?: string; id_number?: string; created_at?: string; }
interface UserRow { id: string; name?: string; email?: string; role?: string; clinic_id?: string; created_at?: string; }
interface AppointmentRow { id: string; patient_name?: string; clinic_name?: string; date?: string; status?: string; created_at?: string; }

type ActiveTab = 'overview' | 'clinics' | 'patients' | 'users' | 'appointments';

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'overview',      label: 'Overview' },
  { id: 'clinics',       label: 'Clinics' },
  { id: 'patients',      label: 'Patients' },
  { id: 'users',         label: 'Users' },
  { id: 'appointments',  label: 'Appointments' },
];

function formatDate(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

// ── MetricCard (same pattern as DashboardScreen) ──────────────────────────────
function MetricCard({ icon, label, value, sub, tone }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  tone: 'primary' | 'accent' | 'warning' | 'danger';
}) {
  const toneMap = {
    primary: { bg: 'bg-primary-50', text: 'text-primary' },
    accent:  { bg: 'bg-accent-50',  text: 'text-accent-600' },
    warning: { bg: 'bg-warning-bg', text: 'text-warning' },
    danger:  { bg: 'bg-danger-bg',  text: 'text-danger' },
  };
  const t = toneMap[tone];
  return (
    <div className="card flex items-center gap-4 hover:shadow-card-hover transition-shadow">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${t.bg} ${t.text}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-ink leading-tight">{value}</p>
        {sub && <p className="text-xs text-ink-muted truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── Status badge (matches existing badge classes) ─────────────────────────────
function StatusBadge({ text }: { text: string }) {
  const lower = text.toLowerCase();
  let cls = 'badge';
  if (lower === 'active' || lower === 'completed' || lower === 'done') cls += ' badge-done';
  else if (lower === 'pending' || lower === 'waiting') cls += ' badge-waiting';
  else if (lower === 'urgent') cls += ' badge-urgent';
  else if (lower === 'cancelled' || lower === 'canceled') cls += ' badge-cancelled';
  else if (lower === 'in-progress' || lower === 'in progress') cls += ' badge-progress';
  else cls += ' bg-primary-50 text-primary';
  return <span className={cls}>{text}</span>;
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role?: string }) {
  if (!role) return <span className="badge badge-cancelled">unknown</span>;
  if (role === 'company_admin') return <span className="badge bg-purple-50 text-purple-700">{role}</span>;
  if (role === 'admin') return <span className="badge badge-done">{role}</span>;
  if (role === 'doctor') return <span className="badge badge-progress">{role}</span>;
  return <span className="badge badge-cancelled">{role}</span>;
}

// ── Admin Sidebar (mirrors AppShell sidebar design) ───────────────────────────
function AdminSidebar({ activeTab, setActiveTab, mobileOpen, setMobileOpen }: {
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const NavList = () => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => { setActiveTab(tab.id); setMobileOpen(false); }}
          className={`nav-item w-full text-left ${activeTab === tab.id ? 'nav-item-active' : ''}`}
        >
          <span className="flex-1">{tab.label}</span>
        </button>
      ))}
    </nav>
  );

  const Footer = () => (
    <div className="border-t border-black/5 p-3">
      <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
        <Avatar name={user?.name || 'Admin'} color="#7C3AED" size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">{user?.name || user?.email}</p>
          <p className="text-xs text-ink-muted">System Admin</p>
        </div>
      </div>
      <button onClick={logout} className="btn-ghost w-full justify-start text-sm">
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-black/5 flex-col fixed inset-y-0">
        <div className="px-5 py-5 border-b border-black/5">
          <ViitsaLogo size="md" />
          <div className="mt-3 pl-1">
            <p className="text-[11px] text-ink-subtle uppercase tracking-wide">Admin</p>
            <p className="text-sm font-semibold text-ink">VIITSA System</p>
          </div>
        </div>
        <NavList />
        <Footer />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-white flex flex-col animate-slide-up">
            <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
              <ViitsaLogo size="sm" />
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-ink-subtle"><X size={18} /></button>
            </div>
            <NavList />
            <Footer />
          </aside>
        </div>
      )}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [clinics,      setClinics]      = useState<ClinicRow[]>([]);
  const [patients,     setPatients]     = useState<PatientRow[]>([]);
  const [users,        setUsers]        = useState<UserRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loadingData,  setLoadingData]  = useState(true);
  const [lastRefresh,  setLastRefresh]  = useState(new Date());

  useEffect(() => {
    setLoadingData(true);
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(
      query(collection(db, 'clinics'), orderBy('created_at', 'desc'), limit(200)),
      snap => { setClinics(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClinicRow))); setLoadingData(false); setLastRefresh(new Date()); },
      () => setLoadingData(false)
    ));
    unsubs.push(onSnapshot(
      query(collection(db, 'patient_accounts'), orderBy('created_at', 'desc'), limit(200)),
      snap => setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() } as PatientRow)))
    ));
    unsubs.push(onSnapshot(
      query(collection(db, 'users'), limit(200)),
      snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserRow)))
    ));
    unsubs.push(onSnapshot(
      query(collection(db, 'appointments'), orderBy('created_at', 'desc'), limit(100)),
      snap => setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppointmentRow)))
    ));

    return () => unsubs.forEach(u => u());
  }, []);

  // Counts
  const totalClinics      = clinics.length;
  const setupClinics      = clinics.filter(c => c.clinic_setup_complete === true).length;
  const pendingClinics    = totalClinics - setupClinics;
  const totalPatients     = patients.length;
  const totalUsers        = users.length;
  const adminUsers        = users.filter(u => u.role === 'company_admin').length;
  const clinicAdmins      = users.filter(u => u.role === 'admin').length;
  const doctorUsers       = users.filter(u => u.role === 'doctor').length;
  const totalAppointments = appointments.length;

  return (
    <div className="min-h-screen bg-surface flex">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main */}
      <div className="flex-1 lg:ml-64 min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/5">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 -ml-1 text-ink-muted" aria-label="Open menu">
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">System Dashboard</p>
                <p className="text-xs text-ink-muted hidden sm:flex items-center gap-1">
                  <RefreshCw size={11} /> Live · {lastRefresh.toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-1.5 bg-primary-50 border border-primary/20 rounded-full px-3 py-1 hidden sm:flex">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wide">Admin</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar name={user?.name || 'Admin'} color="#7C3AED" size={32} />
                <div className="hidden md:block">
                  <p className="text-xs font-semibold text-ink">{user?.name || user?.email}</p>
                  <p className="text-[10px] text-ink-muted">System Admin</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar (same style as PatientsScreen/AppointmentsScreen sub-tabs) */}
          <div className="flex items-center gap-0 border-t border-black/5 overflow-x-auto scrollbar-none px-4 sm:px-6">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink-muted hover:text-ink hover:border-black/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
        <main className="p-4 sm:p-6 max-w-[1600px] mx-auto">
          {loadingData && <Loading label="Loading live Firestore data…" />}

          {!loadingData && (
            <>
              {/* ── OVERVIEW ── */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Admin Dashboard</h1>
                    <p className="text-sm text-ink-muted">Real-time overview of the entire VIITSA platform.</p>
                  </div>

                  {/* Stat cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard icon={<Building2 size={20} />} label="Total Clinics"    value={String(totalClinics)}     sub={`${setupClinics} active · ${pendingClinics} pending`} tone="primary" />
                    <MetricCard icon={<Users size={20} />}     label="Total Patients"   value={String(totalPatients)}    sub="Registered patient accounts"                           tone="accent" />
                    <MetricCard icon={<UserCheck size={20} />} label="System Users"     value={String(totalUsers)}       sub={`${clinicAdmins} clinic · ${doctorUsers} doctor`}      tone="warning" />
                    <MetricCard icon={<Calendar size={20} />}  label="Appointments"     value={String(totalAppointments)} sub="All-time recorded"                                   tone="primary" />
                  </div>

                  {/* Recent clinics + appointments */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="card">
                      <SectionHeader
                        title="Recent Clinics"
                        subtitle={`${totalClinics} registered`}
                        action={<button onClick={() => setActiveTab('clinics')} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">View all <ChevronRight size={14} /></button>}
                      />
                      {clinics.length === 0 ? (
                        <EmptyState icon={<Building2 size={18} />} title="No clinics registered yet" />
                      ) : (
                        <div className="space-y-2">
                          {clinics.slice(0, 5).map(clinic => (
                            <div key={clinic.id} className="flex items-center gap-3 rounded-lg border border-black/5 px-3 py-2.5">
                              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary font-bold text-xs shrink-0">
                                {(clinic.name || 'C').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-ink truncate">{clinic.name || '—'}</p>
                                <p className="text-xs text-ink-muted truncate">{clinic.city} · {clinic.owner_name}</p>
                              </div>
                              <StatusBadge text={clinic.clinic_setup_complete ? 'Active' : 'Pending'} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="card">
                      <SectionHeader
                        title="Recent Appointments"
                        subtitle={`${totalAppointments} total`}
                        action={<button onClick={() => setActiveTab('appointments')} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">View all <ChevronRight size={14} /></button>}
                      />
                      {appointments.length === 0 ? (
                        <EmptyState icon={<Calendar size={18} />} title="No appointments recorded yet" />
                      ) : (
                        <div className="space-y-2">
                          {appointments.slice(0, 5).map(appt => (
                            <div key={appt.id} className="flex items-center gap-3 rounded-lg border border-black/5 px-3 py-2.5">
                              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary text-xs font-bold shrink-0">
                                {(appt.patient_name || 'P').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-ink truncate">{appt.patient_name || '—'}</p>
                                <p className="text-xs text-ink-muted truncate">{appt.clinic_name || '—'} · {formatDate(appt.date || appt.created_at)}</p>
                              </div>
                              {appt.status && <StatusBadge text={appt.status} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* User breakdown */}
                  <div className="card">
                    <SectionHeader title="User Role Breakdown" subtitle="All accounts by role type" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'System Admins', count: adminUsers,   bg: 'bg-purple-50', text: 'text-purple-700' },
                        { label: 'Clinic Admins', count: clinicAdmins, bg: 'bg-primary-50', text: 'text-primary' },
                        { label: 'Doctors',       count: doctorUsers,  bg: 'bg-accent-50',  text: 'text-accent-600' },
                        { label: 'Patients',       count: totalPatients, bg: 'bg-warning-bg', text: 'text-warning' },
                      ].map(item => (
                        <div key={item.label} className={`${item.bg} rounded-xl p-4 text-center`}>
                          <div className={`text-2xl font-bold ${item.text}`}>{item.count}</div>
                          <div className="text-xs text-ink-muted mt-0.5 font-semibold">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── CLINICS ── */}
              {activeTab === 'clinics' && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Clinics</h1>
                    <p className="text-sm text-ink-muted">{totalClinics} registered · {setupClinics} active · {pendingClinics} pending setup</p>
                  </div>
                  <div className="card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-black/5 bg-surface">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Clinic</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide hidden sm:table-cell">Owner</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide hidden md:table-cell">Contact</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide hidden lg:table-cell">City</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide hidden lg:table-cell">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {clinics.map(clinic => (
                            <tr key={clinic.id} className="hover:bg-surface/60 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary font-bold text-xs shrink-0">
                                    {(clinic.name || 'C').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-ink text-sm truncate max-w-[140px]">{clinic.name || '—'}</p>
                                    <p className="text-[10px] text-ink-subtle font-mono truncate max-w-[140px]">{clinic.id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-ink-muted text-xs hidden sm:table-cell">{clinic.owner_name || '—'}</td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <div className="text-xs text-ink-muted space-y-0.5">
                                  {clinic.phone && <p className="flex items-center gap-1"><Phone size={11} />{clinic.phone}</p>}
                                  {clinic.email && <p className="flex items-center gap-1 truncate max-w-[160px]"><Mail size={11} />{clinic.email}</p>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-ink-muted text-xs hidden lg:table-cell">
                                {clinic.city && <span className="flex items-center gap-1"><MapPin size={11} />{clinic.city}</span>}
                              </td>
                              <td className="px-4 py-3"><StatusBadge text={clinic.clinic_setup_complete ? 'Active' : 'Pending'} /></td>
                              <td className="px-4 py-3 text-ink-subtle text-xs hidden lg:table-cell">{formatDate(clinic.created_at)}</td>
                            </tr>
                          ))}
                          {clinics.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-muted">No clinics registered yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PATIENTS ── */}
              {activeTab === 'patients' && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Patients</h1>
                    <p className="text-sm text-ink-muted">{totalPatients} registered patient accounts</p>
                  </div>
                  <div className="card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-black/5 bg-surface">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Patient</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide hidden sm:table-cell">ID No.</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide hidden md:table-cell">Contact</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide hidden lg:table-cell">Registered</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {patients.map(patient => (
                            <tr key={patient.id} className="hover:bg-surface/60 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary font-bold text-xs shrink-0">
                                    {(patient.name || patient.full_name || 'P').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-ink text-sm truncate max-w-[140px]">{patient.name || patient.full_name || '—'}</p>
                                    <p className="text-[10px] text-ink-subtle font-mono truncate">{patient.id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-ink-muted text-xs font-mono hidden sm:table-cell">{patient.id_number || '—'}</td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <div className="text-xs text-ink-muted space-y-0.5">
                                  {patient.phone && <p className="flex items-center gap-1"><Phone size={11} />{patient.phone}</p>}
                                  {patient.email && <p className="flex items-center gap-1 truncate max-w-[180px]"><Mail size={11} />{patient.email}</p>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-ink-subtle text-xs hidden lg:table-cell">{formatDate(patient.created_at)}</td>
                            </tr>
                          ))}
                          {patients.length === 0 && (
                            <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-ink-muted">No patient accounts yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── USERS ── */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">System Users</h1>
                    <p className="text-sm text-ink-muted">{totalUsers} total · {adminUsers} admin · {clinicAdmins} clinic · {doctorUsers} doctor</p>
                  </div>
                  <div className="card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-black/5 bg-surface">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">User</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide hidden sm:table-cell">Email</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Role</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide hidden lg:table-cell">Clinic ID</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide hidden lg:table-cell">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {users.map(u => (
                            <tr key={u.id} className="hover:bg-surface/60 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <Avatar name={u.name || 'U'} color="#7C3AED" size={32} />
                                  <div>
                                    <p className="font-semibold text-ink text-sm truncate max-w-[140px]">{u.name || '—'}</p>
                                    <p className="text-[10px] text-ink-subtle font-mono truncate">{u.id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-ink-muted text-xs hidden sm:table-cell truncate max-w-[180px]">{u.email || '—'}</td>
                              <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                              <td className="px-4 py-3 text-ink-subtle text-[10px] font-mono hidden lg:table-cell truncate max-w-[120px]">{u.clinic_id || '—'}</td>
                              <td className="px-4 py-3 text-ink-subtle text-xs hidden lg:table-cell">{formatDate(u.created_at)}</td>
                            </tr>
                          ))}
                          {users.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-muted">No users found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── APPOINTMENTS ── */}
              {activeTab === 'appointments' && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Appointments</h1>
                    <p className="text-sm text-ink-muted">{totalAppointments} all-time recorded appointments</p>
                  </div>
                  <div className="card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-black/5 bg-surface">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Patient</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide hidden sm:table-cell">Clinic</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide hidden md:table-cell">Date</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {appointments.map(appt => (
                            <tr key={appt.id} className="hover:bg-surface/60 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-semibold text-ink text-sm truncate max-w-[140px]">{appt.patient_name || '—'}</p>
                                <p className="text-[10px] text-ink-subtle font-mono truncate">{appt.id}</p>
                              </td>
                              <td className="px-4 py-3 text-ink-muted text-xs hidden sm:table-cell truncate max-w-[160px]">{appt.clinic_name || '—'}</td>
                              <td className="px-4 py-3 text-ink-muted text-xs hidden md:table-cell">{formatDate(appt.date || appt.created_at)}</td>
                              <td className="px-4 py-3">{appt.status ? <StatusBadge text={appt.status} /> : <span className="text-ink-subtle text-xs">—</span>}</td>
                            </tr>
                          ))}
                          {appointments.length === 0 && (
                            <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-ink-muted">No appointments recorded yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
