import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Save } from 'lucide-react';

export default function AdminAISettings() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'admin_settings', 'ai_config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSystemPrompt(data.systemPrompt || '');
          setKnowledgeBase(data.knowledgeBase || '');
        } else {
          // Pre-fill with strong defaults if no config exists yet
          setSystemPrompt(`[ROLE]
You are a highly qualified medical assistant AI representing Viitsa Clinic.

[CORE OBJECTIVE]
Your goal is to triage patient symptoms, provide educational health information, answer clinic-related queries, and guide patients to book an appointment with the appropriate specialist.

[STRICT BEHAVIORAL RULES]
1. MEDICAL ACCURACY: 100% of your responses must be medically sound. Do NOT invent, hallucinate, or guess medical conditions, treatments, or statistics.
2. NO DIAGNOSES OR PRESCRIPTIONS: You are an assistant, not a doctor. Never provide a definitive diagnosis or prescribe medication. Always advise consulting a human doctor.
3. HANDLING UNCERTAINTY: If you are unsure or if the user's query is complex/high-risk, IMMEDIATELY stop and respond: "I am an AI assistant and cannot provide a definitive answer for this. Please consult with the doctor during your call or visit for accurate medical advice."
4. TONE: Professional, empathetic, clear, and reassuring.
5. CONTEXT: Keep your responses strictly within the boundaries of healthcare and the clinic's services.`);
          setKnowledgeBase(`[CLINIC INFORMATION]
Name: Viitsa Multispecialty Clinic
Location: Main Healthcare Hub
Emergency Contact: Call 911 or visit the nearest ER for life-threatening emergencies.

[DEPARTMENTS & SPECIALTIES]
- General Medicine: Fever, common cold, routine checkups.
- Cardiology: Chest pain, heart issues, blood pressure.
- Pediatrics: Child healthcare and vaccinations.
- Orthopedics: Bone and joint issues, fractures.

[OPERATIONAL GUIDELINES]
- For life-threatening symptoms (e.g., severe chest pain, stroke symptoms, heavy bleeding), immediately instruct the patient to seek emergency care.
- For chronic issues, guide them to book a regular consultation.
- Emphasize that all AI advice is preliminary and subject to a doctor's physical examination.`);
        }
      } catch (err) {
        console.error('Error fetching AI settings:', err);
        alert('Failed to load AI settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'admin_settings', 'ai_config');
      await setDoc(docRef, {
        systemPrompt,
        knowledgeBase,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert('AI settings saved successfully');
    } catch (err) {
      console.error('Error saving AI settings:', err);
      alert('Failed to save AI settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-ink">AI System Settings</h2>
          <p className="text-sm text-ink-muted mt-1">Configure the core instructions and knowledge base for the medical AI agent.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary flex items-center gap-2"
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="bg-surface border border-black/5 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            System Prompt (Instructions)
          </label>
          <p className="text-xs text-ink-muted mb-2">
            These are the strict rules the AI will follow. Instruct it to act as a medical assistant, triage symptoms, and avoid providing fake information.
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="input w-full h-48 font-mono text-sm resize-y"
            placeholder="e.g. You are a medical AI assistant for Viitsa clinic. You must ONLY answer medical questions and never invent fake data..."
          />
        </div>
      </div>

      <div className="bg-surface border border-black/5 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Knowledge Base (Context & Information)
          </label>
          <p className="text-xs text-ink-muted mb-2">
            Add information about the clinic, specific guidelines, doctors available, operational hours, or standard operating procedures the AI should know.
          </p>
          <textarea
            value={knowledgeBase}
            onChange={(e) => setKnowledgeBase(e.target.value)}
            className="input w-full h-48 font-mono text-sm resize-y"
            placeholder="e.g. Viitsa Clinic is located in Hyderabad. Doctors: Dr. Smith (Cardiology), Dr. Jane (Pediatrics). Operational hours: 9 AM to 8 PM..."
          />
        </div>
      </div>
    </div>
  );
}
