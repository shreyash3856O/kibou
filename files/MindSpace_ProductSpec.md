# MindSpace: Anonymous Peer Mental Health Chat Platform
## Product Specification & Deployment Guide

---

## 1. PRODUCT OVERVIEW

**MindSpace** is a mobile-first anonymous peer-to-peer mental health support platform for students within a school/college. It enables students to connect as "Seekers" (needing support) or "Helpers" (offering support), with built-in escalation paths to admins and faculty for crisis situations or requests for professional help.

### Core Value Propositions
- **Anonymity + Safety**: Students can seek/provide support without judgment or identity exposure
- **Peer Connection**: Real human-to-human support reduces isolation
- **Professional Escalation**: Crisis detection and admin/faculty escalation for serious situations
- **Transparent Moderation**: Reports reviewed by admins; harmful actors removed

---

## 2. FEATURE SET

### 2.1 USER MODES (Three Roles)

#### **Mode 1: Seeker**
- Browse active helpers or request help for unmatched seekers
- Describe what you need support with (text prompt, no personal info stored)
- Get matched with available helpers or receive notifications when helpers come online
- Rate/feedback helpers after conversation
- Request escalation to faculty/admin mid-conversation with one click

#### **Mode 2: Helper**
- Browse active seekers or opt-in for notifications
- Accept matches from seekers
- Guided helper guidelines ("Listen without judgment," "Know your limits," "If crisis: escalate")
- Easy escalation button to loop in admin if needed
- Can end conversation anytime
- Anonymous feedback from seekers

#### **Mode 3: Admin/Faculty Dashboard**
- View reported conversations (anonymized: SessionID_Seeker, SessionID_Helper)
- Ban users by account ID (not IP — more effective, legally sound)
- Read admin-direct messages from students
- Escalate conversations to professional counselors
- Analytics: active users, match rate, crisis escalations, report trends
- Manage helper guidelines, crisis keywords
- Email/SMS alerts for crisis flags

---

## 3. FEATURE BREAKDOWN

### 3.1 Matching & Connection
- **Mode Selection**: User picks Seeker or Helper on login
- **Topic Tags** (optional): anxiety, relationships, academic, family, general — helps matching
- **Real-Time Matching**: 
  - Seekers see list of available helpers (anonymized)
  - Helpers see queue of seekers waiting
  - Both can initiate or accept matches
- **Notifications**: Helpers get push notification when new seeker joins (if opted in)
- **Match Timeout**: If no acceptance in 5 min, seeker gets "No helpers available, try admin chat"

### 3.2 Anonymous Messaging
- **Session-Based Anonymity**: 
  - Each conversation gets a session ID
  - Participants see `Seeker_12345` and `Helper_67890`
  - Zero PII stored in chat logs
- **Message Encryption**: Messages encrypted at rest (AES-256)
- **Typing Indicators & Read Receipts**: Real-time, to feel natural
- **Rich Text Support**: Emojis, line breaks (no file uploads, links auto-stripped)
- **Auto-Delete Option**: Messages can auto-expire after 30 days (admin configurable)

### 3.3 Safety & Escalation

#### **Crisis Detection (Pattern-Based)**
- Keywords: "suicide," "hurt myself," "no point," "goodbye," "overdose," etc.
- If detected:
  - Seeker shown immediate hotline (national suicide prevention lifeline, local crisis lines)
  - Conversation flagged for admin review (1-hour SLA)
  - Helper notified: "This person may be in crisis. Consider escalating to admin."
  - Seeker gets one-click "Talk to Admin/Faculty" button

#### **Report Button**
- Available in every conversation
- Reporters can flag: harassment, inappropriate advice, spam, harmful content
- Report reason required (dropdown: unsafe advice, disrespectful, off-topic, other)
- Anonymous to both parties (admin sees it, conversation goes to review queue)

#### **Admin Direct Chat**
- Separate tab: "Get Help Now" or "Talk to Faculty"
- Students can message admins directly for:
  - Crisis situations ("I'm in immediate danger")
  - Request counselor connection ("Can I talk to a real counselor?")
  - Report abuse/get help
- Admin on-call (configurable hours or 24/7 depending on school setup)
- Admins see student's session history, crisis flags, reports

### 3.4 Admin Dashboard
- **Reported Conversations Tab**: 
  - List of flagged chats with reason, timestamp, seeker/helper IDs
  - One-click view full conversation (anonymized)
  - Action buttons: Dismiss, Send Warning, Ban User
- **User Management**:
  - Ban by Session ID or Account ID (not IP)
  - Ban reason recorded (harassment, giving harmful advice, spam)
  - Banned users see "You've been restricted from this platform"
  - Appeals process (email admin)
