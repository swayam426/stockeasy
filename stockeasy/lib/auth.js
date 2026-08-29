import crypto from 'crypto';

const COOKIE_NAME = 'auth_session';
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET is missing or too short (need 32+ chars)');
  }
  return secret;
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

/**
 * Builds a token shaped `<username>.<expiryMs>.<signature>`.
 * The signature covers the first two parts, so neither can be
 * tampered with without invalidating the token.
 */
export function createSessionToken(username) {
  const expiry = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${encodeURIComponent(username)}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Returns { username } when the token is authentic and unexpired,
 * otherwise null. Never throws on malformed input.
 */
export function verifySessionToken(token) {
  if (typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [rawUser, expiryStr, signature] = parts;
  const payload = `${rawUser}.${expiryStr}`;

  let expected;
  try {
    expected = sign(payload);
  } catch {
    return null; // secret not configured — fail closed
  }

  // Constant-time compare so we don't leak the signature byte by byte.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return null;

  return { username: decodeURIComponent(rawUser) };
}

/** Reads and verifies the session straight off a Next.js API request. */
export function getSession(req) {
  return verifySessionToken(req.cookies?.[COOKIE_NAME]);
}

/**
 * Wrap an API handler to require a valid session.
 * Usage: export default requireAuth(async (req, res) => { ... })
 */
export function requireAuth(handler) {
  return async (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    req.session = session;
    return handler(req, res);
  };
}

export { COOKIE_NAME, MAX_AGE_SECONDS };
