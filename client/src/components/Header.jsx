import React from 'react';
import { useApp } from '../context/AppContext';

export default function Header() {
  const { activeTab, setActiveTab, currentView, setCurrentView, setShowDrawer, adminUser } = useApp();

  return (
    <header className="app-header">
      <div
        onClick={() => { if (!adminUser) setCurrentView('main'); }}
        style={{ cursor: adminUser ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <span className="brand-title">Kibou</span>
      </div>

      {/* Show Seeker/Helper tabs only when NOT admin and on main view */}
      {currentView === 'main' && !adminUser ? (
        <div className="tab-switcher">
          <button
            onClick={() => setActiveTab('seeker')}
            className={`tab-btn ${activeTab === 'seeker' ? 'active' : ''}`}
          >
            Seeker
          </button>
          <button
            onClick={() => setActiveTab('helper')}
            className={`tab-btn ${activeTab === 'helper' ? 'active' : ''}`}
          >
            Helper
          </button>
        </div>
      ) : currentView !== 'main' ? (
        /* Back button when in chat/admin view */
        <button
          onClick={() => {
            if (adminUser && currentView === 'admin') return; // admin can't go back to seeker/helper
            setCurrentView('main');
          }}
          className="btn btn-outline"
          style={{ padding: '4px 10px', fontSize: '0.8rem', visibility: adminUser && currentView === 'admin' ? 'hidden' : 'visible' }}
        >
          Back
        </button>
      ) : (
        /* Admin is logged in and on main view — show admin label */
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Admin Mode</span>
      )}

      {/* Three-bar hamburger */}
      <button
        onClick={() => setShowDrawer(true)}
        className="icon-btn"
        aria-label="Menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
    </header>
  );
}
