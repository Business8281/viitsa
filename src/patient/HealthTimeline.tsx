import { useEffect, useState } from 'react';
import {
  ChevronLeft, Calendar, Stethoscope, FileText, Brain, Activity, Filter,
  ChevronDown, ChevronUp, Pill, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePatientAuth } from '../lib/patientAuth';
import { formatDate } from '../lib/format';
import type { PatientTab } from './PatientBottomNav';

type EventType = 'all' | 'appointment' | 'consultation' | 'report' | 'ai';

interface TimelineEvent {
  id: string;
  type: 'appointment' | 'consultation' | 'report' | 'ai';
  date: string;
  title: string;
  subtitle: string;
  detail?: string;
  status?: string;
}

interface Props {
  onTab: (t: PatientTab) => void;
  patientId: string | null;
  clinicId: string | null;
}

const TYPE_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  appointment: Calendar,
  consultation: Stethoscope,
  report: FileText,
  ai: Brain,
};

const TYPE_COLOR: Record<string, string> = {
  appointment: 'bg-blue-50 text-blue-600',
  consultation: 'bg-[#E1F5EE] text-primary',
  report: 'bg-orange-50 text-orange-600',
  ai: 'bg-violet-50 text-violet-600',
};

const TYPE_BORDER: Record<string, string> = {
  appointment: 'border-blue-200',
  consultation: 'border-primary/30',
  report: 'border-orange-200',
  ai: 'border-violet-200',
};

export function HealthTimeline({ onTab, patientId, clinicId }: Props) {
  const { account } = usePatientAuth();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<EventType>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId && !account) { setLoading(false); return; }
    const all: TimelineEvent[] = [];
    const promises: Promise<void>[] = [];

    if (patientId) {
      promises.push(
        supabase.from('appointments').select('*, doctor:users(name, specialisation)')
          .eq('patient_id', patientId).order('date', { ascending: false }).limit(20)
          .then(({ data }) => {
            (data ?? []).forEach((a: Record<string, unknown>) => {
              all.push({
                id: a.appt_id as string,
                type: 'appointment',
                date: a.date as string,
                title: `Appointment`,
                subtitle: (a.doctor as { name?: string } | null)?.name ?? 'Doctor',
                status: a.status as string,
                detail: a.reason as string | undefined,
              });
            });
          }),
        supabase.from('consultations').select('*')
          .eq('patient_id', patientId).order('created_at', { ascending: false }).limit(20)
          .then(({ data }) => {
            (data ?? []).forEach((c: Record<string, unknown>) => {
              all.push({
                id: c.consult_id as string,
                type: 'consultation',
                date: (c.created_at as string).slice(0, 10),
                title: (c.diagnosis as string) || 'Consultation',
                subtitle: (c.symptoms as string) || '',
                detail: c.prescription as string | undefined,
              });
            });
          }),
        supabase.from('health_reports').select('*')
          .eq('patient_id', patientId).order('created_at', { ascending: false }).limit(10)
          .then(({ data }) => {
            (data ?? []).forEach((r: Record<string, unknown>) => {
              all.push({
                id: r.report_id as string,
                type: 'report',
                date: (r.report_date as string | null) ?? (r.created_at as string).slice(0, 10),
                title: (r.report_type as string) || 'Health Report',
                subtitle: (r.hospital_or_doctor as string) || '',
                detail: r.summary as string | undefined,
              });
            });
          }),
      );
    }

    if (account) {
      promises.push(
        supabase.from('ai_conversations').select('*')
          .eq('account_id', account.account_id).order('created_at', { ascending: false }).limit(10)
          .then(({ data }) => {
            (data ?? []).forEach((s: Record<string, unknown>) => {
              all.push({
                id: s.conversation_id as string,
                type: 'ai',
                date: (s.created_at as string).slice(0, 10),
                title: 'AI Health Check',
                subtitle: `Triage: ${String(s.triage_level ?? 'normal').toUpperCase()}`,
                detail: (s.triage_summary as { chief_complaint?: string } | null)?.chief_complaint ?? undefined,
              });
            });
          }),
      );
    }

    Promise.all(promises).then(() => {
      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEvents(all);
      setLoading(false);
    });
  }, [patientId, account]);

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);

  const FILTERS: { key: EventType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'appointment', label: 'Appointments' },
    { key: 'consultation', label: 'Visits' },
    { key: 'report', label: 'Reports' },
    { key: 'ai', label: 'AI Checks' },
  ];

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-28">
      <div className="bg-primary px-4 pt-12 pb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => onTab('home')} aria-label="Back" className="p-2 rounded-xl bg-white/10 text-white">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p className="text-sm font-bold text-white">Health Timeline</p>
            <p className="text-xs text-white/60">Your complete health journey</p>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${filter === f.key ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-0">
        {loading && (
          <div className="space-y-3 mt-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="bg-white rounded-2xl border border-gray-100 h-16 animate-pulse" />)}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center mt-2">
            <Activity size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700">No health events yet</p>
            <p className="text-xs text-gray-400 mt-1">Book an appointment or do an AI check to get started</p>
          </div>
        )}

        {!loading && filtered.map((evt, idx) => {
          const Icon = TYPE_ICON[evt.type] ?? Calendar;
          const isOpen = expanded === evt.id;
          const isLast = idx === filtered.length - 1;

          return (
            <div key={evt.id} className="relative flex gap-4">
              {/* Timeline line */}
              {!isLast && <div className="absolute left-[27px] top-12 bottom-0 w-0.5 bg-gray-100" />}

              <div className="relative z-10 flex flex-col items-center pt-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${TYPE_COLOR[evt.type]}`}>
                  <Icon size={18} />
                </div>
              </div>

              <div className="flex-1 pb-4 pt-3">
                <div
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${TYPE_BORDER[evt.type]}`}
                  onClick={() => setExpanded(isOpen ? null : evt.id)}
                >
                  <div className="px-4 py-3 flex items-start gap-2 cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400">{formatDate(evt.date)}</p>
                      <p className="text-sm font-semibold text-gray-900 mt-0.5">{evt.title}</p>
                      {evt.subtitle && <p className="text-xs text-gray-500 truncate">{evt.subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {evt.status && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          evt.status === 'done' ? 'bg-green-50 text-green-700' :
                          evt.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                          'bg-yellow-50 text-yellow-700'
                        }`}>{evt.status}</span>
                      )}
                      {evt.detail && (isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />)}
                    </div>
                  </div>
                  {isOpen && evt.detail && (
                    <div className="border-t border-gray-50 px-4 py-3">
                      <p className="text-xs text-gray-600 leading-relaxed">{evt.detail}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
