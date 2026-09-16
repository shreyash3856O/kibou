import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'seeker_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Global In-Memory Store for Ultra-Fast WebSocket and API queries
let db = {
  sessions: [],
  conversations: [],
  messages: [],
  reports: [],
  admin_chats: [],
  admin_chat_messages: [],
  admin_users: [],
  banned_ips: [],
  audit_logs: [],
  hotlines: [
    {
      country: 'IN',
      name: 'Shreyash Chaturvedi (Your Friendly Helper)',
      number: '7304167033',
      type: 'Direct Call / WhatsApp Support',
      available: '24/7'
    },
    {
      country: 'IN',
      name: 'Tele-MANAS (Govt of India Lifeline)',
      number: '14416',
      type: 'Toll-free Call (24x7)',
      available: '24/7'
    },
    {
      country: 'IN',
      name: 'KIRAN Helpline (Govt of India)',
      number: '1800-599-0019',
      type: 'Toll-free Call',
      available: '24/7'
    },
    {
      country: 'IN',
      name: 'Vandrevala Foundation',
      number: '+91 9999 666 555',
      type: 'Call / WhatsApp Helpline',
      available: '24/7'
    },
    {
      country: 'IN',
      name: 'AASRA Suicide Prevention & Crisis',
      number: '+91 98204 66726',
      type: '24/7 Helpline Call',
      available: '24/7'
    },
    {
      country: 'IN',
      name: 'NIMHANS Psychosocial Helpline',
      number: '080-46110007',
      type: 'National Mental Health Helpline',
      available: '24/7'
    },
    {
      country: 'IN',
      name: 'iCall Helpline (TISS)',
      number: '9152987821',
      type: 'Psychosocial Support',
      available: 'Mon-Sat 10am - 8pm'
    }
  ]
};

// ─── Mongoose Models (for Cloud MongoDB persistence on Render) ───
let isMongoConnected = false;

const SessionSchema = new mongoose.Schema({
  session_id: { type: String, unique: true, index: true },
  user_hash: String,
  user_role: { type: String, index: true },
  alias: String,
  is_anonymous: Boolean,
  is_available: { type: Boolean, index: true },
  is_banned: { type: Boolean, index: true },
  ban_reason: String,
  topics: [String],
  ip_address: String,
  created_at: String,
  last_activity: String
}, { strict: false });

const ConversationSchema = new mongoose.Schema({
  conversation_id: { type: String, unique: true, index: true },
  seeker_session_id: { type: String, index: true },
  seeker_alias: String,
  seeker_ip: String,
  helper_session_id: { type: String, index: true },
  helper_alias: String,
  helper_ip: String,
  topic: String,
  initial_prompt: String,
  status: { type: String, index: true },
  is_crisis_flagged: Boolean,
  is_escalated: Boolean,
  crisis_keywords: [String],
  created_at: { type: String, index: true },
  matched_at: String,
  ended_at: String,
  ended_by: String
}, { strict: false });

const MessageSchema = new mongoose.Schema({
  message_id: { type: String, unique: true, index: true },
  conversation_id: { type: String, index: true },
  sender_session_id: String,
  sender_alias: String,
  sender_role: String,
  content_encrypted: String,
  is_crisis_keyword_detected: Boolean,
  created_at: { type: String, index: true }
}, { strict: false });

const ReportSchema = new mongoose.Schema({
  report_id: { type: String, unique: true, index: true },
  conversation_id: { type: String, index: true },
  reporter_session_id: String,
  reporter_role: String,
  reporter_ip: String,
  reason: String,
  description: String,
  status: { type: String, index: true },
  admin_notes: String,
  action_taken: String,
  created_at: String,
  reviewed_at: String
}, { strict: false });

const AdminChatSchema = new mongoose.Schema({
  chat_id: { type: String, unique: true, index: true },
  student_session_id: { type: String, index: true },
  student_alias: String,
  topic: String,
  initial_message: String,
  status: { type: String, index: true },
  is_crisis: Boolean,
  created_at: String
}, { strict: false });

const AdminChatMessageSchema = new mongoose.Schema({
  message_id: { type: String, unique: true, index: true },
  chat_id: { type: String, index: true },
  sender_type: String,
  sender_id: String,
  sender_name: String,
  content: String,
  created_at: String
}, { strict: false });

const AdminUserSchema = new mongoose.Schema({
  admin_id: { type: String, unique: true, index: true },
  uid: { type: String, index: true },
  email: { type: String, index: true },
  name: String,
  password_hash: String,
  role: String,
  totp_secret: String,
  backup_2fa_code: String,
  is_active: Boolean,
  created_at: String
}, { strict: false });

const BannedIPSchema = new mongoose.Schema({
  ip: { type: String, unique: true, index: true },
  reason: String,
  banned_at: String,
  banned_by: String
}, { strict: false });

const AuditLogSchema = new mongoose.Schema({
  log_id: { type: String, unique: true, index: true },
  admin_id: String,
  action: String,
  target_id: String,
  details: mongoose.Schema.Types.Mixed,
  timestamp: String
}, { strict: false });

