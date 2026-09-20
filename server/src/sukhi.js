import { detectCrisis } from './security.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SUKHI_SESSION_ID = 'sukhi_ai_helper';
export const SUKHI_ALIAS = 'Sukhi (AI Companion)';

// Memory store for runtime API key configuration (never hardcode keys here — use server/.env)
let runtimeGroqKey = process.env.GROQ_API_KEY || '';

export function setGroqApiKey(key) {
  runtimeGroqKey = (key || '').trim();
  process.env.GROQ_API_KEY = runtimeGroqKey;
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
    provider: hasGroq ? 'Groq (qwen/qwen3.8-27b)' : 'Kibou Context & Hinglish Engine',
    groqConfigured: hasGroq,
    groqKeyMasked: hasGroq ? `${activeKey.slice(0, 7)}...${activeKey.slice(-4)}` : null,
    model: hasGroq ? 'qwen/qwen3.8-27b' : 'kibou-nlu-hinglish-v4'
  };
}

// Verified working models (confirmed against API September 2026)
// Ordered by suitability for concise, empathetic peer conversation
const GROQ_MODELS = [
  'qwen/qwen3.8-27b',    // Best: concise, mature, contextual, no fluff
  'groq/compound-mini',  // Fallback 1: fast, reliable
  'groq/compound',       // Fallback 2: stronger reasoning
  'openai/gpt-oss-20b',  // Fallback 3: solid general model
];

export const SUKHI_SYSTEM_PROMPT = `You are "Sukhi", a peer companion on Kibou — a student mental wellness platform in India.

CRITICAL RULES — FOLLOW EVERY SINGLE TIME WITHOUT EXCEPTION:

1. LENGTH: Write 2 to 3 sentences maximum. No long paragraphs. No lists. No tables. No headers. No bullet points.

2. TONE: You are a mature, grounded college friend in their early 20s — not a therapist, not a helpline, not a motivational speaker. Sound real and human.

3. BANNED WORDS: Never say "yaar", "dost", "buddy", "bhai", or any forced desi slang. It sounds fake and patronizing. Do not say it even once.

4. NO EMOJIS: Zero emojis. No asterisks. No markdown formatting of any kind.

5. HINGLISH: Understand Hinglish naturally. When the user writes in Hinglish (e.g. "padhai nahi ho rahi", "pukish feel ho raha hai", "fat rahi hai", "dimag kharab ho raha hai"), respond in a natural Hindi-English mix that matches their register. Do not force it if they write in English.

6. CONTEXT IS EVERYTHING: Read every message in the conversation history. Respond only to what the user actually said right now — do not give generic wellness scripts. If they said "math", talk about math specifically. If they said "nausea", address the physical feeling first. Never ignore their specific words.

7. ONE QUESTION: End your response with exactly one specific, grounded follow-up question. Never ask two questions in one response.

8. NO REPEATED PHRASES: Never repeat something you have already said in this conversation.

WHAT SUKHI DOES: Listens carefully, reflects back what the person is actually going through, makes them feel understood — then asks one question to go deeper.

9. SCOPE — MENTAL HEALTH ONLY: You exist purely for emotional support and mental wellness. You only respond to feelings, stress, anxiety, loneliness, relationships, family pressure, academic pressure (as feelings, never as tutoring), sleep, burnout, and student-life struggles.
   - NEVER act as a tutor, coder, or general assistant. Do not solve homework, math problems, or equations. Do not write code, essays, assignments, emails, resumes, or letters. Do not answer general-knowledge or factual questions (capitals, history, science facts, definitions). Do not translate text.
   - If a message has nothing to do with emotions or wellbeing, DO NOT answer it. Instead reply with one warm line saying you are only here to listen and support their feelings, then ask one caring question that steers back to how they are doing. Example: "That's outside what I'm here for — I'm just a listening ear for whatever you're feeling. What's been on your mind lately?"
   - Study talk is in scope ONLY through feelings (stress, fear of failure, burnout) — never give study material, solutions, or exam answers.

SAFETY: For any self-harm or suicide signal, respond with care and immediately share:
Tele-MANAS: 14416 (Toll-free, 24/7)
KIRAN: 1800-599-0019 (24/7)
Shreyash Chaturvedi: 7304167033`;

