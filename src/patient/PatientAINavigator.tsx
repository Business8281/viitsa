import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Brain,
  Send,
  Siren,
  Calendar,
  Phone,
  ShieldAlert,
  ChevronLeft,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Globe,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  Stethoscope,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePatientAuth } from '../lib/patientAuth';
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
import type { PatientTab } from './PatientBottomNav';

interface Props {
  onTab: (t: PatientTab) => void;
  clinicId: string | null;
  patientId: string | null;
  onBookWithSummary?: (summary: TriageSummary) => void;
}

interface Message {
  role: 'ai' | 'user';
  text: string;
  ts: number;
}

const DISCLAIMER =
  'VIITSA AI Navigator provides pre-consultation support only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified doctor.';

const TRIAGE_COLOR: Record<string, string> = {
  URGENT: 'bg-red-50 border-red-300 text-red-800',
  MODERATE: 'bg-amber-50 border-amber-300 text-amber-800',
  NORMAL: 'bg-emerald-50 border-emerald-300 text-emerald-800',
};

const TRIAGE_BADGE: Record<string, string> = {
  URGENT: 'bg-red-600 text-white',
  MODERATE: 'bg-amber-500 text-white',
  NORMAL: 'bg-emerald-600 text-white',
};

const GREETING: Record<Language, string> = {
  en: "Namaste! I'm your VIITSA health assistant. How are you feeling today? Please describe your symptoms.",
  hi: "नमस्ते! मैं आपका VIITSA health assistant हूँ। आज आप कैसा महसूस कर रहे हैं? अपनी symptoms बताएं।",
  te: "నమస్కారం! నేను మీ VIITSA health assistant. ఈరోజు మీకు ఎలా అనిపిస్తుందో చెప్పండి.",
};

