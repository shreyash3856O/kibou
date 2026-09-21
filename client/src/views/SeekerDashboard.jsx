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
    setCurrentView,
    bannedInfo
  } = useApp();

  const [selectedTopic, setSelectedTopic] = useState(TOPICS[0]);
  const [promptText, setPromptText] = useState('');
  const [waitingConversation, setWaitingConversation] = useState(null);
  const [activeConversationFound, setActiveConversationFound] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!seekerSession && !bannedInfo) {
      initSeekerSession();
    }
  }, [seekerSession, bannedInfo]);

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
    const interval = setInterval(loadState, 25000);
    return () => clearInterval(interval);
  }, [seekerSession]);

  const handleRequestMatch = async () => {
    try {
      setLoading(true);
      let session = seekerSession;
      if (!session) {
        session = await initSeekerSession();
      }
      if (!session) {
        alert('Your access has been restricted by a moderator.');
        return;
      }

      let res;
      try {
        res = await api.startConversation(
          session.session_id,
          selectedTopic,
          promptText,
          null,
          session.alias
        );
      } catch (err) {
        if (err.status === 404 || err.message?.includes('session')) {
          session = await initSeekerSession();
          if (session) {
            res = await api.startConversation(
              session.session_id,
              selectedTopic,
              promptText,
              null,
              session.alias
            );
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      const socket = getSocket();
      socket.emit('seeker_queue_enter', {
        conversation_id: res.conversation.conversation_id,
        topic: selectedTopic,
        initial_prompt: promptText,
        seeker_alias: session.alias,
        seeker_session_id: session.session_id
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

  const handleStartSukhi = async () => {
    try {
      setLoading(true);
      let session = seekerSession;
      if (!session) {
        session = await initSeekerSession();
      }
      if (!session) {
        alert('Your access has been restricted by a moderator.');
        return;
      }

      const res = await api.startSukhiConversation(
        session.session_id,
        selectedTopic,
        promptText,
        session.alias
      );

      setActiveConversation(res.conversation);
      setCurrentView('chat');
    } catch (err) {
      alert('Failed to connect with Sukhi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (waitingConversation && seekerSession) {
      await api.endConversation(waitingConversation.conversation_id, seekerSession.session_id, 'seeker').catch(() => {});
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
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Topic: {waitingConversation.topic}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', marginBottom: '20px' }}>
            Please hold on. You will be connected as soon as an online helper accepts.
          </p>

          <div style={{ padding: '14px', backgroundColor: 'rgba(99, 102, 241, 0.08)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px', textAlign: 'left' }}>
            <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '4px', color: 'var(--text-primary)' }}>
              Don't want to wait?
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.4' }}>
              <strong>Sukhi</strong>, your mindful AI peer friend, is online 24/7. Always here for gentle perspective, mindful venting, and compassionate listening.
            </p>
            <button
              onClick={() => {
                handleCancel();
                handleStartSukhi();
              }}
              className="btn btn-accent btn-block"
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            >
              Talk to Sukhi (Instant AI Companion)
            </button>
          </div>

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
              Or match with a peer student helper.
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
                  {isSelected && <span>+</span>}
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

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleRequestMatch}
              disabled={loading}
              className="btn btn-primary"
              style={{ flex: 1, padding: '12px', fontSize: '0.95rem' }}
            >
              {loading ? 'Finding Match...' : 'Find Peer Helper'}
            </button>

            <button
              onClick={handleStartSukhi}
              disabled={loading}
              className="btn btn-accent"
              style={{ padding: '12px 16px', fontSize: '0.95rem' }}
              title="Chat instantly with Sukhi AI"
            >
              Talk with Sukhi
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            100% Anonymous. No account or email needed.
          </div>
        </div>
      )}

    </div>
  );
}
