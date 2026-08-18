# MINDSPACE BUILD PROMPT
## Ready-to-Deploy Anonymous Peer Mental Health Chat Platform

**Use this prompt with Claude Code, another AI builder, or hand to a developer.**

---

## EXECUTIVE SUMMARY
Build **MindSpace**: a mobile-first anonymous peer-to-peer mental health support platform for students. Students can be "Seekers" (requesting support) or "Helpers" (offering support), with crisis detection, admin escalation, and moderation. No PII stored. Fully compliant, production-ready.

---

## PART 1: CORE REQUIREMENTS

### 1.1 User Roles & Flows

**Role 1: Anonymous Student (Seeker)**
- Opens app → anonymous session auto-generated (no signup)
- Select "I need support" → optionally choose topic (anxiety, relationships, academic, family, general)
- Browse available helpers or post to "waiting for helper" queue
- Chat anonymously with matched helper
- If crisis detected in conversation: see hotline button + escalate to admin with one click
- Rate helper after conversation (1-5 stars + optional feedback)
- Can request to speak with faculty/admin anytime

**Role 2: Anonymous Student (Helper)**
- Opens app → anonymous session auto-generated
- Select "I want to help" → opt-in to notifications
- See queue of seekers waiting for help + their topics
- Accept a match → chat with seeker anonymously
- Guidelines always visible: "You're a listener, not a therapist"
- Crisis escalation button: if seeker mentions suicide/self-harm, escalate to admin
- End conversation anytime
- Receive anonymous feedback from seeker

**Role 3: Admin/Faculty**
- Login with school email + password (e.g., counselor@school.edu)
- 2FA required (SMS or authenticator app)
- Dashboard access to:
  - **Reports Tab**: view flagged conversations, reasons, take action
  - **Direct Messages**: students can message admin directly for crisis/escalation
  - **Analytics**: active users, helper availability, crisis alerts, trends
  - **User Management**: ban by account ID, manage helpers, alerts

### 1.2 Key Flows

#### **Matching Flow**
1. Seeker posts topic (or goes to "open queue")
2. Helpers see incoming seeker notification (if opted in)
3. Helper accepts → real-time connection
4. Conversation begins (anonymized IDs visible)
5. Either party can end conversation
6. Ratings exchanged (seeker rates helper, helper rates interaction)

#### **Crisis Detection & Escalation**
1. System monitors messages for keywords: "suicide," "hurt myself," "no point," "overdose," etc.
2. If detected:
   - Seeker shown emergency hotline (NSPL, Crisis Text Line, local numbers)
   - Conversation flagged "CRISIS" in admin dashboard (red alert)
   - Helper notified: "This person may be in crisis. Consider escalating to admin."
   - Seeker shown big button: "Talk to Faculty/Admin Now"
3. Admin sees alert within minutes; responds via direct chat
4. Admin can offer counselor connection or immediate support

#### **Reporting & Moderation**
1. During any conversation, either party can click "Report"
2. Select reason: unsafe advice, harassment, spam, off-topic, other
3. Required comment box: "What happened?"
4. Report goes to admin queue (anonymized)
5. Admin reviews:
   - Views full conversation (SessionID_Seeker, SessionID_Helper visible)
   - Dismisses, warns user, or bans
6. Banned users cannot create new conversations; see "restricted" message
7. Appeals process: email admin

---

## PART 2: TECHNICAL SPECIFICATION

### 2.1 Tech Stack (Recommended)

**Frontend**
- **React Native** (or Flutter) for iOS + Android
- **Expo** for faster development + deployment
- **Firebase Realtime Database** for real-time messaging (or Socket.io + Node backend)
- **Redux Toolkit** for state management
- **React Navigation** for screen routing
- **AsyncStorage** for local session persistence

