import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

export default function HelperDashboard() {
  const { 
    helperSession, 
    initHelperSession, 
    setActiveConversation, 
    setCurrentView 
  } = useApp();

  const [isOnline, setIsOnline] = useState(true);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);

  useEffect(() => {
    if (!helperSession) {
      initHelperSession();
    }
  }, [helperSession]);

  const loadQueue = async () => {
    try {
      const res = await api.getWaitingConversations();
      setWaitingQueue(res.waiting || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 4000);

    const socket = getSocket();
    socket.on('new_seeker_in_queue', loadQueue);
    socket.on('queue_updated', loadQueue);

    return () => {
      clearInterval(interval);
      socket.off('new_seeker_in_queue');
      socket.off('queue_updated');
    };
  }, []);

  const handleToggleOnline = async () => {
    const next = !isOnline;
    setIsOnline(next);
    if (helperSession) {
      await api.updateHelperStatus(helperSession.session_id, next);
      const socket = getSocket();
      socket.emit('broadcast_queue_update');
    }
  };

  const handleAccept = async (convId) => {
    if (!helperSession) return;
    try {
      setAcceptingId(convId);
      const res = await api.acceptConversation(convId, helperSession.session_id);
      
      const socket = getSocket();
      socket.emit('helper_accepted_match', {
        conversation_id: convId,
        helper_session_id: helperSession.session_id,
        helper_alias: helperSession.alias
      });

      setActiveConversation(res.conversation);
      setCurrentView('chat');
    } catch (err) {
      alert('Accept failed: ' + err.message);
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      
      {/* Helper Status Card */}
      <div className="flat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>
            Helper Status
          </div>
          <div style={{ fontSize: '0.8rem', color: isOnline ? 'var(--btn-accent-bg)' : 'var(--text-muted)' }}>
            {isOnline ? 'Online and receiving requests' : 'Offline'}
          </div>
        </div>

        <button
          onClick={handleToggleOnline}
          className={`btn ${isOnline ? 'btn-accent' : 'btn-secondary'}`}
          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
        >
          {isOnline ? 'Online' : 'Offline'}
        </button>
      </div>

      {/* Guidelines Button */}
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={() => setShowGuidelines(true)}
          className="btn btn-outline btn-block"
          style={{ padding: '8px', fontSize: '0.82rem' }}
        >
          View Helper Guidelines
        </button>
      </div>

      {/* Waiting Queue List */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
            Waiting Seekers ({waitingQueue.length})
          </span>
          <button onClick={loadQueue} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
            Refresh
          </button>
        </div>

        {waitingQueue.length === 0 ? (
          <div className="flat-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>No seekers waiting right now.</p>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
              Keep your status online. New requests appear here automatically.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {waitingQueue.map((w) => (
              <div key={w.conversation_id} className="flat-card" style={{ padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>{w.topic}</strong>
                    {w.is_crisis_flagged && (
                      <span className="badge-pill badge-red" style={{ marginLeft: '6px' }}>Crisis Flag</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                    {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {w.initial_prompt && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '10px', fontStyle: 'italic' }}>
                    "{w.initial_prompt}"
                  </p>
                )}

                <button
                  onClick={() => handleAccept(w.conversation_id)}
                  disabled={acceptingId === w.conversation_id || !isOnline}
                  className="btn btn-primary btn-block"
                  style={{ padding: '8px', fontSize: '0.85rem' }}
                >
                  {acceptingId === w.conversation_id ? 'Connecting...' : 'Accept Chat'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guidelines Modal */}
      {showGuidelines && (
        <div className="modal-overlay" onClick={() => setShowGuidelines(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Helper Guidelines</h3>
            <ul style={{ fontSize: '0.85rem', paddingLeft: '20px', lineHeight: '1.6', color: 'var(--text-muted)', marginBottom: '20px' }}>
              <li>Listen without judgment. Validate feelings.</li>
              <li>You are a peer listener, not a therapist. Do not diagnose or prescribe.</li>
              <li>Maintain healthy boundaries. Do not share personal social media or phone numbers.</li>
              <li>If the seeker expresses thoughts of suicide or self-harm, click "Escalate to Faculty" in the chat immediately.</li>
            </ul>
            <button onClick={() => setShowGuidelines(false)} className="btn btn-primary btn-block">
              Understood
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
