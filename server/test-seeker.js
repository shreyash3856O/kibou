import { encryptMessage, decryptMessage, detectCrisis, generateAnonymousSession } from './src/security.js';

async function runTests() {
  console.log('🧪 Running Seeker Automated Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  }

  // 1. Encryption / Decryption Test
  const secretText = 'I am struggling with academic anxiety and stress.';
  const encrypted = encryptMessage(secretText);
  const decrypted = decryptMessage(encrypted);
  assert(encrypted.includes(':') && encrypted !== secretText, 'AES-256 Message Encryption');
  assert(decrypted === secretText, 'AES-256 Message Decryption Roundtrip');

  // 2. Anonymous Session Generation Test
  const seekerSession = generateAnonymousSession('device-123', 'seeker');
  assert(seekerSession.session_id && seekerSession.user_hash && seekerSession.alias.startsWith('Seeker_'), 'Anonymous Seeker Session Generation');
  assert(seekerSession.token && seekerSession.token.split('.').length === 3, 'JWT Anonymous Token Format');

  const helperSession = generateAnonymousSession('device-456', 'helper');
  assert(helperSession.alias.startsWith('Helper_'), 'Anonymous Helper Session Generation');

  // 3. Crisis Detection Engine Test
  const safeMessage = 'I am feeling nervous about my exams tomorrow.';
  const crisisMessage1 = 'I feel like there is no point living and I want to kill myself';
  const crisisMessage2 = 'I just want to end it all and overdose';

  const safeCheck = detectCrisis(safeMessage);
  const crisisCheck1 = detectCrisis(crisisMessage1);
  const crisisCheck2 = detectCrisis(crisisMessage2);

  assert(!safeCheck.isCrisis && safeCheck.matchedKeywords.length === 0, 'Crisis Detection: Safe text recognized');
  assert(crisisCheck1.isCrisis && crisisCheck1.matchedKeywords.includes('kill myself'), 'Crisis Detection: Suicide keyword flagged');
  assert(crisisCheck2.isCrisis && crisisCheck2.matchedKeywords.includes('end it all'), 'Crisis Detection: Overdose keyword flagged');

  // 4. REST API Endpoint Tests
  try {
    const res = await fetch('http://localhost:5000/health');
    const healthData = await res.json();
    assert(res.ok && healthData.status === 'ok', 'Server Health Check Endpoint (/health)');

    // Test Anon Session Endpoint
    const sessionRes = await fetch('http://localhost:5000/api/auth/anon-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'seeker', alias: 'TestSeeker_101' })
    });
    const sessionData = await sessionRes.json();
    assert(sessionRes.ok && sessionData.session.alias === 'TestSeeker_101', 'API /api/auth/anon-session');

    // Test Available Helpers
    const helperRes = await fetch('http://localhost:5000/api/helpers/available');
    const helperData = await helperRes.json();
    assert(helperRes.ok && helperData.helpers.length > 0, `API /api/helpers/available (${helperData.helpers.length} helpers online)`);

    // Test Start Conversation
    const convRes = await fetch('http://localhost:5000/api/conversations/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seeker_session_id: sessionData.session.session_id,
        topic: 'Academic Stress',
        initial_prompt: 'Need help studying.'
      })
    });
    const convData = await convRes.json();
    assert(convRes.ok && convData.conversation.status === 'waiting', 'API /api/conversations/start (Queue entry)');

    // Test Waiting Queue for Helper
    const waitingRes = await fetch('http://localhost:5000/api/conversations/waiting');
    const waitingData = await waitingRes.json();
    assert(waitingRes.ok && waitingData.waiting.some((w) => w.conversation_id === convData.conversation.conversation_id), 'API /api/conversations/waiting (Helper queue inspection)');

    // Test Admin Login & 2FA
    const adminLoginRes = await fetch('http://localhost:5000/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'counselor@school.edu', password: 'AdminPass123!' })
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.ok && adminLoginData.require_2fa, 'Admin Step 1 Login (Password verification)');

    const admin2faRes = await fetch('http://localhost:5000/api/auth/admin/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: adminLoginData.admin_id, code: '123456' })
    });
    const admin2faData = await admin2faRes.json();
    assert(admin2faRes.ok && admin2faData.token, 'Admin Step 2 Login (2FA verification & JWT issuance)');

    // Test Admin Analytics
    const analyticsRes = await fetch('http://localhost:5000/api/admin/analytics', {
      headers: { Authorization: `Bearer ${admin2faData.token}` }
    });
    const analyticsData = await analyticsRes.json();
    assert(analyticsRes.ok && analyticsData.analytics.active_users >= 1, 'API /api/admin/analytics (Protected counselor route)');

    // Test Hotlines Endpoint
    const hotlinesRes = await fetch('http://localhost:5000/api/hotlines');
    const hotlinesData = await hotlinesRes.json();
    assert(hotlinesRes.ok && hotlinesData.hotlines.length >= 5, `API /api/hotlines (${hotlinesData.hotlines.length} hotlines loaded)`);

  } catch (err) {
    console.error('API test failed with error:', err);
    failed++;
  }

  console.log(`\n=========================================`);
  console.log(`Total Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`=========================================\n`);
}

runTests();
