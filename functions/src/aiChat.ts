import { onCall } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';
import * as admin from 'firebase-admin';

export const aiChat = onCall(async (request) => {
  const { messages, systemPrompt } = request.data;
  
  if (!messages || !Array.isArray(messages)) {
    throw new Error('Messages are required');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('API key is missing');
  }

  const ai = new GoogleGenAI({ apiKey });

  const safetyInstruction = `
[CRITICAL SAFETY & MEDICAL INSTRUCTION]:
You are operating in a medical context. Your responses MUST strictly relate to the medical field.
DO NOT provide fake, hallucinated, or definitively wrong medical information.
If you are unsure of the answer, or if there is a risk of providing wrong information, YOU MUST STOP and clearly state:
"I am an AI assistant and cannot provide a definitive answer for this. Please consult with the doctor during your call/visit for accurate medical advice."
DO NOT attempt to diagnose or prescribe. Provide general educational information only, or triage symptoms appropriately according to the system prompt.
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

  const finalSystemPrompt = systemPrompt + '\\n' + dynamicSystemPrompt + '\\n[KNOWLEDGE BASE]\\n' + dynamicKnowledgeBase + '\\n' + safetyInstruction;
  
  // Format history for Gemini
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents,
      config: {
        systemInstruction: finalSystemPrompt,
        temperature: 0.2,
      }
    });

    return { raw: response.text };
  } catch (error: any) {
    console.error('AI chat error:', error);
    throw new Error('Failed to fetch AI response');
  }
});
