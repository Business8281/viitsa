export type Language = 'en' | 'hi' | 'te';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TriageSummary {
  level: 'URGENT' | 'MODERATE' | 'NORMAL';
  department: string;
  doctor: string | null;
  chief_complaint: string;
  duration: string;
  severity: string;
  body_location: string;
  possible_differentials: string;
  suggested_investigations: string;
  self_care_advice: string;
  urgency_explanation: string;
  ai_confidence: 'low' | 'medium' | 'high';
  next_steps: string;
  symptom_timeline: string;
  relevant_history: string;
  red_flag_symptoms: string;
}

export interface AIResponse {
  text: string;
  summary: TriageSummary | null;
  rawLevel: 'urgent' | 'moderate' | 'normal';
}

export interface ClinicContext {
  clinic_id: string;
  name: string;
  city?: string;
  departments?: string[];
  doctors?: { user_id: string; name: string; specialisation: string | null }[];
  working_hours?: { open: string; close: string };
}

export const LANG_LABELS: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी',
  te: 'తెలుగు',
};

const LANG_INSTRUCTION: Record<Language, string> = {
  en: 'Respond in clear, simple English. Use easy-to-understand medical terms.',
  hi: 'हिंदी में जवाब दें। Hinglish (Hindi + English mix) भी ठीक है। Simple और समझने में आसान भाषा use करें।',
  te: 'తెలుగులో సమాధానం ఇవ్వండి. Tenglish (Telugu + English mix) కూడా పర్వాలేదు. సాధారణ భాషలో మాట్లాడండి.',
};

const HINGLISH_WORDS = /\b(mujhe|mera|teri|bhai|yaar|haan|nahi|kya|kaise|abhi|bohot|bahut|kal|aaj|thoda|seedha|seedhe|achha|theek|doctor|sir|madam|please)\b/i;

export function detectLanguage(text: string): Language {
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (HINGLISH_WORDS.test(text)) return 'hi';
  return 'en';
}

export function buildSystemPrompt(
  language: Language,
  ctx?: ClinicContext | null,
  patientName?: string,
  exchangeCount?: number,
): string {
  const doctorsList =
    ctx?.doctors?.length
      ? ctx.doctors.map((d) => `${d.name}${d.specialisation ? ` (${d.specialisation})` : ''}`).join(', ')
      : 'General Physician';
  const deptList =
    ctx?.departments?.length
      ? ctx.departments.join(', ')
      : 'General Medicine, Pediatrics, Cardiology, Orthopedics, Dermatology, Gynecology, Ophthalmology, Dentistry, ENT, Emergency';
  const hours = ctx?.working_hours ? `${ctx.working_hours.open}–${ctx.working_hours.close}` : '9:00 AM–7:00 PM';

  const triageJsonInstruction = `\n\nOnce you have gathered sufficient information, append a pre-consultation summary at the very end of your response (after a blank line) using this exact format — do not include it in the conversational text. The TRIAGE_JSON MUST ALWAYS be written in ENGLISH regardless of the conversation language:\nTRIAGE_JSON:{"level":"URGENT|MODERATE|NORMAL","department":"<best matching dept in English>","doctor":"<name or null>","chief_complaint":"<one sentence in English>","duration":"<e.g. 3 days>","severity":"<mild|moderate|severe>","body_location":"<affected body part in English>","symptom_timeline":"<when symptoms started and how they progressed, in English>","relevant_history":"<relevant patient history: chronic conditions, medications, allergies, prior episodes, in English>","possible_differentials":"<2-3 possible clinical findings stated as possibilities, in English>","suggested_investigations":"<relevant tests if appropriate, empty string if none, in English>","red_flag_symptoms":"<warning signs that require immediate attention, empty string if none, in English>","self_care_advice":"<brief safe home-care tips in English>","urgency_explanation":"<why this urgency level was assigned, in English>","ai_confidence":"<low|medium|high>","next_steps":"<what the patient should do next, in English>"}`;

  const readyForSummary = (exchangeCount ?? 0) >= 4;

  return `You are VIITSA, a compassionate AI Health Navigator for ${ctx?.name ?? 'a clinic'} in ${ctx?.city ?? 'India'}.

Your role is to conduct a friendly, intelligent pre-consultation symptom intake — NOT to diagnose or prescribe medicines.

Clinic information:
- Departments: ${deptList}
- Doctors: ${doctorsList}
- Hours: ${hours}
${patientName ? `- Patient: ${patientName}` : ''}

━━━ CONVERSATION MEMORY — CRITICAL RULES ━━━
You have full access to the entire conversation history above. You MUST use it.

1. NEVER ask for information the patient has already provided. If they said "one month", do not ask how long they have had it. If they described the location, do not ask for location again.
2. Before formulating your next question, mentally scan the conversation history for: symptoms, duration, severity, body location, age, gender, medications, allergies, prior conditions, and anything else already mentioned.
3. Each response must move the intake FORWARD — gather new information not yet provided.
4. Ask ONE question at a time. Never stack multiple questions in one message.
5. If a patient's answer is ambiguous, ask a targeted clarification — do not repeat the original question verbatim.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Specialty routing guide:
- Chest pain, palpitations, shortness of breath → Cardiology / Emergency
- Shoulder, joint, bone, muscle pain → Orthopedics
- Skin rash, itching, lesions → Dermatology
- Pregnancy, menstrual, gynae concerns → Gynecology
- Child illness (age under 12) → Pediatrics
- Eye pain, vision problems → Ophthalmology
- Dental, jaw pain → Dentistry
- Ear, nose, throat → ENT
- Neurological (headache, dizziness, numbness) → Neurology / General Medicine
- Fever, general illness → General Medicine

Clinical behaviour:
- Keep each response under 120 words.
- Never diagnose. Never suggest specific medicines or dosages.
- You may explain possible causes using phrases like "this could sometimes be related to…"
- Always state that the final diagnosis belongs to the treating doctor.
- Show empathy. Use the patient's name when appropriate.
- URGENT symptoms (chest pain, difficulty breathing, stroke signs, severe bleeding, loss of consciousness): clearly state urgency and advise immediate clinic visit or call 108.
- After 4–6 exchanges with enough information gathered, produce the TRIAGE_JSON summary.

Language instruction: ${LANG_INSTRUCTION[language]}${readyForSummary ? triageJsonInstruction : ''}`;
}

