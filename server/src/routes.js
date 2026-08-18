import express from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  generateAnonymousSession,
  verifyToken,
  encryptMessage,
  decryptMessage,
  detectCrisis,
  requireAdmin
} from './security.js';
import {
  getDb,
  findSessionById,
  saveSession,
  findConversationById,
  saveConversation,
  addMessage,
  getMessagesByConversationId,
  addReport,
  addAuditLog,
  saveDatabase
} from './db.js';

const router = express.Router();

// Helper to get client IP
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
}

// IP Ban check middleware for non-admin routes
router.use((req, res, next) => {
  const ip = getClientIp(req);
  const db = getDb();
  if (db.banned_ips?.includes(ip) && !req.path.startsWith('/auth/admin')) {
    return res.status(403).json({ error: 'Your IP address has been restricted from this service.' });
  }
  next();
});

// ==========================================
// 1. AUTHENTICATION & SESSIONS
// ==========================================

router.post('/auth/anon-session', (req, res) => {
  try {
    const ip = getClientIp(req);
    const { role = 'seeker', alias, topics } = req.body;
    const sessionData = generateAnonymousSession(ip, role, alias);

    const newSession = {
      session_id: sessionData.session_id,
      user_hash: sessionData.user_hash,
      user_role: role,
      alias: sessionData.alias,
      ip_address: ip,
      topics: topics || ['General Support'],
      is_available: role === 'helper',
      is_banned: false
    };

    saveSession(newSession);

    res.json({
      success: true,
      token: sessionData.token,
      session: newSession
    });
  } catch (err) {
    res.status(500).json({ error: 'Session creation failed: ' + err.message });
  }
});

router.get('/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (decoded.user_role === 'admin') {
    const db = getDb();
    const admin = db.admin_users?.find((u) => u.admin_id === decoded.admin_id);
    return res.json({ success: true, role: 'admin', user: admin });
  }

  const session = findSessionById(decoded.session_id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (session.is_banned) {
    return res.status(403).json({ error: 'Session banned', is_banned: true });
  }

  res.json({ success: true, session });
});

