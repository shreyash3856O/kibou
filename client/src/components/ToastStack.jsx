import React, { useEffect, useState } from 'react';
import { subscribeToasts } from '../services/notifications';

const TOAST_LIFETIME_MS = 4500;

export default function ToastStack() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToasts((toast) => {
      setToasts((prev) => [...prev.slice(-2), toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, TOAST_LIFETIME_MS);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-item"
          role="status"
          onClick={() => {
            if (t.onClick) {
              try {
                t.onClick();
              } catch (e) {}
            }
            setToasts((prev) => prev.filter((x) => x.id !== t.id));
          }}
        >
          <div className="toast-title">{t.title}</div>
          {t.body && <div className="toast-body">{t.body}</div>}
        </div>
      ))}
    </div>
  );
}
