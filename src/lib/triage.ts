import type { Patient, Vital } from './types';
import type { TriageLevel } from './types';

export interface ChatMessage {
  role: 'ai' | 'patient';
  text: string;
  ts: number;
}

export interface TriageResult {
  level: TriageLevel;
  message: string;
  recommendations: { level: 'urgent' | 'caution' | 'informational'; text: string }[];
  notifyDoctor: boolean;
  askFollowUp?: string[];
}

// AI triage runs client-side. For advanced AI chat, use Firebase Cloud Functions.

const URGENT_PATTERNS: RegExp[] = [
  /chest\s*pain/i,
  /chest\s*tight/i,
  /shortness\s*of\s*breath/i,
  /difficulty\s*breathing/i,
  /breathing\s*problem/i,
  /can'?t\s*breathe/i,
  /stroke/i,
  /face\s*drooping/i,
  /severe\s*bleeding/i,
  /unconscious/i,
  /fainted/i,
  /loss\s*of\s*consciousness/i,
  /severe\s*weakness/i,
];

const MODERATE_FEVER = /(?:fever|temp(?:erature)?)\s*(?:of\s*)?(\d{2,3}(?:\.\d)?)\s*°?f?/i;
const FEVER_DURATION = /(?:fever|temp)\s*(?:for|since|past|from)?\s*(\d+)\s*(?:days|day)/i;
const HIGH_FEVER_WORD = /(?:high\s*)?fever/i;
const VOMITING_PERSISTENT = /persistent\s*vomiting|vomiting\s*(?:for|since)\s*\d|continuous\s*vomiting/i;
const PAIN_SCORE = /pain\s*(?:level|score|intensity)?\s*(?:of\s*)?(\d|ten|seven)/i;
const PAIN_MODERATE = /moderate\s*pain|pain\s*(?:in|at)\s*(?:abdomen|chest|back)/i;

const NORMAL_PATTERNS = [
  /routine\s*follow[-\s]?up/i,
  /general\s*check[-\s]?up/i,
  /wellness/i,
  /mild\s*(?:headache|fever|cough|cold|pain)/i,
  /consultation/i,
];

const SYSTEM_FOLLOWUPS = [
  'How long have you had these symptoms — started today, or has it been a few days?',
  'On a scale of 1 to 10, how would you rate the severity?',
  'Are you experiencing any other symptoms alongside this — like fever, weakness, or nausea?',
];

const FEVER_FOLLOWUPS = [
  'What is your current temperature, if you have checked?',
  'How many days have you had this fever?',
  'Do you also have chills, body ache, or weakness?',
];

export function evaluateTriage(
  text: string,
  conversation: ChatMessage[],
): TriageResult {
  const lower = text.toLowerCase();
  const patientMessageCount = conversation.filter((m) => m.role === 'patient').length;

  // URGENT — chest pain + breathing / stroke / severe bleeding / loss of consciousness
  const hasUrgent = URGENT_PATTERNS.some((p) => p.test(text));
  const hasChest = /chest\s*(?:pain|tight|discomfort)/i.test(text);
  const hasBreath = /breath|shortness|breathing/i.test(text);
  if (hasChest && hasBreath) {
    return urgentResult(
      'I understand this is stressful. Chest tightness with shortness of breath needs urgent attention. ' +
        'Please proceed to the doctor immediately — you have been moved to the top of the queue. triage_level: URGENT',
    );
  }
  if (hasChest) {
    return urgentResult(
      'Chest pain needs to be checked immediately. Please head to the doctor at once — I am prioritising you. ' +
        'triage_level: URGENT',
    );
  }
  if (hasUrgent) {
    return urgentResult(
      'Based on what you describe, please see the doctor immediately. You have been moved to the top of the queue. ' +
        'triage_level: URGENT',
    );
  }

  // MODERATE — high fever >103F for >2 days, persistent vomiting, moderate pain score 5-7
  const feverTempMatch = MODERATE_FEVER.exec(text);
  if (feverTempMatch) {
    const temp = parseFloat(feverTempMatch[1]);
    const durMatch = FEVER_DURATION.exec(text);
    const days = durMatch ? parseInt(durMatch[1], 10) : 0;
    if ((temp >= 103 || (days >= 2 && temp >= 100)) || (temp >= 101 && days >= 3)) {
      return moderateResult(
        `High fever (${temp}°F${days ? `, ${days} days` : ''}) can be serious. Please see the doctor today — I am prioritising you. triage_level: MODERATE`,
        days > 0 ? days : undefined,
      );
    }
  }
  if (VOMITING_PERSISTENT.test(text)) {
    return moderateResult(
      'Persistent vomiting can lead to dehydration. Please see the doctor today — bring any medications you have taken. triage_level: MODERATE',
    );
  }
  const painMatch = PAIN_SCORE.exec(text);
  if (painMatch) {
    const word = painMatch[1].toLowerCase();
    const score = word === 'ten' ? 10 : word === 'seven' ? 7 : parseInt(word, 10);
    if (score >= 5 && score <= 7) {
      return moderateResult(
        'A pain score of ' + score + ' needs evaluation today. The doctor will see you soon. triage_level: MODERATE',
      );
    }
  }
  if (PAIN_MODERATE.test(text) || (HIGH_FEVER_WORD.test(text) && patientMessageCount >= 2)) {
    return moderateResult(
      'These symptoms suggest moderate severity. Please see the doctor today. Staying hydrated will help. triage_level: MODERATE',
    );
  }

  // NORMAL — routine, mild
  if (NORMAL_PATTERNS.some((p) => p.test(text))) {
    return normalResult(
      'Thank you for sharing. This sounds routine — the doctor will see you as scheduled. ' +
        'No cause for worry. triage_level: NORMAL',
    );
  }

  // Default — ask 3 clarifying questions, then assign
  if (patientMessageCount < 2) {
    // Determine which followups are most relevant
    const followups = HIGH_FEVER_WORD.test(lower) ? FEVER_FOLLOWUPS : SYSTEM_FOLLOWUPS;
    const next = followups[patientMessageCount] ?? SYSTEM_FOLLOWUPS[0];
    return {
      level: 'normal',
      message: next + ' (triage_level: PENDING)',
      recommendations: [
        { level: 'informational', text: 'Continue hydration and rest while waiting.' },
      ],
      notifyDoctor: false,
    };
  }

  // After 2 patient messages, assign
  return normalResult(
    'Thank you for the details. The doctor will see you shortly. Please proceed to the waiting area — stay comfortable. triage_level: NORMAL',
  );
}

