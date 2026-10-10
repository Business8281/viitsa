import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, Wallet, Activity, Siren, Pill, AlertTriangle, CalendarClock, TrendingUp, CheckCircle, Play, Radio, Receipt } from 'lucide-react';
import { useClinicData } from '../lib/useClinicData';
import { BarChart } from '../components/Charts';
import { EmptyState, SectionHeader, Loading } from '../components/ui';
import { formatRs, formatTime, statusBadgeClass, localDateISO, isSameDay, parseDateArg, matchesDateRange, type DateRangePreset } from '../lib/format';
import { DateRangeFilter } from '../components/DateRangeFilter';
import type { Appointment } from '../lib/types';
import { doc, updateDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

function dayName(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: 'primary' | 'accent' | 'warning' | 'danger';
}) {
  const toneMap = {
    primary: { bg: 'bg-primary-50', text: 'text-primary' },
    accent: { bg: 'bg-accent-50', text: 'text-accent-600' },
    warning: { bg: 'bg-warning-bg', text: 'text-warning' },
    danger: { bg: 'bg-danger-bg', text: 'text-danger' },
  } as const;
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

export function DashboardScreen() {
  const { patients, todayAppointments, appointments, bills, inventory, urgentQueue, criticalInventory, loading } = useClinicData();

  const getBillAmount = (b: any): number => {
    const raw = b.amount !== undefined && b.amount !== null && b.amount !== '' ? b.amount : (b.total !== undefined && b.total !== null && b.total !== '' ? b.total : (b.subtotal ?? 0));
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw || 0).replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const getBillDate = (b: any) => {
    return b.created_at || (b as any).createdAt || (b as any).date || (b as any).payment_date || (b as any).timestamp || (b as any).visit_date;
  };

  const isBillPaid = (b: any): boolean => {
    const st = String(b.payment_status || b.status || '').toLowerCase().trim();
    return st === 'paid' || st === 'completed' || st === 'success' || st === 'cleared';
  };

  const isBillCancelled = (b: any): boolean => {
    const st = String(b.payment_status || b.status || '').toLowerCase().trim();
    return st === 'cancelled' || st === 'void';
  };

  const [billingDatePreset, setBillingDatePreset] = useState<DateRangePreset>('all');
  const [billingStart, setBillingStart] = useState('');
  const [billingEnd, setBillingEnd] = useState('');

  const todayBills = useMemo(() => {
    return bills.filter((b) => isSameDay(getBillDate(b)));
  }, [bills]);

  const billingPresetLabel = useMemo(() => {
    return {
      all: 'All-Time',
      today: "Today's",
      week: 'This Week',
      month: 'This Month',
      '3months': '3 Months',
      custom: 'Custom Range',
    }[billingDatePreset];
  }, [billingDatePreset]);

  const billingSummary = useMemo(() => {
    let allTimeCollections = 0;
    let allTimePaidTransactions = 0;
    let periodCollections = 0;
    let periodPaidTransactions = 0;
    let periodPending = 0;
    let periodPendingCount = 0;
    let todayCollections = 0;
    let todayPaidTransactions = 0;
    let todayPending = 0;
    let totalPendingAllTime = 0;
    let totalPendingCount = 0;

    bills.forEach((b) => {
      const amt = getBillAmount(b);
      const isPaid = isBillPaid(b);
      const isCancelled = isBillCancelled(b);
      const d = getBillDate(b);
      const isToday = isSameDay(d);
      const inRange = matchesDateRange(d, billingDatePreset, billingStart, billingEnd);

      if (isPaid) {
        allTimeCollections += amt;
        allTimePaidTransactions += 1;
        if (isToday) {
          todayCollections += amt;
          todayPaidTransactions += 1;
        }
        if (inRange) {
          periodCollections += amt;
          periodPaidTransactions += 1;
        }
      } else if (!isCancelled) {
        totalPendingAllTime += amt;
        totalPendingCount += 1;
        if (isToday) {
          todayPending += amt;
        }
        if (inRange) {
          periodPending += amt;
          periodPendingCount += 1;
        }
      }
    });

    return {
      allTimeCollections,
      allTimePaidTransactions,
      periodCollections,
      periodPaidTransactions,
      periodPending,
      periodPendingCount,
      todayCollections,
      todayPaidTransactions,
      todayPending,
      totalPendingAllTime,
      totalPendingCount,
    };
  }, [bills, billingDatePreset, billingStart, billingEnd]);

  const metrics = useMemo(() => {
    const totalPatients = todayAppointments.length;
    const completed = todayAppointments.filter((a) => a.status === 'done').length;
    const now = new Date();
    const waitingAppts = todayAppointments.filter(
      (a) => a.status === 'waiting' || a.status === 'in-progress',
    );
    const waitTimes = waitingAppts.map((a) => {
      const timeStr = typeof a.time_slot === 'string' ? a.time_slot : '09:00';
      const [h, m] = timeStr.split(':').map(Number);
      const t = new Date();
      t.setHours(h || 9, m || 0, 0, 0);
      return Math.max(0, Math.round((now.getTime() - t.getTime()) / 60000));
    });
    const avgWait = waitTimes.length ? Math.round(waitTimes.reduce((s, v) => s + v, 0) / waitTimes.length) : 0;
    const revenue = billingSummary.todayCollections;
    return { totalPatients, completed, avgWait, revenue };
  }, [todayAppointments, billingSummary]);

  const weekData = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = localDateISO(d);
      const count = appointments.filter((a) => a.date === iso).length;
      days.push({ label: dayName(d), value: count });
    }
    return days;
  }, [appointments]);

  const upcoming = useMemo(() => {
    return todayAppointments
      .filter((a) => a.status === 'waiting')
      .slice()
      .sort((a, b) => (typeof a.time_slot === 'string' ? a.time_slot : '').localeCompare(typeof b.time_slot === 'string' ? b.time_slot : ''))
      .slice(0, 5);
  }, [todayAppointments]);

  // Sorted queue: urgent first
  const queue = useMemo(() => {
    return [...todayAppointments]
      .filter((a) => a.status !== 'cancelled')
      .sort((a, b) => {
        const au = a.triage_level === 'urgent' ? 0 : 1;
        const bu = b.triage_level === 'urgent' ? 0 : 1;
        if (au !== bu) return au - bu;
        return (a.token_number ?? 0) - (b.token_number ?? 0);
      });
  }, [todayAppointments]);

  const historyAppointments = useMemo(() => {
    const todayStr = localDateISO();
    return appointments
      .filter((a) => (a.date || '') < todayStr || a.status === 'cancelled')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [appointments]);

  // AI-generated insights
  const insights = useMemo(() => {
    const list: { icon: React.ReactNode; tone: 'danger' | 'warning' | 'info'; text: string }[] = [];
    const critical = inventory.filter((i) => i.quantity <= 0);
    const low = inventory.filter((i) => i.quantity > 0 && i.quantity <= i.reorder_level);
    if (critical.length) {
      list.push({
        icon: <Pill size={14} />,
        tone: 'danger',
        text: `${critical.length} item${critical.length > 1 ? 's' : ''} out of stock: ${critical.map((c) => c.name).join(', ')}`,
      });
    }
    if (low.length) {
      list.push({
        icon: <Pill size={14} />,
        tone: 'warning',
        text: `${low.length} item${low.length > 1 ? 's' : ''} running low on stock: ${low.map((l) => l.name).join(', ')}`,
      });
    }
    if (urgentQueue.length) {
      list.push({
        icon: <Siren size={14} />,
        tone: 'danger',
        text: `${urgentQueue.length} urgent triage patient${urgentQueue.length > 1 ? 's' : ''} in queue — needs immediate attention`,
      });
    }
    const followUps = todayAppointments.filter((a) => a.status !== 'done' && a.reason?.toLowerCase().includes('follow-up'));
    if (followUps.length) {
      list.push({
        icon: <CalendarClock size={14} />,
        tone: 'info',
        text: `${followUps.length} patient${followUps.length > 1 ? 's' : ''} scheduled for follow-up today`,
      });
    }
    const pendingBills = todayBills.filter((b) => b.payment_status !== 'paid');
    if (pendingBills.length) {
      const amt = pendingBills.reduce((s, b) => s + Number(b.amount || 0), 0);
      list.push({
        icon: <Wallet size={14} />,
        tone: 'warning',
        text: `${pendingBills.length} pending bill${pendingBills.length > 1 ? 's' : ''} worth ${formatRs(amt)} to collect today`,
      });
    }
    if (!list.length) {
      list.push({ icon: <Activity size={14} />, tone: 'info', text: 'All systems operating normally. No critical alerts.' });
    }
    return list;
  }, [inventory, urgentQueue, todayAppointments, todayBills]);

  const insightToneClass = {
    danger: 'bg-danger-bg text-danger border-danger/20',
    warning: 'bg-warning-bg text-warning border-warning/20',
    info: 'bg-primary-50 text-primary border-primary/20',
  } as const;



  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
            <span>Clinic Dashboard</span>
          </h1>
          <p className="text-sm text-ink-muted">Real-time live overview of today's clinic operations.</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
            <span>Firestore Live</span>
          </span>
        </div>
      </div>

      {urgentQueue.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-danger-bg border border-danger/20 px-4 py-3 animate-slide-up">
          <Siren size={20} className="text-danger shrink-0" />
          <p className="text-sm font-semibold text-danger flex-1">
            {urgentQueue.length} urgent patient{urgentQueue.length > 1 ? 's' : ''} in queue — moved to top of triage.
          </p>
        </div>
      )}

      {/* Metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={<Users size={20} />} label="Patients today" value={String(metrics.totalPatients)} sub={`${metrics.completed} completed`} tone="primary" />
        <MetricCard icon={<Clock size={20} />} label="Avg. wait time" value={`${metrics.avgWait} min`} sub="Across active queue" tone="warning" />
        <MetricCard icon={<Wallet size={20} />} label="Revenue today" value={formatRs(metrics.revenue)} sub={`${billingSummary.todayPaidTransactions} paid transaction${billingSummary.todayPaidTransactions !== 1 ? 's' : ''}`} tone="accent" />
        <MetricCard
          icon={<Activity size={20} />}
          label="Consultations"
          value={`${metrics.completed}/${metrics.totalPatients}`}
          sub="Done / total today"
          tone="primary"
        />
      </div>

      {/* Live Billing & Payments Overview */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <SectionHeader title="Billing & Payments" subtitle={`Live collections and outstanding dues · Period: ${billingPresetLabel}`} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <DateRangeFilter
              preset={billingDatePreset}
              onPresetChange={setBillingDatePreset}
              customStart={billingStart}
              onCustomStartChange={setBillingStart}
              customEnd={billingEnd}
              onCustomEndChange={setBillingEnd}
              label="Live Billing Range"
            />
            <Link to="/clinic/billing" className="btn-outline text-xs self-start sm:self-auto flex items-center gap-1.5 whitespace-nowrap">
              <Receipt size={14} /> Open Full Billing
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link to="/clinic/billing" className="card bg-primary text-white border-none hover:opacity-95 transition-opacity">
            <div className="flex items-center justify-between">
              <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">Total Collections (All Time)</p>
              <Receipt size={16} className="text-white/70" />
            </div>
            <p className="text-2xl font-bold mt-1">{formatRs(billingSummary.allTimeCollections)}</p>
            <p className="text-xs text-white/70 mt-2">{billingSummary.allTimePaidTransactions} paid transactions all-time</p>
          </Link>
          <Link to="/clinic/billing" className="card hover:shadow-card-hover transition-shadow border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <p className="text-primary text-xs font-semibold uppercase tracking-wider">{billingPresetLabel} Collections</p>
              <Receipt size={16} className="text-primary" />
            </div>
            <p className="text-2xl font-bold text-ink mt-1">{formatRs(billingSummary.periodCollections)}</p>
            <p className="text-xs text-ink-subtle mt-2">{billingSummary.periodPaidTransactions} paid transaction{billingSummary.periodPaidTransactions !== 1 ? 's' : ''}</p>
          </Link>
          <Link to="/clinic/billing" className="card bg-accent text-white border-none hover:opacity-95 transition-opacity">
            <div className="flex items-center justify-between">
              <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">Total Pending (All Time)</p>
              <Clock size={16} className="text-white/70" />
            </div>
            <p className="text-2xl font-bold mt-1">{formatRs(billingSummary.totalPendingAllTime)}</p>
            <p className="text-xs text-white/70 mt-2">{billingSummary.totalPendingCount > 0 ? `${billingSummary.totalPendingCount} pending bills` : 'No pending dues'}</p>
          </Link>
          <Link to="/clinic/billing" className="card hover:shadow-card-hover transition-shadow border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center justify-between">
              <p className="text-amber-800 text-xs font-semibold uppercase tracking-wider">{billingPresetLabel} Pending</p>
              <Clock size={16} className="text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-ink mt-1">{formatRs(billingSummary.periodPending)}</p>
            <p className="text-xs text-ink-subtle mt-2">{billingSummary.periodPendingCount > 0 ? `${billingSummary.periodPendingCount} pending in period` : 'Cleared in this period'}</p>
          </Link>
        </div>
      </div>

      {/* Queue + Upcoming */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card">
          <SectionHeader title="Patient queue" subtitle="Live list of today's patients sorted by urgency" />
          {queue.length === 0 ? (
            <EmptyState icon={<Users size={18} />} title="No patients in queue" description="Bookings will appear here as patients arrive." />
          ) : (
            <div className="space-y-2">
              {queue.slice(0, 8).map((a) => (
                <QueueRow key={a.appt_id || a.appointment_id} appt={a} />
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <SectionHeader title="Upcoming appointments" subtitle="Next 5 scheduled today" />
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarClock size={18} />} title="No upcoming appointments" description="All today's patients have been seen." />
          ) : (
            <div className="space-y-2">
              {upcoming.map((a) => (
                <div key={a.appt_id || a.appointment_id} className="flex items-center gap-3 rounded-lg border border-black/5 px-3 py-2.5 hover:border-primary/30 transition">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary font-bold text-xs">
                    {formatTime(a.time_slot).slice(0, 5)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink truncate">
                      {a.patient?.name || (a as any).patient_name || 'Unknown'} 
                      {a.display_token && <span className="ml-2 text-xs font-bold text-primary">{a.display_token}</span>}
                    </p>
                    <p className="text-xs text-ink-muted truncate">{a.reason ?? a.type}</p>
                  </div>
                  <span className={`badge ${a.type === 'walk-in' ? 'badge-progress' : 'bg-primary-50 text-primary'} text-[10px]`}>
                    {a.type === 'walk-in' ? 'Walk-in' : 'Scheduled'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Billing + Footfall chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card">
          <SectionHeader title="Weekly patient footfall" subtitle="Patient count per day, last 7 days" />
          <BarChart data={weekData} height={180} />
        </div>

        <div className="card">
          <SectionHeader title="Billing today" subtitle={`${todayBills.length} bills`} />
          {todayBills.length === 0 ? (
            <EmptyState icon={<Wallet size={18} />} title="No bills today" />
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {todayBills.slice(0, 6).map((b) => (
                <div key={b.bill_id} className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{b.patient?.name ?? 'Unknown'}</p>
                    <p className="text-[11px] text-ink-muted capitalize">{b.payment_method}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink">{formatRs(Number(b.amount || 0))}</p>
                    <span className={`badge ${statusBadgeClass(b.payment_status)} text-[10px] capitalize`}>{b.payment_status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Insights */}
      <div className="card">
        <SectionHeader
          title="AI insights & alerts"
          subtitle="Auto-generated from current clinic data"
          action={<span className="badge bg-accent-50 text-accent-600">AI</span>}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${insightToneClass[ins.tone]}`}>
              <span className="mt-0.5 shrink-0">{ins.icon}</span>
              <p className="text-xs font-medium leading-relaxed">{ins.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-ink-subtle">
          <TrendingUp size={12} />
          <span>Insights auto-update based on inventory levels, patient queue, and billing status.</span>
        </div>
      </div>

      {criticalInventory.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-warning-bg border border-warning/20 px-4 py-3">
          <AlertTriangle size={18} className="text-warning shrink-0" />
          <p className="text-sm text-warning font-medium flex-1">
            {criticalInventory.length} inventory item{criticalInventory.length > 1 ? 's' : ''} below safe stock — review in Inventory.
          </p>
        </div>
      )}

      {historyAppointments.length > 0 && (
        <div className="card mt-4">
          <SectionHeader title="Appointment history" subtitle="Past and cancelled appointments" />
          <div className="space-y-2 opacity-80 max-h-96 overflow-y-auto">
            {historyAppointments.slice(0, 20).map((a) => (
              <div key={a.appt_id || a.appointment_id} className="flex items-center gap-3 rounded-lg border border-black/5 px-3 py-2">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-black/5 text-ink font-bold text-xs">
                  {new Date(a.date).getDate()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink truncate">
                    {a.patient?.name || (a as any).patient_name || 'Unknown'} 
                  </p>
                  <p className="text-xs text-ink-muted truncate">
                    {(a.doctor as any)?.name || 'Doctor'} · {a.date} at {formatTime(a.time_slot)}
                  </p>
                </div>
                <span className={`badge ${a.status === 'cancelled' ? 'bg-danger-bg text-danger' : 'bg-black/5 text-ink'} text-[10px] capitalize`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QueueRow({ appt }: { appt: Appointment }) {
  const apptId = appt.appt_id || appt.appointment_id;

  const handleUpdateStatus = async (newStatus: string) => {
    if (!apptId) return;
    try {
      await updateDoc(doc(db, 'appointments', apptId), {
        status: newStatus,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Failed to update live appointment status:', err);
    }
  };

  const tone =
    appt.triage_level === 'urgent'
      ? 'border-danger/20 bg-danger-bg/30'
      : appt.status === 'in-progress'
        ? 'border-primary/20 bg-primary-50/40'
        : 'border-black/5 bg-white';

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${tone}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink font-bold text-xs shrink-0">
          #{appt.token_number ?? '—'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-ink truncate">{appt.patient?.name || (appt as any).patient_name || 'Unknown'}</p>
            {appt.online_booking && <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold shrink-0">Online</span>}
          </div>
          <p className="text-xs text-ink-muted truncate">{appt.reason ?? 'Consultation'}</p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        <div className="text-left sm:text-right">
          <p className="text-xs font-medium text-ink">{formatTime(appt.time_slot)}</p>
          <span
            className={`badge text-[10px] capitalize ${
              appt.triage_level === 'urgent'
                ? 'badge-urgent'
                : appt.triage_level === 'moderate'
                  ? 'badge-waiting'
                  : statusBadgeClass(appt.status)
            }`}
          >
            {appt.triage_level === 'urgent' ? 'Urgent' : appt.triage_level === 'moderate' ? 'Moderate' : appt.status === 'in-progress' ? 'In room' : appt.status === 'done' ? 'Done' : 'Waiting'}
          </span>
        </div>

        {/* Live Quick Actions */}
        <div className="flex items-center gap-1.5">
          {appt.status !== 'in-progress' && appt.status !== 'done' && (
            <button
              type="button"
              onClick={() => handleUpdateStatus('in-progress')}
              title="Call in room"
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-semibold border border-teal-200 transition-colors"
            >
              <Play className="w-3 h-3 text-teal-600" />
              <span>Call</span>
            </button>
          )}

          {appt.status !== 'done' && (
            <button
              type="button"
              onClick={() => handleUpdateStatus('done')}
              title="Mark Completed"
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold border border-emerald-200 transition-colors"
            >
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              <span>Done</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
