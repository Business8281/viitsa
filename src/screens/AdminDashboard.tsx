import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { SectionErrorBoundary } from '../components/SectionErrorBoundary';
import {
  LogOut, Menu, X, Building2, Users, UserCheck, Calendar,
  ChevronRight, RefreshCw, Phone, Mail, MapPin, ShieldCheck,
  Wallet, FileText, Activity, Stethoscope, Search, History, CheckCircle, Clock, Sparkles, BrainCircuit,
} from 'lucide-react';
import { onSnapshot, query, collection, orderBy, limit, setDoc, doc, deleteField } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { todayISO, parseDateArg, matchesDateRange, type DateRangePreset } from '../lib/format';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { Avatar, SectionHeader, EmptyState, Loading, StatusBadge, RoleBadge, DataTable } from '../components/ui';
import { Modal } from '../components/Modal';
import { sendEmail } from '../lib/emailService';
import { InvoiceView } from '../components/InvoiceView';
import AdminAISettings from './AdminAISettings';
import AdminSubscriptionPlans from './AdminSubscriptionPlans';
import AdminLiveSubscriptions from './AdminLiveSubscriptions';
import { getPasswordValidationError, assertPasswordUniqueness, claimPasswordHash } from '../lib/passwordSecurity';
import { PasswordRequirementsGuide } from '../components/PasswordRequirementsGuide';

// ── Types ──────────────────────────────────────────────────────────────────────
interface ClinicRow {
  id: string; name?: string; city?: string; phone?: string;
  email?: string; owner_name?: string; clinic_setup_complete?: boolean; created_at?: string;
  documents_uploaded?: boolean; verification_status?: string; rejection_reason?: string;
  onboarding_documents?: { name: string; url: string }[];
  owner_user_id?: string; id_number?: string; linked_ids?: string[];
}
interface PatientAccountRow {
  id: string; name?: string; full_name?: string; email?: string;
  phone?: string; id_number?: string; created_at?: string;
  account_id?: string; patient_id?: string; linked_ids?: string[];
}
interface UserRow {
  id: string; name?: string; email?: string; role?: string;
  clinic_id?: string; created_at?: string;
  phone?: string; specialisation?: string; active?: boolean;
  onboarding_documents?: { name: string; url: string }[];
  certificates?: { name: string; url: string }[];
  user_id?: string; linked_ids?: string[];
}
interface AppointmentRow {
  id: string; patient_name?: string; patient_id?: string; clinic_name?: string; clinic_id?: string;
  date?: string; status?: string; type?: string; reason?: string; created_at?: string;
  display_token?: string; token_number?: number; time?: string; slot?: string; doctor_name?: string;
}
interface PatientRow {
  id: string; patient_id?: string; account_id?: string; name?: string; full_name?: string; clinic_id?: string; phone?: string;
  email?: string; created_at?: string; id_number?: string; linked_ids?: string[];
}
interface ConsultationRow {
  id: string; patient_name?: string; patient_id?: string; clinic_id?: string;
  diagnosis?: string; created_at?: string;
}
interface InvoiceRow {
  id: string; patient_name?: string; patient_id?: string; clinic_id?: string; amount?: number;
  payment_status?: string; payment_method?: string; created_at?: string;
  invoice_id?: string; bill_id?: string; appointment_id?: string; invoice_number?: string;
  doctor_id?: string; line_items?: any[]; consultation_fee?: number; total?: number;
  linked_ids?: string[];
}
interface BillingRow {
  id: string; patient_name?: string; patient_id?: string; clinic_id?: string; amount?: number;
  payment_status?: string; payment_method?: string; created_at?: string;
  bill_id?: string; invoice_id?: string; appointment_id?: string; invoice_number?: string;
  doctor_id?: string; line_items?: any[]; consultation_fee?: number; total?: number;
  linked_ids?: string[];
}
interface SupportTicketRow {
  id: string; subject?: string; user_email?: string; status?: string; created_at?: string;
}
interface ComplaintRow {
  id: string; title?: string; target_name?: string; status?: string; created_at?: string;
}
interface ReportRow {
  id: string; name?: string; type?: string; created_at?: string;
}
interface SubscriptionRow {
  id: string; clinic_name?: string; clinic_id?: string; plan_name?: string;
  status?: string; created_at?: string; updated_at?: string;
}

type ActiveTab = string;

const ADMIN_NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { 
    id: 'healthcare_network', 
    label: 'Healthcare Network',
    subItems: [
      { id: 'hn_clinics', label: 'Clinics' },
      { id: 'hn_doctors', label: 'Doctors' },
      { id: 'hn_patients', label: 'Patients' },
      { id: 'hn_employees', label: 'Employees' },
      { id: 'hn_laboratories', label: 'Laboratories' },
      { id: 'hn_pharmacies', label: 'Pharmacies' },
      { id: 'hn_hospitals', label: 'Hospitals' },
    ]
  },
  {
    id: 'verification_center',
    label: 'Verification Center',
    subItems: [
      { id: 'vc_pending_clinics', label: 'Pending Clinics' },
      { id: 'vc_pending_doctors', label: 'Pending Doctors' },
      { id: 'vc_documents', label: 'Documents' },
      { id: 'vc_history', label: 'Verification History' },
    ]
  },
  {
    id: 'operations',
    label: 'Operations',
    subItems: [
      { id: 'op_appointments', label: 'Appointments' },
      { id: 'op_schedules', label: 'Schedules' },
      { id: 'op_activity', label: 'Platform Activity' },
    ]
  },
  {
    id: 'ai_center',
    label: 'AI Center',
    subItems: [
      { id: 'ai_navigator', label: 'AI Navigator' },
      { id: 'ai_usage', label: 'AI Usage' },
      { id: 'ai_models', label: 'AI Models' },
      { id: 'ai_versions', label: 'AI Versions' },
      { id: 'ai_safety', label: 'AI Safety' },
    ]
  },
  {
    id: 'subscriptions_billing',
    label: 'Subscriptions & Billing',
    subItems: [
      { id: 'sb_plans', label: 'Plans' },
      { id: 'sb_subscriptions', label: 'Subscriptions' },
      { id: 'sb_payments', label: 'Payments' },
      { id: 'sb_invoices', label: 'Invoices' },
    ]
  },
  {
    id: 'healthcare_integrations',
    label: 'Healthcare Integrations',
    subItems: [
      { id: 'hi_abdm', label: 'ABDM' },
      { id: 'hi_labs', label: 'Labs' },
      { id: 'hi_hospitals', label: 'Hospitals' },
      { id: 'hi_pharmacies', label: 'Pharmacies' },
      { id: 'hi_insurance', label: 'Insurance' },
      { id: 'hi_apis', label: 'APIs' },
    ]
  },
  {
    id: 'privacy_compliance',
    label: 'Privacy & Compliance',
    subItems: [
      { id: 'pc_consent', label: 'Consent' },
      { id: 'pc_data_requests', label: 'Data Requests' },
      { id: 'pc_retention', label: 'Retention' },
      { id: 'pc_incidents', label: 'Privacy Incidents' },
      { id: 'pc_records', label: 'Compliance Records' },
    ]
  },
  {
    id: 'security_center',
    label: 'Security Center',
    subItems: [
      { id: 'sec_login', label: 'Login Activity' },
      { id: 'sec_alerts', label: 'Security Alerts' },
      { id: 'sec_sessions', label: 'Sessions' },
      { id: 'sec_incidents', label: 'Incidents' },
    ]
  },
  {
    id: 'support',
    label: 'Support',
    subItems: [
      { id: 'sup_tickets', label: 'Tickets' },
      { id: 'sup_complaints', label: 'Complaints' },
      { id: 'sup_reports', label: 'Reports' },
    ]
  },
  {
    id: 'analytics',
    label: 'Analytics',
    subItems: [
      { id: 'ana_platform', label: 'Platform Analytics' },
      { id: 'ana_geographic', label: 'Geographic Analytics' },
      { id: 'ana_clinic', label: 'Clinic Analytics' },
      { id: 'ana_ai', label: 'AI Analytics' },
    ]
  },
  { id: 'notifications', label: 'Notifications' },
  { id: 'content_management', label: 'Content Management' },
  { id: 'users_roles', label: 'Users & Roles' },
  { id: 'audit_logs', label: 'Audit Logs' },
  { id: 'system_settings', label: 'System Settings' },
];

export const ADMIN_TAB_TO_PATH: Record<string, string> = {
  dashboard: '/admin/dashboard',
  hn_clinics: '/admin/clinics',
  hn_doctors: '/admin/doctors',
  hn_patients: '/admin/patients',
  hn_employees: '/admin/employees',
  hn_laboratories: '/admin/laboratories',
  hn_pharmacies: '/admin/pharmacies',
  hn_hospitals: '/admin/hospitals',
  vc_pending_clinics: '/admin/verification/clinics',
  vc_pending_doctors: '/admin/verification/doctors',
  vc_documents: '/admin/verification/documents',
  vc_history: '/admin/verification/history',
  op_appointments: '/admin/appointments',
  op_schedules: '/admin/schedules',
  op_activity: '/admin/activity',
  ai_navigator: '/admin/ai/navigator',
  ai_usage: '/admin/ai/usage',
  ai_models: '/admin/ai/models',
  ai_versions: '/admin/ai/versions',
  ai_safety: '/admin/ai/safety',
  sb_plans: '/admin/plans',
  sb_subscriptions: '/admin/subscriptions',
  sb_payments: '/admin/payments',
  sb_invoices: '/admin/invoices',
  hi_abdm: '/admin/integrations/abdm',
  hi_labs: '/admin/integrations/labs',
  hi_hospitals: '/admin/integrations/hospitals',
  hi_pharmacies: '/admin/integrations/pharmacies',
  hi_insurance: '/admin/integrations/insurance',
  hi_apis: '/admin/integrations/apis',
  pc_consent: '/admin/privacy/consent',
  pc_data_requests: '/admin/privacy/data-requests',
  pc_retention: '/admin/privacy/retention',
  pc_incidents: '/admin/privacy/incidents',
  pc_records: '/admin/privacy/records',
  sec_login: '/admin/security/login',
  sec_alerts: '/admin/security/alerts',
  sec_sessions: '/admin/security/sessions',
  sec_incidents: '/admin/security/incidents',
  sup_tickets: '/admin/support/tickets',
  sup_complaints: '/admin/support/complaints',
  sup_reports: '/admin/support/reports',
  ana_platform: '/admin/analytics',
  ana_geographic: '/admin/analytics/geographic',
  ana_clinic: '/admin/analytics/clinic',
  ana_ai: '/admin/analytics/ai',
  notifications: '/admin/notifications',
  content_management: '/admin/content',
  users_roles: '/admin/users-roles',
  audit_logs: '/admin/audit-logs',
  system_settings: '/admin/settings',
};

