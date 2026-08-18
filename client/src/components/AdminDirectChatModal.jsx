import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { ShieldCheck, Send, X, Lock, PhoneCall } from 'lucide-react';

export default function AdminDirectChatModal({ onClose }) {
  const { seekerSession, helperSession, setShowHotlinesModal } = useApp();
  const session = seekerSession || helperSession;

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    // Start or load admin chat
    api.startAdminChat(session.session_id, '', false)
      .then((res) => {
        setChat(res.chat);
        return api.getAdminChatMessages(res.chat.chat_id);
      })
      .then((res) => {
        setMessages(res.messages || []);
        setLoading(false);

        // Join socket room
        const socket = getSocket();
        socket.emit('join_admin_chat', { chat_id: res.chat.chat_id });

        socket.on('new_admin_chat_message', (newMsg) => {
          if (newMsg.chat_id === res.chat.chat_id) {
            setMessages((prev) => [...prev, newMsg]);
          }
        });
      })
      .catch((err) => {
        console.error('Failed to init admin chat:', err);
        setLoading(false);
      });
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !chat) return;

    const content = inputText.trim();
    setInputText('');

    const socket = getSocket();
    socket.emit('send_admin_chat_message', {
      chat_id: chat.chat_id,
      sender_type: 'student',
      sender_id: session.session_id,
      sender_name: session.alias || 'Anonymous Student',
      content
    });
  };

  return (
    <div className="modal-overlay">
      <div className="glass-card" style={{
        maxWidth: '650px',
        width: '100%',
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(15, 23, 42, 0.8)',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.1rem' }}>Campus Counselor On-Call</h3>
                <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>Active</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Confidential Faculty & Counselor direct channel • 100% Student Privacy
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowHotlinesModal(true)}
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
            >
              <PhoneCall size={12} /> Hotlines
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '6px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            textAlign: 'center'
          }}>
            <Lock size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            This channel connects you directly with the licensed campus counseling team. You can request guidance, schedule an appointment, or discuss crisis support.
          </div>

          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <ShieldCheck size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Start a message with the campus counselor.
              </p>
              <span style={{ fontSize: '0.75rem' }}>
                They will see your anonymous alias and respond promptly.
              </span>
            </div>
          )}

          {messages.map((m) => {
            const isMe = m.sender_id === session?.session_id || m.sender_type === 'student';
            return (
              <div
                key={m.message_id}
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '80%'
                }}
              >
                <div style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginBottom: '2px',
                  textAlign: isMe ? 'right' : 'left'
                }}>
                  {m.sender_name || (isMe ? 'You' : 'Campus Counselor')} • {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{
                  padding: '10px 16px',
                  borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isMe ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(30, 41, 59, 0.9)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  lineHeight: '1.4',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}>
                  {m.content}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          style={{
            padding: '14px 20px',
            background: 'rgba(15, 23, 42, 0.9)',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            gap: '10px'
          }}
        >
          <input
            type="text"
            placeholder="Type your confidential message to counselor..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-full)',
              color: '#ffffff',
              padding: '10px 18px',
              fontSize: '0.9rem'
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="btn btn-primary"
            style={{ padding: '10px 20px' }}
          >
            <Send size={16} /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
