import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

export default function ChatRoom() {
  const { 
    activeConversation, 
    seekerSession, 
    helperSession, 
    setCurrentView,
    setShowHotlinesModal 
  } = useApp();

  const session = seekerSession?.session_id === activeConversation?.seeker_session_id 
    ? seekerSession 
    : helperSession;

  const isSeeker = session?.user_role === 'seeker';

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [isCrisisActive, setIsCrisisActive] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('unsafe_behavior');
  const [reportDescription, setReportDescription] = useState('');
  const [conversationEnded, setConversationEnded] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!activeConversation) {
      setCurrentView('main');
      return;
    }

    const convId = activeConversation.conversation_id;

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
      }
    });

    socket.on('user_typing', (data) => {
      setIsPeerTyping(Boolean(data.isTyping));
    });

    socket.on('conversation_ended', (data) => {
      if (data.conversation_id === convId) {
        setConversationEnded(true);
      }
    });

    socket.on('conversation_escalated', (data) => {
      if (data.conversation_id === convId) {
        setIsCrisisActive(true);
      }
    });

    return () => {
      socket.emit('leave_conversation', {
        conversation_id: convId,
        session_id: session?.session_id,
        alias: session?.alias
      });
      socket.off('new_message');
      socket.off('crisis_detected');
      socket.off('user_typing');
      socket.off('conversation_ended');
      socket.off('conversation_escalated');
    };
  }, [activeConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation || conversationEnded) return;

    const content = inputText.trim();
    setInputText('');

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
      
      {/* Top Bar for Chat Room */}
      <div style={{
        padding: '10px 14px',
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>
            {activeConversation?.topic || 'Chat'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Encrypted session
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={handleEscalate} className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
            Escalate
          </button>
          <button onClick={() => setShowReportModal(true)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
            Report
          </button>
          <button onClick={handleEnd} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
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
            <strong>Crisis Support:</strong> Call/Text 988 or Text HOME to 741741.
          </div>
          <button onClick={() => setShowHotlinesModal(true)} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
            Hotlines
          </button>
        </div>
      )}

      {/* Message Stream */}
      <div className="chat-messages">
        {messages.map((m) => {
          const isMe = m.sender_session_id === session?.session_id;
          return (
            <div key={m.message_id} className={`msg-bubble ${isMe ? 'msg-me' : 'msg-peer'}`}>
              <div style={{ fontSize: '0.68rem', color: isMe ? 'rgba(0,0,0,0.6)' : 'var(--text-muted)', marginBottom: '2px' }}>
                {m.sender_alias || (isMe ? 'You' : 'Peer')}
              </div>
              <div>{m.content}</div>
            </div>
          );
        })}

        {isPeerTyping && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Peer is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

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

    </div>
  );
}
