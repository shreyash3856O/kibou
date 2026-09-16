import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'seeker_super_secure_jwt_secret_key_2026_default';
const RAW_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
// Ensure key is exactly 32 bytes
const ENCRYPTION_KEY = crypto.createHash('sha256').update(RAW_ENCRYPTION_KEY).digest();
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a text string with AES-256-CBC
 */
export function encryptMessage(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt an AES-256-CBC encrypted string
 */
export function decryptMessage(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Decryption failed, returning raw text or placeholder:', err.message);
    return '[Encrypted message content]';
  }
}

/**
 * Generate an anonymous session token with device hash + random salt
 */
export function generateAnonymousSession(deviceId = 'web-client', role = 'seeker', customAlias = '') {
  const sessionId = uuidv4();
  const randomSalt = crypto.randomBytes(16).toString('hex');
  const userHash = crypto
    .createHash('sha256')
    .update(`${deviceId}:${sessionId}:${randomSalt}`)
    .digest('hex')
    .substring(0, 16);

  const anonNumber = Math.floor(1000 + Math.random() * 9000);
  const alias = customAlias || (role === 'helper' ? `Helper_${anonNumber}` : `Seeker_${anonNumber}`);

  const token = jwt.sign(
    {
      session_id: sessionId,
      user_hash: userHash,
      user_role: role,
      alias: alias,
      is_anonymous: true
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    session_id: sessionId,
    user_hash: userHash,
    user_role: role,
    alias: alias
  };
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Comprehensive crisis detection dictionary and regex pattern matching
 */
export const CRISIS_KEYWORDS = [
  'suicide',
  'suicidal',
  'kill myself',
  'killing myself',
  'want to die',
  'wanna die',
  'end my life',
  'end it all',
  'hurt myself',
  'hurting myself',
  'self harm',
  'self-harm',
  'cut myself',
  'cutting myself',
  'no reason to live',
  'no point living',
  'no point in living',
  'goodbye forever',
  'overdose',
  'take all my pills',
  'hang myself',
  'hanging myself',
  'jump off',
  'slit my wrist',
  'better off dead',
  'i don\'t want to wake up',
  'can\'t go on anymore'
];

export function detectCrisis(text) {
  if (!text || typeof text !== 'string') return { isCrisis: false, matchedKeywords: [] };
  const lower = text.toLowerCase();
  const matchedKeywords = CRISIS_KEYWORDS.filter((keyword) => {
    // Regex boundary check for words / phrases
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b|${escaped}`, 'i');
    return regex.test(lower);
  });

  return {
    isCrisis: matchedKeywords.length > 0,
    matchedKeywords
  };
}

/**
 * Admin authentication middleware
 */
export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || decoded.user_role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  req.admin = decoded;
  next();
}
