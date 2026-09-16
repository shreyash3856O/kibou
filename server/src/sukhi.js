import { detectCrisis } from './security.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SUKHI_SESSION_ID = 'sukhi_ai_helper';
export const SUKHI_ALIAS = 'Sukhi (AI Companion)';

// Memory store for runtime API key configuration
let runtimeGroqKey = process.env.GROQ_API_KEY || '';

export function setGroqApiKey(key) {
  runtimeGroqKey = (key || '').trim();
  process.env.GROQ_API_KEY = runtimeGroqKey;

  // Persist to server/.env if possible
  try {
    const envPath = path.join(__dirname, '../.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('GROQ_API_KEY=')) {
        content = content.replace(/GROQ_API_KEY=.*/g, `GROQ_API_KEY=${runtimeGroqKey}`);
      } else {
        content += `\nGROQ_API_KEY=${runtimeGroqKey}\n`;
      }
    } else {
      content = `GROQ_API_KEY=${runtimeGroqKey}\n`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
  } catch (e) {
    console.log('Notice: Could not write .env file:', e.message);
  }
}

export function getAiStatus() {
  const activeKey = runtimeGroqKey || process.env.GROQ_API_KEY || '';
  const hasGroq = Boolean(activeKey && activeKey.startsWith('gsk_'));
  return {
    provider: hasGroq ? 'Groq (Llama 3.3 70B)' : 'Kibou Context-Trained Engine & Fast LLM',
    groqConfigured: hasGroq,
    groqKeyMasked: hasGroq ? `${activeKey.slice(0, 7)}...${activeKey.slice(-4)}` : null,
    model: hasGroq ? 'llama-3.3-70b-versatile' : 'openai-fast / kibou-nlu-v2'
  };
}

export const SUKHI_SYSTEM_PROMPT = `You are "Sukhi", a warm, emotionally intelligent, and culturally attuned peer companion on Kibou — a student mental wellness platform in India.

## YOUR CORE TASK
You are having an ONGOING CONVERSATION with a student. You will receive the FULL history of the chat and the room topic. You MUST:
1. READ every previous message carefully before replying.
2. DIRECTLY respond to the user's latest words in context — never restart, never re-greet, and never repeat yourself.
3. If the user mentions a specific problem (e.g. academic stress, exams, syllabus, family pressure, loneliness), talk about THAT specific issue with genuine understanding of student life in India.
4. If the user gives a short response like "ugh", "idk", or "but im okay", understand their emotional subtext:
   - "but im okay": recognize the habit of brushing off feelings; invite them gently without pressure.
   - "ugh": validate the exhaustion and frustration directly.
   - "yes" / "no": continue the previous thread you were talking about.
5. NEVER repeat the same question, advice, or exercise twice in a conversation.
6. Speak like a caring, witty desi peer friend — not a robotic AI or clinical therapist. Use natural Hinglish phrases where fitting ("Namaste dost", "No worries yaar", "Arre bilkul", "Take a deep breath").
7. Do NOT use any emojis or markdown symbols like asterisks for actions. Keep the text clean, conversational, and natural.

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

export const CRISIS_FALLBACK_RESPONSE = `I hear you, and I am so glad you reached out to talk to me. What you are going through is real, but you do not have to carry this heavy weight alone dost.

Please reach out to people who can support you right now:
Tele-MANAS (Govt of India): Call 14416 (Toll-free, 24/7)
KIRAN Helpline: Call 1800-599-0019 (Toll-free, 24/7)
Shreyash Chaturvedi (Friendly Helper): 7304167033

