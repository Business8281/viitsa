import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { Loading, SectionHeader } from '../components/ui';
import { BarChart, LineChart, HBarChart, DonutChart, ProgressRing, ProgressBar } from '../components/Charts';
import { formatRs, localDateISO } from '../lib/format';
import { supabase as sb } from '../lib/supabase';
import type { Appointment, Bill, Patient, Consultation } from '../lib/types';
import { Calendar, AlertTriangle } from 'lucide-react';

type Range = 'today' | 'week' | 'month' | 'custom';

export function AnalyticsScreen() {
  const { clinic } = useAuth();
  const [range, setRange] = useState<Range>('week');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [consults, setConsults] = useState<Consultation[]>([]);
  const [allBills, setAllBills] = useState<Bill[]>([]);

  const { start, end } = useMemo(() => {
    const now = new Date(); now.setHours(23, 59, 59, 999);
    const s = new Date(); s.setHours(0, 0, 0, 0);
    if (range === 'today') return { start: s, end: now };
    if (range === 'week') { s.setDate(s.getDate() - 6); return { start: s, end: now }; }
    if (range === 'month') { s.setDate(s.getDate() - 29); return { start: s, end: now }; }
    const cs = customStart ? new Date(customStart) : new Date(now.getTime() - 7 * 86400000);
    cs.setHours(0, 0, 0, 0);
    const ce = customEnd ? new Date(customEnd) : now; ce.setHours(23, 59, 59, 999);
    return { start: cs, end: ce };
  }, [range, customStart, customEnd]);

  const startISO = start.toISOString();
  const endISO = end.toISOString();

  useEffect(() => {
    if (!clinic) return;
    setLoading(true);
    Promise.all([
      sb.from('appointments').select('*, patient:patients(*)').eq('clinic_id', clinic.clinic_id).gte('date', localDateISO(start)).lte('date', localDateISO(end)),
      sb.from('billing').select('*, patient:patients(*)').eq('clinic_id', clinic.clinic_id).gte('created_at', startISO).lte('created_at', endISO),
      sb.from('patients').select('*').eq('clinic_id', clinic.clinic_id),
      sb.from('consultations').select('*').eq('clinic_id', clinic.clinic_id).gte('created_at', startISO).lte('created_at', endISO),
      sb.from('billing').select('*, patient:patients(*)').eq('clinic_id', clinic.clinic_id),
    ]).then(([a, b, p, c, ab]) => {
      setAppointments((a.data as Appointment[] | null) ?? []);
      setBills((b.data as Bill[] | null) ?? []);
      setPatients((p.data as Patient[] | null) ?? []);
      setConsults((c.data as Consultation[] | null) ?? []);
      setAllBills((ab.data as Bill[] | null) ?? []);
      setLoading(false);
    });
  }, [clinic, startISO, endISO, start, end]);

  const stats = useMemo(() => {
    const totalPatients = new Set(appointments.map(a => a.patient_id)).size;
    const paidRevenue = bills.filter(b => b.payment_status === 'paid').reduce((s, b) => s + Number(b.amount), 0);
    const completed = appointments.filter(a => a.status === 'done').length;
    const total = appointments.length;
    const completion = total ? Math.round((completed / total) * 100) : 0;
    const returningPatients = patients.filter(p => appointments.filter(a => a.patient_id === p.patient_id).length >= 2).length;
    const returnRate = totalPatients ? Math.round((returningPatients / totalPatients) * 100) : 0;
    const avgBill = bills.length ? Math.round(bills.reduce((s, b) => s + Number(b.amount), 0) / bills.length) : 0;
    const paidBills = bills.filter(b => b.payment_status === 'paid').length;
    const collectionRate = bills.length ? Math.round((paidBills / bills.length) * 100) : 0;
    return { totalPatients, paidRevenue, completed, total, completion, returnRate, avgBill, collectionRate };
  }, [appointments, bills, patients]);

  const revenueOverTime = useMemo(() => {
    const groups: Record<string, number> = {};
    bills.filter(b => b.payment_status === 'paid').forEach(b => {
      const d = new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      groups[d] = (groups[d] ?? 0) + Number(b.amount);
    });
    return Object.entries(groups).map(([label, value]) => ({ label, value }));
  }, [bills]);

  const footfallOverTime = useMemo(() => {
    const groups: Record<string, number> = {};
    appointments.forEach(a => {
      const d = new Date(a.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      groups[d] = (groups[d] ?? 0) + 1;
    });
    return Object.entries(groups).map(([label, value]) => ({ label, value }));
  }, [appointments]);

  const topDiagnoses = useMemo(() => {
    const groups: Record<string, number> = {};
    consults.forEach(c => { const d = (c.diagnosis || 'Unknown').trim(); groups[d] = (groups[d] ?? 0) + 1; });
    return Object.entries(groups).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [consults]);

  const demographics = useMemo(() => {
    const patientIds = new Set(appointments.map(a => a.patient_id));
    const relevant = patients.filter(p => patientIds.has(p.patient_id));
    const groups = { '<18': 0, '18-34': 0, '35-49': 0, '50-64': 0, '65+': 0 };
    relevant.forEach(p => {
      const a = p.age ?? 0;
      if (a < 18) groups['<18']++; else if (a < 35) groups['18-34']++; else if (a < 50) groups['35-49']++; else if (a < 65) groups['50-64']++; else groups['65+']++;
    });
    const colors = ['#0F6E56', '#05C994', '#E08600', '#D63B4B', '#5A6B7B'];
    return Object.entries(groups).map(([label, value], i) => ({ label, value, color: colors[i] }));
  }, [appointments, patients]);

  // Payment breakdown
  const paymentBreakdown = useMemo(() => {
    const grp = { cash: 0, upi: 0, card: 0, pending: 0 };
    bills.forEach(b => {
      if (b.payment_status !== 'paid') grp.pending += Number(b.amount);
      else if (b.payment_method === 'cash') grp.cash += Number(b.amount);
      else if (b.payment_method === 'upi') grp.upi += Number(b.amount);
      else if (b.payment_method === 'card') grp.card += Number(b.amount);
    });
    return [
      { label: 'Cash', value: Math.round(grp.cash), color: '#0F6E56' },
      { label: 'UPI', value: Math.round(grp.upi), color: '#05C994' },
      { label: 'Card', value: Math.round(grp.card), color: '#5A6B7B' },
      { label: 'Pending', value: Math.round(grp.pending), color: '#E08600' },
    ];
  }, [bills]);

  // Pending collections breakdown
  const pendingCollections = useMemo(() => {
    const byPatient: Record<string, { name: string; amount: number }> = {};
    allBills.filter(b => b.payment_status !== 'paid').forEach(b => {
      const name = b.patient?.name ?? 'Unknown';
      if (!byPatient[name]) byPatient[name] = { name, amount: 0 };
      byPatient[name].amount += Number(b.amount);
    });
    return Object.values(byPatient).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [allBills]);

  const totalPending = allBills.filter(b => b.payment_status !== 'paid').reduce((s, b) => s + Number(b.amount), 0);

  if (loading) return <Loading label="Loading analytics…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Analytics</h1>
          <p className="text-sm text-ink-muted">{start.toLocaleDateString('en-IN')} — {end.toLocaleDateString('en-IN')}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-primary-50/60 p-0.5">
          {(['today', 'week', 'month', 'custom'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${range === r ? 'bg-white text-primary shadow-sm' : 'text-ink-muted'}`}>
              {r === 'today' ? 'Today' : r === 'week' ? 'This week' : r === 'month' ? 'This month' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      {range === 'custom' && (
        <div className="card flex items-center gap-3 flex-wrap">
          <Calendar size={16} className="text-ink-muted" />
          <div><label className="label">Start</label><input type="date" className="input" value={customStart} onChange={e => setCustomStart(e.target.value)} /></div>
          <div><label className="label">End</label><input type="date" className="input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Total patients" value={String(stats.totalPatients)} />
        <Metric label="Revenue (paid)" value={formatRs(stats.paidRevenue)} />
        <Metric label="Avg bill value" value={formatRs(stats.avgBill)} />
        <Metric label="Collection rate" value={`${stats.collectionRate}%`} />
      </div>

      {totalPending >= 5000 && (
        <div className="flex items-center gap-3 rounded-xl bg-warning-bg border border-warning/20 px-4 py-3">
          <AlertTriangle size={16} className="text-warning shrink-0" />
          <p className="text-sm text-warning font-medium">
            Pending collections: <strong>{formatRs(totalPending)}</strong> across {allBills.filter(b => b.payment_status !== 'paid').length} bills.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card"><SectionHeader title="Patient footfall" subtitle="Daily appointments in selected range" />
          <LineChart data={footfallOverTime} color="#0F6E56" height={200} /></div>
        <div className="card"><SectionHeader title="Revenue trend" subtitle="Daily paid revenue" />
          <BarChart data={revenueOverTime} color="#05C994" height={200} formatValue={n => '₹' + n} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card"><SectionHeader title="Payment method breakdown" subtitle="Cash vs UPI vs Card vs Pending" />
          <DonutChart data={paymentBreakdown} size={170} /></div>
        <div className="card">
          <SectionHeader title="Pending collections" subtitle="Top 5 patients with outstanding balance" />
          {pendingCollections.length === 0 ? <p className="text-sm text-ink-subtle">No pending bills.</p> : (
            <div className="space-y-2.5">
              {pendingCollections.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted">{p.name}</span>
                  <span className="text-sm font-semibold text-warning">{formatRs(p.amount)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-black/5 flex justify-between text-sm font-bold text-ink">
                <span>Total outstanding</span><span className="text-warning">{formatRs(totalPending)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <SectionHeader title="Top diagnoses" subtitle="Most common this period" />
          {topDiagnoses.length === 0 ? <p className="text-sm text-ink-subtle">No consultations in range.</p> : <HBarChart data={topDiagnoses} color="#0F6E56" />}
        </div>
        <div className="card flex flex-col items-center">
          <SectionHeader title="Completion rate" subtitle="Appointments done / total" />
          <ProgressRing value={stats.completion} size={130} label={`of ${stats.total} appointments`} />
          <div className="grid grid-cols-2 gap-2 w-full mt-4 text-center">
            <div className="rounded bg-success-bg/50 p-2"><p className="text-xs text-ink-muted">Done</p><p className="text-lg font-bold text-success">{stats.completed}</p></div>
            <div className="rounded bg-warning-bg/50 p-2"><p className="text-xs text-ink-muted">Pending</p><p className="text-lg font-bold text-warning">{stats.total - stats.completed}</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <SectionHeader title="Patient demographics" subtitle="Age group breakdown" />
          {demographics.every(d => d.value === 0) ? <p className="text-sm text-ink-subtle">No patients in range.</p> : <DonutChart data={demographics} size={170} />}
        </div>
        <div className="card">
          <SectionHeader title="Clinic efficiency" subtitle="Key ratios for the period" />
          <div className="space-y-4 mt-2">
            <ProgressBar label="Appointment completion" value={stats.completion} color="#0F6E56" rightText={`${stats.completion}%`} />
            <ProgressBar label="Bill collection rate" value={stats.collectionRate} color="#05C994" rightText={`${stats.collectionRate}%`} />
            <ProgressBar label="Patient return rate" value={stats.returnRate} color="#0F6E56" rightText={`${stats.returnRate}%`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs text-ink-muted uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-ink mt-1">{value}</p>
    </div>
  );
}
