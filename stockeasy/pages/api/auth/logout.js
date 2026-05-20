import { serialize } from 'cookie';

export default function handler(req, res) {
  const cookie = serialize('auth_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  res.setHeader('Set-Cookie', cookie);
  res.status(200).json({ success: true });
}