- **Alerts & Insights**:
  - Real-time notification of crisis flags
  - Dashboard showing: active conversations, seekers waiting, helpers online, reports/day
  - Trends: most common help topics, repeat reporters
- **Message Archive**: Searchable, timestamped logs for compliance/investigations

### 3.5 Helper Training & Guardrails
- **Onboarding**: 2-min guided training before first match
  - "Peer support is not therapy"
  - "Listen, don't judge"
  - "Know when to escalate" (crisis signs, requests for medication, trauma)
  - Acceptance checkbox required
- **In-Chat Guidelines**: Subtle, always visible: "You're a listener, not a therapist"
- **Escalation Prompt**: If seeker mentions suicidal thoughts, helpers see pop-up: "This person may be in crisis. Click here to escalate to faculty."

---

## 4. TECHNICAL ARCHITECTURE

### 4.1 Tech Stack

**Frontend (Mobile-First)**
- React Native or Flutter (cross-platform iOS/Android)
- State management: Redux or Zustand
- Real-time: Firebase Realtime Database or WebSocket (Socket.io)
- UI Kit: React Native Paper or Tamagui (accessibility + mobile UX)

**Backend**
- Node.js + Express or Python + Django
- Database: PostgreSQL (privacy, encryption at rest)
- Real-time: Firebase Cloud Messaging or custom WebSocket server
- Authentication: JWT + anonymous session tokens (no email/password required)

**Infrastructure**
- Hosting: AWS (EC2 + RDS) or Firebase (for faster setup)
- CDN: CloudFront or Firebase Hosting
- Monitoring: Sentry (error tracking) + Datadog (performance)
- Email: SendGrid or SES (admin alerts)

### 4.2 Database Schema (Core Tables)

```
sessions
  - session_id (PK, UUID)
  - user_role (seeker | helper)
  - user_hash (anonymous ID, derived from device + random salt)
  - mode (active | waiting | closed)
  - created_at
  - ended_at

conversations
  - conversation_id (PK)
  - seeker_session_id (FK)
  - helper_session_id (FK)
  - matched_at
  - ended_at
  - rating_from_seeker (1-5)
  - rating_from_helper (1-5)
  - is_escalated (bool)
  - is_crisis_flagged (bool)
  - tags (JSON: anxiety, relationships, etc.)

messages
  - message_id (PK)
  - conversation_id (FK)
  - sender_session_id (FK)
  - content_encrypted (text, AES-256)
  - created_at
  - expires_at (nullable, auto-delete after 30 days)

reports
  - report_id (PK)
  - conversation_id (FK)
  - reporter_session_id (FK)
  - reason (harassment | unsafe_advice | spam | other)
  - description (text)
  - created_at
  - status (pending | reviewed | dismissed | action_taken)
  - admin_notes (text)
  - action_taken (warn_user | ban_user | none)

admin_chats
  - chat_id (PK)
  - student_session_id (FK)
  - admin_user_id (FK)
  - messages (JSON)
  - created_at
  - resolved (bool)

banned_users
  - ban_id (PK)
  - session_id (FK)
  - reason (text)
  - banned_by (admin_user_id)
  - banned_at
  - expires_at (nullable for temp bans)
```

### 4.3 Authentication Flow
1. **Anonymous Generation**:
   - On first app open, generate session token (JWT)
   - Derive anonymous user hash from: device_id + app_instance_id + random_salt
   - Store locally (secure storage)
   - No email/password/phone required

2. **Admin Authentication**:
   - School email (admin@school.edu)
   - Password + 2FA (SMS or authenticator app)
   - JWT with role=admin
   - Session expires after 2 hours of inactivity

---

## 5. SAFETY & COMPLIANCE

### 5.1 Data Privacy
- **Minimal PII**: No names, emails, phone numbers in student sessions
- **Encryption**: 
  - Messages encrypted at rest (AES-256)
  - HTTPS/TLS in transit
  - Database encryption enabled
- **Data Retention**: Messages auto-delete after 30 days (configurable)
- **GDPR/Student Privacy Compliance**: 
  - Clear privacy policy
  - No third-party data sharing
  - Audit logs for admin access

### 5.2 Harm Prevention
- **Crisis Keywords**: Auto-detection for suicide, self-harm, abuse
- **Rate Limiting**: Max 100 messages/hour per user (prevent spam/flooding)
- **Profanity Filter**: Mild (warnings only, not censoring)
- **Blocking**: Users can block others mid-conversation (if desired)
- **No Video/Audio**: Text-only reduces harassment risk

### 5.3 Moderation
- **Report Triaging**: Reports reviewed within 24 hours
- **Banning**: Fast-track ban for explicit rule violations
  - Ban account ID (not IP)
  - Can still email appeal to admin
