import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Brain,
  Send,
  Siren,
  Activity,
  Sparkles,
  ShieldAlert,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Globe,
  CheckCircle,
  AlertTriangle,
  Clock,
  Stethoscope,
  User,
  Edit3,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useClinicData } from '../lib/useClinicData';
import { useToast } from '../lib/toast';
import { Loading, Avatar, SectionHeader } from '../components/ui';
import { ProgressBar } from '../components/Charts';
import { formatLongDate } from '../lib/format';
import { riskBarsFromPatient } from '../lib/triage';
import {
  buildSystemPrompt,
  detectLanguage,
  sendToAI,
  speak,
  stopSpeaking,
  startListening,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  LANG_LABELS,
  type Language,
  type AIMessage,
  type TriageSummary,
} from '../lib/aiService';
import type { Patient, Vital, Appointment } from '../lib/types';

const DISCLAIMER =
  'VIITSA AI Navigator provides pre-consultation support only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified doctor for medical decisions.';

interface Message {
  role: 'ai' | 'patient';
  text: string;
  ts: number;
}

const GREETING = "Hello, I'm VIITSA AI Navigator. Can you describe your symptoms? Please mention how long you've had them.";

export function AINavigatorScreen() {
  const { user, clinic } = useAuth();
  const { patients, appointments } = useClinicData();
  const { toast } = useToast();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'ai', text: GREETING, ts: Date.now() }]);
  const [input, setInput] = useState('');
  const [vitals, setVitals] = useState<Vital | null>(null);
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [triage, setTriage] = useState<TriageSummary | null>(null);
  const [rawLevel, setRawLevel] = useState<'urgent' | 'moderate' | 'normal'>('normal');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewEdit, setReviewEdit] = useState<TriageSummary | null>(null);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [clinicContext, setClinicContext] = useState<{
    doctors: { user_id: string; name: string; specialisation: string | null }[];
  }>({ doctors: [] });

  const scrollRef = useRef<HTMLDivElement>(null);
  const aiHistory = useRef<AIMessage[]>([{ role: 'assistant', content: GREETING }]);
  const userExchanges = useRef(0);
  const stopListenRef = useRef<(() => void) | null>(null);

  const canListen = isSpeechRecognitionSupported();
  const canSpeak = isSpeechSynthesisSupported();

  useEffect(() => {
    if (!clinic) return;
    supabase.from('users').select('user_id, name, specialisation').eq('clinic_id', clinic.clinic_id).eq('role', 'doctor').eq('active', true)
      .then(({ data }) => setClinicContext({ doctors: (data ?? []) as { user_id: string; name: string; specialisation: string | null }[] }));
  }, [clinic]);

  // Auto-select first patient
  useEffect(() => {
    if (!selectedPatient && patients.length > 0) {
      const aiPatient = patients.find((p) => p.name === 'Anil Sharma') ?? patients[0];
      setSelectedPatient(aiPatient);
    }
  }, [patients, selectedPatient]);

  useEffect(() => {
    if (!selectedPatient) return;
    supabase.from('vitals').select('*').eq('patient_id', selectedPatient.patient_id)
      .order('recorded_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setVitals(data as Vital | null));
    const latestAppt = appointments.filter((a) => a.patient_id === selectedPatient.patient_id)
      .sort((a, b) => (a.date > b.date ? -1 : 1))[0];
    setAppt(latestAppt ?? null);
  }, [selectedPatient, appointments]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const riskBars = useMemo(() => riskBarsFromPatient(selectedPatient ?? undefined, vitals ?? undefined), [selectedPatient, vitals]);

  const handleAIResponse = useCallback(async (userText: string) => {
    userExchanges.current += 1;
    const ctx = clinic
      ? {
          clinic_id: clinic.clinic_id,
          name: clinic.name,
          city: clinic.city,
          working_hours: clinic.working_hours,
          doctors: clinicContext.doctors,
        }
      : null;

    const systemPrompt = buildSystemPrompt(language, ctx, selectedPatient?.name?.split(' ')[0], userExchanges.current);
    const response = await sendToAI(aiHistory.current, systemPrompt);
    aiHistory.current.push({ role: 'assistant', content: response.text });
    setMessages((prev) => [...prev, { role: 'ai', text: response.text, ts: Date.now() }]);
    setTyping(false);

    if (response.summary) {
      setTriage(response.summary);
      setReviewEdit(response.summary);
    }
    setRawLevel(response.rawLevel);

    if (ttsEnabled && canSpeak) {
      setSpeaking(true);
      speak(response.text, language);
      const words = response.text.split(/\s+/).length;
      setTimeout(() => setSpeaking(false), words * 150 + 500);
    }

    // Persist conversation
    if (clinic && selectedPatient) {
      const allMessages = aiHistory.current.map((m) => ({ role: m.role, content: m.content }));
      if (!conversationId) {
        const { data } = await supabase
          .from('ai_conversations')
          .insert({
            clinic_id: clinic.clinic_id,
            patient_id: selectedPatient.patient_id,
            appt_id: appt?.appt_id ?? null,
            messages: allMessages,
            detected_language: language,
            triage_level: response.rawLevel,
            triage_summary: response.summary ?? null,
          })
          .select('conversation_id')
          .maybeSingle();
        if (data?.conversation_id) setConversationId(data.conversation_id);
      } else {
        await supabase.from('ai_conversations').update({
          messages: allMessages,
          triage_level: response.rawLevel,
          triage_summary: response.summary ?? null,
          updated_at: new Date().toISOString(),
        }).eq('conversation_id', conversationId);
      }

      // Escalate appointment triage if urgent
      if (response.rawLevel !== 'normal' && appt) {
        await supabase.from('appointments').update({ triage_level: response.rawLevel }).eq('appt_id', appt.appt_id);
        if (response.rawLevel === 'urgent') {
          toast('Doctor notified — patient moved to top of queue.', 'warning');
        }
      }
    }
  }, [language, clinic, clinicContext, selectedPatient, appt, ttsEnabled, canSpeak, conversationId, toast]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;

    if (userExchanges.current === 0) {
      const detected = detectLanguage(trimmed);
      if (detected !== language) setLanguage(detected);
    }

    aiHistory.current.push({ role: 'user', content: trimmed });
    setMessages((prev) => [...prev, { role: 'patient', text: trimmed, ts: Date.now() }]);
    setInput('');
    setTyping(true);

    await handleAIResponse(trimmed);
  }, [typing, language, handleAIResponse]);

  const resetChat = (patient: Patient) => {
    setSelectedPatient(patient);
    setMessages([{ role: 'ai', text: GREETING, ts: Date.now() }]);
    aiHistory.current = [{ role: 'assistant', content: GREETING }];
    userExchanges.current = 0;
    setTriage(null);
    setRawLevel('normal');
    setConversationId(null);
    setReviewSaved(false);
    setReviewEdit(null);
    setShowReview(false);
  };

  const toggleListening = useCallback(() => {
    if (listening) {
      stopListenRef.current?.();
      stopListenRef.current = null;
      setListening(false);
      setInterimText('');
      return;
    }
    if (!canListen) return;
    setListening(true);
    let finalAccumulated = '';
    const stop = startListening(
      language,
      (interim, final) => {
        if (final) { finalAccumulated += final; setInput(finalAccumulated); setInterimText(''); }
        else setInterimText(interim);
      },
      () => {
        setListening(false);
        setInterimText('');
        if (finalAccumulated.trim()) void sendMessage(finalAccumulated.trim());
      },
    );
    stopListenRef.current = stop;
  }, [listening, canListen, language, sendMessage]);

  const saveReview = async () => {
    if (!reviewEdit || !conversationId) return;
    await supabase.from('ai_conversations').update({
      doctor_review: { ...reviewEdit, reviewed_by: user?.name, reviewed_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }).eq('conversation_id', conversationId);
    setTriage(reviewEdit);
    setReviewSaved(true);
    setShowReview(false);
    toast('Review saved successfully.', 'success');
  };

  if (!user) return <Loading label="Loading…" />;

  return (
    <div className="h-[calc(100vh-7.5rem)] lg:h-[calc(100vh-9rem)] flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">AI Patient Navigator</h1>
          <p className="text-sm text-ink-muted">Conversational triage · powered by OpenAI</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowLangPicker((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 text-xs font-semibold text-ink-muted hover:border-primary/30 transition"
            >
              <Globe size={13} />
              {LANG_LABELS[language]}
            </button>
            {showLangPicker && (
              <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border border-black/5 z-50 overflow-hidden">
                {(Object.keys(LANG_LABELS) as Language[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLanguage(l); setShowLangPicker(false); }}
                    className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition ${language === l ? 'bg-primary/10 text-primary' : 'text-ink-muted hover:bg-primary-50'}`}
                  >
                    {LANG_LABELS[l]}
                    {language === l && <CheckCircle size={12} className="inline ml-1.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-accent-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-500" />
            </span>
            Online
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 min-h-0">
        {/* Chat panel */}
        <div className="lg:col-span-3 card flex flex-col min-h-0 p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-black/5 bg-gradient-to-r from-primary-50/60 to-accent-50/40">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600 text-white">
              <Brain size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink">VIITSA AI Navigator</p>
              <p className="text-xs text-ink-muted truncate">
                {selectedPatient ? `Triage chat with ${selectedPatient.name}` : 'No patient selected'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {canSpeak && (
                <button
                  onClick={() => { if (speaking) stopSpeaking(); setTtsEnabled((v) => !v); setSpeaking(false); }}
                  className="p-1.5 rounded-lg text-ink-muted hover:text-primary hover:bg-primary-50 transition"
                  title={ttsEnabled ? 'Mute' : 'Unmute'}
                >
                  {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                </button>
              )}
              <select
                value={selectedPatient?.patient_id ?? ''}
                onChange={(e) => {
                  const p = patients.find((x) => x.patient_id === e.target.value);
                  if (p) resetChat(p);
                }}
                className="select max-w-[160px] text-xs"
              >
                {patients.map((p) => (
                  <option key={p.patient_id} value={p.patient_id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 px-4 py-2 bg-amber-50/70 border-b border-amber-100 text-[11px] text-amber-700">
            <ShieldAlert size={12} className="mt-0.5 shrink-0" />
            <span>{DISCLAIMER}</span>
          </div>

          {rawLevel === 'urgent' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-danger-bg text-danger text-sm font-semibold border-b border-danger/20 animate-slide-up">
              <Siren size={16} />
              URGENT — notify doctor immediately
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.map((m, i) => (
              <ChatBubble key={i} msg={m} patientName={selectedPatient?.name ?? 'Patient'} />
            ))}
            {typing && <TypingIndicator />}
            {triage && <AdminTriageSummary triage={triage} saved={reviewSaved} onReview={() => setShowReview(true)} />}
          </div>

          <div className="px-4 pt-3 pb-2 border-t border-black/5">
            <form
              onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }}
              className="flex items-center gap-2"
            >
              <div className="flex-1 relative">
                <input
                  value={listening ? interimText || input : input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={listening ? 'Listening…' : "Type patient's symptoms…"}
                  className={`input w-full pr-8 transition ${listening ? 'border-primary bg-primary-50/30' : ''}`}
                  readOnly={listening}
                />
                {listening && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </div>
              {canListen && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`px-3 py-2 rounded-lg transition text-sm font-medium ${
                    listening ? 'bg-danger text-white' : 'bg-primary-50 text-primary hover:bg-primary-100'
                  }`}
                >
                  {listening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              )}
              <button type="submit" disabled={!input.trim() || typing || listening} className="btn-primary px-3">
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 flex flex-col gap-3 overflow-y-auto">
          {selectedPatient ? (
            <>
              {/* Patient info */}
              <div className="card">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={selectedPatient.name} size={44} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{selectedPatient.name}</p>
                    <p className="text-xs text-ink-muted">{selectedPatient.age} yrs · {selectedPatient.gender} · {selectedPatient.blood_group ?? '—'}</p>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <p className="flex items-center gap-1.5">
                    <span className="text-ink-muted">Conditions:</span>
                    <span className="font-medium text-warning">{selectedPatient.chronic_conditions || 'None'}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-ink-muted">Allergies:</span>
                    <span className="font-medium text-danger">{selectedPatient.allergies || 'None'}</span>
                  </p>
                  {appt && (
                    <p className="flex items-center gap-1.5">
                      <span className="text-ink-muted">Last visit:</span>
                      <span className="font-medium text-ink">{formatLongDate(appt.date)} · {appt.reason}</span>
                    </p>
                  )}
                </div>
                {vitals && (
                  <div className="grid grid-cols-4 gap-1.5 mt-3">
                    <VitalBox label="BP" value={vitals.systolic_bp && vitals.diastolic_bp ? `${vitals.systolic_bp}/${vitals.diastolic_bp}` : '—'} />
                    <VitalBox label="Pulse" value={vitals.pulse ? `${vitals.pulse}` : '—'} />
                    <VitalBox label="Temp" value={vitals.temperature ? `${vitals.temperature}` : '—'} />
                    <VitalBox label="SpO2" value={vitals.spo2 ? `${vitals.spo2}%` : '—'} />
                  </div>
                )}
              </div>

              {/* Risk assessment */}
              <div className="card">
                <div className="flex items-center gap-1.5 mb-3">
                  <Activity size={14} className="text-primary" />
                  <p className="text-xs font-semibold text-ink uppercase tracking-wide">AI risk assessment</p>
                </div>
                <div className="space-y-3">
                  {riskBars.map((b, i) => (
                    <ProgressBar key={i} label={b.label} value={b.value} max={100} color={b.color} rightText={`${b.value}%`} />
                  ))}
                </div>
                <p className="text-[11px] text-ink-subtle mt-3">
                  Risk calculated from chronic conditions and last recorded vitals.
                </p>
              </div>

              {/* Doctor review panel */}
              {triage && (
                <DoctorReviewPanel
                  triage={triage}
                  reviewEdit={reviewEdit}
                  setReviewEdit={setReviewEdit}
                  show={showReview}
                  onToggle={() => setShowReview((v) => !v)}
                  onSave={saveReview}
                  saved={reviewSaved}
                  doctors={clinicContext.doctors}
                />
              )}

              {/* Recommendations */}
              <div className="card">
                <div className="flex items-center gap-1.5 mb-3">
                  <Sparkles size={14} className="text-accent-600" />
                  <p className="text-xs font-semibold text-ink uppercase tracking-wide">AI pre-consultation summary</p>
                </div>
                {triage ? (
                  <div className="space-y-2 text-sm">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                      triage.level === 'URGENT' ? 'bg-danger-bg text-danger' : triage.level === 'MODERATE' ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success'
                    }`}>
                      {triage.level}
                    </div>
                    <p><span className="text-ink-muted text-xs">Complaint:</span> <span className="font-medium">{triage.chief_complaint}</span></p>
                    {triage.body_location && <p><span className="text-ink-muted text-xs">Location:</span> <span className="font-medium">{triage.body_location}</span></p>}
                    <p><span className="text-ink-muted text-xs">Symptom timeline:</span> <span className="font-medium">{triage.symptom_timeline || triage.duration}</span></p>
                    <p><span className="text-ink-muted text-xs">Severity:</span> <span className="font-medium">{triage.severity}</span></p>
                    {triage.relevant_history && <p><span className="text-ink-muted text-xs">Relevant history:</span> <span className="font-medium">{triage.relevant_history}</span></p>}
                    <p><span className="text-ink-muted text-xs">Dept:</span> <span className="font-medium">{triage.department}</span></p>
                    {triage.doctor && <p><span className="text-ink-muted text-xs">Doctor:</span> <span className="font-medium">{triage.doctor}</span></p>}
                    {triage.possible_differentials && <p><span className="text-ink-muted text-xs">Possible clinical findings:</span> <span className="font-medium">{triage.possible_differentials}</span></p>}
                    {triage.suggested_investigations && <p><span className="text-ink-muted text-xs">Investigations:</span> <span className="font-medium">{triage.suggested_investigations}</span></p>}
                    {triage.red_flag_symptoms && <p className="text-danger"><span className="text-danger/70 text-xs">Red flags:</span> <span className="font-medium">{triage.red_flag_symptoms}</span></p>}
                    <p><span className="text-ink-muted text-xs">Next:</span> <span className="font-medium">{triage.next_steps}</span></p>
                    <div className="flex items-center gap-4 pt-1">
                      {triage.ai_confidence && <p><span className="text-ink-muted text-xs">AI confidence:</span> <span className="font-medium capitalize">{triage.ai_confidence}</span></p>}
                      <p><span className="text-ink-muted text-xs">Urgency:</span> <span className="font-medium">{triage.level}</span></p>
                    </div>
                    <p className="text-[11px] text-ink-subtle mt-1">Final diagnosis by treating doctor only.</p>
                  </div>
                ) : (
                  <p className="text-xs text-ink-subtle">
                    AI summary will appear after 4–6 exchanges with the patient.
                  </p>
                )}
              </div>
            </>
          ) : (
            <Loading label="Select patient…" />
          )}

          <div className="flex items-start gap-1.5 text-[11px] text-ink-subtle px-2 leading-relaxed">
            <ShieldAlert size={12} className="mt-0.5 shrink-0" />
            <span>{DISCLAIMER}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg, patientName }: { msg: Message; patientName: string }) {
  const isAI = msg.role === 'ai';
  return (
    <div className={`flex items-end gap-2 ${isAI ? 'justify-start' : 'justify-end'}`}>
      {isAI && (
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-white shrink-0">
          <Brain size={14} />
        </div>
      )}
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
        isAI ? 'bg-white border border-black/5 text-ink rounded-bl-sm' : 'bg-primary text-white rounded-br-sm'
      }`}>
        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
      </div>
      {!isAI && (
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-ink/10 text-ink shrink-0 text-xs font-bold">
          {patientName.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function AdminTriageSummary({ triage, saved, onReview }: { triage: TriageSummary; saved: boolean; onReview: () => void }) {
  const levelColor = triage.level === 'URGENT' ? 'bg-danger-bg border-danger/20 text-danger' : triage.level === 'MODERATE' ? 'bg-warning-bg border-warning/20 text-warning' : 'bg-success-bg border-success/20 text-success';
  return (
    <div className={`rounded-xl border p-3 mt-1 ${levelColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wide">{triage.level} — AI Triage Summary</span>
        {!saved && (
          <button
            onClick={onReview}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/60 hover:bg-white/80 transition"
          >
            <Edit3 size={11} />
            Review
          </button>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-xs font-semibold text-success">
            <CheckCircle size={11} />
            Reviewed
          </span>
        )}
      </div>
      <p className="text-xs font-medium">{triage.chief_complaint}</p>
      <p className="text-xs opacity-70 mt-0.5">{triage.department}{triage.doctor ? ` · ${triage.doctor}` : ''}</p>
    </div>
  );
}

function DoctorReviewPanel({
  triage,
  reviewEdit,
  setReviewEdit,
  show,
  onToggle,
  onSave,
  saved,
  doctors,
}: {
  triage: TriageSummary;
  reviewEdit: TriageSummary | null;
  setReviewEdit: (t: TriageSummary) => void;
  show: boolean;
  onToggle: () => void;
  onSave: () => void;
  saved: boolean;
  doctors: { user_id: string; name: string; specialisation: string | null }[];
}) {
  const draft = reviewEdit ?? triage;

  return (
    <div className="card">
      <button onClick={onToggle} className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5">
          <ClipboardCheck size={14} className="text-primary" />
          <p className="text-xs font-semibold text-ink uppercase tracking-wide">Doctor review panel</p>
          {saved && <CheckCircle size={12} className="text-success" />}
        </div>
        {show ? <ChevronUp size={14} className="text-ink-muted" /> : <ChevronDown size={14} className="text-ink-muted" />}
      </button>

      {show && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="label">Triage level</label>
            <select
              className="select"
              value={draft.level}
              onChange={(e) => setReviewEdit({ ...draft, level: e.target.value as TriageSummary['level'] })}
            >
              <option value="URGENT">URGENT</option>
              <option value="MODERATE">MODERATE</option>
              <option value="NORMAL">NORMAL</option>
            </select>
          </div>
          <div>
            <label className="label">Chief complaint</label>
            <input
              className="input"
              value={draft.chief_complaint}
              onChange={(e) => setReviewEdit({ ...draft, chief_complaint: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Body location</label>
            <input
              className="input"
              value={draft.body_location ?? ''}
              onChange={(e) => setReviewEdit({ ...draft, body_location: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Department</label>
            <input
              className="input"
              value={draft.department}
              onChange={(e) => setReviewEdit({ ...draft, department: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Assign doctor</label>
            <select
              className="select"
              value={draft.doctor ?? ''}
              onChange={(e) => setReviewEdit({ ...draft, doctor: e.target.value || null })}
            >
              <option value="">— Unassigned —</option>
              {doctors.map((d) => (
                <option key={d.user_id} value={d.name}>{d.name}{d.specialisation ? ` (${d.specialisation})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Possible causes (differentials)</label>
            <input
              className="input"
              value={draft.possible_differentials ?? ''}
              onChange={(e) => setReviewEdit({ ...draft, possible_differentials: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Suggested investigations</label>
            <input
              className="input"
              value={draft.suggested_investigations ?? ''}
              onChange={(e) => setReviewEdit({ ...draft, suggested_investigations: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Next steps</label>
            <input
              className="input"
              value={draft.next_steps}
              onChange={(e) => setReviewEdit({ ...draft, next_steps: e.target.value })}
            />
          </div>
          <button onClick={onSave} className="btn-primary w-full text-sm">
            <CheckCircle size={14} className="mr-1.5 inline" />
            Save review
          </button>
        </div>
      )}
    </div>
  );
}

function VitalBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-primary-50/60 px-2 py-1.5 text-center">
      <p className="text-[10px] text-ink-subtle uppercase">{label}</p>
      <p className="text-xs font-bold text-ink">{value}</p>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 justify-start">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-white shrink-0">
        <Brain size={14} />
      </div>
      <div className="bg-white border border-black/5 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle animate-bounce [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
