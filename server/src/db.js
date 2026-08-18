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
      country: 'US',
      name: '988 Suicide and Crisis Lifeline',
      number: '988',
      type: 'Call or Text',
      available: '24/7'
    },
    {
      country: 'US',
      name: 'Crisis Text Line',
      number: '741741',
      type: 'Text HOME to 741741',
      available: '24/7'
    },
    {
      country: 'IN',
      name: 'Tele-MANAS (Govt of India)',
      number: '14416',
      type: 'Toll-free Call',
      available: '24/7'
    },
    {
      country: 'IN',
      name: 'KIRAN Helpline',
      number: '1800-599-0019',
      type: 'Toll-free Call',
      available: '24/7'
    },
    {
      country: 'UK',
      name: 'Samaritans UK',
      number: '116 123',
      type: 'Call',
      available: '24/7'
    },
    {
      country: 'GLOBAL',
      name: 'Befrienders Worldwide',
      number: 'https://www.befrienders.org',
      type: 'Online Directory',
      available: '24/7'
    }
  ]
};

// ─── Mongoose Models (for Cloud MongoDB persistence on Render) ───
let isMongoConnected = false;

const SessionSchema = new mongoose.Schema({
  session_id: { type: String, unique: true, index: true },
  user_hash: String,
  user_role: String,
  alias: String,
  is_anonymous: Boolean,
  is_available: Boolean,
  is_banned: Boolean,
  ban_reason: String,
  topics: [String],
  ip_address: String,
  created_at: String,
  last_activity: String
}, { strict: false });

const ConversationSchema = new mongoose.Schema({
  conversation_id: { type: String, unique: true, index: true },
  seeker_session_id: String,
  seeker_alias: String,
  seeker_ip: String,
  helper_session_id: String,
  helper_alias: String,
  helper_ip: String,
  topic: String,
  initial_prompt: String,
  status: String,
  is_crisis_flagged: Boolean,
  is_escalated: Boolean,
  crisis_keywords: [String],
  created_at: String,
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
  created_at: String
}, { strict: false });

const ReportSchema = new mongoose.Schema({
  report_id: { type: String, unique: true, index: true },
  conversation_id: String,
  reporter_session_id: String,
  reporter_role: String,
  reporter_ip: String,
  reason: String,
  description: String,
  status: String,
  admin_notes: String,
  action_taken: String,
  created_at: String,
  reviewed_at: String
}, { strict: false });

const AdminChatSchema = new mongoose.Schema({
  chat_id: { type: String, unique: true, index: true },
  student_session_id: String,
  student_alias: String,
  topic: String,
  initial_message: String,
  status: String,
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
  email: { type: String, unique: true },
  name: String,
  password_hash: String,
  role: String,
  totp_secret: String,
  backup_2fa_code: String,
  is_active: Boolean,
  created_at: String
}, { strict: false });

const BannedIPSchema = new mongoose.Schema({
  ip: { type: String, unique: true },
  reason: String,
  banned_at: String,
  banned_by: String
}, { strict: false });

const AuditLogSchema = new mongoose.Schema({
  log_id: { type: String, unique: true },
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
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
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

  // Ensure default Counselor Account exists
  const existingAdmin = db.admin_users?.find((u) => u.email === 'counselor@school.edu');
  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('AdminPass123!', salt);
    const secret = speakeasy.generateSecret({ length: 20, name: 'Seeker Admin' });

    const adminUser = {
      admin_id: uuidv4(),
      email: 'counselor@school.edu',
      name: 'Campus Counselor',
      password_hash: passwordHash,
      role: 'counselor',
      totp_secret: secret.base32,
      backup_2fa_code: '123456',
      is_active: true,
      created_at: new Date().toISOString()
    };

    if (!db.admin_users) db.admin_users = [];
    db.admin_users.push(adminUser);
    saveDatabase();

    if (isMongoConnected && Models.AdminUser) {
      Models.AdminUser.updateOne({ email: adminUser.email }, adminUser, { upsert: true }).catch((e) =>
        console.error('Mongo Admin save error:', e.message)
      );
    }
  }

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

export function saveDatabase() {
  // 1. Save to local JSON backup
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving local JSON DB:', err.message);
  }
}

export const getDb = () => db;

export const findSessionById = (id) => db.sessions.find((s) => s.session_id === id);

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
