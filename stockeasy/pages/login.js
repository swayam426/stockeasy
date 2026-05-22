import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Invalid credentials'); return; }
    router.push('/');
  }

  return (
    <>
      <Head>
        <title>Sign In — Raj Agencies</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        display: 'flex', minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        {/* LEFT */}
        <div className="login-left" style={{
          flex: '0 0 480px', background: '#f7f7f5',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
        }}>
          <div style={{ width: '100%', maxWidth: 380 }}>

            {/* Logo + Title tight together */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '2.5rem' }}>
              <img src="/logo.png" alt="Raj Agencies" style={{
                width: 72, height: 72, objectFit: 'contain', flexShrink: 0
              }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a18', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  Raj Agencies
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>Inventory Management</div>
              </div>
            </div>

            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1a1a18', marginBottom: 4, letterSpacing: '-0.02em' }}>
              Sign in
            </h1>
            <p style={{ fontSize: 14, color: '#666', marginBottom: '1.5rem' }}>
              Welcome back! Enter your credentials to continue.
            </p>

            {error && (
              <div style={{
                background: '#FCEBEB', color: '#A32D2D', border: '1px solid #F7C1C1',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>✕ {error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 4 }}>
                  Username <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="Enter your username"
                  required
                  autoFocus
                  style={{
                    width: '100%', padding: '11px 12px', fontSize: 14,
                    border: '1px solid #ddd', borderRadius: 8, background: '#fff',
                    color: '#1a1a18', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 4 }}>
                  Password <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Enter your password"
                    required
                    style={{
                      width: '100%', padding: '11px 44px 11px 12px', fontSize: 14,
                      border: '1px solid #ddd', borderRadius: 8, background: '#fff',
                      color: '#1a1a18', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                    }}
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0,
                  }}>
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '12px',
                background: 'linear-gradient(135deg, #cc0000, #8b0000)',
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 15,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p style={{ fontSize: 12, color: '#bbb', textAlign: 'center', marginTop: '2rem' }}>
              Raj Agencies Inventory System · Secure Access
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="login-right" style={{
          flex: 1,
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d0000 50%, #1a1a1a 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem',
        }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <img src="/logo.png" alt="Raj Agencies" style={{
              width: 180, height: 180, objectFit: 'contain',
              filter: 'drop-shadow(0 4px 24px rgba(200,0,0,0.5))',
              marginBottom: '1.5rem',
            }} />
            <h2 style={{
              fontSize: 40, fontWeight: 800, color: '#fff',
              lineHeight: 1.2, marginBottom: '1rem', letterSpacing: '-0.02em',
            }}>
              Manage your <br />
              <span style={{ color: '#ff3333' }}>inventory</span> with ease
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '2rem' }}>
              Track stock, record inflows and outflows, and get low stock alerts — all in one place.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              {['📦 Real-time stock tracking', '⬇ Inflow & ⬆ Outflow records', '⚠️ Low stock alerts', '📋 Full transaction log'].map(f => (
                <div key={f} style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, padding: '10px 20px', color: 'rgba(255,255,255,0.85)',
                  fontSize: 14, fontWeight: 500, width: '100%', maxWidth: 280,
                }}>{f}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