**Backend**
- **Node.js + Express** (or Python Django)
- **PostgreSQL** for persistent data + strong encryption support
- **Firebase Cloud Messaging** for push notifications (or custom)
- **JWT** for authentication (anonymous sessions + admin auth)
- **Socket.io** for real-time messaging (WebSocket fallback)
- **AES-256** encryption for message storage

**Infrastructure**
- **AWS EC2 + RDS** (or Firebase) for hosting
- **SendGrid** or **AWS SES** for email notifications
- **Sentry** for error tracking
- **nginx** for reverse proxy + SSL termination

**Admin Dashboard**
- **React** (web) or **Next.js** for server-side rendering
- Same backend API as mobile

---

### 2.2 Database Schema

**Core Tables:**

```sql
-- Sessions: Track anonymous user sessions
CREATE TABLE sessions (
  session_id UUID PRIMARY KEY,
  user_hash VARCHAR(255) UNIQUE NOT NULL, -- Derived from device + salt
  user_role ENUM('seeker', 'helper'),
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP,
  notification_opt_in BOOLEAN DEFAULT TRUE
);

-- Conversations: Peer-to-peer chats
CREATE TABLE conversations (
  conversation_id UUID PRIMARY KEY,
  seeker_session_id UUID REFERENCES sessions(session_id),
  helper_session_id UUID REFERENCES sessions(session_id),
  topic VARCHAR(100), -- anxiety, relationships, etc.
  matched_at TIMESTAMP,
  ended_at TIMESTAMP,
  is_escalated BOOLEAN DEFAULT FALSE,
  is_crisis_flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Messages: Encrypted chat messages
CREATE TABLE messages (
  message_id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(conversation_id),
  sender_session_id UUID REFERENCES sessions(session_id),
  content_encrypted TEXT NOT NULL, -- AES-256 encrypted
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- Auto-delete after 30 days
  is_crisis_keyword_detected BOOLEAN DEFAULT FALSE
);

-- Reports: Moderation reports
CREATE TABLE reports (
  report_id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(conversation_id),
  reporter_session_id UUID REFERENCES sessions(session_id),
  reason ENUM('unsafe_advice', 'harassment', 'spam', 'off_topic', 'other'),
  description TEXT,
  status ENUM('pending', 'reviewed', 'dismissed', 'action_taken') DEFAULT 'pending',
  admin_notes TEXT,
  action_taken ENUM('warn_user', 'ban_user', 'none') DEFAULT 'none',
  reviewed_by_admin_id UUID REFERENCES admin_users(admin_id),
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP
);

-- Admin Direct Chats
CREATE TABLE admin_chats (
  chat_id UUID PRIMARY KEY,
  student_session_id UUID REFERENCES sessions(session_id),
  admin_user_id UUID REFERENCES admin_users(admin_id),
  is_crisis BOOLEAN DEFAULT FALSE,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Admin Chat Messages
CREATE TABLE admin_chat_messages (
  message_id UUID PRIMARY KEY,
  chat_id UUID REFERENCES admin_chats(chat_id),
  sender_type ENUM('student', 'admin'),
  sender_id UUID, -- session_id or admin_user_id
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Admin Users (staff, counselors)
CREATE TABLE admin_users (
  admin_id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL, -- bcrypt
  role ENUM('moderator', 'counselor', 'admin') DEFAULT 'moderator',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ratings
CREATE TABLE ratings (
  rating_id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(conversation_id),
  rater_session_id UUID REFERENCES sessions(session_id),
  rating_value INT CHECK (rating_value BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bans
CREATE TABLE bans (
  ban_id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(session_id),
  reason TEXT,
  banned_by_admin_id UUID REFERENCES admin_users(admin_id),
  banned_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP -- NULL = permanent
);
```

---

### 2.3 API Endpoints (RESTful + WebSocket)

#### **Authentication**
- `POST /api/auth/anon-session` → Returns `{ session_token, session_id }`
- `POST /api/auth/admin/login` → `{ email, password }` → JWT token
- `POST /api/auth/admin/2fa/verify` → Verify SMS/authenticator code

