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

    if (!res.ok) {
      setError(data.error || 'Invalid credentials');
      return;
    }

    router.push('/');
  }

  return (
    <>
      <Head>
        <title>Sign In — Raj Agencies</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={styles.page}>
        {/* LEFT — Login Form */}
        <div style={styles.left}>
          <div style={styles.formWrap}>
            <div style={styles.logo}>
              <img src="/logo.png" alt="Raj Agencies" style={styles.logoImg} />
              <span style={styles.logoText}>Raj Agencies</span>
            </div>

            <h1 style={styles.title}>Sign in</h1>
            <p style={styles.subtitle}>Welcome back! Enter your credentials to continue.</p>

            {error && (
              <div style={styles.errorBox}>
                <span>✕</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Username <span style={{ color: '#e53e3e' }}>*</span></label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="Enter your username"
                  required
                  style={styles.input}
                  autoFocus
                />
              </div>

              <div style={styles.field}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={styles.label}>Password <span style={{ color: '#e53e3e' }}>*</span></label>
                </div>
                <div style={styles.passwordWrap}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Enter your password"
                    required
                    style={{ ...styles.input, marginBottom: 0, paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={styles.eyeBtn}
                  >
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <button type="submit" style={styles.submitBtn} disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p style={styles.footer}>
              Raj Agencies Inventory System · Secure Access
            </p>
          </div>
        </div>

        {/* RIGHT — Branding Panel */}
        <div style={styles.right}>
          <div style={styles.rightContent}>
            <div style={styles.rightLogo}>
              <img src="/logo.png" alt="Raj Agencies" style={styles.rightLogoImg} />
            </div>
            <h2 style={styles.rightTitle}>
              Manage your <br />
              <span style={styles.rightHighlight}>inventory</span> with ease
            </h2>
            <p style={styles.rightDesc}>
              Track stock, record inflows and outflows, and get low stock alerts — all in one place.
            </p>
            <div style={styles.features}>
              {['📦 Real-time stock tracking', '⬇ Inflow & ⬆ Outflow records', '⚠️ Low stock alerts', '📋 Full transaction log'].map(f => (
                <div key={f} style={styles.feature}>{f}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  left: {
    flex: '0 0 480px',
    background: '#f7f7f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  formWrap: {
    width: '100%',
    maxWidth: 360,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: '2rem',
  },
  logoImg: {
    width: 40,
    height: 40,
    borderRadius: 8,
    objectFit: 'cover',
  },
  logoText: {
    fontSize: 17,
    fontWeight: 700,
    color: '#888787',
    letterSpacing: '-0.01em',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1a1a18',
    marginBottom: 6,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: '1.5rem',
  },
  errorBox: {
    background: '#FCEBEB',
    color: '#A32D2D',
    border: '1px solid #F7C1C1',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  field: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: '#444',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #ddd',
    borderRadius: 8,
    background: '#fff',
    color: '#1a1a18',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
    marginBottom: 0,
  },
  passwordWrap: {
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: 0,
    lineHeight: 1,
  },
  submitBtn: {
    width: '100%',
    padding: '11px',
    background: 'linear-gradient(135deg, #cc0000, #8b0000)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
    letterSpacing: '0.01em',
  },
  footer: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
    marginTop: '2rem',
  },
  // RIGHT PANEL
  right: {
    flex: 1,
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d0000 50%, #1a1a1a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    position: 'relative',
    overflow: 'hidden',
  },
  rightContent: {
    maxWidth: 480,
    textAlign: 'center',
    position: 'relative',
    zIndex: 1,
  },
  rightLogo: {
    marginBottom: '2rem',
  },
  rightLogoImg: {
    width: 90,
    height: 90,
    objectFit: 'contain',
    filter: 'drop-shadow(0 4px 20px rgba(200,0,0,0.4))',
  },
  rightTitle: {
    fontSize: 38,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.2,
    marginBottom: '1rem',
    letterSpacing: '-0.02em',
  },
  rightHighlight: {
    color: '#ff3333',
  },
  rightDesc: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.7,
    marginBottom: '2rem',
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
  },
  feature: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '10px 20px',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: 500,
    width: '100%',
    maxWidth: 280,
  },
};