const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'end my life', 'self harm', 'cutting',
  'want to die', 'no reason to live', 'better off dead',
  'take my life', 'hang myself', 'overdose'
];

export function containsCrisisSignal(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

export const CRISIS_FALLBACK_RESPONSE = `I hear you, and I am glad you reached out. What you are going through is real, but you do not have to carry this alone.

Please connect with someone who can help right now:
Tele-MANAS (Govt of India): 14416 (Toll-free, 24/7)
KIRAN Helpline: 1800-599-0019 (Toll-free, 24/7)
Shreyash Chaturvedi: 7304167033

Take one slow breath. Help is a call away.`;

/* =====================================================================
   ZERO-REPETITION INVARIANT
   ===================================================================== */
function wasAlreadySaidBySukhi(candidate, history = []) {
  if (!candidate || !history.length) return false;
  const norm = (s) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const nc = norm(candidate);
  if (nc.length < 15) return false;

  for (const m of history) {
    if (m.sender_role === 'helper' && m.content) {
      const nm = norm(m.content);
      if (nm.length < 15) continue;
      const sliceLen = Math.min(50, nc.length, nm.length);
      if (nc.slice(0, sliceLen) === nm.slice(0, sliceLen)) return true;
      if (nc.includes(nm) || nm.includes(nc)) return true;
    }
  }
  return false;
}

/* =====================================================================
   INTENT CLASSIFIER (Hinglish-aware)
   ===================================================================== */
function classifyUserIntent(text) {
  const lower = (text || '').toLowerCase().trim();

  if (lower.includes('pukish') || lower.includes('nausea') || lower.includes('vomit') ||
      lower.includes('throw up') || lower.includes('sir dard') || lower.includes('headache') ||
      lower.includes('chakkar') || lower.includes('fat rahi') || lower.includes('ghabrahat') ||
      lower.includes('chest tight') || lower.includes('dizziness') || lower.includes('sick to my stomach'))
    return 'SOMATIC_PHYSICAL';

  if (/\b(math|maths|calculus|algebra|integration|differentiation|trig|geometry|stats|statistics)\b/i.test(lower))
    return 'MATH_SPECIFIC';

  if (/\b(physics|chemistry|chem|coding|dsa|programming|biology|bio|accounts|accounting|economics|law)\b/i.test(lower))
    return 'OTHER_SUBJECT';

  if (lower.includes('gf chahiye') || lower.includes('need a gf') || lower.includes('want a gf') ||
      lower.includes('girlfriend') || lower.includes('bandi chahiye') || lower.includes('single hu') ||
      lower.includes('crush') || lower.includes('dating') || lower.includes('kat gaya') ||
      lower.includes('ladki') || lower.includes('propose'))
    return 'DATING_RELATIONSHIP';

  if (lower.includes('padhai nahi ho') || lower.includes('padh nahi pa') || lower.includes('man nahi lag') ||
      lower.includes('mann nahi lag') || lower.includes('padhne ka man') || lower.includes('focus nahi'))
    return 'CANNOT_STUDY';

  if (lower.includes('fail ho ja') || lower.includes('backlog') || lower.includes('marks nahi aa') ||
      lower.includes('paper kharab') || lower.includes('fail hone ka'))
    return 'FEAR_OF_FAILURE';

  if (lower.includes('samajh nahi aa') || lower.includes('samajh nahi rha') || lower.includes('dimag kharab') ||
      lower.includes('bohot tension') || lower.includes('sab bekaar') || lower.includes('sab fucked'))
    return 'OVERWHELMED_GENERAL';

  if (lower.includes('parent') || lower.includes('family') || lower.includes('father') ||
      lower.includes('mother') || lower.includes('mom') || lower.includes('dad') ||
      lower.includes('ghar wale') || lower.includes('taane') || lower.includes('compar') ||
      lower.includes('cousin') || lower.includes('relatives') || lower.includes('sharma ji'))
    return 'PARENTAL_PRESSURE';

  if (/^(but\s+)?(i'?m|am)\s*(ok|okay|fine|good|alright)(\s+(now|though|today))?$/i.test(lower) ||
      lower === 'sab theek hai' || lower === 'kuch nahi' || lower === 'im fine' || lower === "i'm fine")
    return 'DEFLECTION';

  if (/^(ugh+|sigh+|argh+|damn+|dammit|smh|fuck|shit|crap|pfft|mehh+|fml)$/i.test(lower) ||
      lower === 'thak gaya hu' || lower === 'bore ho raha hu')
    return 'VENTING';

  if (/^(what|wat|huh|bruh|bro|wth|wtf|um+|umm+|lol|lmao|k)$/i.test(lower) ||
      lower.includes('kya bol rahe ho') || lower.includes('kya matlab'))
    return 'CONFUSION';

  if (/^(yes|yeah|yep|ya|yup|nah|no|nope|ok|okay|hmm+|hm+|sure|right|ha|haan|nahi)$/i.test(lower))
    return 'AFFIRMATION';

  if (lower.includes('thank') || lower.includes('shukriya') || lower.includes('dhanyawad') || lower.includes('thx'))
    return 'GRATITUDE';

  if (lower.includes('exam') || lower.includes('study') || lower.includes('syllabus') ||
      lower.includes('assignment') || lower.includes('marks') || lower.includes('grades') ||
      lower.includes('cgpa') || lower.includes('college') || lower.includes('deadlines') ||
      lower.includes('pressure') || lower.includes('academic'))
    return 'ACADEMIC_STRESS';

  if (lower.includes('panic') || lower.includes('anxious') || lower.includes('anxiety') ||
      lower.includes('overthinking') || lower.includes('nervous') || lower.includes('dread'))
    return 'ANXIETY_GENERAL';

  if (lower.includes('lonely') || lower.includes('alone') || lower.includes('breakup') ||
      lower.includes('nobody cares') || lower.includes('ignored') || lower.includes('akelapan'))
    return 'LONELINESS';

  if (lower.includes('sleep') || lower.includes('insomnia') || lower.includes('tired') ||
      lower.includes('exhausted') || lower.includes('burnout') || lower.includes('neend'))
    return 'SLEEP_EXHAUSTION';

  return 'GENERAL';
}

/* =====================================================================
   OFF-TOPIC GUARD (mental-health-only scope for local engine)
   Strict multi-word/code patterns only — never fires on emotional venting.
   ===================================================================== */
function isOffTopicRequest(text) {
  const lower = (text || '').toLowerCase().trim();
  if (!lower) return false;

  const patterns = [
    'write a code', 'write code', 'write a function', 'write a program',
    'debug', 'leetcode', 'compile error', 'fix this code', 'fix my code',
    'python', 'javascript', 'java program', 'c++ program', 'sql query',
    'html page', 'css for', 'build a website', 'make an app',
    'capital of', 'who is the prime minister', 'who is the president',
    'who invented', 'when was', 'how many countries', 'distance from',
    'solve this', 'solve the equation', 'solve for x', 'calculate',
    'do my homework', 'write my assignment', 'write an essay',
    'make my resume', 'write a mail', 'write an email', 'write a letter',
    'write a paragraph', 'complete my project',
    'translate', 'meaning of this word',
    'tell me a joke', 'sing a song', 'give me a riddle',
    'who won the', 'score of the match', 'movie review'
  ];
  if (patterns.some((p) => lower.includes(p))) return true;

  // Bare arithmetic homework like "12 + 5" or "solve 2x+3=7"
  if (/\d+\s*[+\-*/^%]\s*\d+/.test(lower) && !/(exam|marks|days|hours|percent|%|\bkg\b)/.test(lower)) return true;

  return false;
}

function getLastSukhiMessage(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].sender_role === 'helper') return history[i].content || '';
  }
  return '';
}