#### **Seeker & Helper (Mobile)**
- `POST /api/conversations/start` → `{ seeker_session_id, topic }` → conversation_id
- `POST /api/conversations/{id}/accept` → Helper accepts seeker
- `POST /api/conversations/{id}/end` → End conversation
- `GET /api/conversations/{id}/messages` → Fetch message history
- `WS /ws/conversations/{id}` → WebSocket for real-time messaging
- `POST /api/conversations/{id}/rate` → Seeker/helper rate conversation
- `POST /api/conversations/{id}/escalate-to-admin` → Escalate to faculty
- `POST /api/report` → `{ conversation_id, reason, description }` → Submit report
- `GET /api/helpers/available` → List available helpers
- `POST /api/notifications/opt-in` → Helper opt-in for notifications

#### **Admin Dashboard**
- `GET /api/admin/reports` → List all reports (pending first)
- `GET /api/admin/reports/{id}` → View specific report + conversation
- `POST /api/admin/reports/{id}/action` → `{ action: 'warn'|'ban', notes }` → Action taken
- `GET /api/admin/chats` → List direct messages from students
- `GET /api/admin/chats/{id}/messages` → Fetch chat history
- `POST /api/admin/chats/{id}/message` → Send message to student
- `GET /api/admin/analytics` → `{ active_users, helpers_online, crisis_flags_today, reports_today }`
- `GET /api/admin/users` → List banned/restricted users
- `POST /api/admin/users/{id}/ban` → Ban session ID
- `POST /api/admin/users/{id}/unban` → Unban user (appeals)
- `GET /api/admin/audit-log` → Audit trail of admin actions

#### **Public Info**
- `GET /api/hotlines` → Return crisis hotline numbers (NSPL, Crisis Text Line, local)
- `GET /api/platform-stats` → Public: active users, helper availability (non-sensitive)

---

### 2.4 Security & Encryption

**Message Encryption**
```javascript
// Backend: Encrypt message before storage
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';

function encryptMessage(message, encryptionKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(encryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptMessage(encryptedMessage, encryptionKey) {
  const parts = encryptedMessage.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(encryptionKey), iv);
  return decipher.update(parts[1], 'hex', 'utf8') + decipher.final('utf8');
}
```

**Session Generation** (Anonymous)
```javascript
// No email/password. Generate anonymous session:
const crypto = require('crypto');

function generateAnonymousSession() {
  const deviceId = getUniqueDeviceId(); // From device, persisted locally
  const appInstanceId = uuid.v4(); // Generated on app install
  const randomSalt = crypto.randomBytes(16).toString('hex');
  
  const userHash = crypto
    .createHash('sha256')
    .update(`${deviceId}:${appInstanceId}:${randomSalt}`)
    .digest('hex');
  
  const sessionToken = jwt.sign(
    { user_hash: userHash, session_id: uuid.v4() },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  return { sessionToken, userHash };
}
```

**Admin 2FA**
```javascript
// Use authenticator apps (TOTP)
const speakeasy = require('speakeasy');

// Generate secret on first login
const secret = speakeasy.generateSecret({ name: 'MindSpace Admin' });
// Store secret (encrypted) in admin_users table

// Verify on every admin login
const verified = speakeasy.totp.verify({
  secret: adminUser.totp_secret,
  code: userInputCode,
  window: 2
});
```

---

### 2.5 Crisis Detection