function urgentResult(message: string): TriageResult {
  return {
    level: 'urgent',
    message,
    recommendations: [
      { level: 'urgent', text: 'Move patient to top of doctor queue immediately' },
      { level: 'urgent', text: 'Have a nurse escort the patient; monitor SpO2 and BP on arrival' },
      { level: 'caution', text: 'Keep an ECG ready before the doctor sees the patient' },
      { level: 'informational', text: 'Inform family member / emergency contact' },
    ],
    notifyDoctor: true,
  };
}

function moderateResult(message: string, feverDays?: number): TriageResult {
  const recs: { level: 'urgent' | 'caution' | 'informational'; text: string }[] = [
    { level: 'caution', text: 'Prioritise in queue — doctor evaluation today' },
    { level: 'informational', text: 'Maintain fluid intake; avoid self-medication' },
  ];
  if (feverDays && feverDays >= 3) {
    recs.push({ level: 'caution', text: 'Consider blood work — CBC, dengue/malaria screen' });
  }
  recs.push({ level: 'informational', text: 'Reassess vitals on arrival' });
  return { level: 'moderate', message, recommendations: recs, notifyDoctor: true };
}

function normalResult(message: string): TriageResult {
  return {
    level: 'normal',
    message,
    recommendations: [
      { level: 'informational', text: 'Routine consultation — no special preparation needed' },
      { level: 'informational', text: 'Bring prior prescriptions if available' },
      { level: 'informational', text: 'Arrive 10 minutes before slot for check-in' },
    ],
    notifyDoctor: false,
  };
}

export function riskBarsFromPatient(patient?: Patient, vitals?: Vital): { label: string; value: number; color: string }[] {
  const conditions = (patient?.chronic_conditions ?? '').toLowerCase();
  const out: { label: string; value: number; color: string }[] = [];

  // Cardiac risk
  let cardiac = 10;
  if (/hypertension/.test(conditions)) cardiac += 35;
  if (/heart/.test(conditions)) cardiac += 45;
  if (vitals?.systolic_bp && vitals.systolic_bp >= 140) cardiac += 20;
  if ((patient?.age ?? 0) >= 50) cardiac += 15;
  out.push({ label: 'Cardiac risk', value: Math.min(100, cardiac), color: cardiac >= 60 ? '#D63B4B' : cardiac >= 40 ? '#E08600' : '#05C994' });

  // Diabetes control
  let diabetes = 5;
  if (/diabetes/.test(conditions)) diabetes += 60;
  if ((vitals as { weight?: number } | undefined)?.weight && (vitals as { weight?: number }).weight! >= 80) diabetes += 15;
  if ((patient?.age ?? 0) >= 50) diabetes += 10;
  out.push({ label: 'Diabetes control', value: Math.min(100, diabetes), color: diabetes >= 60 ? '#D63B4B' : diabetes >= 35 ? '#E08600' : '#05C994' });

  // Hypertension
  let hyper = 5;
  if (/hypertension/.test(conditions)) hyper += 60;
  if (vitals?.systolic_bp && vitals.systolic_bp >= 140) hyper += 25;
  if (vitals?.diastolic_bp && vitals.diastolic_bp >= 90) hyper += 15;
  out.push({ label: 'Hypertension', value: Math.min(100, hyper), color: hyper >= 60 ? '#D63B4B' : hyper >= 40 ? '#E08600' : '#05C994' });

  return out;
}

export const QUICK_REPLIES = [
  'I have chest pain and shortness of breath',
  'High fever for 3 days',
  'Routine diabetes follow-up',
  'Mild headache since morning',
  'Persistent vomiting',
];

export const AI_GREETING =
  "Hello, I'm VIITSA AI Navigator. Can you describe your symptoms? Please mention how long you've had them.";