router.post('/auth/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDb();
    const admin = db.admin_users?.find((u) => u.email === email?.toLowerCase().trim());

    if (!admin || !admin.is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      success: true,
      require_2fa: true,
      admin_id: admin.admin_id,
      email: admin.email,
      name: admin.name
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

router.post('/auth/admin/2fa/verify', (req, res) => {
  try {
    const { admin_id, code } = req.body;
    const db = getDb();
    const admin = db.admin_users?.find((u) => u.admin_id === admin_id);

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const isTotpValid = speakeasy.totp.verify({
      secret: admin.totp_secret,
      encoding: 'base32',
      token: code,
      window: 4
    });

    const isBackupValid = admin.backup_2fa_code && admin.backup_2fa_code === code?.trim();

    if (!isTotpValid && !isBackupValid) {
      return res.status(400).json({ error: 'Invalid 2FA code' });
    }

    const token = jwt.sign(
      {
        admin_id: admin.admin_id,
        email: admin.email,
        name: admin.name,
        user_role: 'admin',
        role: admin.role
      },
      process.env.JWT_SECRET || 'seeker_secret_key_2026',
      { expiresIn: '8h' }
    );

    addAuditLog(admin.admin_id, 'LOGIN_SUCCESS', admin.admin_id, 'Admin logged in');

    res.json({
      success: true,
      token,
      admin: {
        admin_id: admin.admin_id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: '2FA verification failed: ' + err.message });
  }
});

// ==========================================
// 2. HELPER STATUS
// ==========================================

router.get('/helpers/available', (req, res) => {
  const db = getDb();
  const helpers = (db.sessions || [])
    .filter((s) => s.user_role === 'helper' && s.is_available && !s.is_banned)
    .map((h) => ({
      session_id: h.session_id,
      alias: h.alias,
      topics: h.topics || ['General Support']
    }));

  res.json({ success: true, helpers });
});

router.post('/helpers/status', (req, res) => {
  const { session_id, is_available } = req.body;
  const session = findSessionById(session_id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (typeof is_available === 'boolean') {
    session.is_available = is_available;
    saveSession(session);
  }

  res.json({ success: true, session });
});

// ==========================================
// 3. CONVERSATIONS & MATCHING
// ==========================================

router.post('/conversations/start', (req, res) => {
  try {
    const { seeker_session_id, topic, initial_prompt, helper_session_id } = req.body;

    const seeker = findSessionById(seeker_session_id);
    if (!seeker) {
      return res.status(404).json({ error: 'Seeker session not found' });
    }
    if (seeker.is_banned) {
      return res.status(403).json({ error: 'Account restricted' });
    }

    let helper = null;
    let status = 'waiting';

    if (helper_session_id) {
      helper = findSessionById(helper_session_id);
      if (helper && helper.is_available && !helper.is_banned) {
        status = 'active';
      }
    }

    const crisisCheck = detectCrisis(initial_prompt || '');
    const conversationId = uuidv4();

    const conversation = {
      conversation_id: conversationId,
      seeker_session_id: seeker.session_id,
      seeker_alias: seeker.alias,
      seeker_ip: seeker.ip_address || getClientIp(req),
      helper_session_id: helper ? helper.session_id : null,
      helper_alias: helper ? helper.alias : null,
      helper_ip: helper ? helper.ip_address : null,
      topic: topic || 'General Support',
      initial_prompt: initial_prompt || '',
      status: status,
      matched_at: status === 'active' ? new Date().toISOString() : null,
      ended_at: null,
      is_escalated: false,
      is_crisis_flagged: crisisCheck.isCrisis,
      crisis_keywords: crisisCheck.matchedKeywords,
      created_at: new Date().toISOString()
    };

    saveConversation(conversation);

    if (initial_prompt) {
      addMessage({
        conversation_id: conversationId,
        sender_session_id: seeker.session_id,
        sender_alias: seeker.alias,
        sender_role: 'seeker',
        content_encrypted: encryptMessage(initial_prompt),
        is_crisis_keyword_detected: crisisCheck.isCrisis
      });
    }

    res.json({
      success: true,
      conversation,
      is_crisis_detected: crisisCheck.isCrisis
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start conversation: ' + err.message });
  }
});

router.get('/conversations/waiting', (req, res) => {
  const db = getDb();
  const waiting = (db.conversations || [])
    .filter((c) => c.status === 'waiting')
    .map((c) => ({
      conversation_id: c.conversation_id,
      seeker_alias: c.seeker_alias,
      topic: c.topic,
      initial_prompt: c.initial_prompt,
      created_at: c.created_at,
      is_crisis_flagged: c.is_crisis_flagged
    }));

  res.json({ success: true, waiting });
});

router.post('/conversations/:id/accept', (req, res) => {
  try {
    const { helper_session_id } = req.body;
    const conversation = findConversationById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const helper = findSessionById(helper_session_id);
    if (!helper) {
      return res.status(404).json({ error: 'Helper session not found' });
    }

    conversation.helper_session_id = helper.session_id;
    conversation.helper_alias = helper.alias;
    conversation.helper_ip = helper.ip_address || getClientIp(req);
    conversation.status = 'active';
    conversation.matched_at = new Date().toISOString();

    saveConversation(conversation);

    res.json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ error: 'Accept failed: ' + err.message });
  }
});

router.post('/conversations/:id/end', (req, res) => {
  try {
    const { session_id } = req.body;
    const conversation = findConversationById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    conversation.status = 'ended';
    conversation.ended_at = new Date().toISOString();
    conversation.ended_by = session_id;

    saveConversation(conversation);

    res.json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ error: 'End chat failed: ' + err.message });
  }
});

router.get('/conversations/:id/messages', (req, res) => {
  try {
    const conversation = findConversationById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const rawMessages = getMessagesByConversationId(req.params.id);
    const messages = rawMessages.map((m) => ({
      message_id: m.message_id,
      conversation_id: m.conversation_id,
      sender_session_id: m.sender_session_id,
      sender_alias: m.sender_alias,
      sender_role: m.sender_role,
      content: decryptMessage(m.content_encrypted),
      created_at: m.created_at,
      is_crisis_keyword_detected: m.is_crisis_keyword_detected
    }));

    res.json({
      success: true,
      conversation,
      messages
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages: ' + err.message });
  }
});

router.post('/conversations/:id/rate', (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/conversations/:id/escalate', (req, res) => {
  try {
    const conversation = findConversationById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    conversation.is_escalated = true;
    conversation.is_crisis_flagged = true;
    saveConversation(conversation);

    const db = getDb();
    let adminChat = db.admin_chats?.find((c) => c.student_session_id === conversation.seeker_session_id && !c.resolved);
    if (!adminChat) {
      adminChat = {
        chat_id: uuidv4(),
        student_session_id: conversation.seeker_session_id,
        student_alias: conversation.seeker_alias,
        related_conversation_id: conversation.conversation_id,
        is_crisis: true,
        topic: conversation.topic,
        resolved: false,
        created_at: new Date().toISOString()
      };
      if (!db.admin_chats) db.admin_chats = [];
      db.admin_chats.push(adminChat);
      saveDatabase();
    }

    res.json({ success: true, conversation, admin_chat_id: adminChat.chat_id });
  } catch (err) {
    res.status(500).json({ error: 'Escalation failed: ' + err.message });
  }
});

router.get('/conversations/my-history/:sessionId', (req, res) => {
  const db = getDb();
  const sessionId = req.params.sessionId;
  const history = (db.conversations || [])
    .filter((c) => c.seeker_session_id === sessionId || c.helper_session_id === sessionId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ success: true, conversations: history });
});

// ==========================================
// 4. REPORTS
// ==========================================

router.post('/report', (req, res) => {
  try {
    const ip = getClientIp(req);
    const { conversation_id, reporter_session_id, reporter_role, reason, description } = req.body;
    const report = addReport({
      conversation_id,
      reporter_session_id,
      reporter_role,
      reporter_ip: ip,
      reason: reason || 'safety_concern',
      description: description || ''
    });

    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: 'Report failed: ' + err.message });
  }
});

// ==========================================
// 5. DIRECT COUNSELOR CHATS
// ==========================================

router.post('/admin-chats/start', (req, res) => {
  try {
    const { student_session_id, initial_message } = req.body;
    const student = findSessionById(student_session_id);
    if (!student) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const db = getDb();
    let chat = db.admin_chats?.find((c) => c.student_session_id === student_session_id && !c.resolved);

    if (!chat) {
      chat = {
        chat_id: uuidv4(),
        student_session_id: student.session_id,
        student_alias: student.alias,
        resolved: false,
        created_at: new Date().toISOString()
      };
      if (!db.admin_chats) db.admin_chats = [];
      db.admin_chats.push(chat);
    }

    if (initial_message) {
      if (!db.admin_chat_messages) db.admin_chat_messages = [];
      db.admin_chat_messages.push({
        message_id: uuidv4(),
        chat_id: chat.chat_id,
        sender_type: 'student',
        sender_id: student.session_id,
        sender_name: student.alias,
        content: initial_message,
        created_at: new Date().toISOString()
      });
    }

    saveDatabase();
    res.json({ success: true, chat });
  } catch (err) {
    res.status(500).json({ error: 'Admin chat start failed: ' + err.message });
  }
});

router.get('/admin-chats/:id/messages', (req, res) => {
  const db = getDb();
  const chat = db.admin_chats?.find((c) => c.chat_id === req.params.id);
  if (!chat) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  const messages = (db.admin_chat_messages || []).filter((m) => m.chat_id === req.params.id);
  res.json({ success: true, chat, messages });
});

// ==========================================
// 6. ADMIN MODERATION & IP BAN PANEL
// ==========================================

router.get('/admin/reports', requireAdmin, (req, res) => {
  const db = getDb();
  const reports = (db.reports || []).map((r) => {
    const conv = findConversationById(r.conversation_id);
    return {
      ...r,
      conversation_topic: conv ? conv.topic : 'N/A',
      seeker_alias: conv ? conv.seeker_alias : 'N/A',
      seeker_ip: conv ? conv.seeker_ip : 'N/A',
      helper_alias: conv ? conv.helper_alias : 'N/A',
      helper_ip: conv ? conv.helper_ip : 'N/A'
    };
  });

  res.json({ success: true, reports });
});

router.get('/admin/reports/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const report = db.reports?.find((r) => r.report_id === req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  const conversation = findConversationById(report.conversation_id);
  const rawMessages = conversation ? getMessagesByConversationId(conversation.conversation_id) : [];
  const messages = rawMessages.map((m) => ({
    message_id: m.message_id,
    sender_session_id: m.sender_session_id,
    sender_alias: m.sender_alias,
    sender_role: m.sender_role,
    content: decryptMessage(m.content_encrypted),
    created_at: m.created_at,
    is_crisis_keyword_detected: m.is_crisis_keyword_detected
  }));

  res.json({
    success: true,
    report,
    conversation,
    messages
  });
});

