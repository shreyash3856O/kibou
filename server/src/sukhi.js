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
    provider: hasGroq ? 'Groq (Llama 3.3 70B)' : 'Kibou Context & Hinglish Engine',
    groqConfigured: hasGroq,
    groqKeyMasked: hasGroq ? `${activeKey.slice(0, 7)}...${activeKey.slice(-4)}` : null,
    model: hasGroq ? 'llama-3.3-70b-versatile' : 'kibou-nlu-hinglish-v4'
  };
}

export const SUKHI_SYSTEM_PROMPT = `You are "Sukhi", an empathetic, grounded peer companion on Kibou — a student mental wellness platform in India.

## TONE & LANGUAGE RULES (CRITICAL)
1. DO NOT OVERUSE "yaar", "dost", or forced slang. It sounds corny, fake, and annoying. Speak like a natural, mature college peer or supportive friend in their early 20s.
2. FLUENT HINGLISH COMPREHENSION: Understand Indian Hinglish naturally (e.g. "padhai nahi ho rahi", "fat rahi hai", "gf chahiye", "maths me fail ho jaunga", "ghar wale taane maar rahe hai", "dimag kharab ho raha hai", "pukish feel ho raha hai").
3. DIRECT CONTEXTUAL RESPONSES:
   - If user says they feel physical symptoms ("i feel pukish", nausea, headache), address that physical reaction first.
   - If user names a specific subject ("i think its math"), talk specifically about math and exam anxiety.
   - If user says "i need a gf" or talks about relationships, talk naturally like a real friend about companionship and loneliness, NOT like a therapist reading a script.
4. ZERO REPETITION: Never repeat questions or phrases you have already said.
5. NO EMOJIS: Do not use any emojis or asterisks for actions. Keep the text clean, readable, and authentic.

## BOUNDARIES & SAFETY
- You are a supportive peer, not a therapist.
- For suicide/self-harm signals, provide immediately:
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

export const CRISIS_FALLBACK_RESPONSE = `I hear you, and I am glad you reached out. What you are going through is real, but you do not have to carry this heavy weight alone.

Please connect with people who can support you right now:
Tele-MANAS (Govt of India): Call 14416 (Toll-free, 24/7)
KIRAN Helpline: Call 1800-599-0019 (Toll-free, 24/7)
Shreyash Chaturvedi: 7304167033

