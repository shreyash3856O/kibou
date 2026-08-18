import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { 
  Layers, 
  MessageSquare, 
  Sparkles, 
  Send, 
  RotateCcw,
  Clock,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export default function LiveSimulator() {
  // Seeker State
  const [seekerSession, setSeekerSession] = useState(null);
  const [seekerTopic, setSeekerTopic] = useState('Academic Stress & Burnout');
  const [seekerPrompt, setSeekerPrompt] = useState('Feeling overwhelmed before tomorrow\'s calculus midterm.');
  const [seekerConversation, setSeekerConversation] = useState(null);
  const [seekerMessages, setSeekerMessages] = useState([]);
  const [seekerInput, setSeekerInput] = useState('');
  const [seekerCrisisBanner, setSeekerCrisisBanner] = useState(false);

  // Helper State
  const [helperSession, setHelperSession] = useState(null);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [helperConversation, setHelperConversation] = useState(null);
  const [helperMessages, setHelperMessages] = useState([]);
  const [helperInput, setHelperInput] = useState('');
  const [helperCrisisBanner, setHelperCrisisBanner] = useState(false);

  const seekerEndRef = useRef(null);
  const helperEndRef = useRef(null);

  // Initialize both sessions on mount
  const initSimulatorSessions = async () => {
    try {
      const sRes = await api.createAnonSession('seeker', 'Seeker_Test1', ['Academic Stress & Burnout']);
      setSeekerSession(sRes.session);

      const hRes = await api.createAnonSession('helper', 'Helper_Test1', ['Academic Stress & Burnout', 'General Venting & Support']);
      setHelperSession(hRes.session);

      setSeekerConversation(null);
      setHelperConversation(null);
      setSeekerMessages([]);
      setHelperMessages([]);
      setSeekerCrisisBanner(false);
      setHelperCrisisBanner(false);

      const qRes = await api.getWaitingConversations();
      setWaitingQueue(qRes.waiting || []);
    } catch (err) {
      console.error('Failed to init simulator sessions:', err);
    }
  };

  useEffect(() => {
    initSimulatorSessions();
  }, []);

  // Setup sockets
  useEffect(() => {
    const socket = getSocket();

    socket.on('new_message', (msg) => {
      if (seekerConversation && msg.conversation_id === seekerConversation.conversation_id) {
        setSeekerMessages((prev) => {
          if (prev.some((m) => m.message_id === msg.message_id)) return prev;
          return [...prev, msg];
        });
      }
      if (helperConversation && msg.conversation_id === helperConversation.conversation_id) {
        setHelperMessages((prev) => {
          if (prev.some((m) => m.message_id === msg.message_id)) return prev;
          return [...prev, msg];
        });
      }
    });

    socket.on('conversation_matched', (data) => {
      if (data?.conversation) {
        setSeekerConversation(data.conversation);
        setHelperConversation(data.conversation);
      }
    });

    socket.on('crisis_detected', () => {
      setSeekerCrisisBanner(true);
      setHelperCrisisBanner(true);
    });

    socket.on('queue_updated', async () => {
      const qRes = await api.getWaitingConversations();
      setWaitingQueue(qRes.waiting || []);
    });

    return () => {
      socket.off('new_message');
      socket.off('conversation_matched');
      socket.off('crisis_detected');
      socket.off('queue_updated');
    };
  }, [seekerConversation, helperConversation]);

  useEffect(() => {
    seekerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    helperEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [seekerMessages, helperMessages]);

  // Seeker posts request
  const handleSeekerRequest = async () => {
    if (!seekerSession) return;
    try {
      const res = await api.startConversation(
        seekerSession.session_id,
        seekerTopic,
        seekerPrompt,
        null
      );
      setSeekerConversation(res.conversation);

      const socket = getSocket();
      socket.emit('seeker_queue_enter', {
        conversation_id: res.conversation.conversation_id,
        topic: seekerTopic,
        initial_prompt: seekerPrompt,
        seeker_alias: seekerSession.alias
      });
      socket.emit('join_conversation', {
        conversation_id: res.conversation.conversation_id,
        session_id: seekerSession.session_id,
        alias: seekerSession.alias
      });
    } catch (err) {
      alert('Seeker request failed: ' + err.message);
    }
  };

  // Helper accepts seeker
  const handleHelperAccept = async (convId) => {
    if (!helperSession) return;
    try {
      const res = await api.acceptConversation(convId, helperSession.session_id);
      setHelperConversation(res.conversation);
      setSeekerConversation(res.conversation);

      const socket = getSocket();
      socket.emit('helper_accepted_match', {
        conversation_id: convId,
        helper_session_id: helperSession.session_id,
        helper_alias: helperSession.alias
      });

      const msgs = await api.getConversationMessages(convId);
      setSeekerMessages(msgs.messages || []);
      setHelperMessages(msgs.messages || []);
    } catch (err) {
      alert('Helper accept failed: ' + err.message);
    }
  };

  // Seeker sends message
  const handleSeekerSend = (e) => {
    e.preventDefault();
    if (!seekerInput.trim() || !seekerConversation) return;

    const content = seekerInput.trim();
    setSeekerInput('');

    const socket = getSocket();
    socket.emit('send_message', {
      conversation_id: seekerConversation.conversation_id,
      sender_session_id: seekerSession.session_id,
      sender_alias: seekerSession.alias,
      sender_role: 'seeker',
      content
    });
  };

  // Helper sends message
  const handleHelperSend = (e) => {
    e.preventDefault();
    if (!helperInput.trim() || !helperConversation) return;

    const content = helperInput.trim();
    setHelperInput('');

    const socket = getSocket();
    socket.emit('send_message', {
      conversation_id: helperConversation.conversation_id,
      sender_session_id: helperSession.session_id,
      sender_alias: helperSession.alias,
      sender_role: 'helper',
      content
    });
  };

  return (
    <div style={{ padding: '20px 0 60px' }}>
      <div className="container">
        
        {/* Simulator Control Bar */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(13, 148, 136, 0.15))',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 22px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="#818cf8" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>
                Seeker & Helper Live Dual-Simulator
              </h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Test real-time matching, encrypted chat, and crisis keyword triggers side by side.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setSeekerInput('I feel like there is no point living and I want to kill myself');
              }}
              className="btn btn-outline"
              style={{ fontSize: '0.74rem', padding: '6px 12px', borderColor: '#f43f5e', color: '#fda4af' }}
              title="Fill crisis phrase for keyword detection test"
            >
              ⚡ Fill Crisis Test Phrase
            </button>
            <button
              onClick={initSimulatorSessions}
              className="btn btn-ghost"
              style={{ fontSize: '0.74rem', padding: '6px 12px' }}
            >
              <RotateCcw size={13} /> Reset Test
            </button>
          </div>
        </div>

        {/* Split Panels */}
        <div className="grid-cols-2" style={{ gap: '20px' }}>
          
          {/* LEFT: SEEKER */}
          <div className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', height: '620px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={16} color="#818cf8" />
                <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>Seeker Window</span>
                <span className="badge badge-indigo" style={{ fontSize: '0.65rem' }}>
                  {seekerSession?.alias || 'Seeker'}
                </span>
              </div>
              <span className="status-dot"></span>
            </div>

            {seekerCrisisBanner && (
              <div style={{
                background: 'rgba(225, 29, 72, 0.18)',
                border: '1px solid #f43f5e',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: '0.75rem',
                color: '#fda4af',
                marginBottom: '10px'
              }}>
                🚨 <strong>Crisis Alert Triggered:</strong> Immediate Hotline Support Available (988 Lifeline).
              </div>
            )}

            {!seekerConversation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Select Support Topic:</label>
                <select
                  value={seekerTopic}
                  onChange={(e) => setSeekerTopic(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    color: '#ffffff',
                    border: '1px solid var(--border-glass)',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem'
                  }}
                >
                  <option>Academic Stress & Burnout</option>
                  <option>Anxiety & Racing Thoughts</option>
                  <option>Friendships & Relationships</option>
                  <option>Venting & General Support</option>
                </select>

                <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Note:</label>
                <textarea
                  value={seekerPrompt}
                  onChange={(e) => setSeekerPrompt(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    color: '#ffffff',
                    border: '1px solid var(--border-glass)',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    height: '70px',
                    fontSize: '0.85rem',
                    resize: 'none'
                  }}
                />

                <button
                  onClick={handleSeekerRequest}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '6px' }}
                >
                  Post to Seeker Queue →
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {seekerMessages.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        alignSelf: m.sender_role === 'seeker' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%'
                      }}
                    >
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: '12px',
                        background: m.sender_role === 'seeker' ? '#6366f1' : 'rgba(255,255,255,0.08)',
                        fontSize: '0.84rem'
                      }}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  <div ref={seekerEndRef} />
                </div>

                <form onSubmit={handleSeekerSend} style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-glass)' }}>
                  <input
                    type="text"
                    placeholder="Seeker message..."
                    value={seekerInput}
                    onChange={(e) => setSeekerInput(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 'var(--radius-full)',
                      color: '#ffffff',
                      padding: '8px 14px',
                      fontSize: '0.84rem'
                    }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px' }}>
                    <Send size={13} />
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* RIGHT: HELPER */}
          <div className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', height: '620px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="#14b8a6" />
                <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>Helper Window</span>
                <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>
                  {helperSession?.alias || 'Helper'}
                </span>
              </div>
              <span className="status-dot"></span>
            </div>

            {helperCrisisBanner && (
              <div style={{
                background: 'rgba(225, 29, 72, 0.18)',
                border: '1px solid #f43f5e',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: '0.75rem',
                color: '#fda4af',
                marginBottom: '10px'
              }}>
                ⚠️ <strong>Crisis Flag:</strong> Seeker triggered crisis keywords. Remind them of limits & escalate if needed.
              </div>
            )}

            {!helperConversation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#14b8a6' }}>
                  Live Seeker Queue ({waitingQueue.length}):
                </div>

                {waitingQueue.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
                    No seekers waiting. Click "Post to Seeker Queue" on the left!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {waitingQueue.map((w) => (
                      <div
                        key={w.conversation_id}
                        className="glass-panel"
                        style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.84rem' }}>{w.topic}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{w.seeker_alias}</div>
                        </div>
                        <button
                          onClick={() => handleHelperAccept(w.conversation_id)}
                          className="btn btn-teal"
                          style={{ padding: '5px 12px', fontSize: '0.74rem' }}
                        >
                          Accept Match →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {helperMessages.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        alignSelf: m.sender_role === 'helper' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%'
                      }}
                    >
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: '12px',
                        background: m.sender_role === 'helper' ? '#0d9488' : 'rgba(255,255,255,0.08)',
                        fontSize: '0.84rem'
                      }}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  <div ref={helperEndRef} />
                </div>

                <form onSubmit={handleHelperSend} style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-glass)' }}>
                  <input
                    type="text"
                    placeholder="Helper message..."
                    value={helperInput}
                    onChange={(e) => setHelperInput(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 'var(--radius-full)',
                      color: '#ffffff',
                      padding: '8px 14px',
                      fontSize: '0.84rem'
                    }}
                  />
                  <button type="submit" className="btn btn-teal" style={{ padding: '8px 14px' }}>
                    <Send size={13} />
                  </button>
                </form>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
