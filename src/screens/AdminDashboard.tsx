import { useState, useEffect } from 'react';
import {
  LogOut, Menu, X, Building2, Users, UserCheck, Calendar,
  ChevronRight, RefreshCw, Phone, Mail, MapPin, ShieldCheck,
  Wallet, FileText, Activity, Stethoscope,
} from 'lucide-react';
import { onSnapshot, query, collection, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { Avatar, SectionHeader, EmptyState, Loading } from '../components/ui';

// ── Types ──────────────────────────────────────────────────────────────────────
interface ClinicRow {
  id: string; name?: string; city?: string; phone?: string;
  email?: string; owner_name?: string; clinic_setup_complete?: boolean; created_at?: string;
}
interface PatientAccountRow {
  id: string; name?: string; full_name?: string; email?: string;
  phone?: string; id_number?: string; created_at?: string;
}
interface UserRow {
  id: string; name?: string; email?: string; role?: string;
  clinic_id?: string; created_at?: string;
}
interface AppointmentRow {
  id: string; patient_name?: string; clinic_name?: string; clinic_id?: string;
  date?: string; status?: string; type?: string; reason?: string; created_at?: string;
}
interface PatientRow {
  id: string; name?: string; clinic_id?: string; phone?: string;
  email?: string; created_at?: string;
}
interface ConsultationRow {
  id: string; patient_name?: string; clinic_id?: string;
  diagnosis?: string; created_at?: string;
}
interface InvoiceRow {
  id: string; patient_name?: string; clinic_id?: string; amount?: number;
  payment_status?: string; created_at?: string;
}
interface BillingRow {
  id: string; patient_name?: string; clinic_id?: string; amount?: number;
  payment_status?: string; payment_method?: string; created_at?: string;
}

type ActiveTab = 'overview' | 'clinics' | 'patients' | 'users' | 'appointments' | 'billing';

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'overview',      label: 'Overview' },
  { id: 'clinics',       label: 'Clinics' },
  { id: 'patients',      label: 'Patients' },
  { id: 'users',         label: 'Users' },
  { id: 'appointments',  label: 'Appointments' },
  { id: 'billing',       label: 'Billing' },
];