Take one slow breath. Help is available 24/7.`;

/* =====================================================================
   ZERO-REPETITION HISTORY INVARIANT
   Guarantees Sukhi never sends the same or similar message twice.
   ===================================================================== */

function wasAlreadySaidBySukhi(candidate, history = []) {
  if (!candidate || !history.length) return false;
  const normCandidate = candidate.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (normCandidate.length < 15) return false;

  for (const m of history) {
    if (m.sender_role === 'helper' && m.content) {
      const normMsg = m.content.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (normMsg.length < 15) continue;

      const sliceLen = Math.min(50, normCandidate.length, normMsg.length);
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
   STATEFUL CONVERSATION CONTEXT ANALYZER & HINGLISH PARSER
   ===================================================================== */

function classifyUserIntent(text) {
  const lower = (text || '').toLowerCase().trim();

  // 1. Somatic / Physical Stress (pukish, nausea, headache, panic physical symptoms)
  if (lower.includes('pukish') || lower.includes('nausea') || lower.includes('vomit') ||
      lower.includes('throw up') || lower.includes('sick to my stomach') || lower.includes('sir dard') ||
      lower.includes('headache') || lower.includes('chakkar') || lower.includes('fat rahi hai') ||
      lower.includes('ghabrahat') || lower.includes('chest tight') || lower.includes('dizziness')) {
    return 'SOMATIC_PHYSICAL';
  }

  // 2. Math Anxiety (High frequency specific trigger)
  if (/\b(math|maths|calculus|algebra|integration|differentiation|trig|geometry|stats|statistics)\b/i.test(lower)) {
    return 'MATH_SPECIFIC';
  }

  // 3. Other Academic Subjects
  if (/\b(physics|chemistry|chem|coding|dsa|programming|biology|bio|accounts|accounting|economics|law)\b/i.test(lower)) {
    return 'OTHER_SUBJECT';
  }

  // 4. Dating / Romantic Loneliness / Girlfriend / Relationship
  if (lower.includes('need a gf') || lower.includes('gf chahiye') || lower.includes('want a gf') ||
      lower.includes('girlfriend') || lower.includes('bandi chahiye') || lower.includes('single hu') ||
      lower.includes('no girlfriend') || lower.includes('crush') || lower.includes('dating') ||
      lower.includes('kat gaya') || lower.includes('ladki') || lower.includes('propose')) {
    return 'DATING_RELATIONSHIP';
  }

  // 5. Hinglish: Inability to study / Lack of focus / Procrastination
  if (lower.includes('padhai nahi ho') || lower.includes('padh nahi pa') || lower.includes('man nahi lag') ||
      lower.includes('mann nahi lag') || lower.includes('padhne ka man') || lower.includes('focus nahi')) {
    return 'CANNOT_STUDY';
  }

  // 6. Hinglish: Fear of Failure / Backlogs / Marks
  if (lower.includes('fail ho ja') || lower.includes('backlog') || lower.includes('marks nahi aa') ||
      lower.includes('paper kharab') || lower.includes('fail hone ka darr')) {
    return 'FEAR_OF_FAILURE';
  }

  // 7. Hinglish: General Overwhelm / "Kuch samajh nahi aa raha"
  if (lower.includes('samajh nahi aa') || lower.includes('samajh nahi rha') || lower.includes('dimag kharab') ||
      lower.includes('bohot tension') || lower.includes('sab bekaar') || lower.includes('sab fucked up')) {
    return 'OVERWHELMED_GENERAL';
  }

  // 8. Parental Pressure / Family / Comparisons
  if (lower.includes('parental') || lower.includes('parent') || lower.includes('family') ||
      lower.includes('father') || lower.includes('mother') || lower.includes('mom') ||
      lower.includes('dad') || lower.includes('sharma ji') || lower.includes('relatives') ||
      lower.includes('cousin') || lower.includes('compar') || lower.includes('ghar wale') ||
      lower.includes('taane') || lower.includes('daant')) {
    return 'PARENTAL_PRESSURE';
  }

  // 9. Deflection ("but im okay", "im fine", "sab theek hai")
  if (/^(but\s+)?(i'?m|am)\s*(ok|okay|fine|good|alright)(\s+(now|though|today|so far))?$/i.test(lower) ||
      /^(it'?s|its)\s*(whatever|nothing|fine|okay|ok|all good)$/i.test(lower) ||
      lower === 'im okay' || lower === "i'm okay" || lower === 'but im okay' || lower === "but i'm okay" ||
      lower === 'sab theek hai' || lower === 'kuch nahi') {
    return 'DEFLECTION';
  }

  // 10. Short venting ("ugh", "sigh", "damn", "argh", "smh")
  if (/^(ugh+|sigh+|argh+|damn+|dammit|smh|fuck|shit|crap|pfft|mehh+|gah+|fml)$/i.test(lower) ||
      lower === 'thak gaya hu' || lower === 'bore ho raha hu') {
    return 'VENTING_EXHAUSTION';
  }

  // 11. Confusion ("what", "huh", "kya bol raha hai")
  if (/^(what|wat|wut|huh|bruh|bro|wth|wtf|um+|umm+|uh+|lol|lmao|k)$/i.test(lower) ||
      lower.includes('what do you mean') || lower.includes('kya bol rahe ho') || lower.includes('kya matlab')) {
    return 'CONFUSION';
  }

  // 12. Short affirmations
  if (/^(yes|yeah|yep|ya|yup|nah|no|nope|ok|okay|ok ok|hmm+|hm+|sure|true|right|ha|haan|nahi)$/i.test(lower)) {
    return 'AFFIRMATION';
  }

  // 13. Gratitude
  if (lower.includes('thank') || lower.includes('dhanyawad') || lower.includes('shukriya') || lower.includes('thx')) {
    return 'GRATITUDE';
  }

  // 14. Academic Stress general
  if (lower.includes('academic') || lower.includes('exam') || lower.includes('study') || lower.includes('studies') ||
      lower.includes('syllabus') || lower.includes('assignment') || lower.includes('marks') ||
      lower.includes('score') || lower.includes('grades') || lower.includes('cgpa') || lower.includes('gpa') ||
      lower.includes('college') || lower.includes('homework') || lower.includes('pressure') || lower.includes('deadlines')) {
    return 'ACADEMIC_STRESS';
  }

  // 15. Anxiety general
  if (lower.includes('panic') || lower.includes('anxious') || lower.includes('anxiety') ||
      lower.includes('overthinking') || lower.includes('nervous') || lower.includes('scared') || lower.includes('dread')) {
    return 'ANXIETY_GENERAL';
  }

  // 16. Loneliness general
  if (lower.includes('lonely') || lower.includes('alone') || lower.includes('breakup') ||
      lower.includes('friend') || lower.includes('nobody cares') || lower.includes('ignored') || lower.includes('akelapan')) {
    return 'LONELINESS';
  }

  // 17. Sleep / Tiredness
  if (lower.includes('sleep') || lower.includes('insomnia') || lower.includes('tired') || lower.includes('exhausted') ||
      lower.includes('burnout') || lower.includes('drained') || lower.includes('neend')) {
    return 'SLEEP_EXHAUSTION';
  }

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
   DEEP CONTEXT NLU & DIALOGUE GENERATOR (NATURAL, ZERO-CORNY TONE)
   ===================================================================== */

function generateContextualLocalResponse(userMessage, history = [], roomTopic = '') {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();
  const currentIntent = classifyUserIntent(text);
  const lastSukhi = getLastSukhiMessage(history);
  const lastSukhiLower = lastSukhi.toLowerCase();

  const tryCandidates = (candidates) => {
    for (const c of candidates) {
      if (c && !wasAlreadySaidBySukhi(c, history)) {
        return c;
      }
    }
    return `I hear what you are saying about "${text.length > 40 ? text.slice(0, 40) + '...' : text}". Tell me a bit more about what is going on right now.`;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. SOMATIC / PHYSICAL STRESS ("i feel pukish", nausea, headache, ghabrahat)
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'SOMATIC_PHYSICAL') {
    return tryCandidates([
      `Feeling pukish or nauseous is your body's physical reaction when stress or anxiety spikes. Your nervous system is flooded right now.