router.post('/admin/reports/:id/action', requireAdmin, (req, res) => {
  try {
    const { action, notes, target_session_id, target_ip } = req.body;
    const db = getDb();
    const report = db.reports?.find((r) => r.report_id === req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    report.status = action === 'dismiss' ? 'dismissed' : 'action_taken';
    report.action_taken = action;
    report.admin_notes = notes || '';
    report.reviewed_at = new Date().toISOString();
    report.reviewed_by = req.admin.email;

    if (action === 'ban_user') {
      if (target_session_id) {
        const session = findSessionById(target_session_id);
        if (session) session.is_banned = true;
      }
      if (target_ip) {
        if (!db.banned_ips) db.banned_ips = [];
        if (!db.banned_ips.includes(target_ip)) {
          db.banned_ips.push(target_ip);
        }
      }
      addAuditLog(req.admin.admin_id, 'BAN_USER', target_session_id || target_ip, `Banned via report ${report.report_id}`);
    }

    saveDatabase();
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: 'Action failed: ' + err.message });
  }
});

router.get('/admin/chats', requireAdmin, (req, res) => {
  const db = getDb();
  res.json({ success: true, chats: db.admin_chats || [] });
});

router.get('/admin/users', requireAdmin, (req, res) => {
  const db = getDb();
  res.json({
    success: true,
    sessions: db.sessions || [],
    banned_ips: db.banned_ips || []
  });
});

