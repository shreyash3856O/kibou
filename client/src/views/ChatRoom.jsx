import React, { useState, useEffect, useRef } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import EscalationCallSheet from '../components/EscalationCallSheet';

export default function ChatRoom() {
  const {
    activeConversation,
    seekerSession,
    helperSession,
    setCurrentView,
    setShowHotlinesModal,
    theme
  } = useApp();

  const isDark = theme !== 'light';

  const session = seekerSession?.session_id === activeConversation?.seeker_session_id 
    ? seekerSession 
    : helperSession;

  const isSeeker = session?.user_role === 'seeker';

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [isLocalTyping, setIsLocalTyping] = useState(false);
  const [topbarCompact, setTopbarCompact] = useState(false);
  const [isCrisisActive, setIsCrisisActive] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('unsafe_behavior');
  const [reportDescription, setReportDescription] = useState('');
  const [conversationEnded, setConversationEnded] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [callSheet, setCallSheet] = useState(null);
  const callAutoOpenedRef = useRef(false);

  const messagesEndRef = useRef(null);
  const messagesRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const convMetaRef = useRef({ convId: null, session: null });
  const localTypingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!activeConversation) {
      setCurrentView('main');
      return;
    }

    const convId = activeConversation.conversation_id;
    setTopbarCompact(false);
    convMetaRef.current = { convId, session };

    api.getConversationMessages(convId)
      .then((res) => {
        setMessages(res.messages || []);
        if (res.conversation?.is_crisis_flagged) setIsCrisisActive(true);
        if (res.conversation?.status === 'ended') setConversationEnded(true);
      })
      .catch((err) => console.error(err));

    const socket = getSocket();

    socket.emit('join_conversation', {
      conversation_id: convId,
      session_id: session?.session_id,
      alias: session?.alias
    });

    socket.on('new_message', (msg) => {
      if (msg.conversation_id === convId) {
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === msg.message_id)) return prev;
          return [...prev, msg];
        });
      }
    });

    socket.on('crisis_detected', (data) => {
      if (data.conversation_id === convId) {
        setIsCrisisActive(true);
        // Severe signal: offer direct call options (sheet only, no auto-dial)
        setCallSheet((prev) => prev || {
          mode: 'helplines',
          reason: 'This chat shows signs of crisis. You can reach a trained counselor right now — one tap opens your dialer.',
          autoUrl: null
        });
      }
    });

    socket.on('user_typing', (data) => {
      setIsPeerTyping(Boolean(data.isTyping));
    });

    socket.on('session_banned', (data) => {
      if (!data?.session_id || data.session_id === session?.session_id) {
        setIsBanned(true);
        setConversationEnded(true);
        socket.emit('leave_conversation', {
          conversation_id: convId,
          session_id: session?.session_id,
          alias: session?.alias
        });
      }
    });

    socket.on('conversation_ended', (data) => {
      if (data.conversation_id === convId) {
        setConversationEnded(true);
      }
    });

    socket.on('conversation_escalated', (data) => {
      if (data.conversation_id !== convId) return;
      setIsCrisisActive(true);

      const iAmEscalator = Boolean(data.escalated_by && data.escalated_by === session?.session_id);
      const isAi = Boolean(activeConversation?.is_ai || activeConversation?.helper_session_id === 'sukhi_ai_helper');
      const severe = Boolean(data.is_severe);

      let mode;
      let reason;
      let autoUrl = null;
      if (severe || isAi) {
        // Severe chats and AI chats route to professional helplines
        mode = 'helplines';
        reason = severe
          ? 'This chat was escalated as a crisis. Tap once — your dialer opens with a 24/7 helpline ready.'
          : 'This chat was escalated. Tap once — your dialer opens with a 24/7 helpline ready.';
        if (!iAmEscalator) autoUrl = 'tel:14416';
      } else if (!iAmEscalator) {
        // Peer escalated: the other person's phone goes to Shreyash on WhatsApp
        mode = 'whatsapp';
        reason = 'Your peer escalated this chat to get you help. Your WhatsApp opens straight to Shreyash — just press send.';
        autoUrl = 'https://wa.me/917304167033?text=' + encodeURIComponent('Hi, I need support. My Kibou conversation was just escalated.');
      } else {
        mode = 'all';
        reason = 'You escalated this chat. Call or message support directly, or stay here — counselors have been notified.';
      }

      callAutoOpenedRef.current = false;
      setCallSheet({ mode, reason, autoUrl });
    });

    return () => {
      if (localTypingTimeoutRef.current) clearTimeout(localTypingTimeoutRef.current);
      socket.emit('leave_conversation', {
        conversation_id: convId,
        session_id: session?.session_id,
        alias: session?.alias
      });
      socket.off('new_message');
      socket.off('crisis_detected');
      socket.off('user_typing');
      socket.off('session_banned');
      socket.off('conversation_ended');
      socket.off('conversation_escalated');
    };
  }, [activeConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  // Auto-open the dialer / WhatsApp once per escalation (sheet stays as fallback)
  useEffect(() => {
    if (callSheet?.autoUrl && !callAutoOpenedRef.current) {
      callAutoOpenedRef.current = true;
      try {
        window.location.href = callSheet.autoUrl;
      } catch (e) {}
    }
  }, [callSheet]);

  // Catch up on anything missed while the tab was hidden or socket dropped:
  // rejoin the room and reload messages on foreground / focus / reconnect.
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => {
      const { convId, session: s } = convMetaRef.current;
      if (!convId) return;
      socket.emit('join_conversation', {
        conversation_id: convId,
        session_id: s?.session_id,
        alias: s?.alias
      });
      api.getConversationMessages(convId)
        .then((res) => {
          setMessages(res.messages || []);
          if (res.conversation?.is_crisis_flagged) setIsCrisisActive(true);
          if (res.conversation?.status === 'ended') setConversationEnded(true);
        })
        .catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);
    socket.on('connect', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
      socket.off('connect', refresh);
    };
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation || conversationEnded) return;

    const content = inputText.trim();
    setInputText('');
    setIsLocalTyping(false);
    if (localTypingTimeoutRef.current) clearTimeout(localTypingTimeoutRef.current);

    const socket = getSocket();
    socket.emit('typing_stop', { conversation_id: activeConversation.conversation_id });

    socket.emit('send_message', {
      conversation_id: activeConversation.conversation_id,
      sender_session_id: session?.session_id,
      sender_alias: session?.alias || (isSeeker ? 'Seeker' : 'Helper'),
      sender_role: session?.user_role || (isSeeker ? 'seeker' : 'helper'),
      content
    });
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    setIsLocalTyping(true);
    if (localTypingTimeoutRef.current) clearTimeout(localTypingTimeoutRef.current);
    localTypingTimeoutRef.current = setTimeout(() => setIsLocalTyping(false), 1200);
    const socket = getSocket();
    socket.emit('typing_start', {
      conversation_id: activeConversation?.conversation_id,
      sender_alias: session?.alias,
      sender_role: session?.user_role
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { conversation_id: activeConversation?.conversation_id });
    }, 1200);
  };

  const handleEscalate = async () => {
    if (window.confirm('Escalate this conversation to on-call campus counselors?')) {
      try {
        await api.escalateConversation(activeConversation.conversation_id);
        const socket = getSocket();
        socket.emit('escalate_conversation', {
          conversation_id: activeConversation.conversation_id,
          escalated_by: session?.session_id,
          role: session?.user_role
        });
        setIsCrisisActive(true);
      } catch (err) {
        alert('Escalation failed: ' + err.message);
      }
    }
  };

  const handleEnd = async () => {
    if (window.confirm('End this chat session?')) {
      try {
        await api.endConversation(activeConversation.conversation_id, session?.session_id);
        const socket = getSocket();
        socket.emit('end_conversation', {
          conversation_id: activeConversation.conversation_id,
          ended_by: session?.session_id
        });
        setConversationEnded(true);
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    try {
      await api.submitReport(
        activeConversation.conversation_id,
        session?.session_id,
        session?.user_role,
        reportReason,
        reportDescription
      );
      alert('Report submitted for admin review.');
      setShowReportModal(false);
    } catch (err) {
      alert('Report failed: ' + err.message);
    }
  };

  return (
    <div className="chat-container">
      
      {/* Top Bar for Chat Room — sticky, compacts on scroll */}
      <div className={`chat-topbar${topbarCompact ? ' compact' : ''}`}>
        <div className="chat-topbar-info">
          <div className="chat-topic">
            <span>{activeConversation?.topic || 'Chat'}</span>
          </div>
          <div className="chat-sub">
            {(activeConversation?.helper_session_id === 'sukhi_ai_helper' || activeConversation?.is_ai)
              ? 'Sukhi (Mindful AI Peer)'
              : 'Encrypted peer session'}
          </div>
        </div>

        <div className="chat-topbar-actions">
          <button onClick={handleEscalate} className="btn btn-danger">
            Escalate
          </button>
          <button onClick={() => setShowReportModal(true)} className="btn btn-secondary">
            Report
          </button>
          <button onClick={handleEnd} className="btn btn-outline">
            End
          </button>
        </div>
      </div>

      {/* Crisis Banner if triggered */}
      {isCrisisActive && (
        <div style={{
          backgroundColor: '#7f1d1d',
          color: '#fca5a5',
          padding: '10px 14px',
          fontSize: '0.8rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Crisis Support:</strong> Call Tele-MANAS (14416), KIRAN (1800-599-0019), or Shreyash (7304167033).
          </div>
          <button onClick={() => setShowHotlinesModal(true)} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
            Hotlines
          </button>
        </div>
      )}

      {/* Message Stream */}
      <div
        className="chat-messages"
        ref={messagesRef}
        onScroll={() => {
          if (messagesRef.current) setTopbarCompact(messagesRef.current.scrollTop > 24);
        }}
      >
        {messages.map((m) => {
          const isMe = m.sender_session_id === session?.session_id;
          return (
            <div key={m.message_id} className={`msg-bubble ${isMe ? 'msg-me' : 'msg-peer'}`}>
              <div style={{ fontSize: '0.68rem', color: isMe ? 'rgba(0,0,0,0.6)' : 'var(--text-muted)', marginBottom: '2px' }}>
                {m.sender_alias || (isMe ? 'You' : 'Peer')}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{m.content}</div>
            </div>
          );
        })}

        {isPeerTyping && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ThinkingOrb
              state={(activeConversation?.helper_session_id === 'sukhi_ai_helper' || activeConversation?.is_ai) ? 'listening' : 'composing'}
              size={20}
              dark={isDark}
            />
            <span>{(activeConversation?.helper_session_id === 'sukhi_ai_helper' || activeConversation?.is_ai) ? 'Sukhi is reflecting...' : 'Peer is typing...'}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Banned notice */}
      {isBanned && (
        <div style={{ padding: '10px 14px', backgroundColor: '#7f1d1d', color: '#fca5a5', fontSize: '0.82rem', textAlign: 'center', borderTop: '1px solid #991b1b' }}>
          Your access has been restricted by a moderator. You can no longer send messages.
        </div>
      )}

      {/* Input or Ended Notice */}
      {conversationEnded ? (
        <div style={{ padding: '14px', textAlign: 'center', backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
            This conversation has ended.
          </div>
          <button onClick={() => setCurrentView('main')} className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem' }}>
            Return to Dashboard
          </button>
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="chat-input-bar">
          {isLocalTyping && (
            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} title="You are typing...">
              <ThinkingOrb state="composing" size={20} dark={isDark} />
            </span>
          )}
          <input
            type="text"
            placeholder="Type a message..."
            value={inputText}
            onChange={handleInputChange}
            className="input-text"
          />
          <button type="submit" disabled={!inputText.trim()} className="btn btn-primary" style={{ padding: '8px 16px' }}>
            Send
          </button>
        </form>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '8px' }}>Report Conversation</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Moderators review full anonymized transcripts of reported chats.
            </p>

            <form onSubmit={handleSubmitReport}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>
                Reason:
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="select-input"
                style={{ marginBottom: '12px' }}
              >
                <option value="unsafe_behavior">Unsafe Advice or Harm</option>
                <option value="harassment">Harassment or Abuse</option>
                <option value="spam">Spam or Links</option>
                <option value="other">Other Concern</option>
              </select>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>
                Details (Optional):
              </label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                className="textarea-input"
                rows={3}
                style={{ marginBottom: '16px' }}
              />

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowReportModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Escalation call sheet — one-tap dialer / WhatsApp */}
      <EscalationCallSheet sheet={callSheet} onClose={() => setCallSheet(null)} />

    </div>
  );
}
