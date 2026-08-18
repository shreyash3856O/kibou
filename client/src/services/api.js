const API_BASE = '/api';

// Generic request - picks up the first available session token
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('seeker_token') || localStorage.getItem('helper_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// Admin-specific request - always uses the admin JWT token
async function adminRequest(endpoint, options = {}) {
  const token = localStorage.getItem('admin_token');
  if (!token) throw new Error('Not authenticated as admin');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...options.headers
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  createAnonSession: (role, alias, topics) =>
    request('/auth/anon-session', {
      method: 'POST',
      body: JSON.stringify({ role, alias, topics })
    }),

  getMe: () => request('/auth/me'),

  adminLogin: (email, password) =>
    request('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  admin2faVerify: (admin_id, code) =>
    request('/auth/admin/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ admin_id, code })
    }),

  getAvailableHelpers: () => request('/helpers/available'),
  updateHelperStatus: (session_id, is_available) =>
    request('/helpers/status', {
      method: 'POST',
      body: JSON.stringify({ session_id, is_available })
    }),

  startConversation: (seeker_session_id, topic, initial_prompt, helper_session_id) =>
    request('/conversations/start', {
      method: 'POST',
      body: JSON.stringify({ seeker_session_id, topic, initial_prompt, helper_session_id })
    }),

  getWaitingConversations: () => request('/conversations/waiting'),

  acceptConversation: (conversation_id, helper_session_id) =>
    request(`/conversations/${conversation_id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ helper_session_id })
    }),

  endConversation: (conversation_id, session_id) =>
    request(`/conversations/${conversation_id}/end`, {
      method: 'POST',
      body: JSON.stringify({ session_id })
    }),

  getConversationMessages: (conversation_id) =>
    request(`/conversations/${conversation_id}/messages`),

  escalateConversation: (conversation_id) =>
    request(`/conversations/${conversation_id}/escalate`, { method: 'POST' }),

  getMyHistory: (sessionId) => request(`/conversations/my-history/${sessionId}`),

  submitReport: (conversation_id, reporter_session_id, reporter_role, reason, description) =>
    request('/report', {
      method: 'POST',
      body: JSON.stringify({ conversation_id, reporter_session_id, reporter_role, reason, description })
    }),

  startAdminChat: (student_session_id, initial_message) =>
    request('/admin-chats/start', {
      method: 'POST',
      body: JSON.stringify({ student_session_id, initial_message })
    }),

  getAdminChatMessages: (chat_id) => request(`/admin-chats/${chat_id}/messages`),

  getAdminReports: () => adminRequest('/admin/reports'),
  getAdminReportDetail: (id) => adminRequest(`/admin/reports/${id}`),
  actionAdminReport: (id, action, notes, target_session_id, target_ip) =>
    adminRequest(`/admin/reports/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, notes, target_session_id, target_ip })
    }),

  getAdminChats: () => adminRequest('/admin/chats'),
  getAdminChatMessages: (chat_id) => request(`/admin-chats/${chat_id}/messages`),
  getAdminUsersList: () => adminRequest('/admin/users'),
  banIp: (ip, reason) =>
    adminRequest('/admin/ban-ip', { method: 'POST', body: JSON.stringify({ ip, reason }) }),
  unbanIp: (ip) =>
    adminRequest('/admin/unban-ip', { method: 'POST', body: JSON.stringify({ ip }) }),

  banUser: (sessionId, reason) =>
    adminRequest(`/admin/users/${sessionId}/ban`, { method: 'POST', body: JSON.stringify({ reason }) }),
  unbanUser: (sessionId) =>
    adminRequest(`/admin/users/${sessionId}/unban`, { method: 'POST' }),

  getHotlines: () => request('/hotlines')
};
