import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useClinicData, DEFAULT_CLINIC_ID } from '../lib/useClinicData';
import { Loading, SectionHeader } from '../components/ui';
import { BarChart, LineChart, HBarChart, DonutChart, ProgressRing, ProgressBar } from '../components/Charts';
import { formatRs, formatDate, localDateISO, parseDateArg, isSameDay, calculateAge, formatDobForInput } from '../lib/format';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import type { Consultation, Patient } from '../lib/types';
import {
  Calendar, AlertTriangle, TrendingUp, Users, Wallet, CheckCircle, Radio,
  User, Search, Filter, ChevronDown, ChevronUp, Stethoscope, Activity, Sparkles
} from 'lucide-react';

type Range = 'today' | 'week' | 'month' | 'custom';

export function AnalyticsScreen() {
  const { clinic, user } = useAuth();
  const { appointments, bills, patients, loading: clinicLoading } = useClinicData();

  const [range, setRange] = useState<Range>('week');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [consults, setConsults] = useState<Consultation[]>([]);
  const [consultsLoading, setConsultsLoading] = useState(true);

  // Live Consultations listener with real-time onSnapshot
  useEffect(() => {
    const activeClinicId = clinic?.clinic_id || user?.clinic_id || DEFAULT_CLINIC_ID;
    const unsub = onSnapshot(collection(db, 'consultations'), (snap) => {
      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id, consult_id: d.id } as unknown as Consultation));
      const filtered = docs.filter(c => !c.clinic_id || c.clinic_id === activeClinicId || activeClinicId === DEFAULT_CLINIC_ID);
      setConsults(filtered);
      setConsultsLoading(false);
    }, (err) => {
      console.warn('Live consultations snapshot error:', err);
      setConsultsLoading(false);
    });
    return () => unsub();
  }, [clinic?.clinic_id, user?.clinic_id]);

  const { start, end } = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const s = new Date();
    s.setHours(0, 0, 0, 0);

    if (range === 'today') {
      return { start: s, end: now };
    }
    if (range === 'week') {
      s.setDate(s.getDate() - 6);
      return { start: s, end: now };
    }
    if (range === 'month') {
      s.setDate(s.getDate() - 29);
      return { start: s, end: now };
    }
    const cs = customStart ? parseDateArg(customStart) : new Date(now.getTime() - 6 * 86400000);
    cs.setHours(0, 0, 0, 0);
    const ce = customEnd ? parseDateArg(customEnd) : new Date();
    ce.setHours(23, 59, 59, 999);
    return { start: cs, end: ce };
  }, [range, customStart, customEnd]);

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

  // Filter live items within chosen time range
  const rangeAppts = useMemo(() => {
    return appointments.filter(a => {
      const d = parseDateArg(a.date);
      if (isNaN(d.getTime())) return false;
      return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
    });
  }, [appointments, start, end]);

  const rangeBills = useMemo(() => {
    return bills.filter(b => {
      const d = parseDateArg(getBillDate(b));
      if (isNaN(d.getTime())) return false;
      return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
    });
  }, [bills, start, end]);

  const rangeConsults = useMemo(() => {
    return consults.filter(c => {
      const d = parseDateArg(c.created_at || (c as any).createdAt || (c as any).date);
      if (isNaN(d.getTime())) return false;
      return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
    });
  }, [consults, start, end]);

  // Overall and range statistics
  const stats = useMemo(() => {
    const totalPatients = new Set(rangeAppts.map(a => a.patient_id).filter(Boolean)).size;
    const paidRevenue = rangeBills
      .filter(isBillPaid)
      .reduce((s, b) => s + getBillAmount(b), 0);
    const completed = rangeAppts.filter(a => a.status === 'done').length;
    const total = rangeAppts.length;
    const completion = total ? Math.round((completed / total) * 100) : 0;

    const returningPatients = patients.filter(p =>
      appointments.filter(a => a.patient_id === p.patient_id).length >= 2
    ).length;
    const returnRate = totalPatients ? Math.min(100, Math.round((returningPatients / totalPatients) * 100)) : 0;

    const avgBill = rangeBills.length
      ? Math.round(rangeBills.reduce((s, b) => s + getBillAmount(b), 0) / rangeBills.length)
      : 0;

    const paidBillsCount = rangeBills.filter(isBillPaid).length;
    const collectionRate = rangeBills.length
      ? Math.round((paidBillsCount / rangeBills.length) * 100)
      : (paidRevenue > 0 ? 100 : 0);

    return { totalPatients, paidRevenue, completed, total, completion, returnRate, avgBill, collectionRate };
  }, [rangeAppts, rangeBills, appointments, patients]);

  // Daily timeline generator for charts
  const timelineDays = useMemo(() => {
    const list: Date[] = [];
    const curr = new Date(start);
    curr.setHours(0, 0, 0, 0);
    const stop = new Date(end);
    stop.setHours(23, 59, 59, 999);

    while (curr.getTime() <= stop.getTime()) {
      list.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
      // Safety guard against infinite loops
      if (list.length > 90) break;
    }
    return list;
  }, [start, end]);

  // Revenue trend over time
  const revenueOverTime = useMemo(() => {
    if (timelineDays.length <= 1) {
      const todayTotal = rangeBills.filter(isBillPaid).reduce((s, b) => s + getBillAmount(b), 0);
      return [{ label: formatDate(start), value: todayTotal }];
    }

    return timelineDays.map(d => {
      const label = !isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
      const dayTotal = rangeBills
        .filter(b => isBillPaid(b) && isSameDay(getBillDate(b), d))
        .reduce((s, b) => s + getBillAmount(b), 0);
      return { label, value: dayTotal };
    });
  }, [timelineDays, rangeBills, start]);

  // Footfall over time
  const footfallOverTime = useMemo(() => {
    if (timelineDays.length <= 1) {
      return [{ label: formatDate(start), value: rangeAppts.length }];
    }

    return timelineDays.map(d => {
      const label = !isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
      const dayCount = rangeAppts.filter(a => isSameDay(a.date, d)).length;
      return { label, value: dayCount };
    });
  }, [timelineDays, rangeAppts, start]);

  // Top Diagnoses from live consultations
  const topDiagnoses = useMemo(() => {
    const groups: Record<string, number> = {};
    rangeConsults.forEach(c => {
      const d = (c.diagnosis || (c as any).symptoms || '').trim();
      if (d) groups[d] = (groups[d] ?? 0) + 1;
    });

    // Fallback to appointment reason/complaint if no consult diagnosis filled yet
    if (Object.keys(groups).length === 0) {
      rangeAppts.forEach(a => {
        const r = (a.reason || a.chief_complaint || '').trim();
        if (r) groups[r] = (groups[r] ?? 0) + 1;
      });
    }

    return Object.entries(groups)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [rangeConsults, rangeAppts]);

  // Scope for demographics: 'all' = all clinic patients, 'period' = patients seen in selected range
  const [demographicsScope, setDemographicsScope] = useState<'all' | 'period'>('all');
  const [selectedAgeBracket, setSelectedAgeBracket] = useState<string>('all');
  const [demographicsSearch, setDemographicsSearch] = useState<string>('');
  const [showPatientList, setShowPatientList] = useState<boolean>(true);

  // Live map of patient ages extracted from appointments & consultations
  const externalAgeMap = useMemo(() => {
    const map = new Map<string, number>();
    appointments.forEach(a => {
      const pId = a.patient_id;
      const raw = (a as any).patient_age ?? (a as any).age;
      if (pId && raw !== undefined && raw !== null && raw !== '') {
        const num = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0 && num <= 125) map.set(pId, num);
      }
    });
    consults.forEach(c => {
      const pId = c.patient_id;
      const raw = (c as any).patient_age ?? (c as any).age;
      if (pId && raw !== undefined && raw !== null && raw !== '') {
        const num = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0 && num <= 125) map.set(pId, num);
      }
    });
    return map;
  }, [appointments, consults]);

  // Robust live age extractor for any patient
  const resolvePatientAge = (p: Patient): number | null => {
    if (typeof p.age === 'number' && !isNaN(p.age) && p.age > 0) return p.age;
    if (typeof p.age === 'string' && (p.age as string).trim()) {
      const parsed = parseInt((p.age as string).replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 125) return parsed;
    }
    const dobStr = (p as any).dob || (p as any).date_of_birth || (p as any).birth_date;
    if (dobStr) {
      const age = calculateAge(dobStr);
      if (age !== null && age >= 0 && age <= 125) return age;
    }
    if (p.patient_id && externalAgeMap.has(p.patient_id)) {
      return externalAgeMap.get(p.patient_id)!;
    }
    return null;
  };

  // Patients based on chosen scope
  const periodPatientIds = useMemo(() => {
    return new Set(rangeAppts.map(a => a.patient_id).filter(Boolean));
  }, [rangeAppts]);

  const scopedPatients = useMemo(() => {
    if (demographicsScope === 'period') {
      const filtered = patients.filter(p => periodPatientIds.has(p.patient_id));
      return filtered.length > 0 ? filtered : patients;
    }
    return patients;
  }, [demographicsScope, periodPatientIds, patients]);

  // Live Demographics and Age Analytics Computation
  const demographicsAnalytics = useMemo(() => {
    const list = scopedPatients;
    const totalCount = list.length;

    const enrichedList = list.map(p => {
      const age = resolvePatientAge(p);
      let bracketKey = 'unspecified';
      let bracketLabel = 'Not Specified';
      let bracketName = 'Age Unrecorded';

      if (age !== null) {
        if (age < 18) {
          bracketKey = '<18';
          bracketLabel = '<18 yrs';
          bracketName = 'Pediatric (<18)';
        } else if (age < 35) {
          bracketKey = '18-34';
          bracketLabel = '18–34 yrs';
          bracketName = 'Young Adults (18–34)';
        } else if (age < 50) {
          bracketKey = '35-49';
          bracketLabel = '35–49 yrs';
          bracketName = 'Adults (35–49)';
        } else if (age < 65) {
          bracketKey = '50-64';
          bracketLabel = '50–64 yrs';
          bracketName = 'Middle Age (50–64)';
        } else {
          bracketKey = '65+';
          bracketLabel = '65+ yrs';
          bracketName = 'Seniors (65+)';
        }
      }

      const apptCount = appointments.filter(a => a.patient_id === p.patient_id).length;

      return {
        ...p,
        resolvedAge: age,
        bracketKey,
        bracketLabel,
        bracketName,
        apptCount,
      };
    });

    const agesOnly = enrichedList.map(p => p.resolvedAge).filter((a): a is number => a !== null);
    const withAgeCount = agesOnly.length;
    const unspecifiedCount = totalCount - withAgeCount;

    const avgAge = withAgeCount > 0 ? Math.round((agesOnly.reduce((s, a) => s + a, 0) / withAgeCount) * 10) / 10 : null;
    const sortedAges = [...agesOnly].sort((a, b) => a - b);
    const medianAge = sortedAges.length > 0 ? sortedAges[Math.floor(sortedAges.length / 2)] : null;
    const minAge = sortedAges.length > 0 ? sortedAges[0] : null;
    const maxAge = sortedAges.length > 0 ? sortedAges[sortedAges.length - 1] : null;

    const bracketConfig: Array<{ key: string; label: string; name: string; color: string; desc: string }> = [
      { key: '<18', label: '<18 yrs', name: 'Pediatric (<18)', color: '#0F6E56', desc: 'Children & Adolescents' },
      { key: '18-34', label: '18–34 yrs', name: 'Young Adults (18–34)', color: '#05C994', desc: 'Young working & student population' },
      { key: '35-49', label: '35–49 yrs', name: 'Adults (35–49)', color: '#E08600', desc: 'Core adult demographic' },
      { key: '50-64', label: '50–64 yrs', name: 'Middle Age (50–64)', color: '#D63B4B', desc: 'Mature adults & pre-seniors' },
      { key: '65+', label: '65+ yrs', name: 'Seniors (65+)', color: '#6366F1', desc: 'Geriatric & senior health' },
    ];

    const bracketStats = bracketConfig.map(cfg => {
      const inBracket = enrichedList.filter(p => p.bracketKey === cfg.key);
      const count = inBracket.length;
      const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      const bAges = inBracket.map(p => p.resolvedAge!).filter(Boolean);
      const bAvg = bAges.length > 0 ? Math.round((bAges.reduce((s, a) => s + a, 0) / bAges.length) * 10) / 10 : null;
      return {
        ...cfg,
        count,
        pct,
        avgAge: bAvg,
        patients: inBracket,
      };
    });

    const unspecifiedPatients = enrichedList.filter(p => p.bracketKey === 'unspecified');
    const unspecifiedStat = {
      key: 'unspecified',
      label: 'Not Specified',
      name: 'Age Unrecorded',
      color: '#94A3B8',
      desc: 'Patients without recorded age or DOB',
      count: unspecifiedCount,
      pct: totalCount > 0 ? Math.round((unspecifiedCount / totalCount) * 100) : 0,
      avgAge: null,
      patients: unspecifiedPatients,
    };

    const donutData = [...bracketStats, ...(unspecifiedCount > 0 ? [unspecifiedStat] : [])]
      .filter(b => b.count > 0)
      .map(b => ({
        label: b.label,
        value: b.count,
        color: b.color,
      }));

    const genders = {
      Male: { count: 0, ages: [] as number[] },
      Female: { count: 0, ages: [] as number[] },
      Other: { count: 0, ages: [] as number[] },
      Unspecified: { count: 0, ages: [] as number[] },
    };

    enrichedList.forEach(p => {
      const g = (p.gender || '').trim();
      const cat = g === 'Male' ? 'Male' : g === 'Female' ? 'Female' : g === 'Other' ? 'Other' : 'Unspecified';
      genders[cat].count++;
      if (p.resolvedAge !== null) genders[cat].ages.push(p.resolvedAge);
    });

    const genderStats = Object.entries(genders).map(([label, data]) => {
      const count = data.count;
      const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      const avg = data.ages.length > 0 ? Math.round((data.ages.reduce((s, a) => s + a, 0) / data.ages.length) * 10) / 10 : null;
      return { label, count, pct, avg };
    });

    const sortedBrackets = [...bracketStats].sort((a, b) => b.count - a.count);
    const dominantBracket = sortedBrackets[0]?.count > 0 ? sortedBrackets[0] : null;

    return {
      totalCount,
      withAgeCount,
      unspecifiedCount,
      coveragePct: totalCount > 0 ? Math.round((withAgeCount / totalCount) * 100) : 0,
      avgAge,
      medianAge,
      minAge,
      maxAge,
      bracketStats,
      unspecifiedStat,
      donutData,
      genderStats,
      dominantBracket,
      enrichedList,
    };
  }, [scopedPatients, appointments, externalAgeMap]);

  // Filtered patient list for interactive explorer
  const filteredPatients = useMemo(() => {
    let list = demographicsAnalytics.enrichedList;
    if (selectedAgeBracket !== 'all') {
      list = list.filter(p => p.bracketKey === selectedAgeBracket);
    }
    if (demographicsSearch.trim()) {
      const q = demographicsSearch.toLowerCase().trim();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.display_id || '').toLowerCase().includes(q) ||
        (p.patient_code || '').toLowerCase().includes(q) ||
        (p.phone || '').includes(q) ||
        (p.resolvedAge !== null && String(p.resolvedAge).includes(q))
      );
    }
    return list;
  }, [demographicsAnalytics.enrichedList, selectedAgeBracket, demographicsSearch]);

  // Legacy demographics alias for safety
  const demographics = demographicsAnalytics.donutData;

  // Live Payment Breakdown (Cash vs UPI vs Card vs Pending)
  const paymentBreakdown = useMemo(() => {
    const grp = { cash: 0, upi: 0, card: 0, pending: 0 };
    rangeBills.forEach(b => {
      const amt = getBillAmount(b);
      if (!isBillPaid(b) && !isBillCancelled(b)) {
        grp.pending += amt;
      } else if (isBillPaid(b)) {
        const method = String(b.payment_method || 'cash').toLowerCase().trim();
        if (method === 'upi') grp.upi += amt;
        else if (method === 'card') grp.card += amt;
        else grp.cash += amt;
      }
    });
    return [
      { label: 'Cash', value: Math.round(grp.cash), color: '#0F6E56' },
      { label: 'UPI', value: Math.round(grp.upi), color: '#05C994' },
      { label: 'Card', value: Math.round(grp.card), color: '#5A6B7B' },
      { label: 'Pending', value: Math.round(grp.pending), color: '#E08600' },
    ];
  }, [rangeBills]);

  // Outstanding pending dues across all time
  const pendingCollections = useMemo(() => {
    const byPatient: Record<string, { name: string; amount: number }> = {};
    bills.filter(b => !isBillPaid(b) && !isBillCancelled(b)).forEach(b => {
      const p = patients.find(pat => pat.patient_id === b.patient_id);
      const name = p?.name ?? (b as any).patient?.name ?? (b as any).patient_name ?? 'Unknown';
      if (!byPatient[name]) byPatient[name] = { name, amount: 0 };
      byPatient[name].amount += getBillAmount(b);
    });
    return Object.values(byPatient).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [bills, patients]);

  const totalPending = useMemo(() => {
    return bills
      .filter(b => !isBillPaid(b) && !isBillCancelled(b))
      .reduce((s, b) => s + getBillAmount(b), 0);
  }, [bills]);



  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-ink">Analytics</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Radio className="w-3 h-3 animate-pulse text-emerald-600" />
              <span>Live Firestore</span>
            </span>
          </div>
          <p className="text-sm text-ink-muted">{formatDate(start)} — {formatDate(end)}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-primary-50/60 p-0.5">
          {(['today', 'week', 'month', 'custom'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${range === r ? 'bg-white text-primary shadow-sm' : 'text-ink-muted hover:text-ink'}`}
            >
              {r === 'today' ? 'Today' : r === 'week' ? 'This week' : r === 'month' ? 'This month' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      {range === 'custom' && (
        <div className="card flex items-center gap-3 flex-wrap">
          <Calendar size={16} className="text-ink-muted" />
          <div>
            <label className="label">Start</label>
            <input type="date" className="input" value={formatDobForInput(customStart)} onChange={e => setCustomStart(e.target.value)} />
          </div>
          <div>
            <label className="label">End</label>
            <input type="date" className="input" value={formatDobForInput(customEnd)} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Total patients" value={String(stats.totalPatients)} sub="Seen this period" />
        <Metric label="Revenue (paid)" value={formatRs(stats.paidRevenue)} sub={`${rangeBills.filter(isBillPaid).length} paid bills`} />
        <Metric label="Avg bill value" value={formatRs(stats.avgBill)} sub="Per generated bill" />
        <Metric label="Collection rate" value={`${stats.collectionRate}%`} sub="Paid vs generated" />
      </div>

      {totalPending > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-warning-bg border border-warning/20 px-4 py-3">
          <AlertTriangle size={18} className="text-warning shrink-0" />
          <p className="text-sm text-warning font-medium">
            Pending collections (all time): <strong>{formatRs(totalPending)}</strong> across {bills.filter(b => !isBillPaid(b) && !isBillCancelled(b)).length} bills requiring follow-up.
          </p>
        </div>
      )}

      {/* Charts Row: Footfall & Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <SectionHeader title="Patient footfall" subtitle="Daily appointments in selected range" />
          <LineChart data={footfallOverTime} color="#0F6E56" height={200} />
        </div>
        <div className="card">
          <SectionHeader title="Revenue trend" subtitle="Daily paid collections" />
          <BarChart data={revenueOverTime} color="#05C994" height={200} formatValue={n => '₹' + n} />
        </div>
      </div>

      {/* Charts Row: Payment Method & Pending Collections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <SectionHeader title="Payment method breakdown" subtitle="Cash vs UPI vs Card vs Pending" />
          <DonutChart data={paymentBreakdown} size={170} />
        </div>
        <div className="card">
          <SectionHeader title="Pending collections" subtitle="Top patients with outstanding balance" />
          {pendingCollections.length === 0 ? (
            <p className="text-sm text-ink-subtle mt-4">All bills are settled. Zero pending dues!</p>
          ) : (
            <div className="space-y-2.5 mt-2">
              {pendingCollections.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted">{p.name}</span>
                  <span className="text-sm font-semibold text-warning">{formatRs(p.amount)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-black/5 flex justify-between text-sm font-bold text-ink">
                <span>Total outstanding</span>
                <span className="text-warning">{formatRs(totalPending)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row: Top Diagnoses & Completion Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <SectionHeader title="Top diagnoses" subtitle="Most common clinical presentations this period" />
          {topDiagnoses.length === 0 ? (
            <p className="text-sm text-ink-subtle mt-4">No diagnoses recorded in selected range.</p>
          ) : (
            <div className="mt-3">
              <HBarChart data={topDiagnoses} color="#0F6E56" />
            </div>
          )}
        </div>
        <div className="card flex flex-col items-center">
          <SectionHeader title="Completion rate" subtitle="Appointments done / total" />
          <div className="my-2">
            <ProgressRing value={stats.completion} size={130} label={`of ${stats.total} visits`} />
          </div>
          <div className="grid grid-cols-2 gap-2 w-full mt-4 text-center">
            <div className="rounded bg-success-bg/50 p-2">
              <p className="text-xs text-ink-muted">Done</p>
              <p className="text-lg font-bold text-success">{stats.completed}</p>
            </div>
            <div className="rounded bg-warning-bg/50 p-2">
              <p className="text-xs text-ink-muted">Pending</p>
              <p className="text-lg font-bold text-warning">{stats.total - stats.completed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Patient Demographics & Live Age Analytics */}
      <div className="card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink">Patient Demographics & Live Age Analytics</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-600" />
                <span>Live Data</span>
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Real-time age group distribution, clinical cohort metrics, and live patient directory
            </p>
          </div>

          {/* Scope Selector: All Patients vs Active This Period */}
          <div className="flex items-center gap-1 bg-primary-50/60 p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setDemographicsScope('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                demographicsScope === 'all'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              All Clinic Patients ({patients.length})
            </button>
            <button
              onClick={() => setDemographicsScope('period')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                demographicsScope === 'period'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Active in Period ({periodPatientIds.size})
            </button>
          </div>
        </div>

        {/* Live Age KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/70 p-3.5">
            <div className="flex items-center justify-between text-ink-muted text-xs font-medium">
              <span>Average Age</span>
              <Activity size={14} className="text-[#0F6E56]" />
            </div>
            <p className="text-xl font-bold text-ink mt-1.5">
              {demographicsAnalytics.avgAge !== null ? `${demographicsAnalytics.avgAge} yrs` : '—'}
            </p>
            <p className="text-[11px] text-ink-subtle mt-0.5">
              Median: {demographicsAnalytics.medianAge !== null ? `${demographicsAnalytics.medianAge} yrs` : '—'}
            </p>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/70 p-3.5">
            <div className="flex items-center justify-between text-ink-muted text-xs font-medium">
              <span>Age Coverage</span>
              <CheckCircle size={14} className="text-[#05C994]" />
            </div>
            <p className="text-xl font-bold text-ink mt-1.5">
              {demographicsAnalytics.coveragePct}%
            </p>
            <p className="text-[11px] text-ink-subtle mt-0.5">
              {demographicsAnalytics.withAgeCount} of {demographicsAnalytics.totalCount} profiles
            </p>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/70 p-3.5">
            <div className="flex items-center justify-between text-ink-muted text-xs font-medium">
              <span>Age Range</span>
              <TrendingUp size={14} className="text-[#E08600]" />
            </div>
            <p className="text-xl font-bold text-ink mt-1.5">
              {demographicsAnalytics.minAge !== null && demographicsAnalytics.maxAge !== null
                ? `${demographicsAnalytics.minAge}y – ${demographicsAnalytics.maxAge}y`
                : '—'}
            </p>
            <p className="text-[11px] text-ink-subtle mt-0.5">
              {demographicsAnalytics.minAge !== null && demographicsAnalytics.maxAge !== null
                ? `${demographicsAnalytics.maxAge - demographicsAnalytics.minAge} yrs spread`
                : 'Single cohort'}
            </p>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/70 p-3.5">
            <div className="flex items-center justify-between text-ink-muted text-xs font-medium">
              <span>Primary Cohort</span>
              <Users size={14} className="text-[#6366F1]" />
            </div>
            <p className="text-xl font-bold text-ink mt-1.5 truncate">
              {demographicsAnalytics.dominantBracket?.label || '—'}
            </p>
            <p className="text-[11px] text-ink-subtle mt-0.5 truncate">
              {demographicsAnalytics.dominantBracket
                ? `${demographicsAnalytics.dominantBracket.count} pts (${demographicsAnalytics.dominantBracket.pct}%)`
                : 'No data'}
            </p>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/70 p-3.5 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-ink-muted text-xs font-medium">
              <span>Gender Balance</span>
              <User size={14} className="text-[#D63B4B]" />
            </div>
            <p className="text-xl font-bold text-ink mt-1.5">
              {demographicsAnalytics.genderStats.find(g => g.label === 'Male')?.pct || 0}% M · {demographicsAnalytics.genderStats.find(g => g.label === 'Female')?.pct || 0}% F
            </p>
            <p className="text-[11px] text-ink-subtle mt-0.5">
              {demographicsAnalytics.totalCount} total in scope
            </p>
          </div>
        </div>

        {/* Dual Column: Chart + Cohorts on Left, Gender & Clinical Breakdown on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
          {/* Left Column: Donut + Age Cohort Interactive Progress Bars */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Age Group Distribution
              </h3>
              <span className="text-xs text-ink-subtle">
                Click a cohort to filter directory
              </span>
            </div>

            {demographicsAnalytics.totalCount === 0 || demographicsAnalytics.donutData.length === 0 ? (
              <div className="p-8 text-center bg-gray-50/60 rounded-2xl border border-gray-100">
                <Users size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">No Patient Records in Chosen Scope</p>
                <p className="text-xs text-gray-400 mt-1">Switch scope to "All Clinic Patients" or add patient records.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-[#FAFDFD] p-3.5 rounded-2xl border border-teal-100/60 flex items-center justify-center">
                  <DonutChart data={demographicsAnalytics.donutData} size={165} />
                </div>

                {/* Interactive Cohort Bars */}
                <div className="space-y-2">
                  {demographicsAnalytics.bracketStats.map(b => {
                    const isSelected = selectedAgeBracket === b.key;
                    return (
                      <div
                        key={b.key}
                        onClick={() => setSelectedAgeBracket(isSelected ? 'all' : b.key)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-teal-50/80 border-teal-300 shadow-2xs'
                            : 'bg-white border-slate-200/60 hover:bg-slate-50/80 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                            <span className="font-bold text-ink">{b.name}</span>
                            <span className="text-[11px] text-ink-subtle font-mono">({b.label})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {b.avgAge !== null && (
                              <span className="text-[11px] text-ink-subtle">
                                Avg: <strong>{b.avgAge}y</strong>
                              </span>
                            )}
                            <span className="font-bold text-ink bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                              {b.count} pts ({b.pct}%)
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(b.count > 0 ? 3 : 0, b.pct)}%`,
                              backgroundColor: b.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Unspecified Bracket if any */}
                  {demographicsAnalytics.unspecifiedCount > 0 && (
                    <div
                      onClick={() => setSelectedAgeBracket(selectedAgeBracket === 'unspecified' ? 'all' : 'unspecified')}
                      className={`p-2.5 rounded-xl border transition cursor-pointer ${
                        selectedAgeBracket === 'unspecified'
                          ? 'bg-slate-100 border-slate-400'
                          : 'bg-white border-slate-200/60 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                          <span className="font-bold text-ink">Age Not Recorded</span>
                        </div>
                        <span className="font-bold text-ink bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                          {demographicsAnalytics.unspecifiedCount} pts ({demographicsAnalytics.unspecifiedStat.pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-slate-400"
                          style={{ width: `${Math.max(3, demographicsAnalytics.unspecifiedStat.pct)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Gender Demographics & Clinical Insights */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Gender & Clinical Profile
            </h3>

            {/* Gender Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {demographicsAnalytics.genderStats.map(g => (
                <div key={g.label} className="p-3 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">{g.label}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-ink-muted">
                      {g.pct}%
                    </span>
                  </div>
                  <p className="text-lg font-bold text-ink mt-1">{g.count} <span className="text-xs font-normal text-ink-muted">pts</span></p>
                  <p className="text-[11px] text-ink-subtle mt-0.5">
                    {g.avg !== null ? `Avg age: ${g.avg} yrs` : 'Age unrecorded'}
                  </p>
                </div>
              ))}
            </div>

            {/* Clinical Demographics Insights */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50/60 to-emerald-50/30 border border-teal-100/80 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0F6E56]">
                <Sparkles size={14} />
                <span>Clinical Demographics Insights</span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Pediatric Ratio */}
                <div className="flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-teal-100/60">
                  <span className="text-ink-muted">Pediatric Patient Ratio (&lt;18y)</span>
                  <span className="font-bold text-[#0F6E56]">
                    {demographicsAnalytics.bracketStats[0]?.pct || 0}% ({demographicsAnalytics.bracketStats[0]?.count || 0} pts)
                  </span>
                </div>

                {/* Working Age Ratio */}
                <div className="flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-teal-100/60">
                  <span className="text-ink-muted">Working Adults (18–64y)</span>
                  <span className="font-bold text-[#05C994]">
                    {((demographicsAnalytics.bracketStats[1]?.pct || 0) +
                      (demographicsAnalytics.bracketStats[2]?.pct || 0) +
                      (demographicsAnalytics.bracketStats[3]?.pct || 0))}% (
                    {(demographicsAnalytics.bracketStats[1]?.count || 0) +
                      (demographicsAnalytics.bracketStats[2]?.count || 0) +
                      (demographicsAnalytics.bracketStats[3]?.count || 0)} pts)
                  </span>
                </div>

                {/* Senior Ratio */}
                <div className="flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-teal-100/60">
                  <span className="text-ink-muted">Geriatric & Seniors (65+y)</span>
                  <span className="font-bold text-[#6366F1]">
                    {demographicsAnalytics.bracketStats[4]?.pct || 0}% ({demographicsAnalytics.bracketStats[4]?.count || 0} pts)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Patient Age Directory / Explorer */}
        <div className="pt-3 border-t border-black/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPatientList(!showPatientList)}
                className="flex items-center gap-1.5 text-xs font-bold text-ink hover:text-primary transition"
              >
                {showPatientList ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                <span>Live Patient Age Records</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-ink-muted text-[11px] font-semibold">
                  {filteredPatients.length} of {demographicsAnalytics.totalCount}
                </span>
              </button>
            </div>

            {/* Live Search and Bracket Reset */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, phone, age..."
                  value={demographicsSearch}
                  onChange={e => setDemographicsSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-primary w-48 sm:w-56"
                />
              </div>

              {selectedAgeBracket !== 'all' && (
                <button
                  onClick={() => setSelectedAgeBracket('all')}
                  className="text-[11px] font-semibold text-primary hover:underline px-2 py-1 rounded-lg bg-teal-50"
                >
                  Clear Filter ({selectedAgeBracket})
                </button>
              )}
            </div>
          </div>

          {/* Bracket Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedAgeBracket('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition ${
                selectedAgeBracket === 'all'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-slate-100 text-ink-muted hover:bg-slate-200'
              }`}
            >
              All ({demographicsAnalytics.totalCount})
            </button>
            {demographicsAnalytics.bracketStats.map(b => (
              <button
                key={b.key}
                onClick={() => setSelectedAgeBracket(b.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-1 ${
                  selectedAgeBracket === b.key
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-slate-100 text-ink-muted hover:bg-slate-200'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.color }} />
                <span>{b.label} ({b.count})</span>
              </button>
            ))}
            {demographicsAnalytics.unspecifiedCount > 0 && (
              <button
                onClick={() => setSelectedAgeBracket('unspecified')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition ${
                  selectedAgeBracket === 'unspecified'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-slate-100 text-ink-muted hover:bg-slate-200'
                }`}
              >
                Unspecified ({demographicsAnalytics.unspecifiedCount})
              </button>
            )}
          </div>

          {/* Patient Directory List */}
          {showPatientList && (
            <div className="mt-2 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              {filteredPatients.length === 0 ? (
                <div className="p-6 text-center text-xs text-ink-muted">
                  No patients found matching the current age bracket and search filter.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 sticky top-0 z-10 text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Patient</th>
                        <th className="py-2.5 px-3">Age</th>
                        <th className="py-2.5 px-3">Clinical Cohort</th>
                        <th className="py-2.5 px-3">Gender</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3 text-right">Visits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPatients.map(p => (
                        <tr key={p.patient_id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 font-semibold text-ink">
                            <div>
                              <span>{p.name || 'Unnamed Patient'}</span>
                              {(p.display_id || p.patient_code) && (
                                <span className="ml-1.5 text-[10px] font-mono text-ink-subtle">
                                  #{p.display_id || p.patient_code}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {p.resolvedAge !== null ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-50 text-[#0F6E56] font-bold border border-teal-100">
                                {p.resolvedAge} yrs
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Not set</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] font-medium text-slate-700">
                              {p.bracketName}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-ink-muted">
                            {p.gender || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-ink-muted">
                            {p.phone || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-ink">
                            {p.apptCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Clinic Efficiency Card */}
      <div className="card">
        <SectionHeader title="Clinic efficiency" subtitle="Key live performance ratios for the period" />
        <div className="space-y-4 mt-3">
          <ProgressBar label="Appointment completion" value={stats.completion} color="#0F6E56" rightText={`${stats.completion}%`} />
          <ProgressBar label="Bill collection rate" value={stats.collectionRate} color="#05C994" rightText={`${stats.collectionRate}%`} />
          <ProgressBar label="Patient return rate" value={stats.returnRate} color="#0F6E56" rightText={`${stats.returnRate}%`} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-ink-muted uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-bold text-ink mt-1">{value}</p>
      {sub && <p className="text-xs text-ink-subtle mt-1">{sub}</p>}
    </div>
  );
}
