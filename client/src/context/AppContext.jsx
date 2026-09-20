import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import {
  getStoredNotifEnabled,
  setStoredNotifEnabled,
  fireOsNotification,
  pushToast,
  getPushSubscription,
  subscribeBackgroundPush
} from '../services/notifications';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [activeTab, setActiveTab] = useState('seeker'); // 'seeker' | 'helper'
  const [currentView, setCurrentView] = useState('main'); // 'main' | 'chat' | 'admin'
  const [seekerSession, setSeekerSession] = useState(null);
  const [helperSession, setHelperSession] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);

  // Theme & Drawer
  const [theme, setTheme] = useState(localStorage.getItem('seeker_theme') || 'dark');
  const [showDrawer, setShowDrawer] = useState(false);
  const [showHotlinesModal, setShowHotlinesModal] = useState(false);
  const [showBreathingModal, setShowBreathingModal] = useState(false);
  const [showFacultyChatModal, setShowFacultyChatModal] = useState(false);

  const [hotlines, setHotlines] = useState([]);

  // Set when the server rejects a session as banned — blocks all app access
  const [bannedInfo, setBannedInfo] = useState(null);

  // Notification toggle (persisted). Controls help-request + chat-message alerts.
  const [notifsEnabled, setNotifsEnabledState] = useState(() => getStoredNotifEnabled());
  const setNotifsEnabled = (enabled) => {
    setStoredNotifEnabled(enabled);
    setNotifsEnabledState(enabled);
  };

  // Fresh refs so socket handlers always see current view/session without re-subscribing
  const viewRef = useRef(null);
  viewRef.current = { currentView, activeTab, activeConversation, seekerSession, helperSession, notifsEnabled, adminUser };

  const clearStoredSession = (role) => {
    localStorage.removeItem(`${role}_session`);
    localStorage.removeItem(`${role}_token`);
    if (role === 'seeker') setSeekerSession(null);
    else setHelperSession(null);
  };

  // Apply theme to html root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('seeker_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Restore and validate sessions
  useEffect(() => {
    api.getHotlines().then((res) => setHotlines(res.hotlines || [])).catch(() => {});

    // Returns { banned: true } when the server rejects the stored session as banned.
    // In that case we must NOT mint a fresh session — the user stays locked out.
    const verifyStoredSession = async (role, parsed) => {
      const me = await api.getMe(role).catch((err) => {
        if (err?.status === 403 && err?.data?.is_banned) {
          clearStoredSession(role);
          setBannedInfo({
            session_id: parsed?.session_id || null,
            message: 'Your access has been restricted by a moderator.'
          });
          return { banned: true };
        }
        return null;
      });
      return me;
    };

    const validateAndRestoreSessions = async () => {
      // 1. Helper session validation
      const storedHelper = localStorage.getItem('helper_session');
      if (storedHelper) {
        try {
          const parsed = JSON.parse(storedHelper);
          setHelperSession(parsed);
          // Verify with server
          const me = await verifyStoredSession('helper', parsed);
          if (me?.session) {
            setHelperSession(me.session);
            localStorage.setItem('helper_session', JSON.stringify(me.session));
          } else if (!me?.banned && !bannedInfo) {
            // Re-initialize if stale (never when banned)
            await initHelperSession();
          }
        } catch (e) {
          await initHelperSession();
        }
      } else {
        await initHelperSession();
      }

      // 2. Seeker session validation
      const storedSeeker = localStorage.getItem('seeker_session');
      if (storedSeeker) {
        try {
          const parsed = JSON.parse(storedSeeker);
          setSeekerSession(parsed);
          // Verify with server
          const me = await verifyStoredSession('seeker', parsed);
          if (me?.session) {
            setSeekerSession(me.session);
            localStorage.setItem('seeker_session', JSON.stringify(me.session));
          } else if (!me?.banned && !bannedInfo) {
            await initSeekerSession();
          }
        } catch (e) {
          await initSeekerSession();
        }
      } else {
        await initSeekerSession();
      }

      // 3. Admin validation
      const storedAdmin = localStorage.getItem('admin_user');
      if (storedAdmin) {
        try { setAdminUser(JSON.parse(storedAdmin)); } catch (e) {}
      }
    };

    validateAndRestoreSessions();
  }, []);

  // Socket matching listener + admin channel + auto-reconnect sync
  useEffect(() => {
    const socket = getSocket();
    const currentSession = activeTab === 'helper' ? helperSession : seekerSession;

    const registerCurrent = () => {
      if (currentSession) {
        socket.emit('register_session', {
          session_id: currentSession.session_id,
          role: currentSession.user_role,
          alias: currentSession.alias
        });
      }
      if (adminUser) {
        socket.emit('join_admin_channel');
      }
    };

    registerCurrent();
    socket.on('connect', registerCurrent);

    const handleMatch = (data) => {
      if (data?.conversation) {
        setActiveConversation(data.conversation);
        setCurrentView('chat');
      }
    };

    socket.on('conversation_matched', handleMatch);

    // Instant moderator ban kick — lock out the matching session immediately
    const handleSessionBanned = (data) => {
      const bannedId = data?.session_id;
      let matched = false;
      if (bannedId && seekerSession?.session_id === bannedId) {
        clearStoredSession('seeker');
        matched = true;
      }
      if (bannedId && helperSession?.session_id === bannedId) {
        clearStoredSession('helper');
        matched = true;
      }
      if (matched || !bannedId) {
        setBannedInfo({
          session_id: bannedId || null,
          message: data?.message || 'Your access has been restricted by a moderator.'
        });
        setCurrentView('main');
        setActiveConversation(null);
      }
    };

    socket.on('session_banned', handleSessionBanned);
    return () => {
      socket.off('connect', registerCurrent);
      socket.off('conversation_matched', handleMatch);
      socket.off('session_banned', handleSessionBanned);
    };
  }, [seekerSession, helperSession, activeTab, adminUser]);

  // Self-heal background push: browsers can drop subscriptions and server
  // restarts can wipe the subscriber list — if the bell is ON but no active
  // browser subscription exists, silently re-subscribe and re-register.
  useEffect(() => {
    if (!notifsEnabled || !helperSession || adminUser || bannedInfo) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = await getPushSubscription();
        if (existing || cancelled) return;
        const keyRes = await api.getVapidKey().catch(() => ({}));
        if (!keyRes?.publicKey || cancelled) return;
        const sub = await subscribeBackgroundPush(keyRes.publicKey);
        if (!sub || cancelled) return;
        await api
          .subscribePush(sub.toJSON(), 'helper', helperSession.session_id, helperSession.alias)
          .catch(() => {});
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [notifsEnabled, helperSession?.session_id, adminUser, bannedInfo]);

  // Global real-notification dispatcher: help requests + chat messages.
  // Subscribed once; reads live state through viewRef (no stale closures).
  useEffect(() => {
    const socket = getSocket();

    // Someone is seeking help — notify users holding a helper session
    const handleSeekerInQueue = (data) => {
      const v = viewRef.current;
      if (!v.notifsEnabled || !v.helperSession || v.adminUser) return;
      const title = 'Someone needs support';
      const body = `${data?.seeker_alias || 'A seeker'} is waiting${data?.topic ? ` — ${data.topic}` : ''}. Tap to help.`;
      fireOsNotification(title, body, 'kibou-seeker-queue');
      pushToast({
        title,
        body,
        onClick: () => {
          setActiveTab('helper');
          setCurrentView('main');
        }
      });
    };

    // New chat message (peer or Sukhi) — skip own messages and the open chat
    const handleChatMessage = (msg) => {
      const v = viewRef.current;
      if (!v.notifsEnabled || !msg) return;
      const ownIds = [v.seekerSession?.session_id, v.helperSession?.session_id].filter(Boolean);
      if (ownIds.includes(msg.sender_session_id)) return;
      if (v.currentView === 'chat' && v.activeConversation?.conversation_id === msg.conversation_id) return;
      const sender = msg.sender_alias || (msg.sender_role === 'helper' ? 'Helper' : 'Peer');
      const snippet = (msg.content || '').trim();
      const title = `New message from ${sender}`;
      const body = snippet.length > 90 ? `${snippet.slice(0, 90)}...` : snippet;
      fireOsNotification(title, body || 'You have a new message.', `kibou-chat-${msg.conversation_id}`);
      pushToast({
        title,
        body: body || 'You have a new message.',
        onClick: async () => {
          try {
            const res = await api.getConversationMessages(msg.conversation_id);
            if (res?.conversation) {
              setActiveConversation(res.conversation);
              setCurrentView('chat');
            }
          } catch (e) {}
        }
      });
    };

    socket.on('new_seeker_in_queue', handleSeekerInQueue);
    socket.on('new_message', handleChatMessage);
    return () => {
      socket.off('new_seeker_in_queue', handleSeekerInQueue);
      socket.off('new_message', handleChatMessage);
    };
  }, []);

  const initSeekerSession = async () => {
    if (bannedInfo) return null;
    try {
      const res = await api.createAnonSession('seeker');
      setSeekerSession(res.session);
      localStorage.setItem('seeker_session', JSON.stringify(res.session));
      localStorage.setItem('seeker_token', res.token);
      return res.session;
    } catch (err) {
      console.error('Init seeker session error:', err);
    }
  };

  const initHelperSession = async () => {
    if (bannedInfo) return null;
    try {
      const res = await api.createAnonSession('helper');
      setHelperSession(res.session);
      localStorage.setItem('helper_session', JSON.stringify(res.session));
      localStorage.setItem('helper_token', res.token);
      return res.session;
    } catch (err) {
      console.error('Init helper session error:', err);
    }
  };

  const loginAdminSuccess = (admin, token) => {
    setAdminUser(admin);
    localStorage.setItem('admin_user', JSON.stringify(admin));
    localStorage.setItem('admin_token', token);
  };

  const logoutAdmin = () => {
    setAdminUser(null);
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_token');
    setCurrentView('main');
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        currentView,
        setCurrentView,
        seekerSession,
        initSeekerSession,
        helperSession,
        initHelperSession,
        adminUser,
        loginAdminSuccess,
        logoutAdmin,
        activeConversation,
        setActiveConversation,
        theme,
        toggleTheme,
        showDrawer,
        setShowDrawer,
        showHotlinesModal,
        setShowHotlinesModal,
        showBreathingModal,
        setShowBreathingModal,
        showFacultyChatModal,
        setShowFacultyChatModal,
        hotlines,
        bannedInfo,
        setBannedInfo,
        notifsEnabled,
        setNotifsEnabled
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