function formatDate(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

function formatRupees(n?: number) {
  if (n == null) return '—';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

// ── MetricCard ────────────────────────────────────────────────────────────────
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
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${t.bg} ${t.text} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-ink leading-tight">{value}</p>
        {sub && <p className="text-xs text-ink-muted truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
function StatusBadge({ text }: { text: string }) {
  const lower = (text || '').toLowerCase();
  let cls = 'badge';
  if (lower === 'active' || lower === 'completed' || lower === 'done' || lower === 'paid') cls += ' badge-done';
  else if (lower === 'pending' || lower === 'waiting') cls += ' badge-waiting';
  else if (lower === 'urgent') cls += ' badge-urgent';
  else if (lower === 'cancelled' || lower === 'canceled') cls += ' badge-cancelled';
  else if (lower === 'in-progress' || lower === 'in progress') cls += ' badge-progress';
  else cls += ' bg-primary-50 text-primary';
  return <span className={cls}>{text}</span>;
}

function RoleBadge({ role }: { role?: string }) {
  if (!role) return <span className="badge badge-cancelled">unknown</span>;
  if (role === 'company_admin') return <span className="badge bg-purple-50 text-purple-700">{role}</span>;
  if (role === 'admin')         return <span className="badge badge-done">{role}</span>;
  if (role === 'doctor')        return <span className="badge badge-progress">{role}</span>;
  if (role === 'staff')         return <span className="badge badge-waiting">{role}</span>;
  return <span className="badge badge-cancelled">{role}</span>;
}

// ── AdminSidebar ──────────────────────────────────────────────────────────────
function AdminSidebar({ activeTab, setActiveTab, mobileOpen, setMobileOpen }: {
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const { user, logout } = useAuth();

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

// ── AdminDashboard ─────────────────────────────────────────────────────────────
export function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab,    setActiveTab]    = useState<ActiveTab>('overview');
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [lastRefresh,  setLastRefresh]  = useState(new Date());

  // Live Firestore collections
  const [clinics,       setClinics]       = useState<ClinicRow[]>([]);
  const [patientAccts,  setPatientAccts]  = useState<PatientAccountRow[]>([]);
  const [clinicPats,    setClinicPats]    = useState<PatientRow[]>([]);
  const [users,         setUsers]         = useState<UserRow[]>([]);
  const [appointments,  setAppointments]  = useState<AppointmentRow[]>([]);
  const [consultations, setConsultations] = useState<ConsultationRow[]>([]);
  const [invoices,      setInvoices]      = useState<InvoiceRow[]>([]);
  const [billing,       setBilling]       = useState<BillingRow[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubs: (() => void)[] = [];
    let initialised = false;

    const done = () => {
      if (!initialised) { initialised = true; setLoading(false); }
      setLastRefresh(new Date());
    };

    // clinics
    unsubs.push(onSnapshot(
      query(collection(db, 'clinics'), orderBy('created_at', 'desc'), limit(500)),
      snap => { setClinics(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClinicRow))); done(); },
      () => done()
    ));

    // patient_accounts (top-level)
    unsubs.push(onSnapshot(
      query(collection(db, 'patient_accounts'), orderBy('created_at', 'desc'), limit(500)),
      snap => setPatientAccts(snap.docs.map(d => ({ id: d.id, ...d.data() } as PatientAccountRow)))
    ));

    // patients (clinic-scoped sub-collection style stored at top level)
    unsubs.push(onSnapshot(
      query(collection(db, 'patients'), limit(500)),
      snap => setClinicPats(snap.docs.map(d => ({ id: d.id, ...d.data() } as PatientRow)))
    ));

    // users
    unsubs.push(onSnapshot(
      query(collection(db, 'users'), limit(500)),
      snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserRow)))
    ));

    // appointments
    unsubs.push(onSnapshot(
      query(collection(db, 'appointments'), orderBy('created_at', 'desc'), limit(500)),
      snap => setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppointmentRow)))
    ));

    // consultations
    unsubs.push(onSnapshot(
      query(collection(db, 'consultations'), orderBy('created_at', 'desc'), limit(200)),
      snap => setConsultations(snap.docs.map(d => ({ id: d.id, ...d.data() } as ConsultationRow)))
    ));

    // invoices
    unsubs.push(onSnapshot(
      query(collection(db, 'invoices'), orderBy('created_at', 'desc'), limit(200)),
      snap => setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceRow)))
    ));

    // billing
    unsubs.push(onSnapshot(
      query(collection(db, 'billing'), orderBy('created_at', 'desc'), limit(200)),
      snap => setBilling(snap.docs.map(d => ({ id: d.id, ...d.data() } as BillingRow)))
    ));

    return () => unsubs.forEach(u => u());
  }, []);

  // ── Derived stats (all from live data) ────────────────────────────────────
  const totalClinics      = clinics.length;
  const setupClinics      = clinics.filter(c => c.clinic_setup_complete === true).length;
  const pendingClinics    = totalClinics - setupClinics;

  // Merge both patient sources for total unique count
  const allPatientIds = new Set([
    ...patientAccts.map(p => p.id),
    ...clinicPats.map(p => p.id),
  ]);
  const totalPatients = allPatientIds.size;

  const totalUsers        = users.length;
  const adminUsers        = users.filter(u => u.role === 'company_admin').length;
  const clinicAdmins      = users.filter(u => u.role === 'admin').length;
  const doctorUsers       = users.filter(u => u.role === 'doctor').length;
  const staffUsers        = users.filter(u => u.role === 'staff').length;

  const totalAppointments = appointments.length;
  const totalConsultations = consultations.length;

  const allBillingRows    = [...invoices, ...billing];
  const totalRevenue      = allBillingRows
    .filter(b => b.payment_status === 'paid')
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const pendingRevenue    = allBillingRows
    .filter(b => b.payment_status !== 'paid')
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  // Combined patients list (prefer patient_accounts, top up with clinic patients)
  const displayPatients: (PatientAccountRow | PatientRow)[] = [
    ...patientAccts,
    ...clinicPats.filter(cp => !patientAccts.find(pa => pa.id === cp.id)),
  ].slice(0, 500);

  // All billing
  const displayBilling: (InvoiceRow | BillingRow)[] = [...invoices, ...billing]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 500);

  return (
    <div className="min-h-screen bg-surface flex">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

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
                  <RefreshCw size={11} className="inline" /> Live · {lastRefresh.toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:inline-flex items-center gap-1.5 bg-primary-50 border border-primary/20 rounded-full px-3 py-1">
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

          {/* Tab bar */}
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

        {/* Main content */}
        <main className="p-4 sm:p-6 max-w-[1600px] mx-auto">
          {loading && <Loading label="Loading live Firestore data…" />}

          {!loading && (
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
                    <MetricCard icon={<Building2 size={20} />} label="Clinics"       value={String(totalClinics)}       sub={`${setupClinics} active · ${pendingClinics} pending`}   tone="primary" />
                    <MetricCard icon={<Users size={20} />}     label="Patients"      value={String(totalPatients)}      sub="Across all clinics"                                     tone="accent" />
                    <MetricCard icon={<Calendar size={20} />}  label="Appointments"  value={String(totalAppointments)}  sub={`${totalConsultations} consultations`}                  tone="warning" />
                    <MetricCard icon={<Wallet size={20} />}    label="Revenue Paid"  value={formatRupees(totalRevenue)} sub={`${formatRupees(pendingRevenue)} pending`}              tone="danger" />
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard icon={<UserCheck size={20} />}    label="System Users"  value={String(totalUsers)}     sub={`${adminUsers} admin · ${clinicAdmins} clinic`}  tone="primary" />
                    <MetricCard icon={<Stethoscope size={20} />}  label="Doctors"       value={String(doctorUsers)}    sub={`${staffUsers} staff`}                           tone="accent" />
                    <MetricCard icon={<Activity size={20} />}     label="Consultations" value={String(totalConsultations)} sub="All recorded"                               tone="warning" />
                    <MetricCard icon={<FileText size={20} />}     label="Invoices"      value={String(displayBilling.length)} sub="All-time billing records"               tone="danger" />
                  </div>

                  {/* Recent rows */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* Recent clinics */}
                    <div className="card">
                      <SectionHeader
                        title="Recent Clinics"
                        subtitle={`${totalClinics} total`}
                        action={<button onClick={() => setActiveTab('clinics')} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">View all <ChevronRight size={14} /></button>}
                      />
                      {clinics.length === 0 ? (
                        <EmptyState icon={<Building2 size={18} />} title="No clinics registered yet" />
                      ) : (
                        <div className="space-y-2">
                          {clinics.slice(0, 5).map(c => (
                            <div key={c.id} className="flex items-center gap-3 rounded-lg border border-black/5 px-3 py-2.5">
                              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary font-bold text-xs shrink-0">
                                {(c.name || 'C').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-ink truncate">{c.name || '—'}</p>
                                <p className="text-xs text-ink-muted truncate">{c.city || '—'} · {c.owner_name || '—'}</p>
                              </div>
                              <StatusBadge text={c.clinic_setup_complete ? 'Active' : 'Pending'} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent appointments */}
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
                          {appointments.slice(0, 5).map(a => (
                            <div key={a.id} className="flex items-center gap-3 rounded-lg border border-black/5 px-3 py-2.5">
                              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary text-xs font-bold shrink-0">
                                {(a.patient_name || 'P').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-ink truncate">{a.patient_name || '—'}</p>
                                <p className="text-xs text-ink-muted truncate">{a.clinic_name || a.clinic_id || '—'} · {formatDate(a.date || a.created_at)}</p>
                              </div>
                              {a.status && <StatusBadge text={a.status} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* User breakdown */}
                  <div className="card">
                    <SectionHeader title="User Role Breakdown" subtitle="All accounts by role" />
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[
                        { label: 'System Admins', count: adminUsers,   bg: 'bg-purple-50', text: 'text-purple-700' },
                        { label: 'Clinic Admins', count: clinicAdmins, bg: 'bg-primary-50', text: 'text-primary' },
                        { label: 'Doctors',       count: doctorUsers,  bg: 'bg-accent-50',  text: 'text-accent-600' },
                        { label: 'Staff',         count: staffUsers,   bg: 'bg-warning-bg', text: 'text-warning' },
                        { label: 'Patients',      count: totalPatients, bg: 'bg-danger-bg', text: 'text-danger' },
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
                    <p className="text-sm text-ink-muted">{totalClinics} registered · {setupClinics} active · {pendingClinics} pending</p>
                  </div>
                  <DataTable
                    headers={['Clinic', 'Owner', 'Contact', 'City', 'Status', 'Created']}
                    hiddenFrom={[null, 'sm', 'md', 'lg', null, 'lg']}
                    empty={clinics.length === 0}
                    emptyLabel="No clinics registered yet"
                  >
                    {clinics.map(c => (
                      <tr key={c.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="inline-flex h-8 w-8 rounded-lg bg-primary-50 text-primary font-bold text-xs items-center justify-center shrink-0">
                              {(c.name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-ink text-sm truncate max-w-[140px]">{c.name || '—'}</p>
                              <p className="text-[10px] text-ink-subtle font-mono truncate max-w-[140px]">{c.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden sm:table-cell">{c.owner_name || '—'}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="text-xs text-ink-muted space-y-0.5">
                            {c.phone && <p className="flex items-center gap-1"><Phone size={11} />{c.phone}</p>}
                            {c.email && <p className="flex items-center gap-1 truncate max-w-[160px]"><Mail size={11} />{c.email}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden lg:table-cell">
                          {c.city && <span className="flex items-center gap-1"><MapPin size={11} />{c.city}</span>}
                        </td>
                        <td className="px-4 py-3"><StatusBadge text={c.clinic_setup_complete ? 'Active' : 'Pending'} /></td>
                        <td className="px-4 py-3 text-ink-subtle text-xs hidden lg:table-cell">{formatDate(c.created_at)}</td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              )}

              {/* ── PATIENTS ── */}
              {activeTab === 'patients' && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Patients</h1>
                    <p className="text-sm text-ink-muted">{totalPatients} total unique patients</p>
                  </div>
                  <DataTable
                    headers={['Patient', 'ID No.', 'Contact', 'Registered']}
                    hiddenFrom={[null, 'sm', 'md', 'lg']}
                    empty={displayPatients.length === 0}
                    emptyLabel="No patients yet"
                  >
                    {displayPatients.map(p => (
                      <tr key={p.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="inline-flex h-8 w-8 rounded-full bg-primary-50 text-primary font-bold text-xs items-center justify-center shrink-0">
                              {((p as PatientAccountRow).name || (p as PatientAccountRow).full_name || (p as PatientRow).name || 'P').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-ink text-sm truncate max-w-[140px]">
                                {(p as PatientAccountRow).name || (p as PatientAccountRow).full_name || (p as PatientRow).name || '—'}
                              </p>
                              <p className="text-[10px] text-ink-subtle font-mono truncate">{p.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-muted text-xs font-mono hidden sm:table-cell">
                          {(p as PatientAccountRow).id_number || '—'}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="text-xs text-ink-muted space-y-0.5">
                            {p.phone && <p className="flex items-center gap-1"><Phone size={11} />{p.phone}</p>}
                            {p.email && <p className="flex items-center gap-1 truncate max-w-[180px]"><Mail size={11} />{p.email}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-subtle text-xs hidden lg:table-cell">{formatDate(p.created_at)}</td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              )}

              {/* ── USERS ── */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">System Users</h1>
                    <p className="text-sm text-ink-muted">{totalUsers} total · {adminUsers} admin · {clinicAdmins} clinic · {doctorUsers} doctor · {staffUsers} staff</p>
                  </div>
                  <DataTable
                    headers={['User', 'Email', 'Role', 'Clinic ID', 'Created']}
                    hiddenFrom={[null, 'sm', null, 'lg', 'lg']}
                    empty={users.length === 0}
                    emptyLabel="No users found"
                  >
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
                  </DataTable>
                </div>
              )}

              {/* ── APPOINTMENTS ── */}
              {activeTab === 'appointments' && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Appointments</h1>
                    <p className="text-sm text-ink-muted">{totalAppointments} all-time · {totalConsultations} consultations</p>
                  </div>
                  <DataTable
                    headers={['Patient', 'Clinic', 'Date', 'Type', 'Status']}
                    hiddenFrom={[null, 'sm', 'md', 'lg', null]}
                    empty={appointments.length === 0}
                    emptyLabel="No appointments recorded yet"
                  >
                    {appointments.map(a => (
                      <tr key={a.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink text-sm truncate max-w-[140px]">{a.patient_name || '—'}</p>
                          <p className="text-[10px] text-ink-subtle font-mono truncate">{a.id}</p>
                        </td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden sm:table-cell truncate max-w-[160px]">{a.clinic_name || a.clinic_id || '—'}</td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden md:table-cell">{formatDate(a.date || a.created_at)}</td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden lg:table-cell capitalize">{a.type || '—'}</td>
                        <td className="px-4 py-3">{a.status ? <StatusBadge text={a.status} /> : <span className="text-ink-subtle text-xs">—</span>}</td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              )}

              {/* ── BILLING ── */}
              {activeTab === 'billing' && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Billing</h1>
                    <p className="text-sm text-ink-muted">
                      {displayBilling.length} records · Paid: {formatRupees(totalRevenue)} · Pending: {formatRupees(pendingRevenue)}
                    </p>
                  </div>
                  <DataTable
                    headers={['Patient', 'Clinic', 'Amount', 'Method', 'Status', 'Date']}
                    hiddenFrom={[null, 'sm', null, 'md', null, 'lg']}
                    empty={displayBilling.length === 0}
                    emptyLabel="No billing records yet"
                  >
                    {displayBilling.map(b => (
                      <tr key={b.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink text-sm truncate max-w-[140px]">{b.patient_name || '—'}</p>
                          <p className="text-[10px] text-ink-subtle font-mono truncate">{b.id}</p>
                        </td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden sm:table-cell truncate max-w-[140px]">{b.clinic_id || '—'}</td>
                        <td className="px-4 py-3 text-ink font-bold text-sm">{formatRupees(b.amount)}</td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden md:table-cell capitalize">{(b as BillingRow).payment_method || '—'}</td>
                        <td className="px-4 py-3">{b.payment_status ? <StatusBadge text={b.payment_status} /> : <span className="text-ink-subtle text-xs">—</span>}</td>
                        <td className="px-4 py-3 text-ink-subtle text-xs hidden lg:table-cell">{formatDate(b.created_at)}</td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Reusable DataTable wrapper ────────────────────────────────────────────────
function DataTable({ headers, hiddenFrom, children, empty, emptyLabel }: {
  headers: string[];
  hiddenFrom: (string | null)[];
  children: React.ReactNode;
  empty: boolean;
  emptyLabel: string;
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-black/5 bg-surface">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={h}
                  className={`text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide ${
                    hiddenFrom[i] ? `hidden ${hiddenFrom[i]}:table-cell` : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {!empty ? children : (
              <tr>
                <td colSpan={headers.length} className="px-4 py-10 text-center text-sm text-ink-muted">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
