import { detectCrisis } from './security.js';

// Default API keys & endpoints (supports Groq & xAI/Grok)
const DEFAULT_API_KEY = process.env.GROQ_API_KEY || process.env.XAI_API_KEY || process.env.AI_API_KEY || 'c2c496c9-c350-4425-9e59-5e14759a0ba8';

export const SUKHI_SESSION_ID = 'sukhi_ai_helper';
export const SUKHI_ALIAS = 'Sukhi (AI Companion)';

export const SUKHI_SYSTEM_PROMPT = `You are "Sukhi" (सुखी), a warm, wise, mindful, and culturally attuned mental health companion on Kibou.

TONE & STYLE:
- Speak like a caring, empathetic, desi friend—not a cold, robotic AI or clinical therapist.
- Use gentle warmth, soothing reassurance, and light metaphors rooted in Indian life (a hot cup of cutting chai, finding stillness amid the Mumbai local train rush, a cool monsoon breeze, patience during a tough cricket match, sitting under a banyan tree) to ease tension.
- Blend in simple mindfulness wisdom (breath awareness, observing thoughts like passing clouds, grounding in the present moment, 4-7-8 breathing) gently and naturally without ever sounding preachy or condescending.
- Keep responses conversational, concise (2 to 4 thoughtful sentences or short paragraphs), supportive, and easy to read on mobile.
- Use occasional warm Indian English / Hinglish phrases where natural (e.g., "Take a deep breath dost", "Shaant ho jao, I'm right here with you", "Ek deep breath lete hain, no rush at all").
- NEVER invalidate or minimize the user's pain.

YOUR ROLE & BOUNDARIES:
- You are a supportive peer friend and empathetic listener, not a licensed medical doctor or psychiatrist.
- You listen deeply, validate emotions, and offer gentle perspective.

CRITICAL SAFETY RULE (MANDATORY):
- If the user mentions suicide, self-harm, wanting to die, ending their life, cutting, or severe crisis:
  1. Immediately express deep compassion and validate their pain without judgment.
  2. You MUST immediately provide the emergency 24/7 helplines:
     - Tele-MANAS (Govt of India): 14416 (Toll-free 24/7)
     - KIRAN Helpline: 1800-599-0019 (24/7)
     - Shreyash Chaturvedi (Friendly Helper): 7304167033
  3. Encourage them warmly to reach out to these resources or a trusted person right now. Do not attempt to "therapy" through active crisis alone.`;

// Safety keyword list
const CRISIS_KEYWORDS = [
  'suicide',
  'kill myself',
  'end my life',
  'self harm',
  'cutting',
  'want to die',
  'no reason to live',
  'better off dead',
  'take my life',
  'hang myself',
  'overdose'
];

export function containsCrisisSignal(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

// Emergency safety response
export const CRISIS_FALLBACK_RESPONSE = `I hear you, and I am so glad you reached out to talk to me. What you are feeling is real, but you do not have to carry this heavy burden all alone dost. 💙

Please connect with someone who can support you right now:
📞 **Tele-MANAS (Govt of India)**: Call **14416** (Toll-free, 24/7)
📞 **KIRAN Helpline**: Call **1800-599-0019** (Toll-free, 24/7)
📞 **Shreyash Chaturvedi (Friendly Helper)**: **7304167033**

Take one slow, deep breath with me. You matter, and help is available right now.`;

// Contextual mindful fallback responses if AI API is temporarily offline
const MINDFUL_FALLBACK_RESPONSES = [
  "I hear you, dost. Sometimes life feels like a chaotic Mumbai local during rush hour, but remember that this moment is just one stop, not the entire journey. Take a slow, deep breath with me. What's weighing on your mind the most right now?",
  "Thank you for sharing that with me. It takes real courage to open up. Like a warm cup of ginger chai on a rainy day, let's take a pause together. How has your body been feeling while carrying all this stress?",
  "I'm right here with you. When thoughts start racing like a runaway train, let's ground ourselves: feel your feet on the floor and take one deep belly breath. You're doing the best you can, and that is enough. Tell me more about what happened.",
  "That sounds really heavy to carry alone. Remember, feelings are like clouds in the monsoon sky—they can be dark and overwhelming, but they always pass. I'm listening. Take all the time you need."
];

/**
 * Generate AI response from Groq or xAI (Grok)
 */
export async function getSukhiResponse(userMessage, conversationHistory = []) {
  // 1. Code-Level Safety Check
  const crisisCheck = detectCrisis(userMessage);
  if (crisisCheck.isCrisis || containsCrisisSignal(userMessage)) {
    return {
      content: CRISIS_FALLBACK_RESPONSE,
      isCrisis: true
    };
  }

  const apiKey = DEFAULT_API_KEY;

  // Format messages array
  const formattedHistory = (conversationHistory || []).map((m) => ({
    role: m.sender_role === 'seeker' ? 'user' : 'assistant',
    content: m.content || ''
  })).filter((m) => m.content.trim().length > 0);

  // Keep last 10 messages for context
  const recentHistory = formattedHistory.slice(-10);

  const messages = [
    { role: 'system', content: SUKHI_SYSTEM_PROMPT },
    ...recentHistory,
    { role: 'user', content: userMessage }
  ];

  // Try endpoints in order: Groq -> xAI Grok
  const endpoints = [
    {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      models: ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'mixtral-8x7b-32768']
    },
    {
      url: 'https://api.x.ai/v1/chat/completions',
      models: ['grok-beta', 'grok-2-latest', 'grok-2']
    }
  ];

  for (const endpoint of endpoints) {
    for (const model of endpoint.models) {
      try {
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: 450
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content;
          if (reply && reply.trim()) {
            return {
              content: reply.trim(),
              isCrisis: false
            };
          }
        }
      } catch (err) {
        // Try next model or endpoint
        continue;
      }
    }
  }

  // Fallback if APIs are offline / rate-limited
  const randomFallback = MINDFUL_FALLBACK_RESPONSES[Math.floor(Math.random() * MINDFUL_FALLBACK_RESPONSES.length)];
  return {
    content: randomFallback,
    isCrisis: false
  };
}