let Models = {};

export async function initializeDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri) {
    try {
      console.log('🔄 Connecting to MongoDB database...');
      await mongoose.connect(mongoUri, { 
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 50,
        minPoolSize: 5
      });
      isMongoConnected = true;
      console.log('✅ Connected to MongoDB cloud database successfully.');

      Models = {
        Session: mongoose.models.Session || mongoose.model('Session', SessionSchema),
        Conversation: mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema),
        Message: mongoose.models.Message || mongoose.model('Message', MessageSchema),
        Report: mongoose.models.Report || mongoose.model('Report', ReportSchema),
        AdminChat: mongoose.models.AdminChat || mongoose.model('AdminChat', AdminChatSchema),
        AdminChatMessage: mongoose.models.AdminChatMessage || mongoose.model('AdminChatMessage', AdminChatMessageSchema),
        AdminUser: mongoose.models.AdminUser || mongoose.model('AdminUser', AdminUserSchema),
        BannedIP: mongoose.models.BannedIP || mongoose.model('BannedIP', BannedIPSchema),
        AuditLog: mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema)
      };

      // Load collections into memory
      const [sessions, conversations, messages, reports, adminChats, adminChatMessages, adminUsers, bannedIps, auditLogs] =
        await Promise.all([
          Models.Session.find({}).lean(),
          Models.Conversation.find({}).lean(),
          Models.Message.find({}).lean(),
          Models.Report.find({}).lean(),
          Models.AdminChat.find({}).lean(),
          Models.AdminChatMessage.find({}).lean(),
          Models.AdminUser.find({}).lean(),
          Models.BannedIP.find({}).lean(),
          Models.AuditLog.find({}).lean()
        ]);

      db.sessions = sessions || [];
      db.conversations = conversations || [];
      db.messages = messages || [];
      db.reports = reports || [];
      db.admin_chats = adminChats || [];
      db.admin_chat_messages = adminChatMessages || [];
      db.admin_users = adminUsers || [];
      db.banned_ips = (bannedIps || []).map((b) => b.ip || b);
      db.audit_logs = auditLogs || [];
    } catch (err) {
      console.error('⚠️ MongoDB connection failed:', err.message);
      console.log('🔄 Falling back to local JSON database storage.');
      loadLocalJson();
    }
  } else {
    console.log('ℹ️ No MONGODB_URI found. Using local JSON database (Set MONGODB_URI on Render or .env for cloud persistence).');
    loadLocalJson();
  }

  // Ensure Counselor Account exists with UID: shreyyay and Password: 100
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('100', salt);
  const secret = speakeasy.generateSecret({ length: 20, name: 'Kibou Admin' });

  const adminUser = {
    admin_id: 'admin_shreyyay',
    uid: 'shreyyay',
    email: 'shreyyay',
    name: 'Shreyash (Counselor)',
    password_hash: passwordHash,
    role: 'counselor',
    totp_secret: secret.base32,
    backup_2fa_code: '100',
    is_active: true,
    created_at: new Date().toISOString()
  };

  if (!db.admin_users) db.admin_users = [];
  const existingIndex = db.admin_users.findIndex((u) => u.uid === 'shreyyay' || u.email === 'shreyyay' || u.email === 'counselor@school.edu');
  if (existingIndex >= 0) {
    db.admin_users[existingIndex] = { ...db.admin_users[existingIndex], ...adminUser };
  } else {
    db.admin_users.push(adminUser);
  }
  saveDatabase();

  if (isMongoConnected && Models.AdminUser) {
    Models.AdminUser.updateOne({ uid: 'shreyyay' }, adminUser, { upsert: true }).catch((e) =>
      console.error('Mongo Admin save error:', e.message)
    );
  }

  // Ensure Sukhi AI Helper is registered as an available 24/7 companion
  const sukhiSession = {
    session_id: 'sukhi_ai_helper',
    user_role: 'helper',
    alias: 'Sukhi (AI Companion)',
    ip_address: '127.0.0.1',
    topics: ['General Venting', 'Academic Stress', 'Anxiety & Panic', 'Relationships', 'Mindfulness'],
    is_available: true,
    is_banned: false,
    is_ai: true,
    created_at: new Date().toISOString()
  };
  saveSession(sukhiSession);

  if (!db.banned_ips) db.banned_ips = [];
}

function loadLocalJson() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const fileData = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(fileData);
      db = { ...db, ...parsed };
    } catch (err) {
      console.error('Error reading local JSON DB:', err.message);
    }
  }
}

// Debounced, non-blocking asynchronous file writing so 100s of users don't freeze event loop
let isSaving = false;
let needsSaveAgain = false;
let saveDebounceTimer = null;

async function flushDatabaseToDisk() {
  if (isSaving) {
    needsSaveAgain = true;
    return;
  }
  isSaving = true;
  try {
    const data = JSON.stringify(db);
    await fs.promises.writeFile(DB_FILE, data, 'utf8');
  } catch (err) {
    console.error('Error saving local JSON DB:', err.message);
  } finally {
    isSaving = false;
    if (needsSaveAgain) {
      needsSaveAgain = false;
      flushDatabaseToDisk();
    }
  }
}

