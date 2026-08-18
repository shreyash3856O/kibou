# Seeker 🌿

Anonymous peer mental health and crisis support platform. Built with a clean, mobile-first design, end-to-end AES-256 chat encryption, real-time crisis detection keywords, faculty counseling escalation, and a 2FA-secured counselor moderation panel.

---

## 🚀 One-Click Deploy to Render

Seeker is structured as a unified full-stack application (Express + React Vite + Socket.io WebSockets) that runs on a single port.

### Step 1: Create a Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
2. Select **Build and deploy from a Git repository** and connect your GitHub repository: `shreyash3856O/kibou`.

### Step 2: Configure Service Settings
- **Name**: `seeker-app` (or your preferred name)
- **Language**: `Node`
- **Branch**: `main`
- **Region**: Any (e.g., `Oregon (US West)` or `Frankfurt (EU)`)
- **Build Command**:
  ```bash
  npm install && npm run build
  ```
- **Start Command**:
  ```bash
  npm start
  ```
- **Plan**: `Free`

### Step 3: Set Environment Variables on Render
Under the **Environment Variables** tab in your Render Web Service settings, add:

| Key | Example / Recommended Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production optimizations |
| `PORT` | `5000` | Server listening port |
| `JWT_SECRET` | `seeker_super_secure_jwt_secret_2026` | Random secure string for authentication tokens |
| `ENCRYPTION_KEY` | `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` | 64-character hex key for AES-256 message encryption |
| `MONGODB_URI` *(Recommended)* | `mongodb+srv://user:pass@cluster.mongodb.net/seeker` | MongoDB Atlas URI for persistent database storage (see below) |

> **Note on Database**: If `MONGODB_URI` is provided, Seeker automatically saves all sessions, conversations, messages, reports, and counselor chats to MongoDB. If `MONGODB_URI` is not set, Seeker automatically runs with local JSON storage.

---

## 🗄️ Setting Up Free MongoDB Atlas (Optional but Recommended)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free **M0 Shared Cluster**.
3. Under **Database Access**, create a database user and password.
4. Under **Network Access**, click **Add IP Address** → choose **Allow Access From Anywhere (`0.0.0.0/0`)** so Render can connect.
5. Click **Connect** → **Drivers** → copy the connection string (e.g. `mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/seeker?retryWrites=true&w=majority`).
6. Paste it as `MONGODB_URI` in Render environment variables.

---

## 🩺 Default Counselor Admin Credentials

- **Email**: `counselor@school.edu`
- **Password**: `AdminPass123!`
- **2FA Code**: `123456`

---

## 💻 Local Development

```bash
# 1. Install all dependencies (client and server)
npm run install:all

# 2. Build the client
npm run build

# 3. Start the unified server
npm start

# App will be accessible at http://localhost:5000
```
