import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

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

  // Apply theme to html root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('seeker_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Restore sessions
  useEffect(() => {
    api.getHotlines().then((res) => setHotlines(res.hotlines || [])).catch(() => {});

    const storedSeeker = localStorage.getItem('seeker_session');
    if (storedSeeker) {
      try { setSeekerSession(JSON.parse(storedSeeker)); } catch (e) {}
    }

    const storedHelper = localStorage.getItem('helper_session');
    if (storedHelper) {
      try { setHelperSession(JSON.parse(storedHelper)); } catch (e) {}
    }

    const storedAdmin = localStorage.getItem('admin_user');
    if (storedAdmin) {
      try { setAdminUser(JSON.parse(storedAdmin)); } catch (e) {}
    }
  }, []);

  // Socket matching listener + admin channel
  useEffect(() => {
    const socket = getSocket();
    const currentSession = activeTab === 'helper' ? helperSession : seekerSession;

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

    const handleMatch = (data) => {
      if (data?.conversation) {
        setActiveConversation(data.conversation);
        setCurrentView('chat');
      }
    };

    socket.on('conversation_matched', handleMatch);
    return () => {
      socket.off('conversation_matched', handleMatch);
    };
  }, [seekerSession, helperSession, activeTab, adminUser]);

  const initSeekerSession = async () => {
    try {
      const res = await api.createAnonSession('seeker');
      setSeekerSession(res.session);
      localStorage.setItem('seeker_session', JSON.stringify(res.session));
      localStorage.setItem('seeker_token', res.token);
      return res.session;
    } catch (err) {
      console.error(err);
    }
  };

  const initHelperSession = async () => {
    try {
      const res = await api.createAnonSession('helper');
      setHelperSession(res.session);
      localStorage.setItem('helper_session', JSON.stringify(res.session));
      localStorage.setItem('helper_token', res.token);
      return res.session;
    } catch (err) {
      console.error(err);
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
        hotlines
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
