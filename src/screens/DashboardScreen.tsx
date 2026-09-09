import { useMemo } from 'react';
import { Users, Clock, Wallet, Activity, Siren, Pill, AlertTriangle, CalendarClock, TrendingUp } from 'lucide-react';
import { useClinicData } from '../lib/useClinicData';
import { BarChart } from '../components/Charts';
import { EmptyState, SectionHeader } from '../components/ui';
import { formatRs, formatTime, statusBadgeClass, localDateISO } from '../lib/format';
import type { Appointment } from '../lib/types';

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
  const { todayAppointments, appointments, bills, inventory, urgentQueue, criticalInventory } = useClinicData();

  const metrics = useMemo(() => {
    const totalPatients = todayAppointments.length;
    const completed = todayAppointments.filter((a) => a.status === 'done').length;
    const now = new Date();
    const waitingAppts = todayAppointments.filter(
      (a) => a.status === 'waiting' || a.status === 'in-progress',
    );
    const waitTimes = waitingAppts.map((a) => {
      const [h, m] = a.time_slot.split(':').map(Number);
      const t = new Date();
      t.setHours(h, m, 0, 0);
      return Math.max(0, Math.round((now.getTime() - t.getTime()) / 60000));
    });
    const avgWait = waitTimes.length ? Math.round(waitTimes.reduce((s, v) => s + v, 0) / waitTimes.length) : 0;
    const todayBills = bills.filter((b) => new Date(b.created_at).toDateString() === now.toDateString());
    const revenue = todayBills.filter((b) => b.payment_status === 'paid').reduce((s, b) => s + Number(b.amount), 0);
    return { totalPatients, completed, avgWait, revenue };
  }, [todayAppointments, bills]);

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

  const todayBills = bills.filter((b) => new Date(b.created_at).toDateString() === new Date().toDateString());

  const upcoming = useMemo(() => {
    return todayAppointments
      .filter((a) => a.status === 'waiting')
      .slice()
      .sort((a, b) => a.time_slot.localeCompare(b.time_slot))
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
      const amt = pendingBills.reduce((s, b) => s + Number(b.amount), 0);
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
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink">Clinic Dashboard</h1>
        <p className="text-sm text-ink-muted">Real-time overview of today's clinic operations.</p>
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
        <MetricCard icon={<Wallet size={20} />} label="Revenue today" value={formatRs(metrics.revenue)} sub={`${todayBills.length} transactions`} tone="accent" />
        <MetricCard
          icon={<Activity size={20} />}
          label="Consultations"
          value={`${metrics.completed}/${metrics.totalPatients}`}
          sub="Done / total today"
          tone="primary"
        />
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
                <QueueRow key={a.appt_id} appt={a} />
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
                <div key={a.appt_id} className="flex items-center gap-3 rounded-lg border border-black/5 px-3 py-2.5 hover:border-primary/30 transition">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary font-bold text-xs">
                    {formatTime(a.time_slot).slice(0, 5)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink truncate">{a.patient?.name ?? 'Unknown'}</p>
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
                    <p className="text-sm font-bold text-ink">{formatRs(Number(b.amount))}</p>
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
    </div>
  );
}

function QueueRow({ appt }: { appt: Appointment }) {
  const tone =
    appt.triage_level === 'urgent'
      ? 'border-danger/20 bg-danger-bg/30'
      : appt.status === 'in-progress'
        ? 'border-primary/20 bg-primary-50/40'
        : 'border-black/5 bg-white';
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${tone}`}>
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink font-bold text-xs">
        #{appt.token_number ?? '—'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink truncate">{appt.patient?.name ?? 'Unknown'}</p>
          {appt.online_booking && <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold">Online</span>}
        </div>
        <p className="text-xs text-ink-muted truncate">{appt.reason ?? 'Consultation'}</p>
      </div>
      <div className="text-right">
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
    </div>
  );
}
