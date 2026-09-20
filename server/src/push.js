import webpush from 'web-push';
import { getDb, saveDatabase } from './db.js';

let pushReady = false;

function ensurePushConfigured() {
  if (pushReady) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    console.warn('[Push] VAPID keys missing — background push disabled.');
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    pushReady = true;
    return true;
  } catch (e) {
    console.warn('[Push] Invalid VAPID config:', e.message);
    return false;
  }
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

function getSubscriptions() {
  const db = getDb();
  if (!db.push_subscriptions) db.push_subscriptions = [];
  return db.push_subscriptions;
}

// Upsert a helper's browser push subscription (keyed by endpoint)
export function savePushSubscription(subscription, meta = {}) {
  if (!subscription?.endpoint) return null;
  const subs = getSubscriptions();
  const existing = subs.findIndex((s) => s.subscription?.endpoint === subscription.endpoint);
  const record = {
    subscription,
    role: meta.role || 'helper',
    session_id: meta.session_id || null,
    alias: meta.alias || null,
    created_at: new Date().toISOString()
  };
  if (existing >= 0) subs[existing] = { ...subs[existing], ...record };
  else subs.push(record);
  saveDatabase();
  return record;
}

export function removePushSubscription(endpoint) {
  if (!endpoint) return false;
  const db = getDb();
  if (!db.push_subscriptions) return false;
  const before = db.push_subscriptions.length;
  db.push_subscriptions = db.push_subscriptions.filter((s) => s.subscription?.endpoint !== endpoint);
  if (db.push_subscriptions.length !== before) {
    saveDatabase();
    return true;
  }
  return false;
}

// Notify all subscribed helpers that a seeker is waiting.
// Fire-and-forget: never blocks the socket handler. Dead endpoints are pruned.
export async function sendSeekerPush({ seeker_alias, topic, conversation_id }) {
  if (!ensurePushConfigured()) return { sent: 0, reason: 'push_not_configured' };
  const subs = getSubscriptions().filter((s) => s.role === 'helper' && s.subscription?.endpoint);
  if (subs.length === 0) return { sent: 0, reason: 'no_subscribers' };

  const title = 'Someone needs support';
  const body = `${seeker_alias || 'A seeker'} is waiting${topic ? ` — ${topic}` : ''}. Tap to help.`;
  const payload = JSON.stringify({
    title,
    body,
    tag: 'kibou-seeker-queue',
    url: '/',
    conversation_id: conversation_id || null
  });

  let sent = 0;
  await Promise.all(
    subs.map(async (record) => {
      try {
        await webpush.sendNotification(record.subscription, payload);
        sent += 1;
      } catch (e) {
        // 404/410 = subscription expired or revoked — prune it
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          removePushSubscription(record.subscription.endpoint);
        } else {
          console.warn('[Push] send failed:', e?.message || e);
        }
      }
    })
  );
  return { sent };
}
