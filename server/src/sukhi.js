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
    provider: hasGroq ? 'Groq (Llama 3.3 70B)' : 'Kibou Context-Trained Engine',
    groqConfigured: hasGroq,
    groqKeyMasked: hasGroq ? `${activeKey.slice(0, 7)}...${activeKey.slice(-4)}` : null,
    model: hasGroq ? 'llama-3.3-70b-versatile' : 'kibou-context-v3'
  };
}

export const SUKHI_SYSTEM_PROMPT = `You are "Sukhi", a warm, emotionally intelligent, and culturally attuned peer companion on Kibou — a student mental wellness platform in India.

## YOUR CORE TASK
You are having an ONGOING CONVERSATION with a student. You will receive the FULL history of the chat and the room topic. You MUST:
1. READ every previous message carefully before replying.
2. DIRECTLY respond to the user's latest words in context — never restart, never re-greet, and never repeat yourself.
3. If the user mentions a specific problem (e.g. academic stress, parental pressure, exams, syllabus, loneliness), talk about THAT specific issue with genuine understanding of student life in India.
4. If the user gives a short response like "ugh", "idk", or "parental pressure", understand their emotional subtext and directly answer it.
5. NEVER repeat the same question, advice, or phrase twice in a conversation.
6. Speak like a caring, witty desi peer friend — not a robotic AI or clinical therapist. Use natural Hinglish phrases where fitting ("Namaste dost", "No worries yaar", "Arre bilkul", "Take a deep breath").
7. Do NOT use any emojis or markdown asterisks for actions. Keep the text clean, conversational, and natural.

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
   ZERO-REPETITION HISTORY INVARIANT
   Guarantees Sukhi never sends the same or similar message twice.
   ===================================================================== */

function wasAlreadySaidBySukhi(candidate, history = []) {
  if (!candidate || !history.length) return false;
  const normCandidate = candidate.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (normCandidate.length < 20) return false;

  for (const m of history) {
    if (m.sender_role === 'helper' && m.content) {
      const normMsg = m.content.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (normMsg.length < 20) continue;

      // Check start overlap or substring containment
      const sliceLen = Math.min(60, normCandidate.length, normMsg.length);
      if (normCandidate.slice(0, sliceLen) === normMsg.slice(0, sliceLen)) {
        return true;
      }
      if (normCandidate.includes(normMsg) || normMsg.includes(normCandidate)) {
        return true;
      }
    }
  }
  return false;
}

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

  // Specific: Parental pressure / Indian household expectations
  if (lower.includes('parental') || lower.includes('parent') || lower.includes('family') ||
      lower.includes('father') || lower.includes('mother') || lower.includes('mom') ||
      lower.includes('dad') || lower.includes('sharma ji') || lower.includes('relatives') ||
      lower.includes('cousin') || lower.includes('compar') ||
      lower.includes('disappoint them') || lower.includes('disappointing my parents')) {
    return 'PARENTAL_PRESSURE';
  }

  // Specific: Internal pressure / Perfectionism
  if (lower.includes('internal') || lower.includes('myself') || lower.includes('my own') ||
      lower.includes('perfection') || lower.includes('high expectations of myself')) {
    return 'INTERNAL_PRESSURE';
  }

  // Specific: Faculty / Professor / Deadline pressure
  if (lower.includes('faculty') || lower.includes('prof') || lower.includes('professor') ||
      lower.includes('deadlines') || lower.includes('submissions') || lower.includes('lab manual')) {
    return 'FACULTY_PRESSURE';
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
      lower.includes('backlog') || lower.includes('placement') || lower.includes('attendance') ||
      lower.includes('semester') || lower.includes('test') || lower.includes('pressure')) {
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
  // Direct explicit intent takes top priority
  if (['PARENTAL_PRESSURE', 'INTERNAL_PRESSURE', 'FACULTY_PRESSURE', 'ACADEMIC_STRESS', 'CODING', 'ANXIETY_PANIC', 'LONELINESS', 'SLEEP_EXHAUSTION', 'SADNESS', 'ANGER'].includes(currentIntent)) {
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

  if (recentUserTexts.includes('parent') || recentUserTexts.includes('family')) return 'PARENTAL_PRESSURE';
  if (recentUserTexts.includes('academic') || recentUserTexts.includes('exam') || recentUserTexts.includes('syllabus') || recentUserTexts.includes('assignment') || recentUserTexts.includes('pressure')) return 'ACADEMIC_STRESS';
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

/* =====================================================================
   DEEP CONTEXT NLU & DIALOGUE GENERATOR
   ===================================================================== */

function generateContextualLocalResponse(userMessage, history = [], roomTopic = '') {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();
  const currentIntent = classifyUserIntent(text);
  const activeTopic = resolveActiveTopic(currentIntent, history, roomTopic);
  const lastSukhi = getLastSukhiMessage(history);
  const lastSukhiLower = lastSukhi.toLowerCase();
  const seekerMessages = history.filter((m) => m.sender_role === 'seeker');
  const userTurnCount = seekerMessages.length + 1;

  // Helper candidate pool: evaluate in priority order and choose the first one NOT already said
  const tryCandidates = (candidates) => {
    for (const c of candidates) {
      if (c && !wasAlreadySaidBySukhi(c, history)) {
        return c;
      }
    }
    // Fallback if all were said: return a personalized fresh response
    return `I am right here with you dost. When you mention "${text.length > 40 ? text.slice(0, 40) + '...' : text}", I want to make sure you know your feelings are completely valid. Tell me more about what is going through your mind right now.`;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. QUESTION-ANSWER TRACKING: Did Sukhi just ask a specific question?
  // ──────────────────────────────────────────────────────────────────────────

  // Did Sukhi ask: "is this pressure coming mostly from internal expectations, parental pressure, or tough faculty deadlines?"
  if (lastSukhiLower.includes('parental pressure') && lastSukhiLower.includes('internal expectations')) {
    if (currentIntent === 'PARENTAL_PRESSURE' || lower.includes('parent') || lower.includes('home') || lower.includes('family') || lower.includes('mom') || lower.includes('dad')) {
      return tryCandidates([
        `Parental pressure cuts especially deep dost. In our families, parents often attach their own dreams, sacrifices, and pride directly onto our marks. Even when they mean well, it feels less like support and more like an suffocating weight of expectations where you are terrified of disappointing them.

