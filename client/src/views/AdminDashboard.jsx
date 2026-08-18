import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { 
  ShieldAlert, 
  Lock, 
  KeyRound, 
  BarChart3, 
  Flag, 
  MessageSquare, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  LogOut, 
  Eye, 
  UserX, 
  UserCheck, 
  FileText,
  Send,
  Sparkles,
  PhoneCall,
  Search
} from 'lucide-react';

export default function AdminDashboard() {
  const { 
    adminUser, 
    loginAdminSuccess, 
    logoutAdmin,
    playAlertSound
  } = useApp();

  // Auth State
  const [email, setEmail] = useState('counselor@school.edu');
  const [password, setPassword] = useState('AdminPass123!');
  const [twoFaStep, setTwoFaStep] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState('123456');
  const [adminIdFor2fa, setAdminIdFor2fa] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState('crisis'); // 'crisis', 'reports', 'inbox', 'analytics', 'users', 'audit'

  // Data States
  const [analytics, setAnalytics] = useState(null);
  const [crisisAlerts, setCrisisAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [chats, setChats] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Selected Report Modal
  const [selectedReportDetail, setSelectedReportDetail] = useState(null);
  const [actionNotes, setActionNotes] = useState('');

  // Active Direct Chat with Student
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInputText, setChatInputText] = useState('');

  // Load all admin data
  const loadAdminData = async () => {
    if (!adminUser) return;
    try {
      const [anRes, crRes, repRes, chRes, usRes, audRes] = await Promise.all([
        api.getAdminAnalytics().catch(() => ({})),
        api.getAdminCrisisAlerts().catch(() => ({})),
        api.getAdminReports().catch(() => ({})),
        api.getAdminChatsList().catch(() => ({})),
        api.getAdminUsersList().catch(() => ({})),
        api.getAdminAuditLogs().catch(() => ({}))
      ]);

      setAnalytics(anRes.analytics || null);
      setCrisisAlerts(crRes.crisis_alerts || []);
      setReports(repRes.reports || []);
      setChats(chRes.chats || []);
      setUsersList(usRes.users || []);
      setAuditLogs(audRes.audit_logs || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  useEffect(() => {
    if (adminUser) {
      loadAdminData();
      const interval = setInterval(loadAdminData, 6000);

      const socket = getSocket();
      socket.emit('join_admin_channel');

      socket.on('admin_crisis_alert', (data) => {
        playAlertSound('crisis');
        loadAdminData();
      });

      socket.on('admin_escalation_alert', (data) => {
        playAlertSound('crisis');
        loadAdminData();
      });

      socket.on('admin_chat_inbox_updated', () => {
        loadAdminData();
      });

      return () => {
        clearInterval(interval);
        socket.off('admin_crisis_alert');
        socket.off('admin_escalation_alert');
        socket.off('admin_chat_inbox_updated');
      };
    }
  }, [adminUser]);

  // Load chat messages when selectedChat changes
  useEffect(() => {
    if (selectedChat) {
      api.getAdminChatMessages(selectedChat.chat_id).then((res) => {
        setChatMessages(res.messages || []);
      });

      const socket = getSocket();
      socket.emit('join_admin_chat', { chat_id: selectedChat.chat_id });

      socket.on('new_admin_chat_message', (msg) => {
        if (msg.chat_id === selectedChat.chat_id) {
          setChatMessages((prev) => [...prev, msg]);
        }
      });

      return () => {
        socket.off('new_admin_chat_message');
      };
    }
  }, [selectedChat]);

  // Handle Login Step 1
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await api.adminLogin(email, password);
      if (res.require_2fa) {
        setAdminIdFor2fa(res.admin_id);
        setTwoFaStep(true);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  // Handle Login Step 2 (2FA)
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

  // Open Report Review Modal
  const handleViewReport = async (reportId) => {
    try {
      const res = await api.getAdminReportDetail(reportId);
      setSelectedReportDetail(res);
      setActionNotes('');
    } catch (err) {
      alert('Error fetching report: ' + err.message);
    }
  };

  // Action Report (Warn, Ban, Dismiss)
  const handleActionReport = async (action) => {
    if (!selectedReportDetail) return;
    try {
      const targetSessionId = selectedReportDetail.report.reporter_role === 'seeker'
        ? selectedReportDetail.conversation?.helper_session_id
        : selectedReportDetail.conversation?.seeker_session_id;

      await api.actionAdminReport(
        selectedReportDetail.report.report_id,
        action,
        actionNotes,
        targetSessionId
      );

      setSelectedReportDetail(null);
      loadAdminData();
    } catch (err) {
      alert('Action failed: ' + err.message);
    }
  };

  // Send Counselor Message to Student
  const handleSendCounselorMessage = async (e) => {
    e.preventDefault();
    if (!chatInputText.trim() || !selectedChat) return;

    const content = chatInputText.trim();
    setChatInputText('');

    const socket = getSocket();
    socket.emit('send_admin_chat_message', {
      chat_id: selectedChat.chat_id,
      sender_type: 'admin',
      sender_id: adminUser.admin_id,
      sender_name: adminUser.name || 'Campus Counselor',
      content
    });
  };

  // Toggle Ban / Unban for a user session
  const handleToggleBan = async (user) => {
    try {
      if (user.is_banned) {
        await api.unbanUser(user.session_id);
      } else {
        const reason = prompt('Enter reason for banning this session ID:', 'Safety / Terms of service violation');
        if (reason) {
          await api.banUser(user.session_id, reason);
        }
      }
      loadAdminData();
    } catch (err) {
      alert('Ban action failed: ' + err.message);
    }
  };

  // ==========================================
  // VIEW: ADMIN AUTHENTICATION
  // ==========================================
  if (!adminUser) {
    return (
      <div style={{ padding: '60px 0', minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
        <div className="container" style={{ maxWidth: '440px' }}>
          <div className="glass-card" style={{ padding: '36px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
              }}>
                <ShieldAlert size={28} color="#ffffff" />
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '800' }}>
                Campus Counselor Portal
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Faculty & Counseling Staff Secure Access
              </p>
            </div>

            {authError && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '0.85rem',
                color: '#fb7185',
                marginBottom: '18px'
              }}>
                {authError}
              </div>
            )}

            {!twoFaStep ? (
              <form onSubmit={handleLoginSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                    School / Counselor Email:
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#ffffff',
                      padding: '10px 14px',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                    Password:
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#ffffff',
                      padding: '10px 14px',
                      fontSize: '0.9rem'
                    }}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Default demo: <code>counselor@school.edu</code> / <code>AdminPass123!</code>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px' }}
                >
                  Continue to 2FA Verification →
                </button>
              </form>
            ) : (
              <form onSubmit={handle2faSubmit}>
                <div style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '16px'
                }}>
                  <KeyRound size={16} color="#818cf8" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Two-Factor Authentication is enforced for student safety and FERPA compliance.
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                    Enter 6-Digit 2FA Code:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="123456"
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value)}
                    style={{
                      width: '100%',
                      textAlign: 'center',
                      letterSpacing: '0.3em',
                      fontSize: '1.4rem',
                      fontWeight: '700',
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid #6366f1',
                      borderRadius: 'var(--radius-sm)',
                      color: '#ffffff',
                      padding: '10px'
                    }}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
                    Demo bypass code prefilled: <code>123456</code>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setTwoFaStep(false)}
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 2, padding: '12px' }}
                  >
                    Verify & Access Portal
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: LOGGED IN COUNSELOR DASHBOARD
  // ==========================================
  return (
    <div style={{ padding: '24px 0 60px' }}>
      <div className="container">
        
        {/* Admin Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-indigo">
                <ShieldAlert size={12} /> Counselor Portal
              </span>
              <span className="badge badge-emerald">
                {adminUser.name || 'Campus Counselor'} ({adminUser.email})
              </span>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: '800', marginTop: '4px' }}>
              Counseling & Moderation Hub
            </h1>
          </div>

          <button
            onClick={logoutAdmin}
            className="btn btn-outline"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>

        {/* Top Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-glass)',
          paddingBottom: '12px',
          marginBottom: '28px',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => setActiveTab('crisis')}
            className={`btn ${activeTab === 'crisis' ? 'btn-danger' : 'btn-ghost'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <AlertTriangle size={16} />
            <span>Live Crisis Radar ({crisisAlerts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Flag size={16} />
            <span>Reports Queue ({reports.filter((r) => r.status === 'pending').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inbox')}
            className={`btn ${activeTab === 'inbox' ? 'btn-teal' : 'btn-ghost'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <MessageSquare size={16} />
            <span>Direct Student Chats ({chats.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <BarChart3 size={16} />
            <span>Platform Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Users size={16} />
            <span>User Management ({usersList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`btn ${activeTab === 'audit' ? 'btn-outline' : 'btn-ghost'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <FileText size={16} />
            <span>Audit Trail</span>
          </button>
        </div>

        {/* ==========================================
            TAB 1: LIVE CRISIS RADAR (1-Hour SLA)
            ========================================== */}
        {activeTab === 'crisis' && (
          <div>
            <div style={{
              background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.15), rgba(139, 92, 246, 0.1))',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 24px',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'rgba(244, 63, 94, 0.25)',
                  color: '#f43f5e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: '#fda4af' }}>
                    1-Hour SLA Crisis Response Center
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Conversations flagged with crisis keywords or escalated by students/helpers appear here with top priority.
                  </p>
                </div>
              </div>
            </div>

            {crisisAlerts.length === 0 ? (
              <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '1.1rem', color: '#ffffff' }}>No active crisis flags</h4>
                <p style={{ fontSize: '0.85rem' }}>All student peer sessions are currently operating within safe parameters.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {crisisAlerts.map((c) => (
                  <div
                    key={c.conversation_id}
                    className="glass-card"
                    style={{
                      padding: '20px 24px',
                      borderLeft: '5px solid #f43f5e'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="badge badge-rose" style={{ fontWeight: '700' }}>
                            CRISIS FLAGGED
                          </span>
                          <span className="badge badge-indigo">
                            {c.topic}
                          </span>
                          <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>
                            <Clock size={12} /> SLA Review Deadline: {new Date(c.sla_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.9rem', color: '#ffffff' }}>
                          Seeker: <strong>{c.seeker_alias}</strong> • Helper: <strong>{c.helper_alias || 'Unassigned'}</strong>
                        </div>

                        {c.crisis_keywords?.length > 0 && (
                          <div style={{ fontSize: '0.8rem', color: '#fda4af', marginTop: '4px' }}>
                            Triggered keywords: <strong>{c.crisis_keywords.join(', ')}</strong>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setSelectedChat({
                            chat_id: c.conversation_id,
                            student_alias: c.seeker_alias,
                            topic: c.topic
                          });
                          setActiveTab('inbox');
                        }}
                        className="btn btn-teal"
                        style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                      >
                        <MessageSquare size={16} /> Open Counselor Outreach
                      </button>
                    </div>

                    {/* Recent Message Snippets */}
                    <div style={{
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px',
                      fontSize: '0.85rem'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Recent Conversation Transcript (Encrypted Decrypted for Audit):
                      </div>
                      {(c.recent_messages || []).map((m, i) => (
                        <div key={i} style={{ marginBottom: '4px' }}>
                          <strong style={{ color: m.is_crisis ? '#f43f5e' : '#818cf8' }}>
                            {m.sender_alias}:
                          </strong>{' '}
                          <span style={{ color: m.is_crisis ? '#fda4af' : 'var(--text-primary)' }}>
                            {m.content}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 2: REPORTS MODERATION QUEUE
            ========================================== */}
        {activeTab === 'reports' && (
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '16px' }}>
              Student Safety Reports Queue
            </h3>

            {reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                No moderation reports filed.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reports.map((r) => (
                  <div
                    key={r.report_id}
                    className="glass-panel"
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className={`badge ${r.status === 'pending' ? 'badge-rose' : 'badge-emerald'}`}>
                          {r.status.toUpperCase()}
                        </span>
                        <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                          Reason: {r.reason}
                        </span>
                        <span className="badge badge-indigo" style={{ fontSize: '0.7rem' }}>
                          {r.conversation_topic}
                        </span>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        "{r.description || 'No additional note provided by reporter.'}"
                      </p>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Reported by: <strong>{r.reporter_role}</strong> at {new Date(r.created_at).toLocaleString()}
                        {r.action_taken !== 'none' && ` • Action taken: ${r.action_taken}`}
                      </div>
                    </div>

                    <button
                      onClick={() => handleViewReport(r.report_id)}
                      className="btn btn-outline"
                      style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                    >
                      <Eye size={16} /> Review Transcript
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 3: DIRECT STUDENT COUNSELOR INBOX
            ========================================== */}
        {activeTab === 'inbox' && (
          <div className="grid-cols-3" style={{ gap: '20px' }}>
            {/* Chats List */}
            <div>
              <div className="glass-card" style={{ padding: '20px' }}>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '14px' }}>
                  Student Direct Inquiries ({chats.length})
                </h4>

                {chats.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No direct student chats yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {chats.map((c) => {
                      const isSelected = selectedChat?.chat_id === c.chat_id;
                      return (
                        <div
                          key={c.chat_id}
                          onClick={() => setSelectedChat(c)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 'var(--radius-sm)',
                            background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${isSelected ? '#6366f1' : 'var(--border-glass)'}`,
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#ffffff' }}>
                              {c.student_alias || 'Student'}
                            </span>
                            {c.is_crisis && (
                              <span className="badge badge-rose" style={{ fontSize: '0.65rem' }}>CRISIS</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.last_message || 'Active counseling thread'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Thread */}
            <div style={{ gridColumn: 'span 2' }}>
              <div className="glass-card" style={{ height: '550px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {selectedChat ? (
                  <>
                    <div style={{
                      padding: '14px 20px',
                      background: 'rgba(15, 23, 42, 0.85)',
                      borderBottom: '1px solid var(--border-glass)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <h4 style={{ fontSize: '1rem', color: '#ffffff' }}>
                          Confidential Thread with {selectedChat.student_alias}
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Session ID: {selectedChat.student_session_id || selectedChat.chat_id}
                        </span>
                      </div>
                      <span className="badge badge-emerald">Encrypted 2-Way Channel</span>
                    </div>

                    <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {chatMessages.map((m) => {
                        const isMe = m.sender_type === 'admin';
                        return (
                          <div
                            key={m.message_id}
                            style={{
                              alignSelf: isMe ? 'flex-end' : 'flex-start',
                              maxWidth: '80%'
                            }}
                          >
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', textAlign: isMe ? 'right' : 'left' }}>
                              {m.sender_name} • {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div style={{
                              padding: '10px 16px',
                              borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              background: isMe ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(30, 41, 59, 0.9)',
                              color: '#ffffff',
                              fontSize: '0.88rem'
                            }}>
                              {m.content}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <form onSubmit={handleSendCounselorMessage} style={{ padding: '14px 20px', background: 'rgba(15, 23, 42, 0.9)', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: '10px' }}>
                      <input
                        type="text"
                        placeholder="Reply as Campus Counselor..."
                        value={chatInputText}
                        onChange={(e) => setChatInputText(e.target.value)}
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
                      <button type="submit" className="btn btn-teal" style={{ padding: '10px 22px' }}>
                        <Send size={16} /> Send
                      </button>
                    </form>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    Select a student inquiry from the left to view and respond.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 4: PLATFORM ANALYTICS
            ========================================== */}
        {activeTab === 'analytics' && analytics && (
          <div>
            <div className="grid-cols-3" style={{ gap: '20px', marginBottom: '28px' }}>
              <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Active Users (Anonymous Sessions)</div>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff' }}>{analytics.active_users}</div>
              </div>

              <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Helpers Online on Duty</div>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: '#14b8a6' }}>{analytics.helpers_online}</div>
              </div>

              <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Crisis Flags Today</div>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: analytics.crisis_flags_today > 0 ? '#f43f5e' : '#10b981' }}>
                  {analytics.crisis_flags_today}
                </div>
              </div>
            </div>

            <div className="grid-cols-2" style={{ gap: '20px' }}>
              <div className="glass-card" style={{ padding: '24px' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Support Topics Breakdown</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(analytics.topic_distribution || {}).map(([topic, count]) => (
                    <div key={topic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '0.9rem' }}>{topic}</span>
                      <strong style={{ color: '#818cf8' }}>{count} sessions</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card" style={{ padding: '24px' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Safety & Compliance Overview</h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  <p>• <strong>Encryption:</strong> AES-256-CBC at rest with auto-expiration.</p>
                  <p>• <strong>Anonymity:</strong> Device SHA-256 salted hashes. Zero student PII stored.</p>
                  <p>• <strong>FERPA/GDPR:</strong> Compliance-ready data retention & audit logging.</p>
                  <p>• <strong>Banned Accounts:</strong> {analytics.banned_users} accounts restricted.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 5: USER MANAGEMENT & BANS
            ========================================== */}
        {activeTab === 'users' && (
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '16px' }}>
              Session Account Management (Ban / Unban)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Moderators can restrict malicious actors by their unique session hash without collecting personal identity.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {usersList.map((u) => (
                <div
                  key={u.session_id}
                  className="glass-panel"
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{u.alias}</span>
                      <span className={`badge ${u.user_role === 'helper' ? 'badge-teal' : 'badge-indigo'}`}>
                        {u.user_role}
                      </span>
                      {u.is_banned ? (
                        <span className="badge badge-rose">BANNED / RESTRICTED</span>
                      ) : (
                        <span className="badge badge-emerald">ACTIVE</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Hash: <code>{u.user_hash}</code> • Created: {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleBan(u)}
                    className={`btn ${u.is_banned ? 'btn-teal' : 'btn-danger'}`}
                    style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                  >
                    {u.is_banned ? <><UserCheck size={14} /> Unban Session</> : <><UserX size={14} /> Ban Session</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 6: AUDIT TRAIL
            ========================================== */}
        {activeTab === 'audit' && (
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '16px' }}>
              Administrative Audit Logs
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditLogs.map((log) => (
                <div
                  key={log.log_id}
                  className="glass-panel"
                  style={{ padding: '12px 16px', fontSize: '0.85rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span className="badge badge-indigo" style={{ fontSize: '0.7rem' }}>
                      {log.action}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-primary)', marginTop: '4px' }}>
                    {log.details}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report Review Modal */}
        {selectedReportDetail && (
          <div className="modal-overlay">
            <div className="glass-card" style={{ maxWidth: '750px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '28px' }}>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '6px' }}>
                Review Report: {selectedReportDetail.report.report_id}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Reason: <strong>{selectedReportDetail.report.reason}</strong> | Description: "{selectedReportDetail.report.description}"
              </p>

              {/* Chat Transcript */}
              <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.4)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  FULL DECRYPTED CHAT LOG:
                </div>
                {selectedReportDetail.messages.map((m) => (
                  <div key={m.message_id} style={{ marginBottom: '8px', fontSize: '0.85rem' }}>
                    <strong style={{ color: m.sender_role === 'seeker' ? '#818cf8' : '#14b8a6' }}>
                      {m.sender_alias} ({m.sender_role}):
                    </strong>{' '}
                    <span>{m.content}</span>
                  </div>
                ))}
              </div>

              <textarea
                placeholder="Enter admin action notes..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                style={{
                  width: '100%',
                  height: '60px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#ffffff',
                  padding: '8px',
                  fontSize: '0.85rem',
                  marginBottom: '16px'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setSelectedReportDetail(null)} className="btn btn-ghost">Cancel</button>
                <button onClick={() => handleActionReport('dismiss')} className="btn btn-outline">Dismiss</button>
                <button onClick={() => handleActionReport('warn_user')} className="btn btn-primary">Send Warning</button>
                <button onClick={() => handleActionReport('ban_user')} className="btn btn-danger">Ban Violator</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