Please step away from your desk or screen for five minutes. Drink a small sip of cold water, loosen any tight clothing, and take slow breaths into your belly. What was happening right before you started feeling this physical nausea?`,
      `That physical sick feeling in your stomach happens when anxiety hits fight-or-flight mode. Don't force yourself to study or push through this right now — your body needs to calm down first.

Are you dealing with an upcoming test, or did something specific just happen that set this off?`,
      `When stress turns physical like that, it means you have been running on high alert for too long. Sit back, let your shoulders drop, and take a couple of slow sips of water. How does your head and chest feel right now?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. MATH ANXIETY & SPECIFIC SUBJECTS ("i think its math", calculus, algebra)
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'MATH_SPECIFIC' || (lastSukhiLower.includes('subject') && lower.includes('math'))) {
    return tryCandidates([
      `Math anxiety is completely real. When problems aren't clicking or formulas look like another language, it triggers an immediate feeling of panic and mental paralysis.

What's going on with math right now — is it an upcoming exam, a chapter you are completely stuck on, or feeling like you've fallen too far behind?`,
      `Staring at math problem sets when your brain is already tired is one of the quickest ways to feel overwhelmed. 

Which specific topic or chapter is giving you the hardest time right now? Let's take it one step at a time without any pressure.`,
      `Math tends to make people feel like it's all-or-nothing, but it usually comes down to just one or two foundational concepts that got missed along the way. What topic are you covering in class right now?`
    ]);
  }

  if (currentIntent === 'OTHER_SUBJECT') {
    return tryCandidates([
      `That subject can be genuinely exhausting when there is so much content to memorize or apply. What specific part of it is giving you trouble right now?`,
      `Feeling stuck on that coursework is frustrating, especially when deadlines are close. Are you preparing for a specific test or trying to finish an assignment?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. DATING / ROMANTIC LONELINESS ("i need a gf", single hu, bandi chahiye)
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'DATING_RELATIONSHIP') {
    return tryCandidates([
      `Being single when it feels like everyone around you is coupled up can feel really isolating. It's usually less about just having a title and more about wanting genuine connection — someone to talk to, share small things with, and feel understood by.

Has this been hitting you especially hard recently, or is there someone specific you've been thinking about?`,
      `That desire for companionship makes complete sense. In college, seeing couples everywhere can make you feel like you are missing out on an entire part of life.

Do you feel more lonely in general, or is it specifically that you want someone special to connect with?`,
      `Wanting a relationship is completely natural, but it gets tough when it turns into feeling like you aren't enough on your own. What kind of connection are you hoping to find?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. HINGLISH: CANNOT STUDY / PROCRASTINATION ("padhai nahi ho rahi")
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'CANNOT_STUDY') {
    return tryCandidates([
      `Padhai me man na lagna bohot normal hai, especially jab dimag pehle se hi thaka hua ho. Jab hum khud ko force karte hain, to kitabon ke samne baithkar bhi kuch absorb nahi hota.

Filhaal ke liye book band karo aur 10 minute ka real break lo — bina phone scroll kiye. Aaj ke din sabse zaruri topic kaun sa hai jo bas finish karna hai?`,
      `Jab syllabus ka burden bohot bada lagta hai, tab dimag freeze ho jata hai aur padhai shuru hi nahi hoti. Poori book mat dekho abhi. Bas agle 15 minute ke liye ek chhota sa page ya summary dekhne ka try kar sakte ho?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. HINGLISH: FEAR OF FAILURE / BACKLOGS ("fail ho jaunga", "marks nahi aa rahe")
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'FEAR_OF_FAILURE') {
    return tryCandidates([
      `Fail hone ka ya backlog ka darr bohot bhari hota hai, samajh sakta hu. Hamare education system me marks ko hi sab kuch bana diya jata hai, isliye lagta hai ki agar paper kharab gaya to sab khatam ho jayega.

Lekin ek exam tumhari poori worth decide nahi karta. Abhi ke time me ground reality kya hai — exam kab hai aur kitna syllabus bacha hai?`,
      `Paper kharab hone ka darr hume pehle se hi thaka deta hai. Panic me padhai aur mushkil ho jati hai. Chalo calm hokar dekhte hain: pass hone ke liye minimum kaun se chapters sabse important hain?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. HINGLISH: GENERAL OVERWHELM ("kuch samajh nahi aa raha", "bohot tension hai")
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'OVERWHELMED_GENERAL') {
    return tryCandidates([
      `Jab har taraf se cheezein pile up hoti hain, to dimag me fog aa jata hai aur kuch samajh nahi aata. Aise me sab solve karne ki koshish mat karo.

Thoda sa pani piyo aur deep breath lo. Sabse pehli cheez kya hai jo dimag me ghoom rahi hai?`,
      `Itna zyada load ek saath lene se koi bhi exhaust ho jayega. Koi jaldbazi nahi hai, aaram se batao — college ki vajah se tension hai ya ghar aur personal life me kuch chal raha hai?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. QUESTION-ANSWER TRACKING FOR PREVIOUS QUESTIONS
  // ──────────────────────────────────────────────────────────────────────────

  // Did Sukhi ask: "What specific deadline or subject is taking up the most mental space for you right now?"
  if (lastSukhiLower.includes('specific deadline or subject') || lastSukhiLower.includes('which specific subject')) {
    if (lower.includes('math')) {
      return tryCandidates([
        `Math anxiety is completely real. When formulas and problem sets aren't clicking, it easily creates a block in your mind.

What part of math is causing the issue — is it understanding the concepts, lack of practice, or an upcoming exam date?`,
        `Math can feel brutal when you fall behind even a couple of lectures. What specific topic are you dealing with in math right now?`
      ]);
    }
    if (lower.includes('exam') || lower.includes('test') || lower.includes('paper')) {
      return tryCandidates([
        `Exam deadlines create constant low-level panic until the paper is over. When is this exam scheduled, and how much of the syllabus do you feel confident about so far?`,
        `Preparing for an upcoming paper is stressful. Let's look at it practically: which topics carry the highest weightage that you could focus on first?`
      ]);
    }
  }

  // Did Sukhi ask about comparisons or relatives?
  if (lastSukhiLower.includes('compare') || lastSukhiLower.includes('relatives')) {
    if (lower.includes('compar') || lower.includes('cousin') || lower.includes('relative') || lower.includes('sharma') || lower.includes('yes') || lower.includes('yeah')) {
      return tryCandidates([
        `Being constantly compared to cousins or toppers is unfair and exhausting. It sends a message that your effort doesn't count unless it beats someone else.

Remember that you are studying to build your own life, not to win a family trophy. When these comparisons happen at home, do you usually stay quiet, or does it turn into an argument?`,
        `Comparisons are toxic, especially when family members do it without realizing the damage. Your cousins have different strengths and different lives. How do you usually deal with hearing those comparisons?`
      ]);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. PARENTAL PRESSURE & FAMILY
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'PARENTAL_PRESSURE') {
    return tryCandidates([
      `Parental expectations can feel like an immense weight. In many families, parents tie their pride and sacrifices directly to academic marks, which makes you feel like you are carrying their entire happiness on your shoulders.

Do they openly pressure you about specific marks and ranks, or is it more of an unspoken disappointment you constantly feel around the house?`,
      `Dealing with pressure from parents is exhausting because you care about them, but their expectations leave no room for your own mental peace.

Have you ever tried expressing how stressed you feel, or does communication at home shut down quickly?`,
      `Remember that you are a human being with your own limits, not a machine designed to produce exam scores for others. What is the hardest part about dealing with family expectations for you right now?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 9. DEFLECTION ("but im okay", "im fine")
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'DEFLECTION') {
    return tryCandidates([
      `Saying "I'm okay" is a common habit when explaining things feels like too much work. If you truly are doing fine right now, that's good. But if you just need a place to vent without having to put on a brave face, you can speak freely here.

What has been on your mind today?`,
      `It is completely fine if you don't feel like diving deep right now. Just know you don't have to pretend everything is sorted here. How has your day felt overall?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 10. SHORT VENTING ("ugh", "sigh")
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'VENTING_EXHAUSTION') {
    return tryCandidates([
      `That sigh says you are running on empty right now. You don't have to explain in full sentences. What is the most draining thing on your mind today?`,
      `Sounds like you are just completely fed up or overwhelmed with things. What happened today that pushed you to this point?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 11. CONFUSION ("what", "huh")
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'CONFUSION') {
    return tryCandidates([
      `Let me keep it simple and direct. Tell me what's actually going on with you in your own words — I'm listening.`,
      `No complications here. What's on your mind right now?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 12. AFFIRMATIONS ("yes", "ok")
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'AFFIRMATION') {
    if (lastSukhiLower.includes('exam') || lastSukhiLower.includes('math') || lastSukhiLower.includes('subject')) {
      return tryCandidates([
        `Understood. Breaking the work into one small piece for the next hour can make things a lot more manageable. What is one specific question or topic you could review right now?`,
        `One step at a time. What is the single nearest deadline you have to meet?`
      ]);
    }
    return tryCandidates([
      `I'm listening. What else has been going on?`,
      `Take your time. What is the next thing on your mind?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 13. ACADEMIC STRESS GENERAL
  // ──────────────────────────────────────────────────────────────────────────
  if (currentIntent === 'ACADEMIC_STRESS' || roomTopic.toLowerCase().includes('academic')) {
    return tryCandidates([
      `Academic pressure can feel constant, especially when lectures, assignments, and exams all hit at the same time.

Which part feels the heaviest right now — an upcoming test, pending assignments, or feeling behind on syllabus?`,
      `When academic workload piles up, it feels impossible to relax even when you take a break. What is the most urgent thing you need to get done this week?`,
      `Balancing college expectations with your own energy is tough. What subject or project has been draining you the most recently?`
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 14. GENERAL FALLBACK (Clean, natural, zero corny language)
  // ──────────────────────────────────────────────────────────────────────────
  const snippet = text.length > 50 ? `${text.slice(0, 50)}...` : text;
  return tryCandidates([
    `I hear you regarding "${snippet}". What has been the most frustrating part about that for you?`,
    `Tell me a bit more about "${snippet}" — what is currently happening with that?`,
    `Thank you for sharing that. What would feel most helpful for you to talk through right now?`
  ]);
}

/* =====================================================================
   MAIN SUKHI AI RESPONSE PIPELINE
   Priority 1: Groq LLM (llama-3.3-70b-versatile, ~300ms)
   Priority 2: Kibou Context & Hinglish Engine (Instant, clean tone)
   ===================================================================== */

export async function getSukhiResponse(userMessage, conversationHistory = [], roomTopic = '') {
  // 1. Crisis Check
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

  // 2. Groq LLM (Llama 3.3 70B)
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
            temperature: 0.65,
            max_tokens: 400,
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

  // 3. Kibou Context & Hinglish Engine (Instant, natural, zero corny words)
  const contextualReply = generateContextualLocalResponse(userMessage, conversationHistory, roomTopic);
  return {
    content: contextualReply,
    isCrisis: false
  };
}