router.post('/admin/ban-ip', requireAdmin, (req, res) => {
  const { ip, reason } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });

  const db = getDb();
  if (!db.banned_ips) db.banned_ips = [];
  if (!db.banned_ips.includes(ip)) {
    db.banned_ips.push(ip);
    addAuditLog(req.admin.admin_id, 'BAN_IP', ip, reason || 'Manual IP ban');
    saveDatabase();
  }

  res.json({ success: true, message: `Banned IP: ${ip}`, banned_ips: db.banned_ips });
});

router.post('/admin/unban-ip', requireAdmin, (req, res) => {
  const { ip } = req.body;
  const db = getDb();
  if (db.banned_ips) {
    db.banned_ips = db.banned_ips.filter((item) => item !== ip);
    addAuditLog(req.admin.admin_id, 'UNBAN_IP', ip, 'Manual IP unban');
    saveDatabase();
  }

  res.json({ success: true, message: `Unbanned IP: ${ip}`, banned_ips: db.banned_ips });
});

router.post('/admin/users/:sessionId/ban', requireAdmin, (req, res) => {
  const session = findSessionById(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  session.is_banned = true;
  saveSession(session);
  addAuditLog(req.admin.admin_id, 'BAN_SESSION', session.session_id, 'Manual session ban');

  res.json({ success: true, session });
});

router.post('/admin/users/:sessionId/unban', requireAdmin, (req, res) => {
  const session = findSessionById(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  session.is_banned = false;
  saveSession(session);
  addAuditLog(req.admin.admin_id, 'UNBAN_SESSION', session.session_id, 'Manual session unban');

  res.json({ success: true, session });
});

router.get('/admin/audit-logs', requireAdmin, (req, res) => {
  const db = getDb();
  res.json({ success: true, audit_logs: db.audit_logs || [] });
});

router.get('/hotlines', (req, res) => {
  const db = getDb();
  res.json({ success: true, hotlines: db.hotlines || [] });
});

export default router;