Take one slow, deep breath with me. You matter, and help is here for you 24/7.`;

/* =====================================================================
   STATEFUL CONVERSATION CONTEXT ANALYZER
   Extracts multi-turn conversational signals, topic shifts, and intent
   ===================================================================== */

/**
 * Categorize the user's latest message intent
 */
function classifyUserIntent(text) {
  const lower = (text || '').toLowerCase().trim();

  // Deflection / Minimizing feelings ("but im okay", "im fine", "it's nothing")
  if (/^(but\s+)?(i'?m|am)\s*(ok|okay|fine|good|alright)(\s+(now|though|today|so far))?$/i.test(lower) ||
      /^(it'?s|its)\s*(whatever|nothing|fine|okay|ok|all good)$/i.test(lower) ||
      lower === 'im okay' || lower === "i'm okay" || lower === 'but im okay' || lower === "but i'm okay" ||
      lower === 'im fine' || lower === "i'm fine" || lower === 'nothing much just okay') {
    return 'DEFLECTION';
  }

  // Short emotional venting ("ugh", "sigh", "damn", "argh", "smh", "idk")
  if (/^(ugh+|sigh+|argh+|damn+|dammit|smh|fuck|shit|crap|pfft|mehh+|gah+|fml)$/i.test(lower)) {
    return 'VENTING_EXHAUSTION';
  }

  // Confusion or slang reaction ("what", "huh", "nigga what", "bruh", "bro", "wth")
  if (/^(nigga\s+)?(what|wat|wut|huh|bruh|bro|wth|wtf|um+|umm+|uh+|lol|lmao|k)$/i.test(lower) ||
      lower.includes('what do you mean') || lower.includes('makes no sense') || lower.includes('nigga what')) {
    return 'CONFUSION';
  }

  // Short affirmations / acknowledgments
  if (/^(yes|yeah|yep|ya|yup|nah|no|nope|ok|okay|ok ok|hmm+|hm+|sure|true|right|got it|makes sense|agreed)$/i.test(lower)) {
    return 'AFFIRMATION';
  }

  // Gratitude
  if (lower.includes('thank') || lower.includes('dhanyawad') || lower.includes('shukriya') || lower.includes('thx')) {
    return 'GRATITUDE';
  }

  // Academic pressure (high priority detection)
  if (lower.includes('academic') || lower.includes('exam') || lower.includes('study') || lower.includes('studies') ||
      lower.includes('studying') || lower.includes('syllabus') || lower.includes('assignment') || lower.includes('marks') ||
      lower.includes('score') || lower.includes('grades') || lower.includes('cgpa') || lower.includes('gpa') ||
      lower.includes('college') || lower.includes('homework') || lower.includes('pass') || lower.includes('fail') ||
      lower.includes('backlog') || lower.includes('placement') || lower.includes('attendance') || lower.includes('prof') ||
      lower.includes('professor') || lower.includes('semester') || lower.includes('test') || lower.includes('deadlines')) {
    return 'ACADEMIC_STRESS';
  }

  // Coding / Tech
  if (lower.includes('python') || lower.includes('coding') || lower.includes('code') || lower.includes('programming') ||
      lower.includes('javascript') || lower.includes('c++') || lower.includes('java') || lower.includes('developer')) {
    return 'CODING';
  }

  // Panic / Acute Anxiety / Overthinking
  if (lower.includes('panic') || lower.includes('palpitations') || lower.includes('racing thoughts') ||
      lower.includes('chest tight') || lower.includes('cant breathe') || lower.includes("can't breathe") ||
      lower.includes('anxious') || lower.includes('anxiety') || lower.includes('overthinking') ||
      lower.includes('nervous') || lower.includes('scared') || lower.includes('dread')) {
    return 'ANXIETY_PANIC';
  }

  // Loneliness / Relationships
  if (lower.includes('lonely') || lower.includes('alone') || lower.includes('breakup') || lower.includes('relationship') ||
      lower.includes('friend') || lower.includes('nobody cares') || lower.includes('ignored') || lower.includes('isolated') ||
      lower.includes('ghosted') || lower.includes('left out')) {
    return 'LONELINESS';
  }

  // Exhaustion / Sleep
  if (lower.includes('sleep') || lower.includes('insomnia') || lower.includes('tired') || lower.includes('exhausted') ||
      lower.includes('burnout') || lower.includes('drained') || lower.includes('no energy') || lower.includes('sleepy')) {
    return 'SLEEP_EXHAUSTION';
  }

  // Sadness / Low Mood
  if (lower.includes('sad') || lower.includes('crying') || lower.includes('cry') || lower.includes('depressed') ||
      lower.includes('hopeless') || lower.includes('numb') || lower.includes('empty') || lower.includes('worthless')) {
    return 'SADNESS';
  }

  // Anger / Frustration
  if (lower.includes('angry') || lower.includes('furious') || lower.includes('pissed') || lower.includes('unfair') ||
      lower.includes('frustrated') || lower.includes('irritated') || lower.includes('rage')) {
    return 'ANGER';
  }

  // General stress mention
  if (lower.includes('stress') || lower.includes('stressed') || lower.includes('tension') || lower.includes('overwhelmed')) {
    return 'GENERAL_STRESS';
  }

  return 'GENERAL';
}

/**
 * Determine the active theme of the conversation considering metadata, history, and current message
 */
function resolveActiveTopic(currentIntent, history, roomTopic = '') {
  // Current intent takes highest priority if it points to a specific domain
  if (['ACADEMIC_STRESS', 'CODING', 'ANXIETY_PANIC', 'LONELINESS', 'SLEEP_EXHAUSTION', 'SADNESS', 'ANGER'].includes(currentIntent)) {
    return currentIntent;
  }

  // Room topic from metadata
  const rtLower = (roomTopic || '').toLowerCase();
  if (rtLower.includes('academic') || rtLower.includes('exam') || rtLower.includes('study')) return 'ACADEMIC_STRESS';
  if (rtLower.includes('anxiety') || rtLower.includes('panic')) return 'ANXIETY_PANIC';
  if (rtLower.includes('lonel') || rtLower.includes('relationship')) return 'LONELINESS';
  if (rtLower.includes('sleep') || rtLower.includes('tired')) return 'SLEEP_EXHAUSTION';
  if (rtLower.includes('depress') || rtLower.includes('sad')) return 'SADNESS';

  // Inspect recent user messages (last 4)
  const recentUserTexts = history
    .filter((m) => m.sender_role === 'seeker')
    .slice(-4)
    .map((m) => (m.content || '').toLowerCase())
    .join(' ');

  if (recentUserTexts.includes('academic') || recentUserTexts.includes('exam') || recentUserTexts.includes('syllabus') || recentUserTexts.includes('assignment')) return 'ACADEMIC_STRESS';
  if (recentUserTexts.includes('anxiety') || recentUserTexts.includes('panic') || recentUserTexts.includes('overthinking')) return 'ANXIETY_PANIC';
  if (recentUserTexts.includes('lonely') || recentUserTexts.includes('alone') || recentUserTexts.includes('breakup')) return 'LONELINESS';
  if (recentUserTexts.includes('sleep') || recentUserTexts.includes('insomnia') || recentUserTexts.includes('tired')) return 'SLEEP_EXHAUSTION';
  if (recentUserTexts.includes('sad') || recentUserTexts.includes('cry') || recentUserTexts.includes('depressed')) return 'SADNESS';

  return 'GENERAL';
}

/**
 * Get the last message sent by Sukhi
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
 * Check what Sukhi has already offered to prevent repetitive loops
 */
function getAlreadyOfferedTechniques(history) {
  const allHelperText = history
    .filter((m) => m.sender_role === 'helper')
    .map((m) => (m.content || '').toLowerCase())
    .join(' ');

  return {
    grounding3Things: allHelperText.includes('3 things') || allHelperText.includes('name 3'),
    breathing478: allHelperText.includes('4-7-8') || allHelperText.includes('breathe in slowly'),
    pomodoro25Min: allHelperText.includes('25 minutes') || allHelperText.includes('timer'),
    glassOfWater: allHelperText.includes('glass of water') || allHelperText.includes('drink some water'),
    namingFrustration: allHelperText.includes('naming it helps')
  };
}

/* =====================================================================
   DEEP CONTEXT NLU & DIALOGUE GENERATOR
   Trained on student peer counseling patterns, Hinglish context,
   and dynamic multi-turn dialogue management.
   ===================================================================== */

function generateContextualLocalResponse(userMessage, history = [], roomTopic = '') {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();
  const currentIntent = classifyUserIntent(text);
  const activeTopic = resolveActiveTopic(currentIntent, history, roomTopic);
  const lastSukhi = getLastSukhiMessage(history);
  const offered = getAlreadyOfferedTechniques(history);
  const userTurnCount = history.filter((m) => m.sender_role === 'seeker').length + 1;

  // 1. DEFLECTION ("but im okay", "im fine", "nevermind")
  // Students frequently minimize their pain to stay strong. Address this warmly with high emotional resonance.
  if (currentIntent === 'DEFLECTION') {
    if (activeTopic === 'ACADEMIC_STRESS') {
      return `I hear that "but I'm okay" dost. When academic pressure gets intense, we often tell ourselves we are okay just to keep grinding through the next assignment. If you really are catching your breath right now, that is wonderful. But if you just need a quiet space to vent about exams or college without having to pretend everything is sorted, I'm right here with you. What was the thing that sparked this whole academic thought today?`;
    }
    return `I hear that "but I'm okay" dost. In student life, we get so used to brushing things off and saying "sab theek hai" just to make it through the day. If you truly are feeling alright in this moment, that is great! But if there is even a small corner of your mind feeling weighed down, you don't have to put on a brave face here. What is taking up the most space in your head today?`;
  }

  // 2. SHORT EMOTIONAL VENTING ("ugh", "sigh", "damn", "argh")
  // User is releasing raw frustration or exhaustion. Validate immediately without canned advice.
  if (currentIntent === 'VENTING_EXHAUSTION') {
    if (activeTopic === 'ACADEMIC_STRESS') {
      return `That "ugh" says everything yaar. Academic burnout is so real — between classes, pending submissions, and exams, it feels like an endless treadmill. You don't have to explain in proper sentences right now. What is the single most annoying or exhausting thing on your plate today?`;
    }
    if (activeTopic === 'ANXIETY_PANIC') {
      return `I feel that heavy "ugh" dost. When your mind is racing and feeling overwhelmed, even talking about it takes effort. No pressure at all. Just take a slow breath. What is feeling the heaviest right now?`;
    }
    return `That "ugh" speaks volumes dost. Sounds like you are just completely fed up or drained right now. You don't need to put on a filter here. Let it out — what is driving you up the wall today?`;
  }

  // 3. CONFUSION OR SKEPTICISM ("what", "huh", "bruh", "makes no sense")
  if (currentIntent === 'CONFUSION') {
    return `Ha fair enough, let me reset! I promise no robotic lectures or complicated talk yaar. Tell me what is actually on your mind in your own words — whether it is college, life, or just needing to vent, I am listening!`;
  }

  // 4. GRATITUDE ("thank you", "thanks", "dhanyawad")
  if (currentIntent === 'GRATITUDE') {
    return `Anytime dost! Talking things out takes courage, and you did that today. Go easy on yourself, take a gentle stretch, and remember you have always got a safe space right here. Anything else you want to get off your chest before you go?`;
  }

  // 5. AFFIRMATIONS ("yes", "yeah", "ok", "no", "hmm")
  // Follow up on Sukhi's PREVIOUS question dynamically.
  if (currentIntent === 'AFFIRMATION') {
    const lastLower = lastSukhi.toLowerCase();

    if (lastLower.includes('subject') || lastLower.includes('exam') || lastLower.includes('syllabus')) {
      return `Got it yaar. When looking at that whole syllabus, our brain panics and tries to finish everything at once. What if we break it down into just one bite-sized piece for today? Which specific chapter or problem could you look at first without overwhelming yourself?`;
    }
    if (lastLower.includes('breathe') || lastLower.includes('breath')) {
      return `Glad you took that moment dost. Even a few seconds of breathing gives your nervous system a chance to reset. How does your body feel now compared to a few minutes ago?`;
    }
    if (lastLower.includes('heaviest') || lastLower.includes('mind')) {
      return `I am listening dost. Take your time and share whatever part comes naturally. What is on your mind?`;
    }
    if (activeTopic === 'ACADEMIC_STRESS') {
      return `Understood dost. Academic pressure is tough, but you don't have to carry the whole burden in one go. What is one small thing that would make today feel even 5% lighter for you?`;
    }
    return `I am right here with you dost. What is the next thing on your mind? Take your time, no rush at all.`;
  }

  // 6. ACADEMIC STRESS (Key student reality)
  if (currentIntent === 'ACADEMIC_STRESS' || (activeTopic === 'ACADEMIC_STRESS' && !['ANXIETY_PANIC', 'LONELINESS'].includes(currentIntent))) {
    // If user specifically named their challenge
    if (lower.includes('fail') || lower.includes('backlog') || lower.includes('marks') || lower.includes('cgpa')) {
      return `The fear of marks, backlogs, and grades can feel terrifyingly heavy dost. In our system, so much pressure gets tied to scores that it starts feeling like your whole future is on the line with every paper. But please remember — an exam score measures syllabus recall on one particular morning, not your worth or your potential as a person. Take a slow breath yaar. What is the exact situation right now? Let us look at it together calmly.`;
    }

    if (lower.includes('syllabus') || lower.includes('behind') || lower.includes('pending') || lower.includes('assignment')) {
      return `That feeling of being drowned in syllabus and deadlines is something almost every student goes through, but that doesn't make it any easier when you're the one facing it dost. The trick is to stop staring at the entire mountain. If you had to pick just ONE single topic or assignment to conquer today, which one would give you the biggest sense of relief?`;
    }

    if (userTurnCount > 2) {
      return `Academic stress can feel like a cloud that follows you everywhere — even when you try to take a break, your mind whispers that you should be studying. Let us give you a genuine breather right now. Tell me dost: is this pressure coming mostly from internal expectations, parental pressure, or tough faculty deadlines?`;
    }

    // First time directly acknowledging academic stress
    return `Academic stress in college can feel relentless dost. Between lectures, assignments, pending submissions, and exams, it easily piles up until you feel suffocated.
Tell me yaar — which part is pressing on you the hardest right now? Is it an upcoming test, back-to-back assignment deadlines, or just feeling behind on the syllabus?`;
  }

  // 7. CODING / PROGRAMMING
  if (currentIntent === 'CODING') {
    return `Coding can be brilliant when things click, and deeply frustrating when a bug won't budge! What language or project are you working on right now dost? Tell me what you are trying to build or where you are stuck.`;
  }

  // 8. ANXIETY / PANIC
  if (currentIntent === 'ANXIETY_PANIC') {
    if (!offered.breathing478 && (lower.includes('panic') || lower.includes('palpitations') || lower.includes('cant breathe'))) {
      return `I hear you dost — you are safe right now, and I am right here with you.
Let us do a gentle breath together:
Breathe in slowly through your nose for 4 counts...
Hold gently for 4 counts...
And release smoothly through your mouth for 6 counts.

Your mind is sounding an alarm, but you are okay in this present moment. What is the main thought running through your mind right now?`;
    }
    if (!offered.grounding3Things && userTurnCount > 2) {
      return `When overthinking starts spinning out of control dost, trying to fight the thoughts only makes them louder. Let us bring your awareness back into the room: take a quick look around and name 3 simple objects you see right in front of you. Just notice them. How is your chest and breathing feeling?`;
    }
    return `Anxiety can make your whole body feel tense and on edge dost. You don't have to solve everything today. I am listening without any judgment — what is causing the biggest worry for you right now?`;
  }

  // 9. LONELINESS / RELATIONSHIPS
  if (currentIntent === 'LONELINESS') {
    return `Feeling lonely or dealing with relationship hurts cuts very deep dost. College can be surrounded by hundreds of people and still feel like the loneliest place on earth. But you don't have to carry that silence alone — I am right here listening with an open heart. What happened that made you feel this way?`;
  }

  // 10. SLEEP / EXHAUSTION
  if (currentIntent === 'SLEEP_EXHAUSTION') {
    return `When your body is exhausted but your brain refuses to switch off, it is pure torture dost. Try unclenching your jaw, letting your shoulders drop down, and dimming your screen. What are the persistent thoughts that keep playing in your head when you try to rest?`;
  }

  // 11. SADNESS / LOW MOOD
  if (currentIntent === 'SADNESS') {
    return `I am right here with you dost. That heavy feeling in your chest is real, and it is completely okay not to be okay today. You don't have to pretend or force yourself to be cheerful here. When did this heaviness start creeping in?`;
  }

  // 12. ANGER / FRUSTRATION
  if (currentIntent === 'ANGER') {
    return `That anger is completely valid dost. When things feel unfair or people cross boundaries, feeling furious is your mind's natural response. Let it all out here safely — what set this off?`;
  }

  // 13. GREETINGS (Only if very first turn)
  if (/^(hi|hello|hey|namaste|hola|sup|yo)\b/i.test(lower) && userTurnCount <= 1) {
    if (activeTopic === 'ACADEMIC_STRESS') {
      return `Namaste dost! I'm Sukhi, your mindful companion on Kibou. I see you're dealing with academic stress today. You're definitely not alone in that — college pressure is real. What's on your mind right now?`;
    }
    return `Namaste dost! I'm Sukhi, your mindful companion on Kibou. Whether you are dealing with college stress, life troubles, or just need a safe space to vent, I am all ears. What is on your mind today?`;
  }

  // 14. GENERAL CONTEXTUAL REFLECTION
  // Quote or reflect the user's specific statement and invite elaboration
  const cleanSnippet = text.length > 50 ? `${text.slice(0, 50)}...` : text;
  return `I hear you when you say "${cleanSnippet}" dost. That makes total sense, and I want to understand more. Tell me what has been going on with this — what is the hardest part about it for you right now?`;
}

