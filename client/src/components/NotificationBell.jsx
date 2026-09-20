import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ensureNotificationPermission, isNotificationSupported } from '../services/notifications';

export default function NotificationBell() {
  const { notifsEnabled, setNotifsEnabled } = useApp();
  const [busy, setBusy] = useState(false);

  const handleToggle = async () => {
    if (busy) return;
    if (notifsEnabled) {
      setNotifsEnabled(false);
      return;
    }
    setBusy(true);
    // User gesture: request OS-notification permission. Toasts work regardless.
    await ensureNotificationPermission();
    setNotifsEnabled(true);
    setBusy(false);
  };

  const supported = isNotificationSupported();

  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      className="icon-btn"
      aria-label={notifsEnabled ? 'Disable notifications' : 'Enable notifications'}
      title={
        notifsEnabled
          ? 'Notifications ON — new help requests & chat messages'
          : supported
            ? 'Notifications OFF — turn on for help requests & chat messages'
            : 'Notifications OFF — this browser blocks OS alerts, in-app toasts still work'
      }
      style={{ position: 'relative', opacity: busy ? 0.6 : 1 }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        {!notifsEnabled && <line x1="2" y1="2" x2="22" y2="22"></line>}
      </svg>
      {notifsEnabled && (
        <span
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#22c55e'
          }}
        />
      )}
    </button>
  );
}