export function saveDatabase() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(flushDatabaseToDisk, 300);
}

export const getDb = () => db;

export const findSessionById = (id) => {
  if (!id) return null;
  return db.sessions.find((s) => s.session_id === id);
};

export const findOrRecoverSession = async (session_id, fallbackRole = 'seeker', fallbackAlias = 'Anonymous') => {
  if (!session_id) return null;
  let session = db.sessions.find((s) => s.session_id === session_id);
  if (session) return session;

  if (isMongoConnected && Models.Session) {
    try {
      const mongoSession = await Models.Session.findOne({ session_id }).lean();
      if (mongoSession) {
        db.sessions.push(mongoSession);
        return mongoSession;
      }
    } catch (e) {
      console.error('Mongo session lookup error:', e.message);
    }
  }

  // Auto-heal / reconstruct session if not found so high concurrency / server reboot never throws 404
  const recoveredSession = {
    session_id,
    user_role: fallbackRole,
    alias: fallbackAlias,
    is_available: fallbackRole === 'helper',
    is_banned: false,
    created_at: new Date().toISOString(),
    last_activity: new Date().toISOString()
  };
  saveSession(recoveredSession);
  return recoveredSession;
};

export const saveSession = (session) => {
  const index = db.sessions.findIndex((s) => s.session_id === session.session_id);
  const updatedSession = {
    ...session,
    last_activity: new Date().toISOString(),
    created_at: session.created_at || new Date().toISOString()
  };

  if (index >= 0) {
    db.sessions[index] = { ...db.sessions[index], ...updatedSession };
  } else {
    db.sessions.push(updatedSession);
  }
  saveDatabase();

  if (isMongoConnected && Models.Session) {
    Models.Session.updateOne({ session_id: updatedSession.session_id }, updatedSession, { upsert: true }).catch((e) =>
      console.error('Mongo session sync error:', e.message)
    );
  }

  return updatedSession;
};

export const findConversationById = (id) => db.conversations.find((c) => c.conversation_id === id);

export const saveConversation = (conversation) => {
  const index = db.conversations.findIndex((c) => c.conversation_id === conversation.conversation_id);
  const updatedConv = {
    ...conversation,
    created_at: conversation.created_at || new Date().toISOString()
  };

  if (index >= 0) {
    db.conversations[index] = { ...db.conversations[index], ...updatedConv };
  } else {
    db.conversations.push(updatedConv);
  }
  saveDatabase();

  if (isMongoConnected && Models.Conversation) {
    Models.Conversation.updateOne({ conversation_id: updatedConv.conversation_id }, updatedConv, { upsert: true }).catch((e) =>
      console.error('Mongo conversation sync error:', e.message)
    );
  }

  return db.conversations.find((c) => c.conversation_id === conversation.conversation_id);
};

export const addMessage = (message) => {
  const newMsg = {
    message_id: message.message_id || uuidv4(),
    conversation_id: message.conversation_id,
    sender_session_id: message.sender_session_id,
    sender_alias: message.sender_alias || 'Anonymous',
    sender_role: message.sender_role || 'seeker',
    content_encrypted: message.content_encrypted,
    created_at: new Date().toISOString(),
    is_crisis_keyword_detected: message.is_crisis_keyword_detected || false
  };
  db.messages.push(newMsg);
  saveDatabase();

  if (isMongoConnected && Models.Message) {
    Models.Message.create(newMsg).catch((e) =>
      console.error('Mongo message save error:', e.message)
    );
  }

  return newMsg;
};

export const getMessagesByConversationId = (convId) => {
  return db.messages.filter((m) => m.conversation_id === convId);
};

export const addReport = (report) => {
  const newReport = {
    report_id: report.report_id || uuidv4(),
    conversation_id: report.conversation_id,
    reporter_session_id: report.reporter_session_id,
    reporter_role: report.reporter_role || 'seeker',
    reporter_ip: report.reporter_ip || '',
    reason: report.reason,
    description: report.description || '',
    status: 'pending',
    admin_notes: '',
    action_taken: 'none',
    created_at: new Date().toISOString(),
    reviewed_at: null
  };
  db.reports.push(newReport);
  saveDatabase();

  if (isMongoConnected && Models.Report) {
    Models.Report.create(newReport).catch((e) =>
      console.error('Mongo report save error:', e.message)
    );
  }

  return newReport;
};

export const addAuditLog = (adminId, action, targetId, details) => {
  const log = {
    log_id: uuidv4(),
    admin_id: adminId,
    action,
    target_id: targetId,
    details,
    timestamp: new Date().toISOString()
  };
  if (!db.audit_logs) db.audit_logs = [];
  db.audit_logs.unshift(log);
  saveDatabase();

  if (isMongoConnected && Models.AuditLog) {
    Models.AuditLog.create(log).catch((e) =>
      console.error('Mongo audit log error:', e.message)
    );
  }

  return log;
};
