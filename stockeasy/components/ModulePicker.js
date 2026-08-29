/**
 * Shown immediately after login. The two halves of the app — stock control
 * and the commercial/quotation side — have little day-to-day overlap, so
 * picking one up front keeps each workspace to a handful of tabs instead
 * of seven competing for the nav bar.
 */
export default function ModulePicker({ onPick, onLogout, darkMode, onToggleTheme }) {
  const modules = [
    {
      id: 'inventory',
      icon: '📦',
      title: 'Inventory',
      desc: 'Track stock levels, record inflows and outflows, and monitor low-stock alerts.',
      points: ['Dashboard & reports', 'Add and edit products', 'Inflow / outflow entry', 'Full transaction log'],
      accent: 'var(--green)',
    },
    {
      id: 'quotations',
      icon: '📄',
      title: 'Quotations',
      desc: 'Create client quotations priced from live inventory, with GST and printable PDFs.',
      points: ['Create & send quotations', 'Client directory', 'Automatic GST calculation', 'Print / save as PDF'],
      accent: 'var(--red)',
    },
  ];

  return (
    <div className="picker-page">
      <div className="picker-topbar">
        <div className="brand">
          <img src="/logo2.png" alt="Raj Agencies" style={{ height: 40, width: 40, objectFit: 'contain' }} />
          <span style={{ color: darkMode ? '#fff' : '#363434', fontSize: 19, fontWeight: 700 }}>
            Raj Agencies
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onToggleTheme} className="btn btn-sm" style={{ color: 'var(--text2)' }}>
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button onClick={onLogout} className="btn btn-sm" style={{ color: 'var(--text2)' }}>
            Logout
          </button>
        </div>
      </div>

      <div className="picker-body">
        <div className="picker-intro">
          <h1>Where would you like to work?</h1>
          <p>Choose a workspace. You can switch between them at any time.</p>
        </div>

        <div className="picker-grid">
          {modules.map(m => (
            <button
              key={m.id}
              type="button"
              className="picker-card"
              onClick={() => onPick(m.id)}
              style={{ '--accent': m.accent }}
            >
              <div className="picker-card-icon">{m.icon}</div>
              <div className="picker-card-title">{m.title}</div>
              <div className="picker-card-desc">{m.desc}</div>
              <ul className="picker-card-points">
                {m.points.map(p => <li key={p}>{p}</li>)}
              </ul>
              <div className="picker-card-cta">Open {m.title} →</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