export async function sendToAI(
  messages: AIMessage[],
  systemPrompt: string,
): Promise<AIResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !anonKey) {
    return unavailableResponse();
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
    };

    const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, systemPrompt }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      console.warn('AI chat error:', err);
      return unavailableResponse();
    }

    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? '';

    return parseAIResponse(raw);
  } catch (e) {
    console.warn('AI chat fetch failed:', e);
    return unavailableResponse();
  }
}

export async function translateSummary(
  summary: TriageSummary,
  target: Language,
): Promise<TriageSummary> {
  if (target === 'en') return summary;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) return summary;

  const fields: (keyof TriageSummary)[] = [
    'chief_complaint', 'symptom_timeline', 'severity', 'body_location',
    'relevant_history', 'possible_differentials', 'suggested_investigations',
    'red_flag_symptoms', 'self_care_advice', 'urgency_explanation', 'next_steps',
  ];

  const langName = LANG_LABELS[target];
  const systemPrompt = `You are a medical translator. Translate the provided English medical summary field values into ${langName}. Return ONLY valid JSON with the same keys and translated string values. Preserve medical terminology appropriately. Never translate the values for "level", "department", "doctor", "duration", or "ai_confidence" — copy them unchanged.`;

  const payload = JSON.stringify(
    Object.fromEntries(fields.map((f) => [f, summary[f] ?? ''])),
  );

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
    };

    const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Translate this JSON to ${langName}: ${payload}` }],
        systemPrompt,
      }),
    });
    if (!res.ok) return summary;

    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? '';
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) return summary;
    const translated = JSON.parse(raw.slice(start, end + 1)) as Partial<TriageSummary>;

    return { ...summary, ...translated } as TriageSummary;
  } catch {
    return summary;
  }
}

function parseAIResponse(raw: string): AIResponse {
  const jsonMatch = /TRIAGE_JSON:\s*(\{[\s\S]*?\})\s*$/i.exec(raw);
  let summary: TriageSummary | null = null;

  if (jsonMatch) {
    try {
      summary = JSON.parse(jsonMatch[1]) as TriageSummary;
    } catch {
      // Malformed JSON — continue without summary
    }
  }

  const text = raw.replace(/\n*TRIAGE_JSON:[\s\S]*$/i, '').trim();

  const level = summary?.level
    ? (summary.level.toLowerCase() as 'urgent' | 'moderate' | 'normal')
    : inferLevel(text);

  return { text, summary, rawLevel: level };
}

function inferLevel(text: string): 'urgent' | 'moderate' | 'normal' {
  const lower = text.toLowerCase();
  if (/urgent|immediately|emergency|call 108|108/.test(lower)) return 'urgent';
  if (/moderate|prioritis|today|concerning/.test(lower)) return 'moderate';
  return 'normal';
}

function unavailableResponse(): AIResponse {
  return {
    text: 'I\'m sorry — AI assistance is temporarily unavailable. Please describe your symptoms to the clinic staff directly, or try again in a moment.',
    summary: null,
    rawLevel: 'normal',
  };
}

// Web Speech API helpers

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

const LANG_VOICE_CODE: Record<Language, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
};

export function isSpeechRecognitionSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  return 'speechSynthesis' in window;
}

export function startListening(
  language: Language,
  onTranscript: (interim: string, final: string) => void,
  onEnd: () => void,
): () => void {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    onEnd();
    return () => undefined;
  }

  const recognition = new SR();
  recognition.lang = LANG_VOICE_CODE[language];
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }
    onTranscript(interim, final);
  };

  recognition.onerror = () => onEnd();
  recognition.onend = () => onEnd();

  recognition.start();
  return () => recognition.stop();
}

export function speak(text: string, language: Language): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = LANG_VOICE_CODE[language];
  utter.rate = 1.0;
  utter.pitch = 1.0;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
