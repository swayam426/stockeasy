import { NextResponse } from 'next/server';

/**
 * Runs on Vercel's Edge runtime, where Node's `crypto` module does not
 * exist — so this uses Web Crypto and must stay in sync with lib/auth.js.
 * Both sign `<username>.<expiryMs>` with HMAC-SHA256, base64url encoded.
 */

const COOKIE_NAME = 'auth_session';

function base64url(buffer) {
  let str = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verify(token, secret) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [rawUser, expiryStr, signature] = parts;
  const payload = `${rawUser}.${expiryStr}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = base64url(sigBuf);

  if (signature.length !== expected.length) return false;
  // Constant-time-ish compare: always walk the full length.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return false;

  const expiry = Number(expiryStr);
  return Number.isFinite(expiry) && Date.now() <= expiry;
}

export async function middleware(req) {
  const secret = process.env.SESSION_SECRET;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  const valid = secret ? await verify(token, secret) : false;
  if (valid) return NextResponse.next();

  // API routes get a 401; page requests get bounced to /login.
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('from', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// Protect everything except the login page, the auth endpoints,
// Next.js internals and static assets.
//
// The image exclusions matter: /logo.png is used by the login page itself,
// so protecting it would make the login screen redirect its own logo to
// /login and render broken.
export const config = {
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
