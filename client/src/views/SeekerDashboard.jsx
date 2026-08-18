import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

const TOPICS = [
  'Academic Stress',
  'Anxiety & Panic',
  'Relationships',
  'Family Issues',
  'Loneliness',
  'General Venting'
];

export default function SeekerDashboard() {
  const { 
    seekerSession, 
    initSeekerSession, 
    setActiveConversation, 
    setCurrentView 
  } = useApp();

  const [selectedTopic, setSelectedTopic] = useState(TOPICS[0]);
  const [promptText, setPromptText] = useState('');
  const [waitingConversation, setWaitingConversation] = useState(null);
  const [activeConversationFound, setActiveConversationFound] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!seekerSession) {
      initSeekerSession();
    }
  }, [seekerSession]);

  const loadState = async () => {
    if (!seekerSession) return;
    try {
      const res = await api.getMyHistory(seekerSession.session_id);
      const history = res.conversations || [];

      const active = history.find((c) => c.status === 'active');
      setActiveConversationFound(active || null);

      const waiting = history.find((c) => c.status === 'waiting');
      setWaitingConversation(waiting || null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadState();
    const interval = setInterval(loadState, 4000);
    return () => clearInterval(interval);
  }, [seekerSession]);

  const handleRequestMatch = async () => {
    try {
      setLoading(true);
      let session = seekerSession;
      if (!session) {
        session = await initSeekerSession();
      }

      const res = await api.startConversation(
        session.session_id,
        selectedTopic,
        promptText,
        null
      );

      const socket = getSocket();
      socket.emit('seeker_queue_enter', {
        conversation_id: res.conversation.conversation_id,
        topic: selectedTopic,
        initial_prompt: promptText,
        seeker_alias: session.alias
      });

      if (res.conversation.status === 'active') {
        setActiveConversation(res.conversation);
        setCurrentView('chat');
      } else {
        setWaitingConversation(res.conversation);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (waitingConversation && seekerSession) {
      await api.endConversation(waitingConversation.conversation_id, seekerSession.session_id);
      setWaitingConversation(null);
      const socket = getSocket();
      socket.emit('broadcast_queue_update');
    }
  };

  return (
    <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      
      {/* Active chat banner */}
      {activeConversationFound && !waitingConversation && (
        <div className="flat-card" style={{ borderLeft: '4px solid var(--btn-accent-bg)' }}>
          <div style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '4px' }}>
            Active Chat in Progress
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Topic: {activeConversationFound.topic}
          </div>
          <button
            onClick={() => {
              setActiveConversation(activeConversationFound);
              setCurrentView('chat');
            }}
            className="btn btn-accent btn-block"
          >
            Resume Chat
          </button>
        </div>
      )}

      {/* Waiting screen */}
      {waitingConversation ? (
        <div className="flat-card" style={{ textAlign: 'center', padding: '30px 16px', margin: 'auto 0' }}>
          <div style={{ fontWeight: '700', fontSize: '1.2rem', marginBottom: '8px' }}>
            Finding an available Helper
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Topic: {waitingConversation.topic}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', marginBottom: '24px' }}>
            Please hold on. You will be connected as soon as an online helper accepts.
          </p>
          <button onClick={handleCancel} className="btn btn-secondary">
            Cancel Request
          </button>
        </div>
      ) : (
        /* Seeker Form */
        <div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '4px' }}>
              Select a Topic
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Choose what you would like to talk about today.
            </div>
          </div>

          <div className="topic-list">
            {TOPICS.map((topic) => {
              const isSelected = selectedTopic === topic;
              return (
                <div
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className={`topic-item ${isSelected ? 'selected' : ''}`}
                >
                  <span>{topic}</span>
                  {isSelected && <span>✓</span>}
                </div>
              );
            })}
          </div>

          <div style={{ margin: '16px 0' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
              Note (Optional):
            </label>
            <textarea
              placeholder="Add details if you want..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="textarea-input"
              rows={3}
            />
          </div>

          <button
            onClick={handleRequestMatch}
            disabled={loading}
            className="btn btn-primary btn-block"
            style={{ padding: '14px', fontSize: '1rem' }}
          >
            {loading ? 'Finding Match...' : 'Find Helper'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            100% Anonymous. No account or email needed.
          </div>
        </div>
      )}

    </div>
  );
}
