import React from 'react';
import { useApp } from '../context/AppContext';

export default function DrawerMenu() {
  const {
    showDrawer,
    setShowDrawer,
    theme,
    toggleTheme,
    setShowHotlinesModal,
    setShowBreathingModal,
    setShowFacultyChatModal,
    setCurrentView,
    adminUser,
    logoutAdmin
  } = useApp();

  if (!showDrawer) return null;

  return (
    <div className="drawer-backdrop" onClick={() => setShowDrawer(false)}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <span style={{ fontWeight: '700', fontSize: '1.05rem' }}>Menu</span>
          <button onClick={() => setShowDrawer(false)} className="icon-btn">
            ✕
          </button>
        </div>

        {/* Theme Switcher */}
        <button onClick={toggleTheme} className="drawer-link">
          <span>Theme:</span>
          <strong style={{ marginLeft: 'auto' }}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</strong>
        </button>

        {/* Hotlines */}
        <button
          onClick={() => {
            setShowDrawer(false);
            setShowHotlinesModal(true);
          }}
          className="drawer-link"
        >
          <span>Crisis Hotlines (24/7)</span>
        </button>

        {/* 4-7-8 Breathing */}
        <button
          onClick={() => {
            setShowDrawer(false);
            setShowBreathingModal(true);
          }}
          className="drawer-link"
        >
          <span>4-7-8 Breathing Tool</span>
        </button>

        {/* Faculty Escalation */}
        <button
          onClick={() => {
            setShowDrawer(false);
            setShowFacultyChatModal(true);
          }}
          className="drawer-link"
        >
          <span>Talk to Campus Counselor</span>
        </button>

        {/* Admin / Counselor Panel */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          {adminUser ? (
            <div>
              <button
                onClick={() => {
                  setShowDrawer(false);
                  setCurrentView('admin');
                }}
                className="drawer-link"
                style={{ fontWeight: '700' }}
              >
                Admin Panel ({adminUser.email})
              </button>
              <button
                onClick={() => {
                  logoutAdmin();
                  setShowDrawer(false);
                }}
                className="drawer-link"
                style={{ color: '#dc2626' }}
              >
                Sign Out Admin
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setShowDrawer(false);
                setCurrentView('admin');
              }}
              className="drawer-link"
              style={{ color: 'var(--text-muted)' }}
            >
              Counselor Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
