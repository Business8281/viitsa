import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';
import * as admin from 'firebase-admin';

export const aiChat = onCall({ region: 'asia-south1', timeoutSeconds: 120 }, async (request) => {
  const { messages, systemPrompt, audioBase64, audioMimeType, returnAudio = true, language } = request.data || {};
  
  if ((!messages || !Array.isArray(messages)) && !audioBase64) {
    throw new HttpsError('invalid-argument', 'Messages or audio input is required');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'API key is missing');
  }

  const ai = new GoogleGenAI({ apiKey });

  const langRule = language
    ? `\nExplicit Language Preference: Please respond strictly in ${language === 'te' ? 'Telugu (తెలుగు)' : language === 'hi' ? 'Hindi (हिन्दी)' : 'English'}.`
    : '\nLanguage Rule: If the user communicates in Telugu, reply in Telugu. If in Hindi, reply in Hindi. If in English, reply in English.';

  const safetyInstruction = `
[CRITICAL SAFETY & MEDICAL INSTRUCTION]:
You are operating in a medical context. Your responses MUST strictly relate to the medical field.
DO NOT provide fake, hallucinated, or definitively wrong medical information.
If you are unsure of the answer, or if there is a risk of providing wrong information, YOU MUST STOP and clearly state:
"I am an AI assistant and cannot provide a definitive answer for this. Please consult with the doctor during your call/visit for accurate medical advice."
DO NOT attempt to diagnose or prescribe. Provide general educational information only, or triage symptoms appropriately according to the system prompt.
${langRule}
`;

  let dynamicSystemPrompt = '';
  let dynamicKnowledgeBase = '';

  try {
    const aiConfigSnap = await admin.firestore().collection('admin_settings').doc('ai_config').get();
    if (aiConfigSnap.exists) {
      const data = aiConfigSnap.data();
      dynamicSystemPrompt = data?.systemPrompt || '';
      dynamicKnowledgeBase = data?.knowledgeBase || '';
    }
  } catch (err) {
    console.warn('Could not fetch dynamic AI config:', err);
  }

  const finalSystemPrompt = (systemPrompt || '') + '\n' + dynamicSystemPrompt + '\n[KNOWLEDGE BASE]\n' + dynamicKnowledgeBase + '\n' + safetyInstruction;
  
  // Format history for Gemini
  const contents = (messages || []).map((msg: any, idx: number) => {
    const isLast = idx === (messages || []).length - 1;
    const parts: any[] = [{ text: msg.content || '' }];
    
    // If audio is provided and this is the last user message, attach the audio
    if (isLast && msg.role === 'user' && audioBase64) {
      parts.unshift({
        inlineData: {
          mimeType: audioMimeType || 'audio/webm',
          data: audioBase64
        }
      });
    }

    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts
    };
  });

  // If no messages but audio was sent directly
  if (contents.length === 0 && audioBase64) {
    contents.push({
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: audioMimeType || 'audio/webm',
            data: audioBase64
          }
        },
        { text: 'Please listen to this patient speech carefully, understand their symptoms, and respond in the exact same language.' }
      ]
    });
  }

  try {
    // 1. Generate text response with Gemini 3.8 Flash
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents,
      config: {
        systemInstruction: finalSystemPrompt,
        temperature: 0.2,
      }
    });

    const responseText = response.text || '';
    let audioWavBase64: string | null = null;

    // 2. If voice output is requested, synthesize natural speech using dedicated TTS model
    if (returnAudio && responseText.trim()) {
      try {
        // Strip out TRIAGE_JSON and markdown characters for clean, natural speech voiceover
        const spokenText = responseText
          .replace(/\n*TRIAGE_JSON:[\s\S]*$/i, '')
          .replace(/[*#_`~]/g, '')
          .replace(/\[.*?\]/g, '')
          .trim();

        if (spokenText) {
          const ttsRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [{ parts: [{ text: spokenText }] }],
            config: { responseModalities: ['AUDIO'] }
          });

          const audioPart = ttsRes.candidates?.[0]?.content?.parts?.[0];
          if (audioPart?.inlineData?.data) {
            audioWavBase64 = audioPart.inlineData.data;
          }
        }
      } catch (ttsErr) {
        console.warn('TTS generation notice:', ttsErr);
      }
    }

    return { 
      raw: responseText,
      audioBase64: audioWavBase64,
      mimeType: audioWavBase64 ? 'audio/wav' : null
    };
  } catch (error: any) {
    console.error('AI chat error:', error);
    throw new HttpsError('internal', 'Failed to fetch AI response');
  }
});