/* =====================================================================
   LOCAL FALLBACK RESPONSE ENGINE
   ===================================================================== */
function generateContextualLocalResponse(userMessage, history = [], roomTopic = '') {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();
  const intent = classifyUserIntent(text);
  const lastSukhi = getLastSukhiMessage(history).toLowerCase();

  const pick = (candidates) => {
    for (const c of candidates) {
      if (c && !wasAlreadySaidBySukhi(c, history)) return c;
    }
    return `Tell me a bit more about what is going on right now.`;
  };

  // Scope guard: off-topic requests get a warm redirect, never an answer
  if (isOffTopicRequest(text)) return pick([
    `That's outside what I'm here for — I'm just a listening ear for whatever you're feeling, not homework or general questions. What's been weighing on your mind lately?`,
    `I can't help with that one since I'm only here for emotional support and mental wellness. How have you been feeling these days?`,
    `That's not something I can do — my only job here is to listen and support you through what you're feeling. What would you like to talk about?`
  ]);

  if (intent === 'SOMATIC_PHYSICAL') return pick([
    `Feeling nauseous or pukish is your body's physical response when stress spikes — your nervous system is flooded right now. Step away from your desk, take slow breaths into your belly, and sip some cold water. What was happening right before this started?`,
    `That sick feeling in your stomach kicks in when anxiety goes into overdrive — don't force yourself to push through it. What were you doing or thinking about right before it started?`,
    `When stress turns physical like that it usually means you've been running on high alert for a while. How does your head feel right now?`
  ]);

  if (intent === 'MATH_SPECIFIC' || (lastSukhi.includes('subject') && lower.includes('math'))) return pick([
    `Math anxiety is real — when formulas stop clicking it creates an immediate mental block that makes even starting feel impossible. Is it a specific chapter you're stuck on, an upcoming exam, or feeling like you've fallen too far behind?`,
    `Staring at math problems when your brain is already tired is one of the fastest ways to spiral. Which specific topic is giving you the most trouble?`,
    `Math usually feels all-or-nothing, but it almost always comes down to one or two concepts that got missed. What are you currently covering in class?`
  ]);

  if (intent === 'OTHER_SUBJECT') return pick([
    `That subject gets genuinely exhausting when there is so much to absorb. What specific part of it is tripping you up right now?`,
    `Feeling stuck on coursework when deadlines are close is rough. Are you working toward a specific test or trying to get an assignment done?`
  ]);

  if (intent === 'DATING_RELATIONSHIP') return pick([
    `Being single when it feels like everyone around you is paired up can feel really isolating — it's usually less about a label and more about wanting someone to genuinely connect with. Has this been hitting harder recently, or is there someone specific on your mind?`,
    `That desire for connection makes complete sense — seeing couples everywhere in college makes you feel like you're missing out on a whole part of life. Do you feel lonely in general, or is it specifically about wanting someone special?`,
    `Wanting a relationship is natural, but it gets complicated when it starts to feel like you're not enough on your own. What kind of connection are you looking for?`
  ]);

  if (intent === 'CANNOT_STUDY') return pick([
    `Padhai mein man na lagna tab hota hai jab dimag pehle se hi thaka hua ho — khud ko force karne se sirf guilt badhta hai, kuch absorb nahi hota. Abhi book band karo aur 10 minute ka real break lo. Aaj ke din kaunsa ek topic sabse zaroori hai?`,
    `Jab syllabus ka bojh bahut bada lagta hai toh dimag freeze ho jaata hai aur shuru karna impossible lagta hai. Poori book mat dekho — bas agle 15 minute ke liye ek chhoti si cheez choose karo. Kaun si hai woh?`
  ]);

  if (intent === 'FEAR_OF_FAILURE') return pick([
    `Fail hone ka darr hume pehle se exhaust kar deta hai, aur panic mein padhai aur mushkil ho jaati hai. Ground reality kya hai — exam kab hai aur kitna syllabus cover hua hai?`,
    `Ek exam tumhari worth decide nahi karta, lekin ye samajhna tab bahut mushkil hota hai jab pressure mein ho. Minimum paas ke liye kaunse chapters sabse important hain?`
  ]);

  if (intent === 'OVERWHELMED_GENERAL') return pick([
    `Jab har taraf se cheezein pile up hoti hain toh dimag mein fog aa jaata hai — sab ek saath solve karne ki koshish mat karo. Jo cheez sabse zyada dimag mein ghoom rahi hai, woh kya hai?`,
    `Itna load ek saath lena kisi ko bhi exhaust kar deta hai. College ki wajah se hai ya ghar mein bhi kuch chal raha hai?`
  ]);

  if (lastSukhi.includes('compare') || lastSukhi.includes('relatives')) {
    if (lower.includes('compar') || lower.includes('cousin') || lower.includes('yes') || lower.includes('yeah') || lower.includes('haan')) return pick([
      `Constantly being compared to cousins or toppers is exhausting and unfair — it sends the message that your effort doesn't count unless it beats someone else. When it happens at home, do you usually stay quiet or does it turn into an argument?`,
      `Comparisons chip away at you slowly, especially from family who don't see the damage they're doing. How do you usually handle it when you hear those things?`
    ]);
  }

  if (intent === 'PARENTAL_PRESSURE') return pick([
    `Parental expectations can feel like an enormous weight — many families tie their pride directly to marks, which makes you feel like you're carrying their entire happiness on your shoulders. Do they openly pressure you, or is it more an unspoken disappointment you feel around the house?`,
    `Dealing with family pressure is draining because you care about them, but their expectations leave no room for your own peace. Have you ever told them how stressed you actually feel, or does that conversation get shut down quickly?`,
    `You're a person with real limits, not a machine built to produce exam scores. What is the hardest part of the family expectations for you right now?`
  ]);

  if (intent === 'DEFLECTION') return pick([
    `Saying you're okay is often a habit when explaining things feels like too much effort — you don't have to explain anything here. What's actually been on your mind today?`,
    `You don't have to keep a brave face here. How has your day actually been?`
  ]);

  if (intent === 'VENTING') return pick([
    `That says you're running on empty right now. You don't need full sentences — what is the most draining thing on your mind today?`,
    `Sounds like you've just hit a wall. What happened today that pushed you there?`
  ]);

  if (intent === 'CONFUSION') return pick([
    `Let's keep it simple. Tell me what's actually going on with you right now in your own words — I'm listening.`,
    `What's on your mind right now?`
  ]);

  if (intent === 'AFFIRMATION') {
    if (lastSukhi.includes('exam') || lastSukhi.includes('math') || lastSukhi.includes('subject')) return pick([
      `Breaking it into one small piece for the next hour makes it a lot more manageable. What is one specific topic you could look at right now?`,
      `What is the single nearest deadline you need to hit?`
    ]);
    return pick([
      `I'm listening. What else has been going on?`,
      `Take your time. What is the next thing on your mind?`
    ]);
  }

  if (intent === 'GRATITUDE') return pick([
    `You don't need to thank me — just keep talking if you need to. Is there anything else on your mind?`,
    `Glad it helped a bit. How are you feeling right now compared to when we started talking?`
  ]);

  if (intent === 'ACADEMIC_STRESS' || roomTopic.toLowerCase().includes('academic')) return pick([
    `Academic pressure builds up fast when lectures, assignments, and exams all pile on at once. Which part feels the heaviest right now — an upcoming test, pending work, or feeling behind on the syllabus?`,
    `When workload piles up, it's impossible to relax even on a break. What is the most urgent thing on your plate this week?`,
    `What subject or piece of work has been draining you the most lately?`
  ]);

  if (intent === 'ANXIETY_GENERAL') return pick([
    `That feeling of constant dread or panic is exhausting, especially when you can't switch it off. What feels like the biggest source of it right now?`,
    `Anxiety usually latches onto something specific even when it feels general. What keeps coming back to your mind most?`
  ]);

  if (intent === 'LONELINESS') return pick([
    `Feeling like no one really sees you or cares is genuinely painful, and it gets heavier when you are surrounded by people but still feel alone. Has something specific happened recently, or has this been building for a while?`,
    `That sense of isolation hits differently in college where everyone seems to be connected. Is it more about missing close friendships, or feeling disconnected from the people already around you?`
  ]);

  if (intent === 'SLEEP_EXHAUSTION') return pick([
    `Running on broken sleep makes everything harder — your brain literally cannot process stress the same way. Has the sleep been bad for a few nights or is this ongoing?`,
    `Exhaustion like that isn't just physical, it dulls everything including your ability to cope. What do you think is keeping you from sleeping?`
  ]);

  // General fallback
  const snippet = text.length > 50 ? `${text.slice(0, 50)}...` : text;
  return pick([
    `That sounds like it's been weighing on you. What has felt most frustrating about it?`,
    `Tell me more — what specifically is happening with "${snippet}" right now?`,
    `What would feel most helpful to talk through right now?`
  ]);
}

