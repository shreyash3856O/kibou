import React, { useEffect } from 'react';
import { useApp } from './context/AppContext';
import Header from './components/Header';
import DrawerMenu from './components/DrawerMenu';
import SeekerDashboard from './views/SeekerDashboard';
import HelperDashboard from './views/HelperDashboard';
import ChatRoom from './views/ChatRoom';
import AdminPanel from './views/AdminPanel';
import HotlinesModal from './components/HotlinesModal';
import BreathingModal from './components/BreathingModal';
import FacultyChatModal from './components/FacultyChatModal';
import ToastStack from './components/ToastStack';

export default function App() {
  const { currentView, setCurrentView, activeTab, adminUser, bannedInfo } = useApp();

  // When admin logs in, immediately switch to admin view
  useEffect(() => {
    if (adminUser && currentView !== 'admin') {
      setCurrentView('admin');
    }
  }, [adminUser]);

  // Banned users see only the restriction notice — no chat, no dashboards
  if (bannedInfo && !adminUser) {
    return (
      <div className="mobile-app">
        <Header />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 16px' }}>
          <div className="flat-card" style={{ textAlign: 'center', margin: 'auto 0', borderLeft: '4px solid #dc2626' }}>
            <div style={{ fontWeight: '700', fontSize: '1.15rem', marginBottom: '8px' }}>
              Access Restricted
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '12px' }}>
              {bannedInfo.message || 'Your access has been restricted by a moderator.'}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>
              If you believe this is a mistake, please reach out to the campus counseling team.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="mobile-app">
      <Header />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentView === 'chat' && <ChatRoom />}

        {currentView === 'admin' && <AdminPanel />}

        {currentView === 'main' && !adminUser && (
          <>
            {activeTab === 'seeker' && <SeekerDashboard />}
            {activeTab === 'helper' && <HelperDashboard />}
          </>
        )}

        {/* If admin is logged in but view is somehow main, show admin panel */}
        {currentView === 'main' && adminUser && <AdminPanel />}
      </main>

      <DrawerMenu />

      <ToastStack />

      <HotlinesModal />
      <BreathingModal />
      <FacultyChatModal />
    </div>
  );
}
