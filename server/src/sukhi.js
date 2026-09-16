import { detectCrisis } from './security.js';

export const SUKHI_SESSION_ID = 'sukhi_ai_helper';
export const SUKHI_ALIAS = 'Sukhi (AI Companion)';

export const SUKHI_SYSTEM_PROMPT = `You are "Sukhi" (सुखी), a warm, emotionally intelligent, and culturally attuned peer companion on Kibou — a student mental wellness platform in India.

## YOUR CORE TASK
You are having an ONGOING CONVERSATION. You will receive the FULL history of the chat. You MUST:
1. READ every previous message carefully before replying.
2. DIRECTLY continue from where the conversation left off — never restart or repeat yourself.
3. REMEMBER what the person said earlier and reference it naturally (e.g., "You mentioned your exam was stressing you — how did that go?").
4. BUILD on their answers — if they replied "yes" or "no" or gave a short response, understand what they are reacting to and continue that thread.
5. NEVER give a generic, off-topic, or template-sounding reply that ignores context.

## TONE & STYLE
- Speak like a caring, witty desi friend — not a robotic AI or clinical therapist.
- Use gentle warmth and relatable Indian metaphors (chai, Mumbai local train rush, test match patience) when it fits naturally.
- Keep answers conversational, natural, concise (2–3 short paragraphs), easy to read on mobile.
- Use natural Hinglish phrases where fitting ("Namaste dost", "No worries yaar", "Arre bilkul", "Take a deep breath").
- If someone says just "yes", "ok", "ok ok", "hmm", "got it", etc. — acknowledge their brief reply with warmth and ask a relevant follow-up question tied to what you were just discussing.

## CONTEXT TRACKING
- Keep track of: their topic, mood, any issue they named (exam, breakup, loneliness, etc.), and your last question or suggestion.
- If they gave a short reply or one-word answer, check what question you just asked them and respond accordingly.
- Never repeat the same question or suggestion twice.

## BOUNDARIES & SAFETY
- You are a supportive peer friend, not a therapist or doctor.
- If the user mentions suicide, self-harm, ending their life, or severe crisis, express compassion and IMMEDIATELY provide:
  * Tele-MANAS: 14416 (Toll-free 24/7)
  * KIRAN: 1800-599-0019 (24/7)
  * Shreyash Chaturvedi: 7304167033`;

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

export const CRISIS_FALLBACK_RESPONSE = `I hear you, and I am so glad you reached out to talk to me. What you are going through is real, but you do not have to carry this heavy weight alone dost. 💙

Please reach out to people who can support you right now:
📞 **Tele-MANAS (Govt of India)**: Call **14416** (Toll-free, 24/7)
📞 **KIRAN Helpline**: Call **1800-599-0019** (Toll-free, 24/7)
📞 **Shreyash Chaturvedi (Friendly Helper)**: **7304167033**

Take one slow, deep breath with me. You matter, and help is here for you 24/7.`;

/* =====================================================================
   CONTEXT-AWARE LOCAL NLU ENGINE
   - Analyzes the full conversation history to determine:
     * The current topic/thread
     * What Sukhi's last question was
     * What the user is responding to
   - Then gives a relevant, personalized follow-up
   ===================================================================== */

/**
 * Extract the dominant topic/theme from conversation history
 */
function detectConversationTopic(history) {
  const allText = history.map((m) => (m.content || '').toLowerCase()).join(' ');
  if (allText.includes('exam') || allText.includes('marks') || allText.includes('study') || allText.includes('fail') || allText.includes('assignment')) return 'academics';
  if (allText.includes('python') || allText.includes('code') || allText.includes('coding') || allText.includes('javascript') || allText.includes('programming')) return 'coding';
  if (allText.includes('anxious') || allText.includes('panic') || allText.includes('stress') || allText.includes('anxiety') || allText.includes('overthinking')) return 'anxiety';
  if (allText.includes('lonely') || allText.includes('alone') || allText.includes('breakup') || allText.includes('relationship') || allText.includes('friend')) return 'loneliness';
  if (allText.includes('sleep') || allText.includes('tired') || allText.includes('insomnia') || allText.includes('exhausted')) return 'sleep';
  if (allText.includes('sad') || allText.includes('cry') || allText.includes('depressed') || allText.includes('hopeless') || allText.includes('numb')) return 'sadness';
  if (allText.includes('angry') || allText.includes('rage') || allText.includes('frustrated') || allText.includes('irritated')) return 'anger';
  return 'general';
}