export function PatientAINavigator({ onTab, clinicId, patientId, onBookWithSummary }: Props) {
  const { account } = usePatientAuth();
  const [language, setLanguage] = useState<Language>('en');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [triage, setTriage] = useState<TriageSummary | null>(null);
  const [rawLevel, setRawLevel] = useState<'urgent' | 'moderate' | 'normal'>('normal');
  const [saved, setSaved] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [clinicContext, setClinicContext] = useState<{
    name: string; city?: string;
    departments?: string[];
    doctors?: { user_id: string; name: string; specialisation: string | null }[];
    working_hours?: { open: string; close: string };
  } | null>(null);

  const stopListenRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiHistory = useRef<AIMessage[]>([]);
  const userExchanges = useRef(0);
  const hasTriage = triage !== null;
  const canListen = isSpeechRecognitionSupported();
  const canSpeak = isSpeechSynthesisSupported();

  // Load clinic context
  useEffect(() => {
    if (!clinicId) return;
    Promise.all([
      supabase.from('clinics').select('name, city, working_hours').eq('clinic_id', clinicId).maybeSingle(),
      supabase.from('users').select('user_id, name, specialisation').eq('clinic_id', clinicId).eq('role', 'doctor').eq('active', true),
    ]).then(([clinicRes, doctorsRes]) => {
      if (clinicRes.data) {
        setClinicContext({
          name: clinicRes.data.name,
          city: clinicRes.data.city,
          working_hours: clinicRes.data.working_hours,
          doctors: (doctorsRes.data ?? []) as { user_id: string; name: string; specialisation: string | null }[],
        });
      }
    });
  }, [clinicId]);

  // Show greeting only once on mount — language switches must NOT reset the conversation
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const greeting = GREETING[language];
    setMessages([{ role: 'ai', text: greeting, ts: Date.now() }]);
    aiHistory.current = [{ role: 'assistant', content: greeting }];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const handleAIResponse = useCallback(async (userText: string) => {
    userExchanges.current += 1;
    const systemPrompt = buildSystemPrompt(
      language,
      clinicContext ? { clinic_id: clinicId ?? '', ...clinicContext } : null,
      account?.name?.split(' ')[0],
      userExchanges.current,
    );

    const response = await sendToAI(aiHistory.current, systemPrompt);
    aiHistory.current.push({ role: 'assistant', content: response.text });
    setMessages((prev) => [...prev, { role: 'ai', text: response.text, ts: Date.now() }]);
    setTyping(false);

    if (response.summary) {
      setTriage(response.summary);
    }
    setRawLevel(response.rawLevel);

    if (ttsEnabled && canSpeak) {
      setSpeaking(true);
      speak(response.text, language);
      // Approximate duration: ~150ms per word
      const words = response.text.split(/\s+/).length;
      setTimeout(() => setSpeaking(false), words * 150 + 500);
    }

    // Save conversation to DB
    if (clinicId && patientId) {
      const allMessages = aiHistory.current.map((m) => ({ role: m.role, content: m.content }));
      if (!conversationId) {
        const { data } = await supabase
          .from('ai_conversations')
          .insert({
            clinic_id: clinicId,
            patient_id: patientId,
            account_id: account?.account_id ?? null,
            messages: allMessages,
            detected_language: language,
            triage_level: response.rawLevel,
            triage_summary: response.summary ?? null,
          })
          .select('conversation_id')
          .maybeSingle();
        if (data?.conversation_id) setConversationId(data.conversation_id);
      } else {
        await supabase
          .from('ai_conversations')
          .update({
            messages: allMessages,
            triage_level: response.rawLevel,
            triage_summary: response.summary ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('conversation_id', conversationId);
      }
    }

    // Legacy ai_sessions save on definitive triage
    if (response.summary && !saved && clinicId && patientId) {
      setSaved(true);
      await supabase.from('ai_sessions').insert({
        patient_id: patientId,
        clinic_id: clinicId,
        symptoms_entered: userText,
        ai_response: response.text,
        triage_level: response.rawLevel,
        doctor_notified: response.rawLevel !== 'normal',
        conversation: aiHistory.current.map((m) => ({ role: m.role === 'assistant' ? 'ai' : 'patient', text: m.content })),
        recommendations: [],
      });
    }
  }, [language, clinicContext, clinicId, patientId, account, ttsEnabled, canSpeak, conversationId, saved]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;

    // Auto-detect language from first user message
    if (userExchanges.current === 0) {
      const detected = detectLanguage(trimmed);
      if (detected !== language) setLanguage(detected);
    }

    aiHistory.current.push({ role: 'user', content: trimmed });
    setMessages((prev) => [...prev, { role: 'user', text: trimmed, ts: Date.now() }]);
    setInput('');
    setTyping(true);

    await handleAIResponse(trimmed);
  }, [typing, language, handleAIResponse]);

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
        if (final) {
          finalAccumulated += final;
          setInput(finalAccumulated);
          setInterimText('');
        } else {
          setInterimText(interim);
        }
      },
      () => {
        setListening(false);
        setInterimText('');
        if (finalAccumulated.trim()) {
          void send(finalAccumulated.trim());
        }
      },
    );

    stopListenRef.current = stop;
  }, [listening, canListen, language, send]);

  const toggleTts = () => {
    if (speaking) stopSpeaking();
    setTtsEnabled((v) => !v);
    setSpeaking(false);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-60px)] bg-[#F4F9F8]">
      {/* Header */}
      <div className="bg-primary px-4 pt-safe pb-4 flex items-center gap-3 shadow-md" style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)' }}>
        <button onClick={() => onTab('home')} className="p-2 rounded-xl bg-white/10 text-white active:bg-white/20">
          <ChevronLeft size={18} />
        </button>
        <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Brain size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">VIITSA AI Navigator</p>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <p className="text-xs text-white/70">Conversational health assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {canSpeak && (
            <button
              onClick={toggleTts}
              className="p-2 rounded-xl bg-white/10 text-white active:bg-white/20"
              title={ttsEnabled ? 'Mute voice' : 'Enable voice'}
            >
              {speaking || ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowLangPicker((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 text-white text-xs font-semibold active:bg-white/20"
            >
              <Globe size={13} />
              {LANG_LABELS[language].split(' ')[0]}
            </button>
            {showLangPicker && (
              <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border border-black/5 z-50 overflow-hidden">
                {(Object.keys(LANG_LABELS) as Language[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLanguage(l); setShowLangPicker(false); }}
                    className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition ${language === l ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {LANG_LABELS[l]}
                    {language === l && <CheckCircle size={12} className="inline ml-1.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Medical disclaimer */}
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-start gap-2">
        <ShieldAlert size={13} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-[11px] text-amber-700 leading-snug">{DISCLAIMER}</p>
      </div>

      {/* Urgent banner */}
      {rawLevel === 'urgent' && (
        <div className="flex items-center gap-2 bg-red-600 px-4 py-2.5 text-white text-sm font-semibold">
          <Siren size={16} className="shrink-0" />
          URGENT — please come to the clinic immediately or call 108
        </div>
      )}

      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => {
          const isAI = m.role === 'ai';
          return (
            <div key={i} className={`flex items-end gap-2 ${isAI ? '' : 'flex-row-reverse'}`}>
              {isAI ? (
                <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <Brain size={14} className="text-white" />
                </div>
              ) : (
                <div className="h-8 w-8 rounded-xl bg-gray-200 flex items-center justify-center shrink-0 text-xs font-bold text-gray-600">
                  {account?.name?.slice(0, 2).toUpperCase() ?? 'PT'}
                </div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                isAI
                  ? 'bg-white text-gray-800 rounded-bl-sm border border-gray-100 shadow-sm'
                  : 'bg-primary text-white rounded-br-sm'
              }`}>
                {m.text}
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="flex items-end gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Brain size={14} className="text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {/* Triage summary card */}
        {hasTriage && triage && (
          <TriageSummaryCard
            triage={triage}
            onBook={() => {
              if (onBookWithSummary) onBookWithSummary(triage);
              else onTab('book');
            }}
          />
        )}
      </div>

      {/* Input bar */}
      <div className="bg-white border-t border-gray-100 px-4 py-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        <form
          onSubmit={(e) => { e.preventDefault(); void send(input); }}
          className="flex items-center gap-2"
        >
          <div className="flex-1 relative">
            <input
              value={listening ? interimText || input : input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? 'Listening…' : language === 'hi' ? 'अपने symptoms बताएं…' : language === 'te' ? 'మీ లక్షణాలు చెప్పండి…' : 'Describe your symptoms…'}
              className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:border-primary pr-10 transition ${
                listening ? 'border-primary bg-primary/5' : 'border-gray-200 bg-gray-50'
              }`}
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
              className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition ${
                listening
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={listening ? 'Stop recording' : 'Speak'}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
          <button
            type="submit"
            disabled={!input.trim() || typing || listening}
            className="h-11 w-11 rounded-xl flex items-center justify-center disabled:opacity-40 shrink-0 transition"
            style={{ backgroundColor: '#0F6E56' }}
          >
            <Send size={16} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}

function TriageSummaryCard({ triage, onBook }: { triage: TriageSummary; onBook: () => void }) {
  const level = triage.level ?? 'NORMAL';
  return (
    <div className={`rounded-2xl border-2 p-4 mt-2 ${TRIAGE_COLOR[level] ?? TRIAGE_COLOR.NORMAL}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${TRIAGE_BADGE[level] ?? TRIAGE_BADGE.NORMAL}`}>
          {level}
        </span>
        <p className="text-sm font-semibold">Health Assessment Summary</p>
      </div>

      <div className="space-y-2 text-sm mb-4">
        <SummaryRow icon={<User size={13} />} label="Chief Complaint" value={triage.chief_complaint} />
        <SummaryRow icon={<Clock size={13} />} label="Symptom Timeline" value={triage.symptom_timeline || triage.duration} />
        <SummaryRow icon={<AlertTriangle size={13} />} label="Severity" value={triage.severity} />
        {triage.relevant_history && <SummaryRow icon={<User size={13} />} label="Relevant History" value={triage.relevant_history} />}
        {triage.body_location && <SummaryRow icon={<Stethoscope size={13} />} label="Location" value={triage.body_location} />}
        {triage.possible_differentials && <SummaryRow icon={<Stethoscope size={13} />} label="Possible Clinical Findings" value={triage.possible_differentials} />}
        {triage.suggested_investigations && <SummaryRow icon={<CheckCircle size={13} />} label="Suggested Investigations" value={triage.suggested_investigations} />}
        {triage.red_flag_symptoms && <SummaryRow icon={<Siren size={13} />} label="Red Flag Symptoms" value={triage.red_flag_symptoms} />}
        {triage.self_care_advice && <SummaryRow icon={<CheckCircle size={13} />} label="Self-care" value={triage.self_care_advice} />}
        {triage.department && <SummaryRow icon={<Stethoscope size={13} />} label="Department" value={triage.department} />}
        {triage.doctor && <SummaryRow icon={<Brain size={13} />} label="Doctor" value={triage.doctor} />}
        <SummaryRow icon={<CheckCircle size={13} />} label="Next step" value={triage.next_steps} />
      </div>

      <div className="flex items-center justify-between text-[11px] opacity-70 mb-3">
        <span>AI Confidence: {triage.ai_confidence ?? 'medium'}</span>
        <span>Urgency: {level}</span>
      </div>

      <div className="space-y-2">
        <button
          onClick={onBook}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 transition hover:opacity-90"
          style={{ backgroundColor: '#0F6E56' }}
        >
          <Calendar size={14} />
          Book appointment now
        </button>
        {level === 'URGENT' && (
          <a
            href="tel:108"
            className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-red-600 flex items-center justify-center gap-2"
          >
            <Phone size={14} />
            Call 108 Emergency
          </a>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 opacity-60 shrink-0">{icon}</span>
      <span className="font-semibold opacity-70 shrink-0">{label}:</span>
      <span className="flex-1">{value}</span>
    </div>
  );
}