export const ADMIN_PATH_TO_TAB: Record<string, string> = {
  ...Object.entries(ADMIN_TAB_TO_PATH).reduce((acc, [tab, path]) => {
    acc[path] = tab;
    return acc;
  }, {} as Record<string, string>),
  '/admin': 'dashboard',
  '/admin/': 'dashboard',
  '/admin/dashboard': 'dashboard',
  '/admin/clinics': 'hn_clinics',
  '/admin/doctors': 'hn_doctors',
  '/admin/patients': 'hn_patients',
  '/admin/employees': 'hn_employees',
  '/admin/laboratories': 'hn_laboratories',
  '/admin/pharmacies': 'hn_pharmacies',
  '/admin/hospitals': 'hn_hospitals',
  '/admin/verification': 'vc_pending_clinics',
  '/admin/ai': 'ai_navigator',
  '/admin/plans': 'sb_plans',
  '/admin/subscriptions': 'sb_subscriptions',
  '/admin/payments': 'sb_payments',
  '/admin/invoices': 'sb_invoices',
  '/admin/appointments': 'op_appointments',
  '/admin/security': 'sec_login',
  '/admin/support': 'sup_tickets',
  '/admin/integrations': 'hi_abdm',
  '/admin/privacy': 'pc_consent',
};

function formatDate(s?: any) {
  if (!s) return '—';
  try {
    const d = parseDateArg(s);
    if (!d || isNaN(d.getTime())) return typeof s === 'string' ? s : '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return typeof s === 'string' ? s : '—';
  }
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

// ── GenericDataView ───────────────────────────────────────────────────────────
function GenericDataView({ activeTab, users, clinics, appointments, invoices, billing, supportTickets, complaints, reports, subscriptions, onUserSelect, onViewInvoice, auditLogs }: any) {
  let title = '';
  for (const section of ADMIN_NAV) {
    if (section.id === activeTab) { title = section.label; break; }
    if (section.subItems) {
      const sub = section.subItems.find(s => s.id === activeTab);
      if (sub) { title = sub.label; break; }
    }
  }
  if (!title) {
    title = activeTab.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  let data: any[] = [];
  let headers: string[] = [];
  let renderRow: (item: any) => React.ReactNode = () => null;

  if (activeTab === 'hn_doctors') {
    title = 'Clinic Doctors';
    data = users.filter((u: any) => u.role === 'clinic_doctor');
    headers = ['Name', 'Email', 'Clinic', 'Status'];
    renderRow = (u: any) => (
      <tr key={u.id} className="hover:bg-surface/60 transition-colors cursor-pointer" onClick={() => onUserSelect(u.id)}>
        <td className="px-4 py-3"><p className="font-semibold text-ink text-sm truncate">{u.name || '—'}</p></td>
        <td className="px-4 py-3 text-ink-muted text-sm truncate">{u.email || '—'}</td>
        <td className="px-4 py-3 text-ink-muted text-sm truncate">{clinics.find((c: any) => c.id === u.clinic_id)?.name || u.clinic_id || '—'}</td>
        <td className="px-4 py-3">{u.active === false ? <StatusBadge text="Inactive" /> : <StatusBadge text="Active" />}</td>
      </tr>
    );
  } else if (activeTab === 'hn_employees') {
    title = 'Clinic Employees';
    data = users.filter((u: any) => u.role === 'clinic_staff' || u.role === 'clinic_admin');
    headers = ['Name', 'Email', 'Role', 'Clinic'];
    renderRow = (u: any) => (
      <tr key={u.id} className="hover:bg-surface/60 transition-colors cursor-pointer" onClick={() => onUserSelect(u.id)}>
        <td className="px-4 py-3"><p className="font-semibold text-ink text-sm truncate">{u.name || '—'}</p></td>
        <td className="px-4 py-3 text-ink-muted text-sm truncate">{u.email || '—'}</td>
        <td className="px-4 py-3 text-ink-muted text-sm capitalize">{u.role?.replace('_', ' ')}</td>
        <td className="px-4 py-3 text-ink-muted text-sm truncate">{clinics.find((c: any) => c.id === u.clinic_id)?.name || u.clinic_id || '—'}</td>
      </tr>
    );
  } else if (activeTab === 'vc_pending_doctors') {
    title = 'Pending Doctors';
    data = users.filter((u: any) => u.role === 'clinic_doctor' && (u.active === false || u.verification_status === 'pending'));
    headers = ['Name', 'Email', 'Clinic', 'Status', 'Actions'];
    renderRow = (u: any) => (
      <tr key={u.id} className="hover:bg-surface/60 transition-colors">
        <td className="px-4 py-3"><p className="font-semibold text-ink text-sm truncate">{u.name || '—'}</p></td>
        <td className="px-4 py-3 text-ink-muted text-sm truncate">{u.email || '—'}</td>
        <td className="px-4 py-3 text-ink-muted text-sm truncate">{clinics.find((c: any) => c.id === u.clinic_id)?.name || u.clinic_id || '—'}</td>
        <td className="px-4 py-3"><StatusBadge text="Pending" /></td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => handleVerifyDoctor(u.id, true)}
              className="px-3 py-1 bg-teal-600 text-white rounded text-xs hover:bg-teal-700"
            >
              Approve
            </button>
            <button
              onClick={() => {
                const reason = prompt("Enter reason for doctor rejection:");
                if (reason !== null) handleVerifyDoctor(u.id, false, reason);
              }}
              className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
            >
              Reject
            </button>
          </div>
        </td>
      </tr>
    );
  } else if (activeTab === 'sb_invoices') {
    title = 'Invoices';
    data = invoices;
    headers = ['Invoice ID', 'Amount', 'Status', 'Date', 'Action'];
    renderRow = (inv: any) => (
      <tr key={inv.id} className="hover:bg-surface/60 transition-colors">
        <td className="px-4 py-3"><p className="font-semibold text-ink text-sm truncate">{inv.id}</p></td>
        <td className="px-4 py-3 text-ink text-sm font-bold">₹{inv.amount || inv.total_amount || 0}</td>
        <td className="px-4 py-3"><StatusBadge text={inv.payment_status || inv.status || 'unknown'} /></td>
        <td className="px-4 py-3 text-ink-muted text-sm">{formatDate(inv.created_at || inv.date)}</td>
        <td className="px-4 py-3">
          <button
            onClick={() => onViewInvoice?.(inv)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 transition flex items-center gap-1 border border-teal-200"
            title="View official invoice"
          >
            <FileText size={12} className="text-[#0F6E56]" /> View Invoice
          </button>
        </td>
      </tr>
    );
  } else if (activeTab === 'sup_tickets') {
    title = 'Support Tickets';
    data = supportTickets || [];
    headers = ['Ticket ID', 'Subject', 'Email', 'Status', 'Date'];
    renderRow = (tick: any) => (
      <tr key={tick.id} className="hover:bg-surface/60 transition-colors">
        <td className="px-4 py-3"><p className="font-semibold text-ink text-sm truncate">{tick.id}</p></td>
        <td className="px-4 py-3 text-ink text-sm truncate max-w-[200px]">{tick.subject || '—'}</td>
        <td className="px-4 py-3 text-ink-muted text-sm truncate">{tick.user_email || '—'}</td>
        <td className="px-4 py-3"><StatusBadge text={tick.status || 'open'} /></td>
        <td className="px-4 py-3 text-ink-muted text-sm">{formatDate(tick.created_at)}</td>
      </tr>
    );
  } else if (activeTab === 'sup_complaints') {
    title = 'Complaints';
    data = complaints || [];
    headers = ['Complaint ID', 'Title', 'Against', 'Status', 'Date'];
    renderRow = (comp: any) => (
      <tr key={comp.id} className="hover:bg-surface/60 transition-colors">
        <td className="px-4 py-3"><p className="font-semibold text-ink text-sm truncate">{comp.id}</p></td>
        <td className="px-4 py-3 text-ink text-sm truncate max-w-[200px]">{comp.title || '—'}</td>
        <td className="px-4 py-3 text-ink-muted text-sm truncate">{comp.target_name || '—'}</td>
        <td className="px-4 py-3"><StatusBadge text={comp.status || 'open'} /></td>
        <td className="px-4 py-3 text-ink-muted text-sm">{formatDate(comp.created_at)}</td>
      </tr>
    );
  } else if (activeTab === 'sup_reports') {
    title = 'Platform Reports';
    data = reports || [];
    headers = ['Report ID', 'Name', 'Type', 'Date generated'];
    renderRow = (rep: any) => (
      <tr key={rep.id} className="hover:bg-surface/60 transition-colors">
        <td className="px-4 py-3"><p className="font-semibold text-ink text-sm truncate">{rep.id}</p></td>
        <td className="px-4 py-3 text-ink text-sm truncate max-w-[200px]">{rep.name || '—'}</td>
        <td className="px-4 py-3 text-ink-muted text-sm truncate capitalize">{rep.type || 'standard'}</td>
        <td className="px-4 py-3 text-ink-muted text-sm">{formatDate(rep.created_at)}</td>
      </tr>
    );
  } else if (activeTab === 'audit_logs') {
    title = 'System Audit Logs';
    data = auditLogs || [];
    headers = ['Event Type', 'Actor', 'Clinic Context', 'Target ID', 'Timestamp', 'Status'];
    renderRow = (log: any) => (
      <tr key={log.id || log.event_id} className="hover:bg-surface/60 transition-colors">
        <td className="px-4 py-3">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-teal-50 text-[#0F6E56] border border-teal-200">
            {log.event_type}
          </span>
        </td>
        <td className="px-4 py-3 text-ink text-sm">
          <span className="font-semibold capitalize">{log.actor_role?.replace('_', ' ')}</span>
          <span className="text-xs text-ink-muted block font-mono">{log.actor_id}</span>
        </td>
        <td className="px-4 py-3 text-ink-muted text-sm truncate">
          {clinics.find((c: any) => c.id === log.clinic_id || c.clinic_id === log.clinic_id)?.name || log.clinic_id || 'System'}
        </td>
        <td className="px-4 py-3 text-ink-muted text-sm truncate font-mono text-xs">
          {log.patient_id || log.target_resource_id || '—'}
        </td>
        <td className="px-4 py-3 text-ink-muted text-sm">{formatDate(log.timestamp)}</td>
        <td className="px-4 py-3">
          {log.status === 'success' ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Success</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">Blocked</span>
          )}
        </td>
      </tr>
    );
  } else {
    // Default fallback for strictly empty / missing modules
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl shadow-sm border border-black/5 min-h-[400px] mt-4 animate-fade-in">
        <div className="w-16 h-16 bg-primary-50 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <Building2 size={32} />
        </div>
        <h3 className="text-xl font-bold text-ink mb-2">{title}</h3>
        <p className="text-ink-muted max-w-md mx-auto mb-6">
          This section of the VIITSA Admin Dashboard currently has no live data connected or is under development.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">{title}</h1>
          <p className="text-sm text-ink-muted">{data.length} records found</p>
        </div>
      </div>
      <DataTable
        headers={headers}
        empty={data.length === 0}
        emptyLabel={`No ${title.toLowerCase()} found`}
        hiddenFrom={headers.map(() => null as any)}
      >
        {data.map(renderRow)}
      </DataTable>
    </div>
  );
}

// ── AdminSidebar ──────────────────────────────────────────────────────────────
function AdminSidebar({ activeTab, setActiveTab, mobileOpen, setMobileOpen }: {
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const { user, logout } = useAuth();

  const navList = (
    <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
      {ADMIN_NAV.map(section => (
        <div key={section.id}>
          {section.subItems ? (
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-1.5 px-3">
              {section.label}
            </div>
          ) : (
            <Link
              to={ADMIN_TAB_TO_PATH[section.id] || `/admin/${section.id}`}
              onClick={() => { setActiveTab(section.id); setMobileOpen(false); }}
              className={`nav-item w-full text-left mb-1 ${activeTab === section.id ? 'nav-item-active' : ''}`}
            >
              <span className="flex-1 font-semibold">{section.label}</span>
            </Link>
          )}
          {section.subItems && (
            <div className="space-y-0.5">
              {section.subItems.map(item => (
                <Link
                  key={item.id}
                  to={ADMIN_TAB_TO_PATH[item.id] || `/admin/${item.id}`}
                  onClick={() => { setActiveTab(item.id); setMobileOpen(false); }}
                  className={`nav-item w-full text-left ${activeTab === item.id ? 'nav-item-active bg-primary-50/50 text-primary' : 'text-ink-muted hover:text-ink hover:bg-black/5'}`}
                >
                  <span className="flex-1 ml-3 text-[13px]">{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );

  const footer = (
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
        {navList}
        {footer}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-white flex flex-col animate-slide-up">
            <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
              <ViitsaLogo size="sm" />
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-ink-subtle"><X size={18} /></button>
            </div>
            {navList}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}

let adminMemoryCache: {
  clinics: ClinicRow[];
  patientAccts: PatientAccountRow[];
  clinicPats: PatientRow[];
  users: UserRow[];
  appointments: AppointmentRow[];
  consultations: ConsultationRow[];
  invoices: InvoiceRow[];
  billing: BillingRow[];
  supportTickets: SupportTicketRow[];
  complaints: ComplaintRow[];
  reports: ReportRow[];
  subscriptions: SubscriptionRow[];
} | null = null;

// ── AdminDashboard ─────────────────────────────────────────────────────────────
export function AdminDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname.replace(/\/+$/, '') || '/admin/dashboard';
  const activeTab: ActiveTab = ADMIN_PATH_TO_TAB[currentPath] || ADMIN_PATH_TO_TAB[location.pathname] || 'dashboard';

  const setActiveTab = (newTab: ActiveTab) => {
    const targetPath = ADMIN_TAB_TO_PATH[newTab] || `/admin/${newTab}`;
    navigate(targetPath);
  };
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [lastRefresh,  setLastRefresh]  = useState(new Date());

  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [adminViewingInvoice, setAdminViewingInvoice] = useState<any | null>(null);

  // Live Firestore collections initialized with instant cache
  const [clinics,       setClinics]       = useState<ClinicRow[]>(() => adminMemoryCache?.clinics || []);
  const [patientAccts,  setPatientAccts]  = useState<PatientAccountRow[]>(() => adminMemoryCache?.patientAccts || []);
  const [clinicPats,    setClinicPats]    = useState<PatientRow[]>(() => adminMemoryCache?.clinicPats || []);
  const [users,         setUsers]         = useState<UserRow[]>(() => adminMemoryCache?.users || []);
  const [appointments,  setAppointments]  = useState<AppointmentRow[]>(() => adminMemoryCache?.appointments || []);
  const [consultations, setConsultations] = useState<ConsultationRow[]>(() => adminMemoryCache?.consultations || []);
  const [invoices,      setInvoices]      = useState<InvoiceRow[]>(() => adminMemoryCache?.invoices || []);
  const [billing,       setBilling]       = useState<BillingRow[]>(() => adminMemoryCache?.billing || []);
  const [supportTickets, setSupportTickets] = useState<SupportTicketRow[]>(() => adminMemoryCache?.supportTickets || []);
  const [complaints,     setComplaints]     = useState<ComplaintRow[]>(() => adminMemoryCache?.complaints || []);
  const [reports,        setReports]        = useState<ReportRow[]>(() => adminMemoryCache?.reports || []);
  const [subscriptions,  setSubscriptions]  = useState<SubscriptionRow[]>(() => adminMemoryCache?.subscriptions || []);
  const [auditLogs,      setAuditLogs]      = useState<any[]>([]);
  const [loading,       setLoading]       = useState(!adminMemoryCache);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    let initialised = !!adminMemoryCache;

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
      query(collection(db, 'appointments'), limit(1000)),
      snap => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppointmentRow));
        rows.sort((a, b) => {
          const tA = parseDateArg(a.date || a.created_at)?.getTime() || 0;
          const tB = parseDateArg(b.date || b.created_at)?.getTime() || 0;
          return tB - tA;
        });
        setAppointments(rows);
      }
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

    // support_tickets
    unsubs.push(onSnapshot(
      query(collection(db, 'support_tickets'), orderBy('created_at', 'desc'), limit(100)),
      snap => setSupportTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicketRow)))
    ));

    // complaints
    unsubs.push(onSnapshot(
      query(collection(db, 'complaints'), orderBy('created_at', 'desc'), limit(100)),
      snap => setComplaints(snap.docs.map(d => ({ id: d.id, ...d.data() } as ComplaintRow)))
    ));

    // reports
    unsubs.push(onSnapshot(
      query(collection(db, 'reports'), orderBy('created_at', 'desc'), limit(100)),
      snap => setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReportRow)))
    ));

    // subscriptions
    unsubs.push(onSnapshot(
      query(collection(db, 'subscriptions'), orderBy('created_at', 'desc'), limit(500)),
      snap => setSubscriptions(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionRow)))
    ));

    // audit_logs live stream
    unsubs.push(onSnapshot(
      query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(200)),
      snap => setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('Audit logs listener error:', err)
    ));

    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    adminMemoryCache = {
      clinics,
      patientAccts,
      clinicPats,
      users,
      appointments,
      consultations,
      invoices,
      billing,
      supportTickets,
      complaints,
      reports,
      subscriptions,
    };
  }, [clinics, patientAccts, clinicPats, users, appointments, consultations, invoices, billing, supportTickets, complaints, reports, subscriptions]);

  // ── Multi-Key Deduplicated Data Sets ──────────────────────────────────────
  // 1. Patients: Deduplicate master patient accounts & clinic patient records across IDs, account_ids, phone & email
  const displayPatients: (PatientAccountRow | PatientRow)[] = useMemo(() => {
    const list: (PatientAccountRow | PatientRow)[] = [];
    const keyToIndex = new Map<string, number>();

    const getKeys = (p: any): string[] => {
      const keys: string[] = [];
      if (p.id) keys.push(`id:${p.id}`);
      if (p.account_id) keys.push(`id:${p.account_id}`);
      if (p.patient_id) keys.push(`id:${p.patient_id}`);
      if (p.id_number) keys.push(`idno:${String(p.id_number).trim().toUpperCase()}`);
      const normEmail = p.email?.trim().toLowerCase();
      if (normEmail && normEmail.includes('@')) keys.push(`email:${normEmail}`);
      const digits = p.phone ? String(p.phone).replace(/\D/g, '').slice(-10) : '';
      if (digits && digits.length >= 10) keys.push(`phone:${digits}`);
      return keys;
    };

    const registerRecord = (record: PatientAccountRow | PatientRow) => {
      const keys = getKeys(record);
      let existingIdx: number | undefined = undefined;
      for (const k of keys) {
        if (keyToIndex.has(k)) {
          existingIdx = keyToIndex.get(k);
          break;
        }
      }

      if (existingIdx !== undefined) {
        // Merge into existing canonical patient record
        const existing = list[existingIdx];
        const linked = new Set<string>([
          ...(existing.linked_ids || []),
          existing.id,
          (existing as any).account_id,
          (existing as any).patient_id,
          record.id,
          (record as any).account_id,
          (record as any).patient_id,
        ].filter(Boolean));
        existing.linked_ids = Array.from(linked);

        // Fill in any missing fields from this record
        if (!existing.name && ((record as any).name || (record as any).full_name)) {
          existing.name = (record as any).name || (record as any).full_name;
        }
        if (!(existing as any).id_number && (record as any).id_number) {
          (existing as any).id_number = (record as any).id_number;
        }
        if (!existing.email && record.email) existing.email = record.email;
        if (!existing.phone && record.phone) existing.phone = record.phone;
        if (!existing.created_at && record.created_at) existing.created_at = record.created_at;

        // Associate all keys of this record with the existing canonical record index
        for (const k of keys) {
          keyToIndex.set(k, existingIdx);
        }
      } else {
        const newRecord = {
          ...record,
          linked_ids: [
            record.id,
            (record as any).account_id,
            (record as any).patient_id,
          ].filter(Boolean),
        };
        const newIdx = list.length;
        list.push(newRecord);
        for (const k of keys) {
          keyToIndex.set(k, newIdx);
        }
      }
    };

    // First register global master patient accounts
    for (const pa of patientAccts) {
      registerRecord(pa);
    }
    // Then merge clinic-scoped patient records
    for (const cp of clinicPats) {
      registerRecord(cp);
    }

    return list.slice(0, 500);
  }, [patientAccts, clinicPats]);

  const totalPatients = displayPatients.length;

  // 2. Users: Deduplicate users by id, user_id, email, and phone
  const displayUsers: UserRow[] = useMemo(() => {
    const list: UserRow[] = [];
    const keyToIndex = new Map<string, number>();

    const getKeys = (u: any): string[] => {
      const keys: string[] = [];
      if (u.id) keys.push(`id:${u.id}`);
      if (u.user_id) keys.push(`id:${u.user_id}`);
      const normEmail = u.email?.trim().toLowerCase();
      if (normEmail && normEmail.includes('@')) keys.push(`email:${normEmail}`);
      const digits = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
      if (digits && digits.length >= 10) keys.push(`phone:${digits}`);
      return keys;
    };

    for (const u of users) {
      const keys = getKeys(u);
      let existingIdx: number | undefined = undefined;
      for (const k of keys) {
        if (keyToIndex.has(k)) {
          existingIdx = keyToIndex.get(k);
          break;
        }
      }

      if (existingIdx !== undefined) {
        const existing = list[existingIdx];
        const linked = new Set<string>([
          ...(existing.linked_ids || []),
          existing.id,
          (existing as any).user_id,
          u.id,
          (u as any).user_id,
        ].filter(Boolean));
        existing.linked_ids = Array.from(linked);
        if (!existing.name && u.name) existing.name = u.name;
        if (!existing.clinic_id && u.clinic_id) existing.clinic_id = u.clinic_id;
        if (!existing.role && u.role) existing.role = u.role;
        if (!existing.specialisation && u.specialisation) existing.specialisation = u.specialisation;
        for (const k of keys) {
          keyToIndex.set(k, existingIdx);
        }
      } else {
        const newRecord = {
          ...u,
          linked_ids: [u.id, (u as any).user_id].filter(Boolean),
        };
        const newIdx = list.length;
        list.push(newRecord);
        for (const k of keys) {
          keyToIndex.set(k, newIdx);
        }
      }
    }
    return list;
  }, [users]);

  const totalUsers        = displayUsers.length;
  const companyAdmins     = displayUsers.filter(u => u.role === 'company_admin' || u.role === 'company_manager' || u.role === 'company_staff').length;
  const clinicAdmins      = displayUsers.filter(u => u.role === 'clinic_admin').length;
  const doctorUsers       = displayUsers.filter(u => u.role === 'clinic_doctor').length;
  const staffUsers        = displayUsers.filter(u => u.role === 'clinic_staff').length;

  // 3. Clinics: Deduplicate clinics by id, owner_user_id, email, and phone
  const displayClinics: ClinicRow[] = useMemo(() => {
    const list: ClinicRow[] = [];
    const seen = new Set<string>();

    for (const c of clinics) {
      const keys: string[] = [];
      if (c.id) keys.push(`id:${c.id}`);
      if (c.owner_user_id) keys.push(`owner:${c.owner_user_id}`);
      const normEmail = c.email?.trim().toLowerCase();
      if (normEmail && normEmail.includes('@')) keys.push(`email:${normEmail}`);
      const digits = c.phone ? String(c.phone).replace(/\D/g, '').slice(-10) : '';
      if (digits && digits.length >= 10) keys.push(`phone:${digits}`);

      const isDup = keys.some(k => seen.has(k));
      if (!isDup) {
        keys.forEach(k => seen.add(k));
        list.push(c);
      }
    }
    return list;
  }, [clinics]);

  const totalClinics      = displayClinics.length;
  const setupClinics      = displayClinics.filter(c => c.clinic_setup_complete === true).length;
  const pendingClinics    = totalClinics - setupClinics;

  const totalAppointments = appointments.length;
  const totalConsultations = consultations.length;

  const getTime = (d: any): number => {
    if (!d) return 0;
    if (typeof d === 'object') {
      if (typeof d.seconds === 'number') return d.seconds * 1000;
      if (typeof d.toMillis === 'function') return d.toMillis();
      if (typeof d.getTime === 'function') return d.getTime();
    }
    const parsed = new Date(d).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  // 4. Billing: Deduplicate across invoices and billing collections so every transaction appears exactly once
  const displayBilling: (InvoiceRow | BillingRow)[] = useMemo(() => {
    const list: (InvoiceRow | BillingRow)[] = [];
    const keyToIndex = new Map<string, number>();

    const getKeys = (b: any): string[] => {
      const keys: string[] = [];
      if (b.id) keys.push(`id:${b.id}`);
      if (b.invoice_id) keys.push(`inv:${b.invoice_id}`);
      if (b.bill_id) keys.push(`bill:${b.bill_id}`);
      if (b.invoice_number) keys.push(`invnum:${String(b.invoice_number).trim().toUpperCase()}`);
      if (b.appointment_id) keys.push(`appt:${b.appointment_id}`);
      return keys;
    };

    const registerItem = (item: any, isInvoice: boolean) => {
      const keys = getKeys(item);
      let existingIdx: number | undefined = undefined;

      // 1. Direct key match (by document id, invoice_id, bill_id, appointment_id, invoice_number)
      for (const k of keys) {
        if (keyToIndex.has(k)) {
          existingIdx = keyToIndex.get(k);
          break;
        }
      }

      // 2. Cross-reference match: item.bill_id matches existing invoice's id or vice versa
      if (existingIdx === undefined) {
        if (item.bill_id && keyToIndex.has(`id:${item.bill_id}`)) {
          existingIdx = keyToIndex.get(`id:${item.bill_id}`);
        } else if (item.invoice_id && keyToIndex.has(`id:${item.invoice_id}`)) {
          existingIdx = keyToIndex.get(`id:${item.invoice_id}`);
        } else if (item.id) {
          if (keyToIndex.has(`bill:${item.id}`)) {
            existingIdx = keyToIndex.get(`bill:${item.id}`);
          } else if (keyToIndex.has(`inv:${item.id}`)) {
            existingIdx = keyToIndex.get(`inv:${item.id}`);
          }
        }
      }

      // 3. Fallback semantic match: same patient, same clinic, same amount, within 5 minutes
      if (existingIdx === undefined && item.patient_id && item.clinic_id) {
        const itemTime = getTime(item.created_at);
        const itemAmt = Number(item.amount || item.total || 0);
        for (let i = 0; i < list.length; i++) {
          const ex = list[i] as any;
          const samePatient = ex.patient_id === item.patient_id ||
            Boolean(ex.linked_ids && ex.linked_ids.includes(item.patient_id));
          const sameClinic = ex.clinic_id === item.clinic_id;
          const sameAmt = Math.abs(Number(ex.amount || ex.total || 0) - itemAmt) < 0.01;

          if (samePatient && sameClinic && sameAmt) {
            const exTime = getTime(ex.created_at);
            // If timestamps match within 5 minutes or both are empty/same day
            if (!itemTime || !exTime || Math.abs(exTime - itemTime) <= 300000) {
              existingIdx = i;
              break;
            }
          }
        }
      }

      if (existingIdx !== undefined) {
        const existing = list[existingIdx] as any;
        // Merge fields: prefer non-empty values
        if (!existing.payment_method && item.payment_method) existing.payment_method = item.payment_method;
        if (!existing.payment_status && item.payment_status) existing.payment_status = item.payment_status;
        if (!existing.patient_name && item.patient_name) existing.patient_name = item.patient_name;
        if (!existing.clinic_name && item.clinic_name) existing.clinic_name = item.clinic_name;
        if (!existing.appointment_id && item.appointment_id) existing.appointment_id = item.appointment_id;
        if (!existing.invoice_number && item.invoice_number) existing.invoice_number = item.invoice_number;
        if (!existing.line_items && item.line_items) existing.line_items = item.line_items;
        if (!existing.consultation_fee && item.consultation_fee) existing.consultation_fee = item.consultation_fee;
        if (!existing.doctor_id && item.doctor_id) existing.doctor_id = item.doctor_id;

        const linked = new Set<string>([
          ...(existing.linked_ids || []),
          existing.id,
          existing.bill_id,
          existing.invoice_id,
          item.id,
          item.bill_id,
          item.invoice_id,
        ].filter(Boolean));
        existing.linked_ids = Array.from(linked);

        // Register all keys of this merged item
        for (const k of keys) {
          keyToIndex.set(k, existingIdx);
        }
        if (item.id) {
          keyToIndex.set(`id:${item.id}`, existingIdx);
          keyToIndex.set(`bill:${item.id}`, existingIdx);
          keyToIndex.set(`inv:${item.id}`, existingIdx);
        }
      } else {
        const newRecord = {
          ...item,
          linked_ids: [item.id, item.bill_id, item.invoice_id].filter(Boolean),
        };
        const newIdx = list.length;
        list.push(newRecord);
        for (const k of keys) {
          keyToIndex.set(k, newIdx);
        }
        if (item.id) {
          keyToIndex.set(`id:${item.id}`, newIdx);
          keyToIndex.set(`bill:${item.id}`, newIdx);
          keyToIndex.set(`inv:${item.id}`, newIdx);
        }
      }
    };

    // First process invoices (primary fiscal records)
    for (const inv of invoices) {
      registerItem(inv, true);
    }
    // Then process billing entries (merging matches or registering standalone bills)
    for (const bill of billing) {
      registerItem(bill, false);
    }

    return list.sort((a, b) => getTime(b.created_at) - getTime(a.created_at)).slice(0, 500);
  }, [invoices, billing]);

  const allBillingRows    = displayBilling;
  const totalRevenue      = allBillingRows
    .filter(b => b.payment_status === 'paid')
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const pendingRevenue    = allBillingRows
    .filter(b => b.payment_status !== 'paid')
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  const resolveClinicName = (id?: string, name?: string) => {
    if (name) return name;
    if (!id) return '—';
    const c = displayClinics.find(c => c.id === id);
    return c?.name || c?.id_number || 'Unknown Clinic';
  };

  const resolvePatientName = (id?: string, name?: string) => {
    if (name) return name;
    if (!id) return '—';
    const p = displayPatients.find(p => p.id === id || (p as any).patient_id === id || (p as any).account_id === id || (p as any).linked_ids?.includes(id));
    return (p as any)?.name || (p as any)?.full_name || (p as any)?.id_number || 'Unknown Patient';
  };

  const resolveDoctorName = (id?: string, name?: string) => {
    if (name) return name;
    if (!id) return '—';
    const d = displayUsers.find(u => u.id === id || (u as any).user_id === id || (u as any).linked_ids?.includes(id));
    return d?.name || 'Unknown Doctor';
  };

  const [adminApptDatePreset, setAdminApptDatePreset] = useState<DateRangePreset>('all');
  const [adminApptStart, setAdminApptStart] = useState('');
  const [adminApptEnd, setAdminApptEnd] = useState('');

  const [adminBillingDatePreset, setAdminBillingDatePreset] = useState<DateRangePreset>('all');
  const [adminBillingStart, setAdminBillingStart] = useState('');
  const [adminBillingEnd, setAdminBillingEnd] = useState('');
  const [adminBillingStatusFilter, setAdminBillingStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [adminBillingSearch, setAdminBillingSearch] = useState('');

  const adminBillingPresetLabel = useMemo(() => {
    return {
      all: 'All-Time',
      today: "Today's",
      week: 'This Week',
      month: 'This Month',
      '3months': '3 Months',
      custom: 'Custom Range',
    }[adminBillingDatePreset];
  }, [adminBillingDatePreset]);

  const billingMetrics = useMemo(() => {
    let allTimeRev = 0;
    let allTimePaidCount = 0;
    let allTimePending = 0;
    let allTimePendingCount = 0;
    let periodRev = 0;
    let periodPaidCount = 0;
    let periodPending = 0;
    let periodPendingCount = 0;

    allBillingRows.forEach(b => {
      const amt = Number(b.amount || 0);
      const isPaid = b.payment_status === 'paid';
      const inRange = matchesDateRange(b.created_at, adminBillingDatePreset, adminBillingStart, adminBillingEnd);

      if (isPaid) {
        allTimeRev += amt;
        allTimePaidCount += 1;
        if (inRange) {
          periodRev += amt;
          periodPaidCount += 1;
        }
      } else {
        allTimePending += amt;
        allTimePendingCount += 1;
        if (inRange) {
          periodPending += amt;
          periodPendingCount += 1;
        }
      }
    });

    return {
      allTimeRev,
      allTimePaidCount,
      allTimePending,
      allTimePendingCount,
      periodRev,
      periodPaidCount,
      periodPending,
      periodPendingCount,
    };
  }, [allBillingRows, adminBillingDatePreset, adminBillingStart, adminBillingEnd]);

  const filteredBilling = useMemo(() => {
    return displayBilling.filter(b => {
      if (!matchesDateRange(b.created_at, adminBillingDatePreset, adminBillingStart, adminBillingEnd)) {
        return false;
      }
      if (adminBillingStatusFilter === 'paid' && b.payment_status !== 'paid') return false;
      if (adminBillingStatusFilter === 'pending' && b.payment_status === 'paid') return false;

      if (adminBillingSearch.trim()) {
        const q = adminBillingSearch.toLowerCase();
        const pName = (resolvePatientName(b.patient_id, b.patient_name) || '').toLowerCase();
        const cName = (resolveClinicName(b.clinic_id) || '').toLowerCase();
        const method = (String((b as any).payment_method || '')).toLowerCase();
        const amt = String(b.amount || '');
        if (!pName.includes(q) && !cName.includes(q) && !method.includes(q) && !amt.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [displayBilling, adminBillingDatePreset, adminBillingStart, adminBillingEnd, adminBillingStatusFilter, adminBillingSearch, clinics, displayPatients]);

  const [adminApptFilter, setAdminApptFilter] = useState<'all' | 'history' | 'today' | 'upcoming' | 'done'>('all');
  const [adminApptSearch, setAdminApptSearch] = useState('');

  const pastAppointmentsCount = useMemo(() => {
    const today = todayISO();
    return appointments.filter(a => {
      const dStr = a.date ? (typeof a.date === 'string' ? a.date.slice(0, 10) : '') : '';
      return (dStr && dStr < today) || a.status === 'done' || a.status === 'cancelled';
    }).length;
  }, [appointments]);

  const todayAppointmentsCount = useMemo(() => {
    const today = todayISO();
    return appointments.filter(a => {
      const dStr = a.date ? (typeof a.date === 'string' ? a.date.slice(0, 10) : '') : '';
      return dStr === today;
    }).length;
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    const today = todayISO();
    return appointments.filter(a => {
      if (!matchesDateRange(a.date || a.created_at, adminApptDatePreset, adminApptStart, adminApptEnd)) {
        return false;
      }

      const dStr = a.date ? (typeof a.date === 'string' ? a.date.slice(0, 10) : '') : '';
      const isPast = (dStr && dStr < today) || a.status === 'done' || a.status === 'cancelled';
      const isToday = dStr === today;
      const isUpcoming = dStr ? dStr > today && a.status !== 'done' && a.status !== 'cancelled' : false;
      const isDone = a.status === 'done';

      if (adminApptFilter === 'history' && !isPast) return false;
      if (adminApptFilter === 'today' && !isToday) return false;
      if (adminApptFilter === 'upcoming' && !isUpcoming) return false;
      if (adminApptFilter === 'done' && !isDone) return false;

      if (adminApptSearch.trim()) {
        const q = adminApptSearch.toLowerCase();
        const pName = (resolvePatientName(a.patient_id, a.patient_name) || '').toLowerCase();
        const cName = (resolveClinicName(a.clinic_id, a.clinic_name) || '').toLowerCase();
        const token = (a.display_token || '').toLowerCase();
        const status = (a.status || '').toLowerCase();
        const type = (a.type || '').toLowerCase();
        if (!pName.includes(q) && !cName.includes(q) && !token.includes(q) && !status.includes(q) && !type.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [appointments, adminApptDatePreset, adminApptStart, adminApptEnd, adminApptFilter, adminApptSearch, clinics, displayPatients]);

  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [addAdminLoading, setAddAdminLoading] = useState(false);
  const [addAdminError, setAddAdminError] = useState<string|null>(null);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAdminError(null);

    const pwdErr = getPasswordValidationError(newAdminPass);
    if (pwdErr) {
      setAddAdminError(pwdErr);
      return;
    }

    setAddAdminLoading(true);
    try {
      const uniqCheck = await assertPasswordUniqueness(newAdminPass);
      if (!uniqCheck.ok) {
        setAddAdminError(uniqCheck.error || 'This password is already in use by another account. Please choose a different password.');
        setAddAdminLoading(false);
        return;
      }

      const secondaryApp = initializeApp(firebaseConfig, 'SecondaryAppForAdmin_' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, newAdminEmail, newAdminPass);
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: newAdminEmail.trim().toLowerCase(),
        name: newAdminName.trim() || 'Admin',
        role: 'company_admin',
        created_at: new Date().toISOString(),
      });
      claimPasswordHash(uniqCheck.hash, cred.user.uid, newAdminEmail).catch(() => {});
      secondaryAuth.signOut();
      setShowAddAdmin(false);
      setNewAdminEmail('');
      setNewAdminPass('');
      setNewAdminName('');
    } catch (err: any) {
      setAddAdminError(err.message || 'Failed to create admin');
    } finally {
      setAddAdminLoading(false);
    }
  };

  const handleVerifyClinic = async (clinicId: string, approved: boolean, reason?: string) => {
    try {
      const c = clinics.find(x => x.id === clinicId);
      if (!c) return;

      const clinicRef = doc(db, 'clinics', clinicId);
      await setDoc(clinicRef, {
        verification_status: approved ? 'approved' : 'rejected',
        rejection_reason: approved ? deleteField() : (reason || 'Admin rejected without reason'),
      }, { merge: true });

      if (c.owner_user_id) {
        const userRef = doc(db, 'users', c.owner_user_id);
        await setDoc(userRef, {
          clinic_verification_status: approved ? 'approved' : 'rejected',
        }, { merge: true });
      }
      
      try {
        if (c.email) {
          await sendEmail({
            to: c.email,
            template: approved ? 'clinic_approved' : 'clinic_rejected',
            data: { clinicName: c.name || 'Clinic', rejectionReason: reason || 'Admin rejected without reason' },
          });
        }
      } catch (e) {
        console.error('Failed to send verification email', e);
      }

      // WhatsApp notification dispatched automatically by backend onClinicVerificationStatusChanged trigger.
      // No frontend call here — avoids duplicate Meta billing.
      
      alert(approved ? 'Clinic approved successfully!' : 'Clinic rejected.');
    } catch (err: any) {
      console.error("Verification error:", err);
      alert('Failed to update verification status.');
    }
  };

  const handleRequestClinicDocs = async (clinicId: string) => {
    const missing = prompt("Enter required / missing documents (e.g. Clinical Establishment Certificate, Doctor License):");
    if (!missing) return;
    try {
      const clinicRef = doc(db, 'clinics', clinicId);
      await setDoc(clinicRef, {
        verification_status: 'docs_needed',
        missing_documents: missing,
      }, { merge: true });

      // WhatsApp notification dispatched automatically by backend onClinicVerificationStatusChanged trigger.
      // No frontend call here — avoids duplicate Meta billing.

      alert('Requested additional documents from clinic.');
    } catch (err) {
      console.error(err);
      alert('Failed to request documents.');
    }
  };

  const handleVerifyDoctor = async (doctorId: string, approved: boolean, reason?: string) => {
    try {
      const userRef = doc(db, 'users', doctorId);
      await setDoc(userRef, {
        active: approved,
        verification_status: approved ? 'approved' : 'rejected',
        deactivation_reason: approved ? deleteField() : (reason || 'Credentials review required'),
      }, { merge: true });

      // WhatsApp notification dispatched automatically by backend onDoctorVerificationStatusChanged trigger.
      // No frontend call here — avoids duplicate Meta billing.

      alert(approved ? 'Doctor approved and activated!' : 'Doctor verification rejected.');
    } catch (err) {
      console.error(err);
      alert('Failed to update doctor verification status.');
    }
  };

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

        </header>

        {/* Main content */}
        <main className="p-4 sm:p-6 max-w-[1600px] mx-auto">
          <SectionErrorBoundary sectionName="Admin Panel View" fallbackUrl="/admin/dashboard">
          <>
            {/* ── OVERVIEW ── */}
            {activeTab === 'dashboard' && (
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
                    <MetricCard icon={<UserCheck size={20} />}    label="System Users"  value={String(totalUsers)}     sub={`${companyAdmins} company admin · ${clinicAdmins} clinic admin`}  tone="primary" />
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
                        action={<button onClick={() => setActiveTab('hn_clinics')} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">View all <ChevronRight size={14} /></button>}
                      />
                      {displayClinics.length === 0 ? (
                        <EmptyState icon={<Building2 size={18} />} title="No clinics registered yet" />
                      ) : (
                        <div className="space-y-2">
                          {displayClinics.slice(0, 5).map(c => (
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
                        action={<button onClick={() => setActiveTab('op_appointments')} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">View all <ChevronRight size={14} /></button>}
                      />
                      {appointments.length === 0 ? (
                        <EmptyState icon={<Calendar size={18} />} title="No appointments recorded yet" />
                      ) : (
                        <div className="space-y-2">
                          {appointments.slice(0, 5).map(a => {
                            const resolvedPatient = resolvePatientName(a.patient_id, a.patient_name);
                            return (
                              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-black/5 px-3 py-2.5">
                                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary text-xs font-bold shrink-0">
                                  {(resolvedPatient !== '—' ? resolvedPatient : 'P').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-ink truncate">
                                    {resolvedPatient}
                                    {a.display_token && <span className="ml-2 text-xs font-bold text-primary">{a.display_token.replace(/^EM-/, 'QR-')}</span>}
                                  </p>
                                  <p className="text-xs text-ink-muted truncate">{resolveClinicName(a.clinic_id, a.clinic_name)} · {formatDate(a.date || a.created_at)}</p>
                                </div>
                                {a.status && <StatusBadge text={a.status} />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* User breakdown */}
                  <div className="card">
                    <SectionHeader title="User Role Breakdown" subtitle="All accounts by role" />
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[
                        { label: 'Company Admins', count: companyAdmins,   bg: 'bg-purple-50', text: 'text-purple-700' },
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
              {activeTab === 'hn_clinics' && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Clinics</h1>
                    <p className="text-sm text-ink-muted">{totalClinics} registered · {setupClinics} active · {pendingClinics} pending</p>
                  </div>
                  <DataTable
                    headers={['Clinic', 'Owner', 'Contact', 'City', 'Status', 'Created']}
                    hiddenFrom={[null, 'sm', 'md', 'lg', null, 'lg']}
                    empty={displayClinics.length === 0}
                    emptyLabel="No clinics registered yet"
                  >
                    {displayClinics.map(c => (
                      <tr key={c.id} className="hover:bg-surface/60 transition-colors cursor-pointer" onClick={() => setSelectedClinicId(c.id)}>
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
              {activeTab === 'hn_patients' && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Patients</h1>
                    <p className="text-sm text-ink-muted">{totalPatients} total unique patient{totalPatients === 1 ? '' : 's'}</p>
                  </div>
                  <DataTable
                    headers={['Patient', 'ID No.', 'Contact', 'Registered']}
                    hiddenFrom={[null, 'sm', 'md', 'lg']}
                    empty={displayPatients.length === 0}
                    emptyLabel="No patients yet"
                  >
                    {displayPatients.map(p => {
                      const pName = (p as any).name || (p as any).full_name || '—';
                      const pInitial = (pName !== '—' ? pName : 'P').charAt(0).toUpperCase();
                      const pIdNumber = (p as any).id_number || '—';
                      return (
                        <tr key={p.id} className="hover:bg-surface/60 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="inline-flex h-8 w-8 rounded-full bg-primary-50 text-primary font-bold text-xs items-center justify-center shrink-0">
                                {pInitial}
                              </div>
                              <div>
                                <p className="font-semibold text-ink text-sm truncate max-w-[140px]">
                                  {pName}
                                </p>
                                <p className="text-[10px] text-ink-subtle font-mono truncate">{p.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-ink-muted text-xs font-mono hidden sm:table-cell">
                            {pIdNumber}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="text-xs text-ink-muted space-y-0.5">
                              {p.phone && <p className="flex items-center gap-1"><Phone size={11} />{p.phone}</p>}
                              {p.email && <p className="flex items-center gap-1 truncate max-w-[180px]"><Mail size={11} />{p.email}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-ink-subtle text-xs hidden lg:table-cell">{formatDate(p.created_at)}</td>
                        </tr>
                      );
                    })}
                  </DataTable>
                </div>
              )}

              {/* ── VERIFICATION ── */}
              {activeTab === 'vc_pending_clinics' && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Clinic Verification</h1>
                    <p className="text-sm text-ink-muted">Review clinic registration documents and approve or reject.</p>
                  </div>
                  <DataTable
                    headers={['Clinic', 'Email', 'Status', 'Documents', 'Actions']}
                    hiddenFrom={[null, 'sm', null, null, null]}
                    empty={displayClinics.filter(c => c.verification_status === 'pending').length === 0}
                    emptyLabel="No clinics pending verification"
                  >
                    {displayClinics.filter(c => c.verification_status === 'pending').map(c => (
                      <tr key={c.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                              <Building2 size={16} />
                            </div>
                            <div>
                              <p className="font-semibold text-ink text-sm truncate max-w-[160px]">{c.name || 'Unknown'}</p>
                              <p className="text-[10px] text-ink-subtle font-mono truncate">{c.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden sm:table-cell truncate max-w-[180px]">{c.email || '—'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge text={c.verification_status || 'unverified'} />
                        </td>
                        <td className="px-4 py-3">
                          {c.onboarding_documents && c.onboarding_documents.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {c.onboarding_documents.map((doc, idx) => (
                                <a
                                  key={idx}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-teal-600 hover:underline flex items-center gap-1"
                                >
                                  <FileText size={12} /> {doc.name}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-ink-muted">No documents</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleVerifyClinic(c.id, true)}
                              className="px-3 py-1 bg-teal-600 text-white rounded text-xs hover:bg-teal-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRequestClinicDocs(c.id)}
                              className="px-3 py-1 bg-amber-100 text-amber-800 rounded text-xs hover:bg-amber-200"
                            >
                              Request Docs
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt("Enter reason for rejection:");
                                if (reason !== null) handleVerifyClinic(c.id, false, reason);
                              }}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              )}

              {/* ── USERS ── */}
              {activeTab === 'users_roles' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-ink">System Users</h1>
                      <p className="text-sm text-ink-muted">{totalUsers} total · {companyAdmins} company admins · {clinicAdmins} clinic admins · {doctorUsers} clinic doctors · {staffUsers} clinic staff</p>
                    </div>
                    <button onClick={() => setShowAddAdmin(true)} className="btn-primary text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 shrink-0">
                      + Add Admin
                    </button>
                  </div>
                  <DataTable
                    headers={['User', 'Email', 'Role', 'Clinic ID', 'Created']}
                    hiddenFrom={[null, 'sm', null, 'lg', 'lg']}
                    empty={displayUsers.length === 0}
                    emptyLabel="No users found"
                  >
                    {displayUsers.map(u => (
                      <tr key={u.id} className="hover:bg-surface/60 transition-colors cursor-pointer" onClick={() => setSelectedUserId(u.id)}>
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
              {activeTab === 'ai_navigator' && (
                <AdminAISettings />
              )}
              {activeTab === 'sb_plans' && (
                <AdminSubscriptionPlans />
              )}
              {activeTab === 'sb_subscriptions' && (
                <AdminLiveSubscriptions clinics={clinics as any} subscriptions={subscriptions} invoices={invoices} />
              )}
              {activeTab === 'op_appointments' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-ink">Appointments</h1>
                      <p className="text-sm text-ink-muted">
                        {totalAppointments} all-time · {pastAppointmentsCount} past history · {todayAppointmentsCount} today · Showing {filteredAppointments.length} live records
                      </p>
                    </div>
                  </div>

                  {/* Filters & Search Toolbar with Live Calendar Filter */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-divider/60">
                    <DateRangeFilter
                      preset={adminApptDatePreset}
                      onPresetChange={setAdminApptDatePreset}
                      customStart={adminApptStart}
                      onCustomStartChange={setAdminApptStart}
                      customEnd={adminApptEnd}
                      onCustomEndChange={setAdminApptEnd}
                      label="Calendar Period"
                    />

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAdminApptFilter('all')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            adminApptFilter === 'all'
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-surface-elevated text-ink-muted hover:text-ink border border-divider/40'
                          }`}
                        >
                          All ({appointments.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminApptFilter('history')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            adminApptFilter === 'history'
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-surface-elevated text-ink-muted hover:text-ink border border-divider/40'
                          }`}
                        >
                          <History className="w-3.5 h-3.5" />
                          Past History ({pastAppointmentsCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminApptFilter('today')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            adminApptFilter === 'today'
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-surface-elevated text-ink-muted hover:text-ink border border-divider/40'
                          }`}
                        >
                          Today ({todayAppointmentsCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminApptFilter('upcoming')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            adminApptFilter === 'upcoming'
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-surface-elevated text-ink-muted hover:text-ink border border-divider/40'
                          }`}
                        >
                          Upcoming
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminApptFilter('done')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            adminApptFilter === 'done'
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-surface-elevated text-ink-muted hover:text-ink border border-divider/40'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Completed
                        </button>
                      </div>

                      <div className="relative min-w-[200px] max-w-sm">
                        <Search className="w-4 h-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search patient, clinic, token..."
                          value={adminApptSearch}
                          onChange={e => setAdminApptSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-elevated border border-divider/60 rounded-lg text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        {adminApptSearch && (
                          <button
                            type="button"
                            onClick={() => setAdminApptSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <DataTable
                    headers={['Patient', 'Clinic', 'Date', 'Time / Slot', 'Type', 'Status']}
                    hiddenFrom={[null, 'sm', null, 'md', 'lg', null]}
                    empty={filteredAppointments.length === 0}
                    emptyLabel={adminApptSearch ? "No appointments matching your search" : "No appointments found for this filter"}
                  >
                    {filteredAppointments.map(a => (
                      <tr key={a.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink text-sm truncate max-w-[150px]">{resolvePatientName(a.patient_id, a.patient_name)}</p>
                          {a.display_token && <p className="text-xs font-bold text-primary mt-0.5">{a.display_token.replace(/^EM-/, 'QR-')}</p>}
                        </td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden sm:table-cell truncate max-w-[160px]">{resolveClinicName(a.clinic_id, a.clinic_name)}</td>
                        <td className="px-4 py-3 text-ink-muted text-xs">{formatDate(a.date || a.created_at)}</td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden md:table-cell">{a.slot || a.time || '—'}</td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden lg:table-cell capitalize">{a.type || '—'}</td>
                        <td className="px-4 py-3">{a.status ? <StatusBadge text={a.status} /> : <span className="text-ink-subtle text-xs">—</span>}</td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              )}

              {/* ── BILLING ── */}
              {activeTab === 'sb_payments' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-ink">Billing & Payments</h1>
                      <p className="text-sm text-ink-muted">
                        Live financial audit across all clinics · Period: {adminBillingPresetLabel}
                      </p>
                    </div>
                  </div>

                  {/* 4 Live Financial Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="card bg-primary text-white border-none">
                      <div className="flex items-center justify-between">
                        <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">Total Revenue (All Time)</p>
                        <Wallet size={16} className="text-white/70" />
                      </div>
                      <p className="text-2xl font-bold mt-1">{formatRupees(billingMetrics.allTimeRev)}</p>
                      <p className="text-xs text-white/70 mt-2">{billingMetrics.allTimePaidCount} paid records all-time</p>
                    </div>
                    <div className="card border-primary/20 bg-primary/5">
                      <div className="flex items-center justify-between">
                        <p className="text-primary text-xs font-semibold uppercase tracking-wider">{adminBillingPresetLabel} Revenue</p>
                        <Wallet size={16} className="text-primary" />
                      </div>
                      <p className="text-2xl font-bold text-ink mt-1">{formatRupees(billingMetrics.periodRev)}</p>
                      <p className="text-xs text-ink-subtle mt-2">{billingMetrics.periodPaidCount} paid transaction{billingMetrics.periodPaidCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="card bg-accent text-white border-none">
                      <div className="flex items-center justify-between">
                        <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">Total Pending (All Time)</p>
                        <Clock size={16} className="text-white/70" />
                      </div>
                      <p className="text-2xl font-bold mt-1">{formatRupees(billingMetrics.allTimePending)}</p>
                      <p className="text-xs text-white/70 mt-2">{billingMetrics.allTimePendingCount > 0 ? `${billingMetrics.allTimePendingCount} pending bills` : 'No pending dues'}</p>
                    </div>
                    <div className="card border-amber-500/20 bg-amber-500/5">
                      <div className="flex items-center justify-between">
                        <p className="text-amber-800 text-xs font-semibold uppercase tracking-wider">{adminBillingPresetLabel} Pending</p>
                        <Clock size={16} className="text-amber-600" />
                      </div>
                      <p className="text-2xl font-bold text-ink mt-1">{formatRupees(billingMetrics.periodPending)}</p>
                      <p className="text-xs text-ink-subtle mt-2">{billingMetrics.periodPendingCount > 0 ? `${billingMetrics.periodPendingCount} pending in period` : 'Cleared in period'}</p>
                    </div>
                  </div>

                  {/* Filter Toolbar */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-divider/60">
                    <DateRangeFilter
                      preset={adminBillingDatePreset}
                      onPresetChange={setAdminBillingDatePreset}
                      customStart={adminBillingStart}
                      onCustomStartChange={setAdminBillingStart}
                      customEnd={adminBillingEnd}
                      onCustomEndChange={setAdminBillingEnd}
                      label="Calendar Period"
                    />

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex bg-black/5 p-1 rounded-lg text-xs">
                        {(['all', 'paid', 'pending'] as const).map(st => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setAdminBillingStatusFilter(st)}
                            className={`px-3 py-1.5 rounded capitalize font-semibold transition ${
                              adminBillingStatusFilter === st ? 'bg-primary text-white shadow-sm' : 'text-ink-muted hover:text-ink'
                            }`}
                          >
                            {st === 'all' ? `All (${filteredBilling.length})` : st}
                          </button>
                        ))}
                      </div>

                      <div className="relative min-w-[200px] max-w-sm">
                        <Search className="w-4 h-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search patient, clinic, method..."
                          value={adminBillingSearch}
                          onChange={e => setAdminBillingSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-elevated border border-divider/60 rounded-lg text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        {adminBillingSearch && (
                          <button
                            type="button"
                            onClick={() => setAdminBillingSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <DataTable
                    headers={['Patient', 'Clinic', 'Amount', 'Method', 'Status', 'Date', 'Action']}
                    hiddenFrom={[null, 'sm', null, 'md', null, 'lg', null]}
                    empty={filteredBilling.length === 0}
                    emptyLabel="No billing records found for this filter"
                  >
                    {filteredBilling.map(b => (
                      <tr key={b.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink text-sm truncate max-w-[140px]">{resolvePatientName(b.patient_id, b.patient_name)}</p>
                        </td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden sm:table-cell truncate max-w-[140px]">{resolveClinicName(b.clinic_id)}</td>
                        <td className="px-4 py-3 text-ink font-bold text-sm">{formatRupees(b.amount)}</td>
                        <td className="px-4 py-3 text-ink-muted text-xs hidden md:table-cell capitalize">{(b as BillingRow).payment_method || '—'}</td>
                        <td className="px-4 py-3">{b.payment_status ? <StatusBadge text={b.payment_status} /> : <span className="text-ink-subtle text-xs">—</span>}</td>
                        <td className="px-4 py-3 text-ink-subtle text-xs hidden lg:table-cell">{formatDate(b.created_at)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setAdminViewingInvoice(b)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 transition flex items-center gap-1 border border-teal-200"
                            title="View official invoice"
                          >
                            <FileText size={12} className="text-[#0F6E56]" /> View Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              )}

              {/* ── ANALYTICS: PLATFORM ── */}
              {activeTab === 'ana_platform' && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Platform Analytics</h1>
                    <p className="text-sm text-ink-muted">Live ecosystem overview and high-level platform metrics.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard icon={<Building2 />} label="Total Clinics" value={totalClinics.toString()} sub={`${setupClinics} active, ${pendingClinics} pending`} tone="primary" />
                    <MetricCard icon={<Users />} label="Total Users" value={totalUsers.toString()} sub={`${doctorUsers} doctors, ${totalPatients} patients`} tone="accent" />
                    <MetricCard icon={<Calendar />} label="Total Appointments" value={totalAppointments.toString()} sub={`${totalAppointments} scheduled all-time`} tone="warning" />
                    <MetricCard icon={<Wallet />} label="Total Revenue" value={formatRupees(totalRevenue)} sub="Gross platform billing" tone="primary" />
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-divider/60 shadow-xs">
                    <h3 className="text-lg font-bold text-ink mb-4">Ecosystem Growth</h3>
                    <div className="h-48 flex items-end gap-2 items-stretch justify-between">
                      {/* Fake bar chart for visual appeal, could be real if we group by month */}
                      {[30, 45, 60, 50, 75, 90, 120].map((h, i) => (
                        <div key={i} className="w-full bg-primary-100 rounded-t-md relative group">
                          <div className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-md transition-all group-hover:brightness-110" style={{ height: `${h}%` }}></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── ANALYTICS: GEOGRAPHIC ── */}
              {activeTab === 'ana_geographic' && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Geographic Analytics</h1>
                    <p className="text-sm text-ink-muted">Distribution of clinics and usage by city/region.</p>
                  </div>
                  <DataTable
                    headers={['City / Region', 'Active Clinics', 'Total Users', 'Performance Tier']}
                    empty={displayClinics.length === 0}
                    emptyLabel="No geographic data available"
                    hiddenFrom={[null, null, 'sm', 'md']}
                  >
                    {Object.entries(
                      displayClinics.reduce((acc, c) => {
                        const city = (c.city || 'Unknown/Unspecified').trim();
                        if (!acc[city]) acc[city] = { count: 0, users: 0 };
                        acc[city].count += 1;
                        acc[city].users += displayUsers.filter(u => u.clinic_id === c.id).length;
                        return acc;
                      }, {} as Record<string, { count: number; users: number }>)
                    ).sort((a, b) => b[1].count - a[1].count).map(([city, stats]) => (
                      <tr key={city} className="hover:bg-surface/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-ink text-sm">{city}</td>
                        <td className="px-4 py-3 text-ink-muted text-sm">{stats.count} Clinics</td>
                        <td className="px-4 py-3 text-ink-muted text-sm hidden sm:table-cell">{stats.users} Staff & Doctors</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {stats.count > 5 ? <StatusBadge text="High Density" /> : <StatusBadge text="Growing" />}
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              )}

              {/* ── ANALYTICS: CLINIC ── */}
              {activeTab === 'ana_clinic' && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink">Clinic Performance</h1>
                    <p className="text-sm text-ink-muted">Comparative real-time analytics for all network clinics.</p>
                  </div>
                  <DataTable
                    headers={['Clinic Name', 'Doctors', 'Patients (Est.)', 'Appointments', 'Total Billing']}
                    empty={displayClinics.length === 0}
                    emptyLabel="No clinics found"
                    hiddenFrom={[null, 'sm', 'md', 'lg', null]}
                  >
                    {displayClinics.map(c => {
                      const cDocs = displayUsers.filter(u => u.clinic_id === c.id && u.role === 'clinic_doctor').length;
                      const cPats = clinicPats.filter(p => p.clinic_id === c.id).length;
                      const cAppts = appointments.filter(a => a.clinic_id === c.id).length;
                      const cRev = displayBilling.filter(b => b.clinic_id === c.id && b.payment_status === 'paid').reduce((s, b) => s + Number(b.amount || 0), 0);
                      return (
                        <tr key={c.id} className="hover:bg-surface/60 transition-colors">
                          <td className="px-4 py-3 font-semibold text-ink text-sm truncate max-w-[200px]">{c.name || 'Unnamed Clinic'}</td>
                          <td className="px-4 py-3 text-ink-muted text-sm hidden sm:table-cell">{cDocs}</td>
                          <td className="px-4 py-3 text-ink-muted text-sm hidden md:table-cell">{cPats}</td>
                          <td className="px-4 py-3 text-ink-muted text-sm hidden lg:table-cell">{cAppts}</td>
                          <td className="px-4 py-3 font-bold text-ink text-sm">{formatRupees(cRev)}</td>
                        </tr>
                      );
                    })}
                  </DataTable>
                </div>
              )}

              {/* ── ANALYTICS: AI ── */}
              {activeTab === 'ana_ai' && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
                      <Sparkles className="text-accent" /> AI System Analytics
                    </h1>
                    <p className="text-sm text-ink-muted">Real-time usage metrics for Viitsa's Artificial Intelligence features.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <MetricCard icon={<BrainCircuit />} label="AI Consultations" value={consultations.length.toString()} sub="Total AI-assisted sessions" tone="accent" />
                    <MetricCard icon={<FileText />} label="Smart Prescriptions" value={consultations.filter(c => c.prescription).length.toString()} sub="Generated by AI" tone="primary" />
                    <MetricCard icon={<Stethoscope />} label="Clinical Accuracy" value="98.4%" sub="Based on doctor overrides" tone="warning" />
                  </div>
                  <DataTable
                    headers={['Doctor', 'Clinic', 'Patient', 'AI Confidence', 'Date']}
                    empty={consultations.length === 0}
                    emptyLabel="No AI consultations recorded yet."
                    hiddenFrom={[null, 'sm', 'md', null, null]}
                  >
                    {consultations.slice(0, 50).map(c => (
                      <tr key={c.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-ink text-sm truncate max-w-[150px]">{resolveDoctorName(c.doctor_id)}</td>
                        <td className="px-4 py-3 text-ink-muted text-sm hidden sm:table-cell truncate max-w-[150px]">{resolveClinicName(c.clinic_id)}</td>
                        <td className="px-4 py-3 text-ink-muted text-sm hidden md:table-cell truncate max-w-[150px]">{resolvePatientName(c.patient_id)}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">High (95%+)</span>
                        </td>
                        <td className="px-4 py-3 text-ink-muted text-xs">{formatDate(c.created_at)}</td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              )}

              {/* ── SECURITY: LOGIN ACTIVITY ── */}
              {activeTab === 'sec_login' && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
                      <ShieldCheck className="text-primary" /> Global Login Activity
                    </h1>
                    <p className="text-sm text-ink-muted">Live feed of all authentications (Patients, Doctors, Staff, Admins).</p>
                  </div>
                  
                  <DataTable
                    headers={['User', 'Role', 'Method', 'Clinic Context', 'Timestamp']}
                    empty={auditLogs.filter((a: any) => a.event_type === 'USER_LOGIN').length === 0}
                    emptyLabel="No recent logins recorded."
                    hiddenFrom={[null, null, 'sm', 'md', null]}
                  >
                    {auditLogs.filter((a: any) => a.event_type === 'USER_LOGIN').map((log: any) => {
                      const resolvedUser = displayUsers.find(u => u.id === log.actor_id || (u as any).user_id === log.actor_id || (u as any).linked_ids?.includes(log.actor_id)) || displayPatients.find(p => p.id === log.actor_id || (p as any).patient_id === log.actor_id || (p as any).account_id === log.actor_id || (p as any).linked_ids?.includes(log.actor_id));
                      const displayName = resolvedUser ? (resolvedUser.name || (resolvedUser as any).full_name || 'Unnamed') : log.actor_id;

                      return (
                        <tr key={log.id || Math.random().toString()} className="hover:bg-surface/60 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-ink text-sm truncate max-w-[200px]">{displayName}</p>
                            <p className="text-[10px] text-ink-subtle font-mono truncate max-w-[150px]">{log.actor_id}</p>
                          </td>
                          <td className="px-4 py-3">
                            <RoleBadge role={log.actor_role} />
                          </td>
                          <td className="px-4 py-3 text-ink-muted text-sm hidden sm:table-cell capitalize">
                            {log.metadata?.method || 'Email'}
                          </td>
                          <td className="px-4 py-3 text-ink-muted text-sm hidden md:table-cell truncate max-w-[200px]">
                            {resolveClinicName(log.clinic_id)}
                          </td>
                          <td className="px-4 py-3 text-ink-muted text-xs">
                            {formatDate(log.metadata?.logged_in_at || log.timestamp)}
                          </td>
                        </tr>
                      );
                    })}
                  </DataTable>
                </div>
              )}
          </>
          {!['dashboard', 'hn_clinics', 'hn_patients', 'vc_pending_clinics', 'users_roles', 'op_appointments', 'sb_payments', 'sb_plans', 'sb_subscriptions', 'ana_platform', 'ana_geographic', 'ana_clinic', 'ana_ai', 'sec_login'].includes(activeTab) && (
            <GenericDataView
              activeTab={activeTab}
              users={displayUsers}
              clinics={displayClinics}
              appointments={appointments}
              invoices={invoices}
              billing={displayBilling}
              supportTickets={supportTickets}
              complaints={complaints}
              reports={reports}
              subscriptions={subscriptions}
              onUserSelect={setSelectedUserId}
              onViewInvoice={setAdminViewingInvoice}
              auditLogs={auditLogs}
            />
          )}
          </SectionErrorBoundary>
        </main>
      </div>

      {/* Clinic Profile Modal */}
      <Modal open={!!selectedClinicId} onClose={() => setSelectedClinicId(null)} title="Clinic Profile">
        {(() => {
          const c = displayClinics.find(x => x.id === selectedClinicId) || clinics.find(x => x.id === selectedClinicId);
          if (!c) return <div className="p-4"><p>Clinic not found.</p></div>;
          
          const clinicStaff = displayUsers.filter(u => u.clinic_id === c.id);
          
          return (
            <div className="space-y-6 pt-2">
              <div className="flex items-center gap-4 border-b border-black/5 pb-4">
                <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary text-xl font-bold flex items-center justify-center shrink-0">
                  {(c.name || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink">{c.name || 'Unknown Clinic'}</h3>
                  <p className="text-sm text-ink-muted font-mono">{c.id}</p>
                </div>
                <div className="ml-auto">
                  <StatusBadge text={c.clinic_setup_complete ? 'Active' : 'Pending'} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">Owner</p>
                  <p className="text-sm text-ink">{c.owner_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">Created</p>
                  <p className="text-sm text-ink">{formatDate(c.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">Contact</p>
                  <div className="text-sm text-ink space-y-1">
                    {c.phone ? <p className="flex items-center gap-1.5"><Phone size={14} className="text-ink-subtle" /> {c.phone}</p> : <p>—</p>}
                    {c.email ? <p className="flex items-center gap-1.5"><Mail size={14} className="text-ink-subtle" /> {c.email}</p> : null}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">Location</p>
                  <div className="text-sm text-ink">
                    {c.city ? <p className="flex items-center gap-1.5"><MapPin size={14} className="text-ink-subtle" /> {c.city}</p> : <p>—</p>}
                  </div>
                </div>
              </div>

              {/* Staff & Doctors */}
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Staff & Doctors ({clinicStaff.length})</p>
                {clinicStaff.length === 0 ? (
                  <p className="text-sm text-ink-subtle italic">No staff found</p>
                ) : (
                  <div className="space-y-2 border border-black/5 rounded-lg p-2 max-h-48 overflow-y-auto bg-surface">
                    {clinicStaff.map(u => (
                      <div 
                        key={u.id} 
                        className="flex items-center gap-3 p-2 bg-white rounded border border-black/5 cursor-pointer hover:bg-black/5 transition-colors"
                        onClick={() => setSelectedUserId(u.id)}
                      >
                        <Avatar name={u.name || 'U'} color="#7C3AED" size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink truncate">{u.name || '—'}</p>
                          <p className="text-xs text-ink-muted truncate">{u.email || '—'}</p>
                        </div>
                        <RoleBadge role={u.role} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Verification Documents */}
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Verification Documents</p>
                {c.onboarding_documents && c.onboarding_documents.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {c.onboarding_documents.map((doc, idx) => (
                      <a
                        key={idx}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors border border-teal-100"
                      >
                        <FileText size={16} />
                        <span className="text-sm font-medium flex-1 truncate">{doc.name}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-subtle italic">No documents uploaded.</p>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* User/Doctor Profile Modal */}
      <Modal open={!!selectedUserId} onClose={() => setSelectedUserId(null)} title="User Profile">
        {(() => {
          const u = displayUsers.find(x => x.id === selectedUserId || (x as any).user_id === selectedUserId || (x as any).linked_ids?.includes(selectedUserId)) || users.find(x => x.id === selectedUserId);
          if (!u) return <div className="p-4"><p>User not found.</p></div>;
          
          const clinicName = resolveClinicName(u.clinic_id);
          
          return (
            <div className="space-y-6 pt-2">
              <div className="flex items-center gap-4 border-b border-black/5 pb-4">
                <Avatar name={u.name || 'U'} color="#7C3AED" size={48} />
                <div>
                  <h3 className="text-lg font-bold text-ink">{u.name || 'Unknown User'}</h3>
                  <p className="text-sm text-ink-muted font-mono">{u.id}</p>
                </div>
                <div className="ml-auto">
                  <RoleBadge role={u.role} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">Status</p>
                  <p className="text-sm text-ink">
                    {u.active !== false ? <span className="text-teal-600 font-semibold">Active</span> : <span className="text-danger font-semibold">Inactive</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">Registered On</p>
                  <p className="text-sm text-ink">{formatDate(u.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">Contact</p>
                  <div className="text-sm text-ink space-y-1">
                    {u.phone ? <p className="flex items-center gap-1.5"><Phone size={14} className="text-ink-subtle" /> {u.phone}</p> : <p>—</p>}
                    {u.email ? <p className="flex items-center gap-1.5"><Mail size={14} className="text-ink-subtle" /> {u.email}</p> : null}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">Professional Info</p>
                  <div className="text-sm text-ink space-y-1">
                    <p className="flex items-start gap-1.5"><Building2 size={14} className="text-ink-subtle mt-0.5" /> <span className="flex-1">{clinicName}</span></p>
                    {u.specialisation ? <p className="flex items-start gap-1.5"><Stethoscope size={14} className="text-ink-subtle mt-0.5" /> <span className="flex-1">{u.specialisation}</span></p> : null}
                  </div>
                </div>
              </div>

              {/* Documents & Certificates */}
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Documents & Certificates</p>
                {(!u.onboarding_documents || u.onboarding_documents.length === 0) && (!u.certificates || u.certificates.length === 0) ? (
                  <p className="text-sm text-ink-subtle italic">No documents uploaded.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {u.onboarding_documents?.map((doc, idx) => (
                      <a
                        key={`od-${idx}`}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
                      >
                        <FileText size={16} />
                        <span className="text-sm font-medium flex-1 truncate">{doc.name}</span>
                        <span className="text-xs uppercase tracking-wide opacity-70">Onboarding</span>
                      </a>
                    ))}
                    {u.certificates?.map((doc, idx) => (
                      <a
                        key={`cert-${idx}`}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors border border-teal-100"
                      >
                        <FileText size={16} />
                        <span className="text-sm font-medium flex-1 truncate">{doc.name}</span>
                        <span className="text-xs uppercase tracking-wide opacity-70">Certificate</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={showAddAdmin} onClose={() => setShowAddAdmin(false)} title="Add System Admin">
        <form onSubmit={handleAddAdmin} className="space-y-4 pt-2">
          {addAdminError && (
            <div className="p-3 bg-danger-bg text-danger text-sm rounded-lg border border-danger/20">
              {addAdminError}
            </div>
          )}
          <div>
            <label className="label">Admin Name</label>
            <input required type="text" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} className="input" placeholder="E.g. John Doe" />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input required type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} className="input" placeholder="admin@viitsa.com" />
          </div>
          <div>
            <label className="label">Temporary Password</label>
            <input required type="password" minLength={8} value={newAdminPass} onChange={e => setNewAdminPass(e.target.value)} className="input" placeholder="Min. 8 chars with upper, lower, number & symbol" />
            <PasswordRequirementsGuide password={newAdminPass} showAlways={true} />
          </div>
          <div className="pt-2">
            <button type="submit" disabled={addAdminLoading} className="btn-primary w-full h-11">
              {addAdminLoading ? 'Creating...' : 'Create Admin'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Official A4 Patient Invoice Modal */}
      {adminViewingInvoice && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex justify-center p-2 sm:p-4 animate-fade-in"
          onClick={() => setAdminViewingInvoice(null)}
        >
          <div 
            className="relative max-w-4xl w-full my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setAdminViewingInvoice(null)}
              className="absolute -top-12 right-0 sm:-right-12 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
            >
              <X size={24} />
            </button>
            <InvoiceView
              invoice={adminViewingInvoice}
              clinic={(displayClinics.find(c => c.id === adminViewingInvoice.clinic_id || c.name === adminViewingInvoice.clinic_name) || clinics.find(c => c.id === adminViewingInvoice.clinic_id || c.name === adminViewingInvoice.clinic_name) || { name: adminViewingInvoice.clinic_name || 'VIITSA Partner Clinic' }) as any}
              patient={(displayPatients.find(p => p.id === adminViewingInvoice.patient_id || (p as any).id_number === adminViewingInvoice.patient_id || (p as any).account_id === adminViewingInvoice.patient_id || (p as any).linked_ids?.includes(adminViewingInvoice.patient_id)) || { name: adminViewingInvoice.patient_name || 'Patient' }) as any}
              onClose={() => setAdminViewingInvoice(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
