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

export default function App() {
  const { currentView, setCurrentView, activeTab, adminUser } = useApp();

  // When admin logs in, immediately switch to admin view
  useEffect(() => {
    if (adminUser && currentView !== 'admin') {
      setCurrentView('admin');
    }
  }, [adminUser]);

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

      <HotlinesModal />
      <BreathingModal />
      <FacultyChatModal />
    </div>
  );
}