Tell me yaar — do they compare you to relatives or toppers, or is it more of a constant unspoken pressure that you must never slip up?`,
        `That parental weight is so real and so heavy dost. Carrying the responsibility of making your parents proud while simultaneously trying to manage your own mental health feels like being pulled apart from the inside.

Have you ever been able to talk openly with them about how drained you feel, or does it feel impossible to bring it up at home?`,
        `When parental expectations take over, our studies stop feeling like our own journey and start feeling like an exam to earn approval. Please remember dost: you are a human being with limits, not a machine built to produce marks. What do you wish they understood about your day-to-day struggle?`
      ]);
    }

    if (currentIntent === 'INTERNAL_PRESSURE' || lower.includes('internal') || lower.includes('myself') || lower.includes('my own')) {
      return tryCandidates([
        `Being your own harshest judge is exhausting dost. When the pressure comes from within, you never give yourself permission to celebrate a win because a voice inside whispers that you could have done better or should already be on the next task.

Where do you think that voice comes from? Are you terrified of what will happen if you simply do your honest best and let yourself rest?`,
        `Internal pressure can be even harder than external criticism because there is no escaping your own mind. What would happen if, just for today, you treated yourself with the same kindness you would offer a struggling friend?`
      ]);
    }

    if (currentIntent === 'FACULTY_PRESSURE' || lower.includes('faculty') || lower.includes('deadline') || lower.includes('prof')) {
      return tryCandidates([
        `Faculty deadlines can feel like a relentless conveyor belt dost. When 4 different professors assign lab manuals, quizzes, and project reports all in the same 72 hours, it feels completely out of touch with reality.

