import { encryptMessage, decryptMessage, detectCrisis } from './security.js';
import {
  findConversationById,
  saveConversation,
  addMessage,
  findSessionById,
  getDb,
  saveDatabase
} from './db.js';
import { v4 as uuidv4 } from 'uuid';

// Session to socket mapping for direct targeting
const userSockets = new Map(); // session_id -> Set<socket_id>

export function setupSocketIO(io) {
  io.on('connection', (socket) => {
    let currentSessionId = null;

    // Register active user session
    socket.on('register_session', ({ session_id, role, alias }) => {
      if (!session_id) return;
      currentSessionId = session_id;
      socket.session_id = session_id;
      socket.user_role = role;
      socket.alias = alias;

      if (!userSockets.has(session_id)) {
        userSockets.set(session_id, new Set());
      }
      userSockets.get(session_id).add(socket.id);

      // If helper, join helpers room for instant broadcast alerts
      if (role === 'helper') {
        socket.join('helpers_channel');
      }

      // Check if this user has any active conversation to auto-join
      const db = getDb();
      const activeConv = (db.conversations || []).find(
        (c) => (c.seeker_session_id === session_id || c.helper_session_id === session_id) && c.status === 'active'
      );
      if (activeConv) {
        socket.join(`conv-${activeConv.conversation_id}`);
      }
    });

    // Join conversation room
    socket.on('join_conversation', ({ conversation_id, session_id, alias }) => {
      if (!conversation_id) return;
      const room = `conv-${conversation_id}`;
      socket.join(room);

      const conv = findConversationById(conversation_id);
      if (conv) {
        io.to(room).emit('peer_status', {
          status: 'online',
          alias: alias || 'Peer',
          session_id,
          conversation_id
        });
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', ({ conversation_id, session_id, alias }) => {
      if (!conversation_id) return;
      const room = `conv-${conversation_id}`;
      socket.leave(room);
      socket.to(room).emit('peer_status', {
        status: 'left',
        alias: alias || 'Peer',
        session_id,
        conversation_id
      });
    });

    // Seeker requests queue entry
    socket.on('seeker_queue_enter', ({ conversation_id, topic, initial_prompt, seeker_alias }) => {
      socket.join(`conv-${conversation_id}`);
      // Broadcast to all online helpers immediately
      io.to('helpers_channel').emit('new_seeker_in_queue', {
        conversation_id,
        topic,
        initial_prompt,
        seeker_alias,
        created_at: new Date().toISOString()
      });
      io.emit('queue_updated');
    });

    // Helper accepts seeker match
    socket.on('helper_accepted_match', ({ conversation_id, helper_session_id, helper_alias }) => {
      const room = `conv-${conversation_id}`;
      socket.join(room);

      const conv = findConversationById(conversation_id);
      if (conv) {
        conv.helper_session_id = helper_session_id;
        conv.helper_alias = helper_alias;
        conv.status = 'active';
        conv.matched_at = new Date().toISOString();
        saveConversation(conv);

        // Notify both parties in the room immediately
        io.to(room).emit('conversation_matched', {
          conversation: conv,
          message: 'Connected with your peer helper.'
        });

        // Broadcast to helper channel to remove from queue
        io.to('helpers_channel').emit('queue_item_claimed', { conversation_id });
        io.emit('queue_updated');
      }
    });

    // Handle sending chat message
    socket.on('send_message', async (data, callback) => {
      try {
        const { conversation_id, sender_session_id, sender_alias, sender_role, content } = data;
        if (!content || !content.trim()) return;

        const conv = findConversationById(conversation_id);
        if (!conv) {
          if (callback) callback({ error: 'Conversation not found' });
          return;
        }

        // Real-time crisis detection scan
        const crisisCheck = detectCrisis(content);
        const encrypted = encryptMessage(content);

        const newMsg = addMessage({
          conversation_id,
          sender_session_id,
          sender_alias: sender_alias || 'Anonymous',
          sender_role: sender_role || 'seeker',
          content_encrypted: encrypted,
          is_crisis_keyword_detected: crisisCheck.isCrisis
        });

        const payload = {
          message_id: newMsg.message_id,
          conversation_id,
          sender_session_id,
          sender_alias: sender_alias || 'Anonymous',
          sender_role: sender_role || 'seeker',
          content: content,
          created_at: newMsg.created_at,
          is_crisis_keyword_detected: crisisCheck.isCrisis
        };

        const room = `conv-${conversation_id}`;
        io.to(room).emit('new_message', payload);

        // If crisis detected, broadcast safety hotlines & flag counselor channel
        if (crisisCheck.isCrisis) {
          conv.is_crisis_flagged = true;
          conv.crisis_keywords = Array.from(
            new Set([...(conv.crisis_keywords || []), ...crisisCheck.matchedKeywords])
          );
          saveConversation(conv);

          io.to(room).emit('crisis_detected', {
            type: 'CRISIS_DETECTED',
            matched_keywords: crisisCheck.matchedKeywords,
            message: 'Crisis support is available 24/7. Call or text 988 (Lifeline) or text HOME to 741741.',
            guidance_for_helper: 'The seeker may be in crisis. Listen without judgment, remind them of your peer limits, and offer to escalate to campus counselors.',
            conversation_id
          });

          io.to('admin_channel').emit('admin_crisis_alert', {
            alert_id: uuidv4(),
            type: 'CRISIS_KEYWORD_FLAG',
            conversation_id,
            seeker_alias: conv.seeker_alias,
            helper_alias: conv.helper_alias,
            topic: conv.topic,
            matched_keywords: crisisCheck.matchedKeywords,
            snippet: content.substring(0, 100),
            timestamp: new Date().toISOString()
          });
        }

        if (callback) callback({ success: true, message: payload });
      } catch (err) {
        console.error('Socket send_message error:', err);
        if (callback) callback({ error: err.message });
      }
    });

    // Typing indicators
    socket.on('typing_start', ({ conversation_id, sender_alias, sender_role }) => {
      socket.to(`conv-${conversation_id}`).emit('user_typing', {
        isTyping: true,
        sender_alias,
        sender_role
      });
    });

    socket.on('typing_stop', ({ conversation_id }) => {
      socket.to(`conv-${conversation_id}`).emit('user_typing', {
        isTyping: false
      });
    });

    // End chat notification
    socket.on('end_conversation', ({ conversation_id, ended_by }) => {
      const conv = findConversationById(conversation_id);
      if (conv) {
        conv.status = 'ended';
        conv.ended_at = new Date().toISOString();
        conv.ended_by = ended_by;
        saveConversation(conv);

        const room = `conv-${conversation_id}`;
        io.to(room).emit('conversation_ended', { conversation_id, ended_by });
        io.emit('queue_updated');
      }
    });

    // Escalate to faculty
    socket.on('escalate_conversation', ({ conversation_id, escalated_by, role }) => {
      const conv = findConversationById(conversation_id);
      if (conv) {
        conv.is_escalated = true;
        conv.is_crisis_flagged = true;
        saveConversation(conv);

        const room = `conv-${conversation_id}`;
        io.to(room).emit('conversation_escalated', {
          conversation_id,
          escalated_by,
          role,
          message: 'This conversation was escalated to on-call campus counselors. Staff have been notified.'
        });

        io.to('admin_channel').emit('admin_escalation_alert', {
          conversation_id,
          seeker_alias: conv.seeker_alias,
          helper_alias: conv.helper_alias,
          topic: conv.topic,
          escalated_by: role,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Queue updates broadcast
    socket.on('broadcast_queue_update', () => {
      io.emit('queue_updated');
    });

    // Admin Channel Joining
    socket.on('join_admin_channel', () => {
      socket.join('admin_channel');
    });

    // Direct Admin Chat Real-Time
    socket.on('join_admin_chat', ({ chat_id }) => {
      socket.join(`admin-chat-${chat_id}`);
    });

    socket.on('send_admin_chat_message', (data) => {
      const { chat_id, sender_type, sender_id, sender_name, content } = data;
      const db = getDb();
      const msg = {
        message_id: uuidv4(),
        chat_id,
        sender_type,
        sender_id,
        sender_name,
        content,
        created_at: new Date().toISOString()
      };
      if (!db.admin_chat_messages) db.admin_chat_messages = [];
      db.admin_chat_messages.push(msg);
      saveDatabase();

      io.to(`admin-chat-${chat_id}`).emit('new_admin_chat_message', msg);
      io.to('admin_channel').emit('admin_chat_inbox_updated', { chat_id });
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      if (currentSessionId && userSockets.has(currentSessionId)) {
        userSockets.get(currentSessionId).delete(socket.id);
        if (userSockets.get(currentSessionId).size === 0) {
          userSockets.delete(currentSessionId);
        }
      }
    });
  });
}
