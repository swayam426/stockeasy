import crypto from 'crypto';
import { serialize } from 'cookie';
import { createSessionToken, COOKIE_NAME, MAX_AGE_SECONDS } from '../../../lib/auth';

/** Compares two strings without leaking length/content via timing. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  // Hash first so differing lengths don't short-circuit the comparison.
  const hashA = crypto.createHash('sha256').update(bufA).digest();
  const hashB = crypto.createHash('sha256').update(bufB).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  // Fail closed: no credentials configured means nobody gets in.
  if (!validUsername || !validPassword || !process.env.SESSION_SECRET) {
    console.error('Auth misconfigured: ADMIN_USERNAME, ADMIN_PASSWORD or SESSION_SECRET missing');
    return res.status(500).json({ error: 'Server not configured' });
  }

  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const ok = safeEqual(username, validUsername) && safeEqual(password, validPassword);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const cookie = serialize(COOKIE_NAME, createSessionToken(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });

  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ success: true });
}