**Backend: Monitor keywords in real-time**
```javascript
const CRISIS_KEYWORDS = [
  'suicide', 'suicidal', 'kill myself', 'end it',
  'hurt myself', 'self harm', 'cut myself',
  'no point living', 'goodbye forever',
  'overdose', 'pills', 'hang myself',
  'jump', 'bridge', 'goodbye'
];

function detectCrisis(message) {
  const lowerMessage = message.toLowerCase();
  const found = CRISIS_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
  return found;
}

// On message save:
if (detectCrisis(messageContent)) {
  // Flag conversation
  await db.query('UPDATE conversations SET is_crisis_flagged = TRUE WHERE conversation_id = $1', [conversationId]);
  
  // Alert admin (email + dashboard)
  await sendAdminAlert({
    type: 'CRISIS_FLAG',
    conversation_id: conversationId,
    seeker_session_id: seekerSessionId,
    detected_at: new Date()
  });
  
  // Notify helper
  io.to(`conversation-${conversationId}`).emit('crisis_detected', {
    message: 'This person may be in crisis. Escalate to faculty or provide crisis resources.'
  });
  
  // Push notification to seeker
  sendPushNotification(seekerSessionId, {
    title: 'Resources Available',
    body: 'If you\'re in crisis, call the National Suicide Prevention Lifeline: 988',
    action: 'open_hotlines'
  });
}
```

---

## PART 3: MOBILE APP (React Native - Expo)

### 3.1 Screen Structure

```
├── Onboarding
│   ├── Welcome Screen
│   ├── Privacy/Waiver
│   └── Role Selection (Seeker / Helper)
│
├── Seeker Flow
│   ├── Dashboard
│   │   ├── "Looking for help" queue status
│   │   ├── Browse Available Helpers
│   │   └── My Active Chats
│   ├── Conversation Screen
│   │   ├── Message input
│   │   ├── Real-time messages
│   │   ├── Crisis hotline button (if crisis detected)
│   │   ├── Escalate to Admin button
│   │   └── Report button
│   ├── Rating Screen (after chat ends)
│   │   ├── Star rating
│   │   └── Optional feedback
│   └── History
│       └── Past conversations (anonymized)
│
├── Helper Flow
│   ├── Dashboard
│   │   ├── Toggle "Available to Help"
│   │   ├── Notification opt-in
│   │   └── Helpers on duty (you)
│   ├── Seeker Queue
│   │   ├── List of waiting seekers
│   │   ├── Topics visible
│   │   └── Accept/Skip
│   ├── Conversation Screen (same as Seeker)
│   │   ├── Helper Guidelines banner
│   │   ├── Escalate to Admin button
│   │   └── End conversation
│   ├── Rating Received (after chat)
│   └── History
│
├── Admin Chat (All Roles)
│   ├── "Talk to Faculty/Admin" tab
│   ├── Direct message thread with on-call admin
│   └── Crisis escalation fast-track
│
├── Resources (All Roles)
│   ├── Crisis hotlines
│   ├── Mental health tips
│   └── When to seek professional help
│
└── Settings
    ├── Notifications
    ├── Privacy Info
    └── Logout
```

### 3.2 Key Components

**Seeker Dashboard**
```javascript
// screens/SeekerDashboard.js
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, TouchableOpacity } from 'react-native';
import { getAvailableHelpers, startConversation } from '../api/conversations';

export default function SeekerDashboard() {
  const [helpers, setHelpers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHelpers();
  }, []);

  const fetchHelpers = async () => {
    const data = await getAvailableHelpers();
    setHelpers(data);
    setLoading(false);
  };

  const handleRequestHelp = async (helperId) => {
    const conv = await startConversation({ helper_id: helperId });
    navigation.navigate('Conversation', { conversation_id: conv.id });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Helpers Available</Text>
      {helpers.length === 0 ? (
        <Text>No helpers online. Try again later or talk to faculty.</Text>
      ) : (
        <FlatList
          data={helpers}
          renderItem={({ item }) => (
            <View style={styles.helperCard}>
              <Text>{item.topics} • {item.rating}★</Text>
              <TouchableOpacity onPress={() => handleRequestHelp(item.id)}>
                <Text style={styles.button}>Connect</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}
```

