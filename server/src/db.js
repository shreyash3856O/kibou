import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'seeker_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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

export async function initializeDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const fileData = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(fileData);
    } catch (err) {
      console.error('Error reading DB:', err.message);
    }
  }

  // Ensure Admin User exists
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
  }

  if (!db.banned_ips) db.banned_ips = [];
}

export function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving DB:', err.message);
  }
}

export const getDb = () => db;

export const findSessionById = (id) => db.sessions.find((s) => s.session_id === id);

export const saveSession = (session) => {
  const index = db.sessions.findIndex((s) => s.session_id === session.session_id);
  if (index >= 0) {
    db.sessions[index] = { ...db.sessions[index], ...session, last_activity: new Date().toISOString() };
  } else {
    db.sessions.push({ ...session, created_at: new Date().toISOString(), last_activity: new Date().toISOString() });
  }
  saveDatabase();
  return session;
};

export const findConversationById = (id) => db.conversations.find((c) => c.conversation_id === id);

export const saveConversation = (conversation) => {
  const index = db.conversations.findIndex((c) => c.conversation_id === conversation.conversation_id);
  if (index >= 0) {
    db.conversations[index] = { ...db.conversations[index], ...conversation };
  } else {
    db.conversations.push({ ...conversation, created_at: conversation.created_at || new Date().toISOString() });
  }
  saveDatabase();
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
  return log;
};