/* =====================================================================
   GROQ API CALL — with HTTP status checking
   ===================================================================== */
async function callGroqModel(model, messages, groqKey) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 200,
      presence_penalty: 0.4,
      frequency_penalty: 0.5
    }),
    signal: AbortSignal.timeout(8000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn(`[Sukhi] ${model} → HTTP ${res.status}: ${errText.slice(0, 120)}`);
    return null;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

/* =====================================================================
   MAIN RESPONSE PIPELINE
   1. Crisis guard
   2. Groq LLM (qwen/qwen3.8-27b → compound-mini → compound → gpt-oss-20b)
   3. Local Kibou context engine (instant, zero-dependency fallback)
   ===================================================================== */
export async function getSukhiResponse(userMessage, conversationHistory = [], roomTopic = '') {
  // Crisis guard
  const crisisCheck = detectCrisis(userMessage);
  if (crisisCheck.isCrisis || containsCrisisSignal(userMessage)) {
    return { content: CRISIS_FALLBACK_RESPONSE, isCrisis: true };
  }

  const groqKey = runtimeGroqKey || process.env.GROQ_API_KEY;

  // Build message array for LLM
  const formattedHistory = (conversationHistory || [])
    .filter((m) => m.content?.trim().length > 0)
    .slice(-10)
    .map((m) => ({
      role: m.sender_role === 'seeker' ? 'user' : 'assistant',
      content: m.content.trim()
    }));

  const systemContent = roomTopic
    ? `${SUKHI_SYSTEM_PROMPT}\n\nContext: The user entered this chat under the category "${roomTopic}". Keep this in mind.`
    : SUKHI_SYSTEM_PROMPT;

  const messages = [
    { role: 'system', content: systemContent },
    ...formattedHistory,
    { role: 'user', content: userMessage }
  ];

  // Try Groq LLM models in order
  if (groqKey && groqKey.startsWith('gsk_')) {
    for (const model of GROQ_MODELS) {
      try {
        const reply = await callGroqModel(model, messages, groqKey);
        if (reply) {
          // Strip any emojis that slip through
          const clean = reply
            .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
            .trim();
          if (clean.length > 0 && !wasAlreadySaidBySukhi(clean, conversationHistory)) {
            console.log(`[Sukhi] Response via ${model}`);
            return { content: clean, isCrisis: false };
          }
        }
      } catch (e) {
        console.warn(`[Sukhi] ${model} error: ${e.message}`);
      }
    }
    console.warn('[Sukhi] All Groq models failed — using local engine');
  }

  // Local fallback
  return {
    content: generateContextualLocalResponse(userMessage, conversationHistory, roomTopic),
    isCrisis: false
  };
}