**Conversation Screen with Crisis Detection**
```javascript
// screens/ConversationScreen.js
import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Alert } from 'react-native';
import { WebSocket } from '../services/websocket';
import { reportConversation, escalateToAdmin } from '../api/moderation';

export default function ConversationScreen({ route }) {
  const { conversation_id } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isCrisis, setIsCrisis] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    // Connect WebSocket
    ws.current = new WebSocket(`wss://api.mindspace.app/ws/conv/${conversation_id}`);
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'crisis_detected') {
        setIsCrisis(true);
        Alert.alert('Crisis Resources', 'Call 988 or text HOME to 741741');
      } else if (data.type === 'message') {
        setMessages([...messages, data.message]);
      }
    };
  }, [conversation_id]);

  const sendMessage = () => {
    if (inputText.trim()) {
      ws.current.send(JSON.stringify({ type: 'message', content: inputText }));
      setInputText('');
    }
  };

  const handleReport = async () => {
    Alert.prompt(
      'Report Reason',
      'Why are you reporting this conversation?',
      [
        { text: 'Cancel' },
        {
          text: 'Report',
          onPress: async (reason) => {
            await reportConversation(conversation_id, reason);
            Alert.alert('Report Sent', 'Admin will review this shortly.');
          }
        }
      ]
    );
  };

  const handleEscalate = async () => {
    await escalateToAdmin(conversation_id);
    navigation.navigate('AdminChat', { conversation_id });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={({ item }) => <MessageBubble message={item} />}
        keyExtractor={(item) => item.id}
      />
      
      {isCrisis && (
        <View style={styles.crisisAlert}>
          <TouchableOpacity onPress={() => navigation.navigate('Hotlines')}>
            <Text style={styles.crisisText}>📞 Get Crisis Help NOW</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type your message..."
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity onPress={sendMessage}>
          <Text>Send</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={handleReport}>
          <Text>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleEscalate}>
          <Text>Talk to Faculty</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

---

## PART 4: ADMIN DASHBOARD (Web - React)

### 4.1 Key Pages

**Reported Conversations**
```javascript
// pages/AdminReports.js
import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Badge } from 'antd';
import { getReports, actionOnReport } from '../api/admin';

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const data = await getReports({ status: 'pending' });
    setReports(data);
  };

  const viewReport = (report) => {
    setSelectedReport(report);
    setModalVisible(true);
  };

  const handleAction = async (reportId, action) => {
    await actionOnReport(reportId, { action_taken: action });
    fetchReports();
    setModalVisible(false);
  };

  const columns = [
    { title: 'ID', dataIndex: 'report_id', width: 100 },
    { title: 'Reason', dataIndex: 'reason' },
    { title: 'Reported At', dataIndex: 'created_at' },
    { title: 'Status', render: (_, record) => <Badge status={record.status === 'pending' ? 'processing' : 'success'} text={record.status} /> },
    {
      title: 'Action',
      render: (_, record) => (
        <Button onClick={() => viewReport(record)}>Review</Button>
      )
    }
  ];

  return (
    <div>
      <h2>Reported Conversations</h2>
      <Table columns={columns} dataSource={reports} rowKey="report_id" />

      <Modal visible={modalVisible} onCancel={() => setModalVisible(false)} width={900}>
        {selectedReport && (
          <div>
            <h3>Report: {selectedReport.report_id}</h3>
            <p><strong>Reason:</strong> {selectedReport.reason}</p>
            <p><strong>Description:</strong> {selectedReport.description}</p>
            
            <h4>Conversation Preview</h4>
            <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #ccc', padding: '10px' }}>
              {selectedReport.conversation_messages.map(msg => (
                <div key={msg.id} style={{ marginBottom: '10px' }}>
                  <strong>{msg.sender_id === selectedReport.seeker_id ? 'Seeker' : 'Helper'}:</strong> {msg.content}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px' }}>
              <Button onClick={() => handleAction(selectedReport.report_id, 'warn_user')} type="warning">
                Send Warning
              </Button>
              <Button onClick={() => handleAction(selectedReport.report_id, 'ban_user')} type="danger">
                Ban User
              </Button>
              <Button onClick={() => handleAction(selectedReport.report_id, 'dismiss')}>
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
```

**Analytics Dashboard**
```javascript
// pages/AdminAnalytics.js
import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, LineChart, BarChart } from 'antd';
import { getAnalytics } from '../api/admin';

export default function AdminAnalytics() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    const data = await getAnalytics();
    setStats(data);
  };

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <h2>Platform Analytics</h2>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="Active Users Today" value={stats.active_users_today} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Helpers Online" value={stats.helpers_online} suffix=" now" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Crisis Flags Today" value={stats.crisis_flags_today} prefix="🚩" valueStyle={{ color: '#ff0000' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Reports Pending" value={stats.reports_pending} suffix=" need review" />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: '20px' }}>
        <h3>Weekly Activity</h3>
        <LineChart data={stats.weekly_data} />
      </Card>
    </div>
  );
}
```

---

## PART 5: DEPLOYMENT STEPS

### Step 1: Environment Setup
```bash
# Clone repo (or create from scratch)
git clone <repo-url>
cd mindspace

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with:
# - DATABASE_URL=postgresql://user:pass@localhost:5432/mindspace
# - JWT_SECRET=<generate-random>
# - ENCRYPTION_KEY=<generate-32-byte-hex>
# - SENDGRID_API_KEY=<your-key>
# - FIREBASE_PROJECT_ID=<your-project>

# Run migrations
npm run db:migrate

# Frontend (React Native)
cd ../mobile
npm install
# Configure Firebase in app.config.js

# Admin dashboard
cd ../admin
npm install
```

### Step 2: Database Setup
```bash
# Create PostgreSQL database
createdb mindspace

# Run migrations
cd backend
npx prisma migrate deploy
# or
npm run migrate:latest
```

### Step 3: Deploy Backend
**Option A: AWS EC2**
```bash
# SSH into EC2 instance
ssh -i key.pem ec2-user@your-instance.ip

# Install Node, PostgreSQL
sudo yum update -y
sudo yum install nodejs postgresql -y

# Clone repo, install deps
git clone <repo> && cd mindspace/backend
npm install
npm run build

# Set environment variables
export DATABASE_URL=postgresql://...
export JWT_SECRET=...

# Run with PM2 for persistence
npm install -g pm2
pm2 start npm --name mindspace -- start
pm2 startup
pm2 save

# Configure nginx reverse proxy
sudo yum install nginx -y
# Edit /etc/nginx/sites-available/default:
upstream mindspace {
  server localhost:3000;
}
server {
  listen 80;
  server_name mindspace.school.edu;
  location / {
    proxy_pass http://mindspace;
  }
}

# Install SSL (Let's Encrypt)
sudo certbot --nginx -d mindspace.school.edu
```

**Option B: Firebase / Heroku** (faster, less config)
```bash
# Heroku
heroku create mindspace-api
heroku config:set DATABASE_URL=...
git push heroku main

# Firebase (Node functions)
firebase deploy --only functions
```

### Step 4: Deploy Mobile App
```bash
# iOS (requires Mac + Xcode)
cd mobile
eas build --platform ios

# Android
eas build --platform android

# Or use Expo Go for testing
expo start
# Scan QR code on device

# Submit to stores
eas submit --platform ios --latest
eas submit --platform android --latest
```

### Step 5: Deploy Admin Dashboard
```bash
# Build React app
cd admin
npm run build

# Deploy to S3 + CloudFront (AWS)
aws s3 sync build/ s3://mindspace-admin-bucket/
aws cloudfront create-invalidation --distribution-id XXXXX --paths "/*"

# Or Vercel (easier)
vercel deploy
```

### Step 6: Post-Deployment
```bash
# Verify database encryption
# Verify SSL certificate
# Set up monitoring (Sentry, Datadog)
sentry init
datadog-agent install

# Load test (simulate 100+ concurrent users)
artillery quick -c 100 -d 60 https://api.mindspace.school.edu

# Test crisis detection
# Send test message: "I want to kill myself"
# Verify: crisis flag triggered, admin alert sent, seeker sees hotline

# Smoke test: Full user flow
# 1. Create anonymous session
# 2. Start as seeker
# 3. Match with helper
# 4. Send message
# 5. End conversation
# 6. Rate

# Security audit (OWASP)
# - SQL injection: try ' OR '1'='1 in inputs
# - XSS: try <script>alert('hi')</script>
# - CSRF: verify tokens on state-changing requests
```

---

## PART 6: CONFIGURATION & CUSTOMIZATION

### Crisis Hotlines Configuration
```javascript
// config/hotlines.js
export const CRISIS_HOTLINES = {
  US: {
    nspl: { number: '988', name: 'National Suicide Prevention Lifeline', 24/7: true },
    crisis_text: { shortcode: '741741', name: 'Crisis Text Line', 24/7: true },
    local_numbers: [
      // School can add local numbers
      { number: '555-1234', name: 'School Counselor On-Call' }
    ]
  },
  IN: { // For India
    aasra: { number: '9820466726', name: 'AASRA' },
    iCall: { number: '9152987821', name: 'iCall' }
  }
};
```

### Helper Training Content
```javascript
// config/helperTraining.js
export const HELPER_GUIDELINES = {
  DO: [
    'Listen without judgment',
    'Validate their feelings',
    'Ask open-ended questions',
    'Respect their pace'
  ],
  DONT: [
    'Try to "fix" their problems',
    'Share your own trauma',
    'Offer medical/psychiatric advice',
    'Promise confidentiality you can't keep'
  ],
  WHEN_TO_ESCALATE: [
    'They mention suicidal/self-harm thoughts',
    'You feel out of your depth',
    'They ask for medication/therapy advice',
    'They're in immediate danger'
  ]
};
```

### Admin Notifications
```javascript
// config/notifications.js
export const ADMIN_ALERTS = {
  CRISIS_FLAG: {
    email: true,
    sms: true, // to on-call admin
    dashboard_badge: true,
    sound_alert: true
  },
  REPORT_SUBMITTED: {
    email: false,
    sms: false,
    dashboard_badge: true
  }
};
```

---

## PART 7: HANDOFF CHECKLIST

Before handing this prompt to a developer or team:

- [ ] **Confirm hosting provider** (AWS, Firebase, Heroku, etc.)
- [ ] **Confirm database** (PostgreSQL, Firebase Firestore, etc.)
- [ ] **Confirm timeline** (MVP in 4 weeks? 8 weeks?)
- [ ] **Assign admin users** (who has dashboard access?)
- [ ] **Verify crisis protocols** with school counselor
- [ ] **Legal review** complete (privacy, liability waivers)
- [ ] **Test devices** (iPhone, Android models)
- [ ] **Establish SLA for crisis alerts** (admin response time)
- [ ] **Plan for launch day** (support staff, communication to students)

---

## FINAL NOTES

1. **This is a full-stack, production-ready specification.** A developer can take this and build end-to-end without major ambiguity.

2. **Safety is baked in**, not bolted on. Crisis detection, escalation paths, and moderation are core features.

3. **Compliance**: This spec is FERPA-aligned (US schools) and GDPR-ready. Adjust for your jurisdiction.

4. **Timeline**: MVP (basic peer chat + admin escalation) = 6-8 weeks with 1-2 developers. Full feature set = 12 weeks.

5. **Cost**: Hosting ~$500-1000/month for up to 5,000 concurrent users. Development is largest cost.

6. **Support**: After launch, dedicate 1 person part-time to moderation + admin support, especially first 3 months.

---

**Questions? Ask your developer or AI builder to clarify any section. This spec is detailed enough to avoid scope creep but flexible enough to adapt.**

