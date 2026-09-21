# Kibou

Anonymous peer mental health support for students. No name, no account, no waiting — just someone there.

Kibou matches students who need to vent with volunteer peer helpers in real time, or with **Sukhi**, a 24/7 AI companion that understands Hinglish and only ever talks about what you're actually feeling. Everything runs encrypted, counselors moderate from a secured panel, and crisis moments escalate to real helplines.

---

## What it does

- **Seeker ↔ Helper matching** — pick a topic (Academic Stress, Anxiety & Panic, Relationships, Family Issues, Loneliness, General Venting), get matched live over WebSockets.
- **Sukhi (AI Companion)** — Groq-powered peer listener with a strict mental-health-only scope: it reflects feelings, never tutors, never answers homework, and redirects off-topic questions back to how you're doing. Full Hinglish comprehension.
- **End-to-end AES-256 chat encryption**, crisis-keyword detection with instant Tele-MANAS / KIRAN escalation, faculty-counselor escalation channel.
- **Counselor moderation panel** — UID + password + 2FA login, report transcripts, warn/ban with instant live kick, session + IP bans, audit logs, AI engine status and key management.
- **Notifications that actually reach you** — header bell toggle, in-app toasts, OS notifications, and background Web Push (VAPID + service worker) for help requests and chat messages, even with the browser closed.
- **Thoughtful touches** — animated thinking-orb typing states, breathing exercise modal, sticky compact chat bar on mobile, dark/light themes, persistent bans that survive restarts.

---

## Stack

Express + Socket.io backend, React + Vite frontend, MongoDB Atlas when configured with automatic fallback to local JSON storage. Zero-dependency client orb (`thinking-orbs`), `web-push` for background alerts.

---

## Run it locally

```bash
# 1. Install everything (root, server, client)
npm run install:all

# 2. Configure environment
cp .env.example server/.env
# then fill in: JWT_SECRET, ENCRYPTION_KEY, GROQ_API_KEY (console.groq.com/keys),
# VAPID_* (generate via the command in .env.example), MONGODB_URI (optional)

# 3. Build + start
npm run build
npm start

# App at http://localhost:5000 (client dev server: npm run dev in /client → :3000)
```

---

## Deploy to Render

1. New Web Service from this repo (`main`), Node, Free plan.
2. Build: `npm install && npm run build` · Start: `npm start`.
3. Set env vars: `NODE_ENV=production`, `PORT=5000`, `JWT_SECRET`, `ENCRYPTION_KEY` (64-char hex), `GROQ_API_KEY`, `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `MONGODB_URI` (recommended — without it, Render's ephemeral disk wipes sessions, bans, and history on every restart).

Free MongoDB Atlas M0 works: create a cluster + db user, allow `0.0.0.0/0` under Network Access, paste the connection string as `MONGODB_URI`.

---

## Default counselor login

- **UID:** `shreyyay`
- **Password:** `100`
- **2FA code:** `100`

Change these before any public deployment.

---

## Project layout

```
client/                 React + Vite frontend
  src/views/            SeekerDashboard, HelperDashboard, ChatRoom, AdminPanel
  src/components/       Header, ToastStack, NotificationBell, modals
  src/services/         api, socket, notifications (toast + push bus)
  public/sw.js          service worker for background push
server/                 Express + Socket.io backend
  src/index.js          entrypoint · src/socket.js  realtime + ban enforcement
  src/routes.js         REST API · src/sukhi.js  AI companion engine
  src/push.js           Web Push delivery · src/db.js  JSON/Mongo store
brag-output/            launch video (brag.mp4), poster, plan, composition
```

Built for the nights when your brain won't shut up. If it helps one student feel heard at 2am, it worked.