/* =====================================================================
   MAIN SUKHI AI RESPONSE PIPELINE
   Priority 1: Groq LLM (llama-3.3-70b-versatile, ~300ms)
   Priority 2: Pollinations AI Fast (openai-fast, 3.5s timeout)
   Priority 3: Context-Trained Mental Health Dialogue Engine (Instant, 0ms)
   ===================================================================== */

export async function getSukhiResponse(userMessage, conversationHistory = [], roomTopic = '') {
  // 1. Safety Check (Crisis keywords always have highest priority)
  const crisisCheck = detectCrisis(userMessage);
  if (crisisCheck.isCrisis || containsCrisisSignal(userMessage)) {
    return {
      content: CRISIS_FALLBACK_RESPONSE,
      isCrisis: true
    };
  }

  const groqKey = runtimeGroqKey || process.env.GROQ_API_KEY;

  // Format conversation history for LLM
  const formattedHistory = (conversationHistory || [])
    .filter((m) => m.content && m.content.trim().length > 0)
    .slice(-12)
    .map((m) => ({
      role: m.sender_role === 'seeker' ? 'user' : 'assistant',
      content: m.content.trim()
    }));

  const systemPromptWithTopic = roomTopic
    ? `${SUKHI_SYSTEM_PROMPT}\n\nNote: The user entered this conversation under the category: "${roomTopic}". Keep this context in mind.`
    : SUKHI_SYSTEM_PROMPT;

  const messages = [
    { role: 'system', content: systemPromptWithTopic },
    ...formattedHistory,
    { role: 'user', content: userMessage }
  ];

  // 2. Groq LLM (High-speed Llama 3.3 70B on free tier)
  if (groqKey && groqKey.startsWith('gsk_')) {
    for (const model of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: 450,
            presence_penalty: 0.4,
            frequency_penalty: 0.3
          }),
          signal: AbortSignal.timeout(6000)
        });

        if (res.ok) {
          const data = await res.json();
          let reply = data.choices?.[0]?.message?.content;
          if (reply?.trim()) {
            // Strip any rogue emojis if model returns them
            reply = reply.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
            return { content: reply.trim(), isCrisis: false };
          }
        }
      } catch (e) {
        // Try next model or fallback
        continue;
      }
    }
  }

  // 3. Pollinations AI Fast (openai-fast with tight 3.5s timeout)
  try {
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        seed: Math.floor(Math.random() * 1000000),
        model: 'openai-fast'
      }),
      signal: AbortSignal.timeout(3500)
    });

    if (res.ok) {
      let reply = await res.text();
      if (reply && reply.trim() && !reply.startsWith('{') && reply.length > 10) {
        reply = reply.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
        return { content: reply.trim(), isCrisis: false };
      }
    }
  } catch (e) {
    // Falls through to Context Engine immediately
  }

  // 4. Kibou Context-Trained Mental Health Dialogue Engine (Instant fallback)
  const contextualReply = generateContextualLocalResponse(userMessage, conversationHistory, roomTopic);
  return {
    content: contextualReply,
    isCrisis: false
  };
}
