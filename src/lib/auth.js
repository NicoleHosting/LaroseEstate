import crypto from 'node:crypto';

const TOKEN_BYTES = 32;
const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function issueToken(secret, now = Date.now()) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  return {
    token,
    hash: hashToken(token, secret),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TOKEN_LIFETIME_MS).toISOString(),
  };
}

export function hashToken(token, secret) {
  return crypto.createHmac('sha256', secret).update(String(token)).digest('hex');
}

export function bearerToken(header) {
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export function randomId() {
  return crypto.randomUUID();
}

export function randomRoomCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