/**
 * Get Sukhi's last message from conversation history
 */
function getLastSukhiMessage(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].sender_role === 'helper') {
      return history[i].content || '';
    }
  }
  return '';
}

/**
 * Get user's previous messages (excluding the current one)
 */
function getUserMessages(history) {
  return history.filter((m) => m.sender_role === 'seeker').map((m) => m.content || '');
}

/**
 * Check if user's reply is a short acknowledgment / continuation signal
 */
function isShortAcknowledgment(text) {
  return /^(yes|no|yeah|nah|ok|okay|ok ok|hmm+|hm+|uh huh|ya|yep|nope|sure|right|true|i see|got it|i know|same|maybe|idk|i don't know|not really|kind of|kinda|sort of|exactly|absolutely|definitely|totally|agreed|of course|for sure|makes sense|fair enough|cool|nice|great|good|thanks|thank you|thx|appreciate it|👍|🙏|😔|😊|😢|😭|✅)$/i.test(text.trim());
}

/**
 * Intelligent context-aware local NLU engine for instant, relevant replies
 * This is used ONLY when no AI API is available (offline fallback).
 */
function generateContextualLocalResponse(userMessage, history = []) {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();
  const topic = detectConversationTopic(history);
  const lastSukhiMsg = getLastSukhiMessage(history);
  const userMsgs = getUserMessages(history);
  const msgCount = history.length;

  // --- SHORT ACKNOWLEDGMENT HANDLER ---
  // If user said "yes", "ok", "hmm" etc., respond in context of what we were discussing
  if (isShortAcknowledgment(text) || text.length < 6) {
    if (lastSukhiMsg.toLowerCase().includes('breathe') || lastSukhiMsg.toLowerCase().includes('breath') || lastSukhiMsg.toLowerCase().includes('4-7-8')) {
      return `Good — even that one small breath counts dost. 💙 How are you feeling now compared to a few minutes ago? Even slightly better is progress.`;
    }
    if (lastSukhiMsg.toLowerCase().includes('exam') || lastSukhiMsg.toLowerCase().includes('study') || lastSukhiMsg.toLowerCase().includes('25 minutes')) {
      return `That's a solid start yaar! Just one small step at a time. Which subject or topic were you planning to tackle first?`;
    }
    if (lastSukhiMsg.toLowerCase().includes('python') || lastSukhiMsg.toLowerCase().includes('code') || lastSukhiMsg.toLowerCase().includes('programming')) {
      return `Awesome! Are you working on this for college coursework, a personal project, or something else? Tell me more so I can help you better dost. 💻`;
    }
    if (lastSukhiMsg.toLowerCase().includes('sleep') || lastSukhiMsg.toLowerCase().includes('screen') || lastSukhiMsg.toLowerCase().includes('racing')) {
      return `That's good to hear. Rest is so important yaar. What usually helps you wind down when your mind is busy at night?`;
    }
    if (lastSukhiMsg.toLowerCase().includes('loneli') || lastSukhiMsg.toLowerCase().includes('alone') || lastSukhiMsg.toLowerCase().includes('friend')) {
      return `I hear you dost. Loneliness can sneak up quietly. Is there something specific that triggered this feeling recently, or has it been building up for a while?`;
    }
    if (lastSukhiMsg.toLowerCase().includes('angry') || lastSukhiMsg.toLowerCase().includes('frustrat') || lastSukhiMsg.toLowerCase().includes('irritat')) {
      return `Totally valid feeling dost. When you're ready, what do you think is really driving this frustration? Sometimes naming it helps it feel less overwhelming.`;
    }
    // Generic context-based short reply follow-up
    if (topic === 'academics') {
      return `Got it! So you've been dealing with academic pressure. Which part feels the most overwhelming right now — keeping up with syllabus, exams, assignments, or something else?`;
    }
    if (topic === 'anxiety') {
      return `I'm with you dost. What does the anxiety feel like for you — is it more of a racing mind, physical tension, or a general sense of dread?`;
    }
    if (topic === 'sadness') {
      return `I hear you. It's okay to feel that way. When did this heaviness start — was there a specific moment, or has it been a slow build?`;
    }
    // Very generic warm follow-up
    return msgCount > 2
      ? `I'm right here with you dost. 🙏 Take your time — what's the one thing on your mind right now that's taking up the most space?`
      : `Namaste dost! I'm Sukhi, your 24/7 buddy on Kibou. What's on your mind today — studies, life, or just need to vent?`;
  }

  // --- CONFUSION / SLANG REACTIONS ---
  if (/^(nigga\s+)?(what|wat|wut|huh|bruh|bro|wth|wtf|um+|umm+|uh+|lol|lmao|k)$/i.test(lower) ||
      lower.includes('nigga what') || lower.includes('what are you saying') || lower.includes('makes no sense')) {
    const reactions = [
      `Haha, my bad dost! Did I get a bit too deep there? 😄 Tell me what's actually on your mind in simple words — I'm listening!`,
      `Arre haha, let me reset! I promise no heavy lectures. What's up with you today yaar?`,
      `Ha fair enough! Let's keep it real and simple. What were you asking about, or what's bothering you?`
    ];
    return reactions[Math.floor(Math.random() * reactions.length)];
  }

  // --- GREETINGS (only if first or second message) ---
  if (/^(hi|hello|hey|namaste|hola|sup|kaisa hai|yo|good morning|good evening|good afternoon)/i.test(lower) && msgCount <= 4) {
    if (topic !== 'general') {
      return `Namaste dost! 🙏 I see we were talking about ${topic === 'academics' ? 'your studies' : topic}. I'm still right here — want to pick up where we left off?`;
    }
    return `Namaste dost! 🙏 I'm Sukhi, your mindful buddy on Kibou. Whether you want to talk about college pressure, life, or just vent — I'm all ears. How are you feeling today?`;
  }

  // --- GRATITUDE ---
  if (lower.includes('thank') || lower.includes('dhanyawad') || lower.includes('thx') || lower.includes('shukriya')) {
    return `You're always welcome dost! 🌸 Really glad we're talking. Drink some water, take a gentle stretch. Is there anything else on your mind?`;
  }

  // --- TECHNICAL / CODING ---
  if (lower.includes('python') || lower.includes('coding') || lower.includes('programming') || lower.includes('javascript') || lower.includes('c++') || lower.includes('java')) {
    if (lower.includes('python')) {
      const isFollowUp = topic === 'coding' && userMsgs.length > 1;
      if (isFollowUp) {
        return `Picking up our Python chat! 🐍 So where exactly are you right now — still with the basics, or have you moved on to functions, loops, or something like data structures?`;
      }
      return `Aha, Python! Great choice dost 🐍✨\n\nPython is super friendly to start with. Just like making chai — start simple:\n1. **Print stuff**: \`print("Namaste!")\`\n2. **Variables**: \`mood = "stressed"\`\n3. **Loops & logic**: \`if mood == "stressed": take_break()\`\n\nAre you learning this for college, a project, or just for fun?`;
    }
    return `Coding can be exciting and frustrating at the same time! What specific language or concept are you working on? Tell me what you're building and we can break it down step by step. 💻`;
  }

  // --- ACADEMICS ---
  if (lower.includes('exam') || lower.includes('marks') || lower.includes('study') || lower.includes('studying') || lower.includes('fail') || lower.includes('college') || lower.includes('assignment') || lower.includes('syllabus')) {
    if (topic === 'academics' && userMsgs.length > 1) {
      return `Okay, let's take this one step at a time yaar. You mentioned exams/studies — which specific subject or deadline is pressing you most right now? Let's focus on just that one thing first.`;
    }
    return `Academic stress can feel like a storm that never breaks. But remember — an exam score is one moment in time, not your whole story.\n\nWhen overwhelmed, try this: pick just ONE topic for 25 minutes. Set a timer. Just that, nothing else.\n\nWhich subject or exam is stressing you the most right now?`;
  }

  // --- ANXIETY / PANIC ---
  if (lower.includes('anxious') || lower.includes('anxiety') || lower.includes('panic') || lower.includes('overthinking') || lower.includes('scared') || lower.includes('stress') || lower.includes('stressed') || lower.includes('nervous')) {
    if (topic === 'anxiety' && userMsgs.length > 1) {
      return `Still feeling that tension dost? Let's try one more grounding step together — name 3 things you can see right now in your room. Just describe them simply. It helps pull the mind back to this moment. 🌿`;
    }
    return `I hear you dost — let's do a quick 4-7-8 grounding exercise together:\n\n🌬️ **Breathe in slowly** for 4 seconds...\n⏸️ **Hold gently** for 7 seconds...\n💨 **Exhale softly** for 8 seconds.\n\nFeel your feet on the floor. You're safe. What's causing the biggest tension right now?`;
  }

  // --- LONELINESS / RELATIONSHIP ---
  if (lower.includes('lonely') || lower.includes('alone') || lower.includes('breakup') || lower.includes('relationship') || lower.includes('ignored') || lower.includes('nobody cares')) {
    if (topic === 'loneliness' && userMsgs.length > 1) {
      return `That feeling of being unseen can really wear you down dost. Is this something that's been going on with a specific person, or more of a general emptiness that's hard to pin down?`;
    }
    return `Feeling alone or dealing with relationship hurt cuts very deep. But right now — you're not alone. I'm right here listening with an open heart.\n\nIt's okay to feel sad or disappointed. What happened that's making you feel this way dost?`;
  }

  // --- SLEEP / FATIGUE ---
  if (lower.includes('sleep') || lower.includes('tired') || lower.includes('insomnia') || lower.includes('exhausted') || lower.includes("can't sleep") || lower.includes('cant sleep')) {
    return `When the body is tired but the mind won't stop, it's exhausting. Try this: loosen your jaw, drop your shoulders, take slow belly breaths in the dark, and put away screens if you can.\n\nWhat thoughts are keeping you awake tonight dost?`;
  }

  // --- SADNESS / DEPRESSION ---
  if (lower.includes('sad') || lower.includes('cry') || lower.includes('crying') || lower.includes('depressed') || lower.includes('hopeless') || lower.includes('numb') || lower.includes('empty')) {
    if (topic === 'sadness' && userMsgs.length > 1) {
      return `I'm with you dost. That heaviness is real. You don't have to rush to feel better or explain yourself. Is there anything specific that happened, or does this feel like a wave that came out of nowhere?`;
    }
    return `I hear you dost, and I'm really glad you're here talking rather than carrying this alone. 💙\n\nFeeling sad or numb is your mind's way of saying something needs attention. You don't have to be "fine" right now.\n\nWhen did this start feeling this heavy for you?`;
  }

  // --- ANGER / FRUSTRATION ---
  if (lower.includes('angry') || lower.includes('mad') || lower.includes('rage') || lower.includes('frustrated') || lower.includes('irritated') || lower.includes('pissed')) {
    return `That frustration is completely valid dost. Sometimes we carry so much and just explode. Let it out here — what happened that set this off? I'm listening without any judgment.`;
  }

  // --- GENERAL ENGAGING CONTEXTUAL REPLY ---
  // Build a reply that references the ongoing topic if available
  if (topic !== 'general' && msgCount > 2) {
    const topicLabels = {
      academics: 'your studies/exams',
      coding: 'the coding stuff',
      anxiety: 'the anxiety you mentioned',
      loneliness: 'the loneliness you shared',
      sleep: 'the sleep troubles',
      sadness: 'what you shared about feeling down',
      anger: 'the frustration you mentioned'
    };
    const topicLabel = topicLabels[topic] || 'what you shared';
    return `I'm still thinking about ${topicLabel}. Coming back to that — ${text.length > 50 ? `you said "${text.slice(0, 60)}..."` : `you said "${text}"`}. What's the next thing on your mind about this dost?`;
  }

  // First-time or fully general response
  return `I hear you on "${text.length > 50 ? text.slice(0, 50) + '...' : text}". Tell me more about that dost — what are your thoughts on it, or how can I help you with it?`;
}

/* =====================================================================
   MAIN SUKHI AI RESPONSE GENERATOR
   Priority: Groq LLM → xAI Grok → Pollinations → Local Context NLU
   ===================================================================== */

/**
 * Main Sukhi AI response generator
 * @param {string} userMessage - The latest message from the user
 * @param {Array} conversationHistory - Full history [{sender_role, content}, ...]
 */
export async function getSukhiResponse(userMessage, conversationHistory = []) {
  // 1. Code-Level Safety Check (always highest priority)
  const crisisCheck = detectCrisis(userMessage);
  if (crisisCheck.isCrisis || containsCrisisSignal(userMessage)) {
    return {
      content: CRISIS_FALLBACK_RESPONSE,
      isCrisis: true
    };
  }

  const groqKey = process.env.GROQ_API_KEY;
  const xaiKey = process.env.XAI_API_KEY || process.env.AI_API_KEY;

  // Format conversation history for the AI — include clear role labels and limit to last 12 turns
  const formattedHistory = (conversationHistory || [])
    .filter((m) => m.content && m.content.trim().length > 0)
    .slice(-12)
    .map((m) => ({
      role: m.sender_role === 'seeker' ? 'user' : 'assistant',
      content: m.content.trim()
    }));

  const messages = [
    { role: 'system', content: SUKHI_SYSTEM_PROMPT },
    ...formattedHistory,
    { role: 'user', content: userMessage }
  ];

  // 2. Try Groq (fastest: ~300ms, best quality)
  if (groqKey && groqKey.startsWith('gsk_')) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.72,
          max_tokens: 480,
          presence_penalty: 0.4,  // Reduces repetition of same topics
          frequency_penalty: 0.3  // Penalizes using same phrases again
        }),
        signal: AbortSignal.timeout(7000)
      });
      if (res.ok) {
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply?.trim()) {
          return { content: reply.trim(), isCrisis: false };
        }
      } else {
        const errText = await res.text().catch(() => '');
        console.log('Groq non-OK:', res.status, errText.slice(0, 200));
      }
    } catch (e) {
      console.log('Groq attempt failed:', e.message);
    }
  }

  // 3. Try xAI Grok
  if (xaiKey && (xaiKey.startsWith('xai-') || xaiKey.length > 20)) {
    for (const model of ['grok-3-mini', 'grok-2', 'grok-beta']) {
      try {
        const res = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${xaiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.72,
            max_tokens: 480
          }),
          signal: AbortSignal.timeout(7000)
        });
        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content;
          if (reply?.trim()) {
            return { content: reply.trim(), isCrisis: false };
          }
        }
      } catch (e) {
        continue;
      }
    }
  }

  // 4. Try Pollinations (free, no key needed)
  try {
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        seed: Math.floor(Math.random() * 1000000),
        model: 'openai'
      }),
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const reply = await res.text();
      if (reply && reply.trim() && !reply.startsWith('{') && reply.length > 5) {
        return { content: reply.trim(), isCrisis: false };
      }
    }
  } catch (e) {
    // Fall through to local engine
  }

  // 5. Context-Aware Local NLU Engine (guaranteed relevant instant response)
  const contextualReply = generateContextualLocalResponse(userMessage, conversationHistory);
  return {
    content: contextualReply,
    isCrisis: false
  };
}