- **Helper Vetting**: Helpers on-boarded with training; repeat violators banned
- **Transparency Logs**: Schools can audit actions taken

---

## 6. DEPLOYMENT CHECKLIST

### Pre-Launch (4-6 weeks)
- [ ] **Legal Review**:
  - Privacy policy (FERPA-compliant if US school)
  - Terms of service
  - Crisis liability waiver (school + student sign-off)
  - Data retention + deletion policy

- [ ] **Infrastructure**:
  - DB setup + encryption at rest enabled
  - SSL certificate
  - Backup & recovery plan
  - Monitoring alerts (Sentry, Datadog)

- [ ] **Crisis Protocol**:
  - Train admins on crisis response
  - Integrate hotline numbers (NSPL, Crisis Text Line, local)
  - Establish escalation SLA (crisis flag → admin review in 1 hour)

- [ ] **Admin Training** (1-2 hours):
  - Dashboard walkthrough
  - Moderation guidelines
  - How to handle reports
  - How to ban users safely

- [ ] **Testing**:
  - Load test (simulate 500+ concurrent users)
  - Security audit (OWASP top 10)
  - Accessibility test (WCAG 2.1 AA)
  - User testing with 20-30 student volunteers

- [ ] **Marketing/Rollout**:
  - In-school announcement (assembly, email)
  - FAQ page
  - Posters with QR code to download app
  - Trust-building: transparent moderation policy

### Launch (Week 1)
- [ ] App live on iOS App Store + Google Play
- [ ] Admin dashboard accessible to designated staff
- [ ] Crisis hotline numbers prominently displayed
- [ ] Admin on-call during peak hours (3 PM - 8 PM first week)
- [ ] Daily check-in: review crash logs, user feedback

### Post-Launch (Ongoing)
- [ ] Weekly moderation report (reports filed, actions taken)
- [ ] Monthly school stakeholder meeting (principal, counselors, admins)
- [ ] Quarterly feature updates based on feedback
- [ ] Annual security audit + penetration test
- [ ] Track outcomes: user retention, satisfaction, crisis escalations handled

---

## 7. FEATURE ROADMAP (Beyond MVP)

### Phase 1 (MVP - Launch)
- Peer-to-peer matching
- Crisis detection & escalation
- Reporting & admin moderation
- Admin direct chat

### Phase 2 (Month 2-3)
- Resource library (coping strategies, articles)
- Journal (private, encrypted notes for seekers)
- Helper analytics (how many helped, ratings)
- Scheduled "office hours" with faculty

### Phase 3 (Month 4-6)
- Group support circles (anonymous small groups, moderated)
- Integration with school counselor calendar (book appointments)
- SMS alerts (critical crisis → text to admin)
- Multi-language support

### Phase 4 (Month 6+)
- ML-based helper matching (match compatible helper/seeker)
- Sentiment analysis (track improvement over time)
- School mental health dashboard (anonymous aggregate data)
- Integration with crisis hotlines (auto-call if severe crisis detected)

---

## 8. SUCCESS METRICS

Track these:
- **Engagement**: DAU, MAU, average session length
- **Safety**: Crisis escalations handled, reports/day, ban rate
- **Impact**: User satisfaction (NPS), helper ratings, repeat users
- **Moderation**: Report resolution time, false positives, appeals

---

## 9. RISKS & MITIGATIONS

| Risk | Mitigation |
|------|-----------|
| Untrained helpers giving bad advice | Onboarding training, guidelines, escalation prompts |
| Crisis situations missed | Crisis keyword detection, admin escalation SLA |
| Harassment/bullying | Reporting system, fast-track banning |
| False reports/abuse of moderation | Only authenticated admins can action; audit log required |
| Data breach exposing student chats | AES-256 encryption, penetration testing, incident response plan |
| Low adoption / "ghost platform" | Strong launch marketing, faculty champions, word-of-mouth |
| Legal liability for student self-harm | Waivers, clear disclaimers, professional escalation paths, insurance |

---

## 10. ESTIMATED COSTS (First Year)

- **Development**: $15K-30K (freelance/agency) or 3-4 months internal
- **Hosting** (AWS): $300-500/month
- **Domain + SSL**: $50/year
- **Monitoring** (Sentry, Datadog): $100-200/month
- **Legal Review**: $1K-2K
- **Marketing Materials**: $500-1K
- **Admin Training**: Included
- **Total Year 1**: ~$25K-40K (dev is largest variable)

---

## 11. DEPLOYMENT COMMAND

See next section: **DEPLOYMENT PROMPT FOR CLAUDE CODE / BUILDER**.

---
