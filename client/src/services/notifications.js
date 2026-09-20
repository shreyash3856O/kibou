// Real notifications (OS-level via Web Notification API + in-app toasts).
// No console.log / alert() paths — everything surfaces to the user.

const ENABLED_KEY = 'kibou_notifs_enabled';

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getStoredNotifEnabled() {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch (e) {
    return false;
  }
}

export function setStoredNotifEnabled(enabled) {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch (e) {}
}

// Ask the browser for OS-notification permission (must be called from a user gesture).
export async function ensureNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return Notification.permission || 'denied';
  }
}

// Fire an OS-level notification. Only when the tab is hidden —
// when the user is looking at the app, the in-app toast covers it.
export function fireOsNotification(title, body, tag) {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  try {
    const notif = new Notification(title, {
      body,
      tag: tag || 'kibou',
      icon: '/kibou-logo.png',
      badge: '/kibou-logo.png',
      renotify: true
    });
    notif.onclick = () => {
      try {
        window.focus();
        notif.close();
      } catch (e) {}
    };
  } catch (e) {}
}

// ---- Web Push subscription (background alerts, browser closed) ----

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function getPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch (e) {
    return null;
  }
}

// Subscribe this browser for background push. Returns the subscription or null
// (null = unsupported here; in-app toasts still work).
export async function subscribeBackgroundPush(vapidPublicKey) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  if (!vapidPublicKey) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }
    return sub;
  } catch (e) {
    return null;
  }
}

export async function unsubscribeBackgroundPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return null;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    return endpoint;
  } catch (e) {
    return null;
  }
}

// ---- In-app toast bus (works even when OS permission is denied) ----
const toastListeners = new Set();
let toastSeq = 0;

export function subscribeToasts(fn) {
  toastListeners.add(fn);
  return () => toastListeners.delete(fn);
}

export function pushToast({ title, body, onClick }) {
  const toast = { id: ++toastSeq, title, body, onClick: onClick || null, createdAt: Date.now() };
  toastListeners.forEach((fn) => {
    try {
      fn(toast);
    } catch (e) {}
  });
  return toast;
}
