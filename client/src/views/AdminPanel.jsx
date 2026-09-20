import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';


export default function AdminPanel() {
  const { adminUser, loginAdminSuccess, logoutAdmin } = useApp();

  // Login form state (UID & Password)
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaStep, setTwoFaStep] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [adminIdFor2fa, setAdminIdFor2fa] = useState('');
  const [authError, setAuthError] = useState('');

  // Panel state
  const [activeTab, setActiveTab] = useState('messages'); // 'messages' | 'reports' | 'ip_bans' | 'users'
  const [reports, setReports] = useState([]);
  const [usersData, setUsersData] = useState({ sessions: [], banned_ips: [] });
  const [facultyChats, setFacultyChats] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [replyInput, setReplyInput] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [manualIpToBan, setManualIpToBan] = useState('');
  const [aiConfig, setAiConfig] = useState({ provider: '', groqConfigured: false, model: '' });
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [aiSaveMsg, setAiSaveMsg] = useState('');
  const [aiTestPrompt, setAiTestPrompt] = useState('i feel academic stress');
  const [aiTestTopic, setAiTestTopic] = useState('Academic Stress');
  const [aiTestResponse, setAiTestResponse] = useState('');
  const [aiTesting, setAiTesting] = useState(false);
  const messagesEndRef = useRef(null);

  const loadData = async () => {
    if (!localStorage.getItem('admin_token')) return;
    try {
      const [repRes, usrRes, chatRes] = await Promise.all([
        api.getAdminReports().catch(() => ({})),
        api.getAdminUsersList().catch(() => ({})),
        api.getAdminChats().catch(() => ({}))
      ]);
      setReports(repRes.reports || []);
      setUsersData(usrRes || { sessions: [], banned_ips: [] });
      setFacultyChats(chatRes.chats || []);
      api.getAiConfig().then((res) => {
        if (res.config) setAiConfig(res.config);
      }).catch(() => {});
    } catch (err) {
      console.error('loadData error:', err);
    }
  };

  useEffect(() => {
    if (adminUser) loadData();
  }, [adminUser]);

  // Poll for updates every 5s while panel is open
  useEffect(() => {
    if (!adminUser) return;
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [adminUser]);

  // Socket listener for new faculty messages
  useEffect(() => {
    if (!adminUser) return;
    const socket = getSocket();
    socket.on('new_admin_chat_message', () => loadData());
    return () => socket.off('new_admin_chat_message');
  }, [adminUser]);

  const openChat = async (chat) => {
    setSelectedChat(chat);
    // Join the socket room for this admin chat so we get live messages
    const socket = getSocket();
    socket.emit('join_admin_chat', { chat_id: chat.chat_id });
    try {
      const res = await api.getAdminChatMessages(chat.chat_id);
      setChatMessages(res.messages || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyInput.trim() || !selectedChat || !adminUser) return;
    const content = replyInput.trim();
    setReplyInput('');

    const socket = getSocket();
    socket.emit('send_admin_chat_message', {
      chat_id: selectedChat.chat_id,
      sender_type: 'admin',
      sender_id: adminUser.admin_id,
      sender_name: adminUser.name || 'Counselor',
      content
    });

    // Optimistically add message
    setChatMessages((prev) => [...prev, {
      message_id: Date.now().toString(),
      chat_id: selectedChat.chat_id,
      sender_type: 'admin',
      sender_name: adminUser.name || 'Counselor',
      content,
      created_at: new Date().toISOString()
    }]);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await api.adminLogin(uid, password);
      if (res.token) {
        loginAdminSuccess(res.admin, res.token);
      } else if (res.require_2fa) {
        setAdminIdFor2fa(res.admin_id);
        setTwoFaStep(true);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handle2faSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await api.admin2faVerify(adminIdFor2fa, twoFaCode);
      loginAdminSuccess(res.admin, res.token);
      setTwoFaStep(false);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleViewReport = async (reportId) => {
    try {
      const res = await api.getAdminReportDetail(reportId);
      setSelectedReport(res);
      setActionNotes('');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleActionReport = async (action) => {
    if (!selectedReport) return;
    const conv = selectedReport.conversation;
    const targetSessionId = selectedReport.report.reporter_role === 'seeker'
      ? conv?.helper_session_id
      : conv?.seeker_session_id;

    try {
      const res = await api.actionAdminReport(selectedReport.report.report_id, action, actionNotes, targetSessionId);
      setSelectedReport(null);
      loadData();
      if (action === 'ban_user') {
        alert(res?.banned_session_id ? `User banned and kicked from live chat.\nSession: ${res.banned_session_id}` : 'Report action saved, but no target session was found to ban.');
      }
    } catch (err) {
      alert('Action error: ' + err.message);
    }
  };

  const handleBanIp = async (e) => {
    e.preventDefault();
    if (!manualIpToBan.trim()) return;
    try {
      await api.banIp(manualIpToBan.trim(), 'Manual admin ban');
      setManualIpToBan('');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveGroqKey = async (e) => {
    e.preventDefault();
    try {
      const res = await api.saveAiConfig(groqKeyInput.trim());
      if (res.config) setAiConfig(res.config);
      setAiSaveMsg('AI Key updated and saved successfully!');
      setGroqKeyInput('');
      setTimeout(() => setAiSaveMsg(''), 4000);
    } catch (err) {
      setAiSaveMsg('Failed to save key: ' + err.message);
    }
  };

  const handleRunAiTest = async (e) => {
    e.preventDefault();
    setAiTesting(true);
    setAiTestResponse('');
    try {
      const res = await api.testAi(aiTestPrompt, aiTestTopic);
      setAiTestResponse(res.reply || 'No response received');
      if (res.config) setAiConfig(res.config);
    } catch (err) {
      setAiTestResponse('Error: ' + err.message);
    } finally {
      setAiTesting(false);
    }
  };

  const handleUnbanIp = async (ip) => {
    try {
      await api.unbanIp(ip);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleSessionBan = async (s) => {
    try {
      if (s.is_banned) {
        await api.unbanUser(s.session_id);
      } else {
        await api.banUser(s.session_id);
      }
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // ─── LOGIN SCREEN ─────────────────────────────────────────────
  if (!adminUser) {
    return (
      <div style={{ padding: '24px 16px', flex: 1 }}>
        <div className="flat-card" style={{ maxWidth: '400px', margin: '40px auto 0' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Counselor Login</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Faculty and moderation access only.
          </p>

          {authError && (
            <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '8px 12px', fontSize: '0.8rem', borderRadius: '6px', marginBottom: '12px' }}>
              {authError}
            </div>
          )}

          {!twoFaStep ? (
            <form onSubmit={handleLoginSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>UID:</label>
                <input
                  type="text"
                  placeholder="Enter UID"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  className="input-text"
                  required
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Password:</label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-text"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block">Login</button>
            </form>
          ) : (
            <form onSubmit={handle2faSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>2FA Code:</label>
                <input
                  type="text"
                  placeholder="Enter 2FA Code"
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value)}
                  className="input-text"
                  style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2em' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setTwoFaStep(false)} className="btn btn-secondary">Back</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Verify & Access</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ─── CHAT DETAIL VIEW ─────────────────────────────────────────
  if (selectedChat) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Chat header */}
        <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => { setSelectedChat(null); setChatMessages([]); }} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
            Back
          </button>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{selectedChat.student_alias || 'Student'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Confidential thread {selectedChat.is_crisis ? '• Crisis Flagged' : ''}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {chatMessages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '40px 0' }}>
              No messages yet. The student will see your reply here.
            </div>
          )}
          {chatMessages.map((m) => {
            const isAdmin = m.sender_type === 'admin';
            return (
              <div key={m.message_id} className={`msg-bubble ${isAdmin ? 'msg-me' : 'msg-peer'}`}>
                <div style={{ fontSize: '0.68rem', color: isAdmin ? 'rgba(0,0,0,0.5)' : 'var(--text-muted)', marginBottom: '2px' }}>
                  {m.sender_name}
                </div>
                <div>{m.content}</div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply input */}
        <form onSubmit={handleSendReply} className="chat-input-bar">
          <input
            type="text"
            placeholder="Reply to student..."
            value={replyInput}
            onChange={(e) => setReplyInput(e.target.value)}
            className="input-text"
          />
          <button type="submit" disabled={!replyInput.trim()} className="btn btn-primary" style={{ padding: '8px 16px' }}>
            Send
          </button>
        </form>
      </div>
    );
  }

  // ─── MAIN ADMIN PANEL ─────────────────────────────────────────
  return (
    <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem' }}>Admin Panel</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{adminUser.email}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={loadData} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
            Refresh
          </button>
          <button onClick={logoutAdmin} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        {[
          { id: 'messages', label: `Faculty Messages (${facultyChats.length})` },
          { id: 'reports', label: `Reports (${reports.length})` },
          { id: 'ip_bans', label: `Banned IPs (${usersData.banned_ips?.length || 0})` },
          { id: 'users', label: `Sessions (${usersData.sessions?.length || 0})` },
          { id: 'ai', label: 'AI Companion (Sukhi)' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: FACULTY MESSAGES */}
      {activeTab === 'messages' && (
        <div>
          {facultyChats.length === 0 ? (
            <div className="flat-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              No student messages yet. Messages sent via "Talk to Campus Counselor" appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {facultyChats.map((chat) => (
                <div key={chat.chat_id} className="flat-card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {chat.student_alias || 'Anonymous Student'}
                      {chat.is_crisis && (
                        <span className="badge-pill badge-red" style={{ fontSize: '0.68rem' }}>Crisis</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {chat.topic || 'No topic'} • {new Date(chat.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button onClick={() => openChat(chat)} className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '0.78rem' }}>
                    Open Thread
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: REPORTS */}
      {activeTab === 'reports' && (
        <div>
          {reports.length === 0 ? (
            <div className="flat-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              No moderation reports filed yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {reports.map((r) => (
                <div key={r.report_id} className="flat-card" style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="badge-pill" style={{ color: r.status === 'pending' ? '#fca5a5' : '#86efac' }}>
                      {r.status.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '0.88rem', marginBottom: '2px' }}>
                    {r.reason.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Reporter: {r.reporter_role} • Topic: {r.conversation_topic}
                  </div>
                  {r.description && (
                    <p style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      "{r.description}"
                    </p>
                  )}
                  <button onClick={() => handleViewReport(r.report_id)} className="btn btn-secondary btn-block" style={{ padding: '6px', fontSize: '0.8rem' }}>
                    Read Transcript & Action
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: BANNED IPS */}
      {activeTab === 'ip_bans' && (
        <div>
          <form onSubmit={handleBanIp} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="IP address to ban (e.g. 192.168.1.1)"
              value={manualIpToBan}
              onChange={(e) => setManualIpToBan(e.target.value)}
              className="input-text"
            />
            <button type="submit" className="btn btn-danger" style={{ whiteSpace: 'nowrap' }}>
              Ban IP
            </button>
          </form>

          {(usersData.banned_ips || []).length === 0 ? (
            <div className="flat-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              No IP addresses currently banned.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {usersData.banned_ips.map((ip) => (
                <div key={ip} className="flat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                  <code style={{ fontSize: '0.9rem' }}>{ip}</code>
                  <button onClick={() => handleUnbanIp(ip)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                    Unban
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: SESSIONS */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(usersData.sessions || []).length === 0 ? (
            <div className="flat-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              No active sessions.
            </div>
          ) : (
            (usersData.sessions || []).map((s) => (
              <div key={s.session_id} className="flat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{s.alias} <span style={{ color: 'var(--text-faint)', fontWeight: '400' }}>({s.user_role})</span></div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>IP: <code>{s.ip_address || '127.0.0.1'}</code></div>
                </div>
                <button
                  onClick={() => handleToggleSessionBan(s)}
                  className={`btn ${s.is_banned ? 'btn-secondary' : 'btn-danger'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  {s.is_banned ? 'Unban' : 'Ban'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: AI COMPANION (SUKHI) */}
      {activeTab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="flat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>Sukhi AI Engine Status</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Active Engine: <strong style={{ color: 'var(--text-primary)' }}>{aiConfig.provider || 'Context-Trained Engine'}</strong>
                </div>
              </div>
              <span className={`badge-pill ${aiConfig.groqConfigured ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '0.75rem' }}>
                {aiConfig.groqConfigured ? 'Groq Llama 3.3 Active' : 'Kibou Context Engine'}
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '14px' }}>
              Sukhi uses our context-trained mental health dialogue engine by default. For the fastest responses (~300ms) with Llama 3.3 70B, you can provide a free Groq API key.
            </p>

            <form onSubmit={handleSaveGroqKey} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="password"
                placeholder={aiConfig.groqKeyMasked ? `Current: ${aiConfig.groqKeyMasked}` : 'Paste Groq API Key (gsk_...)'}
                value={groqKeyInput}
                onChange={(e) => setGroqKeyInput(e.target.value)}
                className="input-text"
                style={{ flex: 1, minWidth: '240px' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
                Save & Activate
              </button>
            </form>
            {aiSaveMsg && (
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: aiSaveMsg.startsWith('Failed') ? '#f87171' : '#4ade80' }}>
                {aiSaveMsg}
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Free keys can be generated at <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>console.groq.com</a>.
            </div>
          </div>

          <div className="flat-card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px' }}>Live AI Test Console</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Test how Sukhi handles context and emotional nuance in real-time.
            </p>

            <form onSubmit={handleRunAiTest} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Category Context:</label>
                  <select
                    value={aiTestTopic}
                    onChange={(e) => setAiTestTopic(e.target.value)}
                    className="input-text"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  >
                    <option value="Academic Stress">Academic Stress</option>
                    <option value="Anxiety & Panic">Anxiety & Panic</option>
                    <option value="Relationships & Loneliness">Relationships & Loneliness</option>
                    <option value="Exhaustion & Sleep">Exhaustion & Sleep</option>
                    <option value="General Venting">General Venting</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>User Prompt:</label>
                <input
                  type="text"
                  placeholder="e.g. i feel academic stress"
                  value={aiTestPrompt}
                  onChange={(e) => setAiTestPrompt(e.target.value)}
                  className="input-text"
                  required
                />
              </div>

              <button type="submit" disabled={aiTesting} className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '6px 16px' }}>
                {aiTesting ? 'Generating...' : 'Test Sukhi Reply'}
              </button>
            </form>

            {aiTestResponse && (
              <div style={{ marginTop: '14px', padding: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>Sukhi Response:</div>
                <div style={{ fontSize: '0.85rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {aiTestResponse}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Transcript Modal */}
      {selectedReport && (
        <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '6px' }}>Chat Transcript</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Reason: <strong>{selectedReport.report?.reason?.replace(/_/g, ' ')}</strong>
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', marginBottom: '12px' }}>
              {selectedReport.messages?.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>No messages in this conversation.</div>
              )}
              {(selectedReport.messages || []).map((m) => (
                <div key={m.message_id} style={{ marginBottom: '6px', fontSize: '0.82rem' }}>
                  <strong>{m.sender_alias} ({m.sender_role}):</strong> {m.content}
                </div>
              ))}
            </div>

            <textarea
              placeholder="Admin notes..."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              className="textarea-input"
              rows={2}
              style={{ marginBottom: '12px' }}
            />

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedReport(null)} className="btn btn-secondary">Close</button>
              <button onClick={() => handleActionReport('dismiss')} className="btn btn-outline">Dismiss</button>
              <button onClick={() => handleActionReport('warn_user')} className="btn btn-primary">Warn</button>
              <button onClick={() => handleActionReport('ban_user')} className="btn btn-danger">Ban User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