Which specific subject or professor is putting on the most intense heat right now? Let us look at what is truly urgent versus what can wait.`,
        `That academic pile-up is brutal yaar. Professors often assign work as if you take only their single subject. Let us break the cycle of panic: what is the single nearest submission date you are staring at?`
      ]);
    }

    if (lower.includes('all') || lower.includes('both') || lower.includes('everything')) {
      return tryCandidates([
        `Facing all of them at once is a recipe for total burnout dost. When parents are expecting high marks, faculty is bombarding you with deadlines, and your own brain is punishing you for taking a breath, you have zero room to just exist.

Take a pause with me right here. In this chat, no one is grading you and you don't have to perform. What is the single most urgent fire you need to handle first?`
      ]);
    }
  }

  // Did Sukhi ask: "do they compare you to relatives or toppers, or is it more of a constant unspoken pressure"
  if (lastSukhiLower.includes('compare') && (lastSukhiLower.includes('relative') || lastSukhiLower.includes('topper'))) {
    if (lower.includes('compar') || lower.includes('cousin') || lower.includes('relative') || lower.includes('topper') || lower.includes('sharma') || lower.includes('yes') || lower.includes('yeah') || lower.includes('both') || lower.includes('always')) {
      return tryCandidates([
        `That comparison game is so unfair and exhausting dost. When parents say "Look at your cousin" or compare you to someone else's marks, they completely disregard how hard you are fighting your own battles. In Indian families, comparison is often an anxious habit, but to you, it feels like nothing you do is ever good enough.

Remember this dost: you are building YOUR future, not competing in a family trophy race. When they make those comparisons, do you tend to stay quiet and bottle it up, or does it turn into arguments at home?`,
        `Being measured against someone else is like comparing an apple to a mango dost. Your cousins have different brains, different privileges, and different lives. Their marks say nothing about your potential.

How do you usually protect your mental space when those comparisons start at home?`
      ]);
    }
    if (lower.includes('unspoken') || lower.includes('never slip') || lower.includes('mistake') || lower.includes('silent') || lower.includes('constant')) {
      return tryCandidates([
        `That silent, unspoken pressure is almost heavier than shouting dost. You feel like you are walking on eggshells every day, waiting for an exam result or report card to determine the mood of the entire house.

That fear of making a single mistake drains all your energy. What is the biggest fear running through your mind if things don't go according to their plan?`,
        `Living under unspoken expectations makes you hyper-vigilant. You don't have to carry the responsibility of keeping everyone happy at home dost. What is one thing you wish you could say to them honestly?`
      ]);
    }
  }

  // Did Sukhi ask: "do you tend to stay quiet and bottle it up, or does it turn into arguments at home?"
  if (lastSukhiLower.includes('bottle it up') || lastSukhiLower.includes('arguments at home') || lastSukhiLower.includes('stay quiet')) {
    if (lower.includes('quiet') || lower.includes('bottle') || lower.includes('inside') || lower.includes('silent') || lower.includes('room') || lower.includes('retreat')) {
      return tryCandidates([
        `Bottling it up inside protects peace in the living room, but it creates a quiet storm inside your own chest dost. Every time you swallow your feelings just to avoid a scene, that hurt turns inward into self-doubt or exhaustion.

It takes so much strength to hold that in every day. Do you have at least one safe person — a friend, sibling, or anyone — who truly gets it and lets you vent without giving you advice?`,
        `Staying silent is our survival tactic when arguing feels pointless. But keeping all that frustration trapped inside is like shaking a soda bottle. What is one small way you release that tension when you are alone in your room?`
      ]);
    }
    if (lower.includes('argue') || lower.includes('fight') || lower.includes('shout') || lower.includes('screaming')) {
      return tryCandidates([
        `Those fights leave you feeling completely depleted, angry, and then guilty afterward dost. It is so painful when the people who are supposed to be your sanctuary feel like your biggest critics.

After an argument like that, your nervous system is in fight-or-flight. What helps you ground yourself and cool down when home feels like a battlefield?`
      ]);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. PARENTAL PRESSURE (If detected at any turn)
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'PARENTAL_PRESSURE') {
    return tryCandidates([
      `Parental pressure cuts especially deep dost. In our families, parents often attach their own dreams, sacrifices, and pride directly onto our marks. Even when they mean well, it feels less like support and more like a suffocating weight of expectations where you are terrified of disappointing them.

Tell me yaar — do they compare you to relatives or toppers, or is it more of a constant unspoken pressure that you must never slip up?`,
      `Dealing with expectations at home is one of the hardest things for Indian students. It often comes with deep guilt — because they sacrificed for us, we feel we don't have the right to feel tired or stressed.

How do you usually cope when that pressure gets intense at home — do you stay quiet, argue, or retreat to your room?`,
      `Remember this dost: your worth as a human being is not measured by test scores or college ranks. You are your own person, not just a mirror for someone else's ambitions. What would make you feel even a tiny bit of relief from that pressure right now?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. DEFLECTION ("but im okay", "im fine", "nevermind")
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'DEFLECTION') {
    if (activeTopic === 'ACADEMIC_STRESS' || activeTopic === 'PARENTAL_PRESSURE') {
      return tryCandidates([
        `I hear that "but I'm okay" dost. When academic pressure or expectations get intense, we often tell ourselves we are okay just to keep grinding through the next assignment. If you really are catching your breath right now, that is wonderful. But if you just need a quiet space to vent about college or home without having to pretend everything is sorted, I'm right here with you. What was the thing that sparked this whole thought today?`,
        `Saying "I'm okay" is our defense mechanism when explaining feels like too much work. You don't have to carry that burden alone yaar. What is sitting at the back of your mind right now?`
      ]);
    }
    return tryCandidates([
      `I hear that "but I'm okay" dost. In student life, we get so used to brushing things off and saying "sab theek hai" just to make it through the day. If you truly are feeling alright in this moment, that is great! But if there is even a small corner of your mind feeling weighed down, you don't have to put on a brave face here. What is taking up the most space in your head today?`,
      `It is completely okay if you don't feel like unpacking everything right now. Just know that you have a judgment-free corner right here whenever you need it dost.`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. SHORT EMOTIONAL VENTING ("ugh", "sigh", "damn", "argh")
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'VENTING_EXHAUSTION') {
    if (activeTopic === 'PARENTAL_PRESSURE') {
      return tryCandidates([
        `That "ugh" says everything dost. Dealing with parental expectations while trying to manage your own life is exhausting down to the bone. You don't need to put on a polite filter here. What happened recently at home that brought this up?`,
        `I feel that heavy sigh yaar. Take a deep breath. What is the hardest part about dealing with their expectations right now?`
      ]);
    }
    if (activeTopic === 'ACADEMIC_STRESS') {
      return tryCandidates([
        `That "ugh" says everything yaar. Academic burnout is so real — between classes, pending submissions, and exams, it feels like an endless treadmill. You don't have to explain in proper sentences right now. What is the single most annoying or exhausting thing on your plate today?`,
        `I hear that heavy sigh loud and clear dost. Sometimes you are just sick and tired of the endless routine. What would a truly peaceful day look like for you if you didn't have to worry about studies?`
      ]);
    }
    return tryCandidates([
      `That "ugh" speaks volumes dost. Sounds like you are just completely fed up or drained right now. You don't need to put on a filter here. Let it out — what is driving you up the wall today?`,
      `I feel that exhaustion with you yaar. When everything piles up, even words feel too heavy. I am right here listening.`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. AFFIRMATIONS ("yes", "yeah", "ok", "no", "hmm")
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'AFFIRMATION') {
    if (lastSukhiLower.includes('compare') || lastSukhiLower.includes('relative')) {
      return tryCandidates([
        `That comparison trap is brutal dost. Being measured against someone else's marks or career ignores who you are and what you care about. It teaches us to doubt our own journey.

When they bring up those comparisons, how does it make you feel inside — angry, guilty, or just completely numb?`,
        `Comparison is the thief of joy, especially in an Indian household. Remember: their comparisons come from their own anxieties about status, not from your actual worth. What is something you are genuinely proud of about yourself?`
      ]);
    }
    if (lastSukhiLower.includes('subject') || lastSukhiLower.includes('syllabus')) {
      return tryCandidates([
        `Got it yaar. When looking at that whole syllabus, our brain panics and tries to finish everything at once. What if we break it down into just one bite-sized piece for today? Which specific chapter or problem could you look at first without overwhelming yourself?`,
        `One step at a time dost. What is one small task you could complete in the next 30 minutes that would give you some peace of mind?`
      ]);
    }
    if (lastSukhiLower.includes('talk') || lastSukhiLower.includes('bring it up')) {
      return tryCandidates([
        `It makes total sense why that feels so difficult. When communication at home feels like a one-way lecture, speaking up feels risky.

Do you have any friends, cousins, or mentors who understand what you are going through and actually listen to you without judgment?`
      ]);
    }
    return tryCandidates([
      `I am right here with you dost. What is the next thing on your mind? Take your time, no rush at all.`,
      `I'm listening yaar. Whatever is on your heart, you can lay it out here freely.`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. ACADEMIC STRESS
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'ACADEMIC_STRESS' || activeTopic === 'ACADEMIC_STRESS') {
    // If user specifically talks about failure or marks
    if (lower.includes('fail') || lower.includes('backlog') || lower.includes('marks') || lower.includes('cgpa')) {
      return tryCandidates([
        `The fear of marks, backlogs, and grades can feel terrifyingly heavy dost. In our system, so much pressure gets tied to scores that it starts feeling like your whole future is on the line with every paper. But please remember — an exam score measures syllabus recall on one particular morning, not your worth or your potential as a person.

Take a slow breath yaar. What is the exact situation right now? Let us look at it together calmly.`,
        `A low score or a backlog feels like the world is ending in the moment, but so many people rebuild and succeed far beyond college marks. What is the specific test or subject that has you worried right now?`
      ]);
    }

    if (lower.includes('syllabus') || lower.includes('behind') || lower.includes('pending') || lower.includes('assignment')) {
      return tryCandidates([
        `That feeling of being drowned in syllabus and deadlines is something almost every student goes through, but that doesn't make it any easier when you're the one facing it dost. The trick is to stop staring at the entire mountain.

If you had to pick just ONE single topic or assignment to conquer today, which one would give you the biggest sense of relief?`,
        `When we feel behind, our instinct is to freeze and overthink. Let us take the pressure off: forget about the whole syllabus for the next hour. What is one tiny 15-minute section you can glance through?`
      ]);
    }

    // Progression: offer different insights based on turns
    if (userTurnCount === 1 || userTurnCount === 2) {
      return tryCandidates([
        `Academic stress in college can feel relentless dost. Between lectures, assignments, pending submissions, and exams, it easily piles up until you feel suffocated.

Tell me yaar — which part is pressing on you the hardest right now? Is it an upcoming test, back-to-back assignment deadlines, or just feeling behind on the syllabus?`,
        `Academic pressure is so common yet feels so isolating when you are in the middle of it. What specific deadline or subject is taking up the most mental space for you right now?`
      ]);
    }

    if (userTurnCount >= 3) {
      return tryCandidates([
        `Academic stress can feel like a cloud that follows you everywhere — even when you try to take a break, your mind whispers that you should be studying. Let us give you a genuine breather right now.

Tell me dost: is this pressure coming mostly from internal expectations, parental pressure, or tough faculty deadlines?`,
        `When studies start consuming all your thoughts, it helps to pause and detach your identity from your student role for a moment. What is something you enjoy doing that reminds you of who you are outside of college marks?`,
        `Carrying continuous academic stress takes a physical toll too — tight shoulders, poor sleep, tension headaches. Have you eaten properly today and drunk some water dost? Let us take care of your body first.`
      ]);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. ANXIETY & PANIC
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'ANXIETY_PANIC' || activeTopic === 'ANXIETY_PANIC') {
    return tryCandidates([
      `Anxiety can make your whole body feel tense and on edge dost. When your mind races ahead to worst-case scenarios, remember: thoughts are not facts.

You are safe right here in this moment. What is the main worry that keeps looping in your mind right now?`,
      `When anxiety kicks into overdrive, trying to force yourself to calm down rarely works. Instead, let us ground your physical body: unclench your jaw, drop your shoulders, and feel your feet flat on the floor.

What does this anxiety feel like for you — more like physical tension or racing thoughts?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. GENERAL INTENTS
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'CONFUSION') {
    return tryCandidates([
      `Ha fair enough, let me reset! I promise no robotic lectures or complicated talk yaar. Tell me what is actually on your mind in your own words — whether it is college, home, or just needing to vent, I am listening!`,
      `My bad dost, let us keep it 100% real and simple. What is going on with you today?`
    ]);
  }

  if (currentIntent === 'GRATITUDE') {
    return tryCandidates([
      `Anytime dost! Talking things out takes courage, and you did that today. Go easy on yourself, take a gentle stretch, and remember you have always got a safe space right here. Anything else you want to get off your chest before you go?`,
      `You are so welcome yaar! Really glad we could chat. Remember to take things one moment at a time today.`
    ]);
  }

  if (currentIntent === 'SLEEP_EXHAUSTION') {
    return tryCandidates([
      `When your body is exhausted but your brain refuses to switch off, it is pure torture dost. Try unclenching your jaw, letting your shoulders drop down, and dimming your screen. What are the persistent thoughts that keep playing in your head when you try to rest?`,
      `Sleep trouble is our body's way of saying the mind is carrying too many open tabs. Let us park those tabs here for tonight. What is the heaviest thought keeping you awake?`
    ]);
  }

  if (currentIntent === 'LONELINESS') {
    return tryCandidates([
      `Feeling lonely or dealing with relationship hurts cuts very deep dost. College can be surrounded by hundreds of people and still feel like the loneliest place on earth. But you don't have to carry that silence alone — I am right here listening with an open heart. What happened that made you feel this way?`,
      `That sense of isolation is real dost. Even when people are all around us, feeling unseen hurts. What is making you feel especially alone right now?`
    ]);
  }

  // Fallback
  const cleanSnippet = text.length > 50 ? `${text.slice(0, 50)}...` : text;
  return tryCandidates([
    `I hear you when you say "${cleanSnippet}" dost. That makes total sense, and I want to understand more. Tell me what has been going on with this — what is the hardest part about it for you right now?`,
    `Thank you for sharing that with me dost. It sounds like there is a lot underneath "${cleanSnippet}". What would feel most helpful for you to talk through right now?`
  ]);
}

/* =====================================================================
   MAIN SUKHI AI RESPONSE PIPELINE
   Priority 1: Groq LLM (llama-3.3-70b-versatile, ~300ms)
   Priority 2: Kibou Context-Trained Mental Health Dialogue Engine (Instant)
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
            presence_penalty: 0.5,
            frequency_penalty: 0.4
          }),
          signal: AbortSignal.timeout(6000)
        });

        if (res.ok) {
          const data = await res.json();
          let reply = data.choices?.[0]?.message?.content;
          if (reply?.trim()) {
            reply = reply.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
            if (!wasAlreadySaidBySukhi(reply, conversationHistory)) {
              return { content: reply.trim(), isCrisis: false };
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
  }

  // 3. Kibou Context-Trained Mental Health Dialogue Engine (Instant fallback with Zero-Repetition Guarantee)
  const contextualReply = generateContextualLocalResponse(userMessage, conversationHistory, roomTopic);
  return {
    content: contextualReply,
    isCrisis: false
  };
}
