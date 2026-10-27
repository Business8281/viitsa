import { useEffect, useState } from 'react';
import { Sparkles, Languages, AlertTriangle, Siren, Stethoscope, Clock, User, CheckCircle, Brain, Activity } from 'lucide-react';
import type { TriageSummary, Language } from '../lib/aiService';
import { translateSummary, LANG_LABELS } from '../lib/aiService';

const LANGS: Language[] = ['en', 'hi', 'te'];

export function AISummaryPanel({ summary }: { summary: TriageSummary | null | undefined }) {
  const [lang, setLang] = useState<Language>('en');
  const [display, setDisplay] = useState<TriageSummary | null>(summary ?? null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    setDisplay(summary ?? null);
    setLang('en');
  }, [summary]);

  useEffect(() => {
    if (!summary || lang === 'en') { setDisplay(summary ?? null); return; }
    let cancelled = false;
    setTranslating(true);
    translateSummary(summary, lang).then((t) => {
      if (!cancelled) setDisplay(t);
      setTranslating(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, summary]);

  if (!summary || !display) return null;

  const level = display.level ?? 'NORMAL';
  const tone =
    level === 'URGENT' ? 'bg-danger-bg/40 border-danger/20'
    : level === 'MODERATE' ? 'bg-warning-bg/40 border-warning/20'
    : 'bg-accent-50 border-accent-600/20';
  const badge =
    level === 'URGENT' ? 'badge-urgent'
    : level === 'MODERATE' ? 'badge-waiting'
    : 'badge-done';

  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-accent-600" />
          <p className="text-[10px] font-semibold text-accent-600 uppercase">AI Medical Summary</p>
        </div>
        <LanguageSelector lang={lang} onChange={setLang} disabled={translating} />
      </div>

      {translating && (
        <p className="text-[10px] text-ink-subtle mb-2 italic">Translating…</p>
      )}

      <div className="space-y-1.5 text-xs">
        <Row icon={<User size={11} />} label="Chief Complaint" value={display.chief_complaint} />
        <Row icon={<Clock size={11} />} label="Symptom Timeline" value={display.symptom_timeline || display.duration} />
        <Row icon={<AlertTriangle size={11} />} label="Severity" value={display.severity} />
        {display.relevant_history && <Row icon={<User size={11} />} label="Relevant History" value={display.relevant_history} />}
        {display.body_location && <Row icon={<Stethoscope size={11} />} label="Location" value={display.body_location} />}
        {display.possible_differentials && <Row icon={<Stethoscope size={11} />} label="Possible Clinical Findings" value={display.possible_differentials} />}
        {display.suggested_investigations && <Row icon={<CheckCircle size={11} />} label="Suggested Investigations" value={display.suggested_investigations} />}
        {display.red_flag_symptoms && (
          <div className="flex items-start gap-1.5 text-danger">
            <Siren size={11} className="mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold">Red Flag Symptoms: </span>
              <span>{display.red_flag_symptoms}</span>
            </div>
          </div>
        )}
        {display.self_care_advice && <Row icon={<CheckCircle size={11} />} label="Self-care" value={display.self_care_advice} />}
        {display.department && <Row icon={<Stethoscope size={11} />} label="Department" value={display.department} />}
        {display.doctor && <Row icon={<Brain size={11} />} label="Doctor" value={display.doctor} />}
        <Row icon={<CheckCircle size={11} />} label="Next Steps" value={display.next_steps} />
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5">
        <span className={`badge ${badge} text-[10px] uppercase`}>{level}</span>
        <span className="text-[10px] text-ink-subtle flex items-center gap-1">
          <Activity size={10} /> Confidence: <span className="font-medium capitalize">{display.ai_confidence ?? 'medium'}</span>
        </span>
      </div>

      {lang !== 'en' && (
        <p className="text-[9px] text-ink-subtle mt-1.5 italic">Translated for viewing · English is the source</p>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-ink-subtle mt-0.5 shrink-0">{icon}</span>
      <div>
        <span className="text-ink-muted font-medium">{label}: </span>
        <span className="text-ink">{value}</span>
      </div>
    </div>
  );
}

export function LanguageSelector({ lang, onChange, disabled }: { lang: Language; onChange: (l: Language) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-white/70 border border-black/5 p-0.5">
      <Languages size={11} className="text-ink-subtle mx-1" />
      {LANGS.map((l) => (
        <button
          key={l}
          disabled={disabled}
          onClick={() => onChange(l)}
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition disabled:opacity-40 ${lang === l ? 'bg-accent-600 text-white' : 'text-ink-muted hover:text-ink'}`}
        >
          {LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
