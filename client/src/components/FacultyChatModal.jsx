import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

export default function FacultyChatModal() {
  const { showFacultyChatModal, setShowFacultyChatModal, seekerSession, helperSession } = useApp();
  const session = seekerSession || helperSession;

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!showFacultyChatModal || !session) return;

    api.startAdminChat(session.session_id, '')
      .then((res) => {
        setChat(res.chat);
        return api.getAdminChatMessages(res.chat.chat_id);
      })
      .then((res) => {
        setMessages(res.messages || []);
        const socket = getSocket();
        socket.emit('join_admin_chat', { chat_id: res.chat.chat_id });

        socket.on('new_admin_chat_message', (msg) => {
          if (msg.chat_id === res.chat.chat_id) {
            setMessages((prev) => [...prev, msg]);
          }
        });
      })
      .catch((err) => console.error(err));

    return () => {
      const socket = getSocket();
      socket.off('new_admin_chat_message');
    };
  }, [showFacultyChatModal, session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !chat) return;

    const content = inputText.trim();
    setInputText('');

    const socket = getSocket();
    socket.emit('send_admin_chat_message', {
      chat_id: chat.chat_id,
      sender_type: 'student',
      sender_id: session?.session_id,
      sender_name: session?.alias || 'Student',
      content
    });
  };

  if (!showFacultyChatModal) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowFacultyChatModal(false)}>
      <div className="modal-box" style={{ height: '520px', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>Campus Counselor</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Confidential Direct Thread</div>
          </div>
          <button onClick={() => setShowFacultyChatModal(false)} className="icon-btn">✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Send a confidential message to the campus counseling office.
            </div>
          )}

          {messages.map((m) => {
            const isMe = m.sender_type === 'student';
            return (
              <div key={m.message_id} className={`msg-bubble ${isMe ? 'msg-me' : 'msg-peer'}`}>
                <div style={{ fontSize: '0.68rem', color: isMe ? 'rgba(0,0,0,0.6)' : 'var(--text-muted)', marginBottom: '2px' }}>
                  {m.sender_name}
                </div>
                <div>{m.content}</div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
          <input
            type="text"
            placeholder="Type message to counselor..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="input-text"
          />
          <button type="submit" disabled={!inputText.trim()} className="btn btn-primary">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
