import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback, useRef } from 'react';
import QuotationsTab from '../components/QuotationsTab';
import ClientsTab from '../components/ClientsTab';
import ModulePicker from '../components/ModulePicker';

function Alert({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div className={`alert alert-${type}`}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      {msg}
    </div>
  );
}

function StockBadge({ qty, threshold }) {
  if (qty === 0) return <span className="badge badge-out">Out of Stock</span>;
  if (qty <= threshold) return <span className="badge badge-low">Low Stock</span>;
  return <span className="badge badge-ok">In Stock</span>;
}

function StatCards({ products, stockFilter, setStockFilter, setTab }) {
  const total = products.length;
  const stock = products.reduce((s, p) => s + Number(p.qty), 0);
  const low = products.filter(p => Number(p.qty) > 0 && Number(p.qty) <= Number(p.threshold)).length;
  const out = products.filter(p => Number(p.qty) === 0 && p.id).length;

  const cards = [
    { label: 'Total Products', value: total, sub: 'in catalog', filter: 'all' },
    { label: 'Total Units', value: stock.toLocaleString(), sub: 'across all products', filter: '' },
    { label: 'Low Stock', value: low, sub: 'need restocking', filter: 'low', color: low > 0 ? '#854F0B' : undefined },
    { label: 'Out of Stock', value: out, sub: 'unavailable', filter: 'out', color: out > 0 ? '#A32D2D' : undefined },
  ];

  return (
    <div className="stats-grid">
      {cards.map(c => (
        <div
          key={c.label}
          className="stat-card"
          onClick={() => {
            if (c.filter) {
              setTab('inventory');
              setStockFilter(stockFilter === c.filter ? '' : c.filter);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          style={{
            cursor: c.filter ? 'pointer' : 'default',
            border: stockFilter === c.filter && c.filter ? '1.5px solid var(--text)' : undefined,
            transition: 'all 0.15s',
          }}
        >
          <div className="stat-label">{c.label}</div>
          <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
          <div className="stat-sub">{c.sub}{c.filter ? ' · click to filter' : ''}</div>
        </div>
      ))}
    </div>
  );
}

function AddProductForm({ onAdd }) {
  const [form, setForm] = useState({
    name: '', sku: '', category: 'General', qty: '', threshold: '5', price: '', unit: 'pcs'
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        category: form.category,
        qty: parseInt(form.qty) || 0,
        threshold: parseInt(form.threshold) || 5,
        price: parseFloat(form.price) || 0,
        unit: form.unit.trim() || 'pcs',
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return onAdd(null, data.error);
    setForm({ name: '', sku: '', category: 'General', qty: '', threshold: '5', price: '', unit: 'pcs' });
    onAdd(data, null);
  }

  return (
    <div className="card">
      <div className="card-title">➕ Add New Product</div>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label>Product Name *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="" required />
          </div>
          <div className="form-group">
            <label>Low Stock Alert ≤</label>
            <input type="number" value={form.threshold} onChange={e => set('threshold', e.target.value)} placeholder="10" min="0" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Opening Stock</label>
            <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)} placeholder="0" min="0" />
          </div>
          <div className="form-group">
            <label>Unit Price (₹)</label>
            <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" min="0" step="0.01" />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <><span className="spinner" /> Adding…</> : '✓ Add Product'}
        </button>
      </form>
    </div>
  );
}

function EditModal({ product, onClose, onSave }) {
  const [form, setForm] = useState({
    name: product.name,
    qty: String(product.qty),
    threshold: String(product.threshold),
    price: String(product.price),
    unit: product.unit,
    category: product.category,
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        qty: parseInt(form.qty),
        threshold: parseInt(form.threshold),
        price: parseFloat(form.price),
        unit: form.unit,
        category: form.category,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return onSave(null, data.error);
    onSave(data, null);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">✏️ Edit Product</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>Product Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Unit</label>
              <input value={form.unit} onChange={e => set('unit', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Stock (manual override)</label>
              <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)} min="0" />
            </div>
            <div className="form-group">
              <label>Low Stock Alert ≤</label>
              <input type="number" value={form.threshold} onChange={e => set('threshold', e.target.value)} min="0" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>Unit Price (₹)</label>
            <input type="number" value={form.price} onChange={e => set('price', e.target.value)} min="0" step="0.01" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTransactionModal({ tx, type, onClose, onSave }) {
  const [form, setForm] = useState({
    qty: String(tx.qty),
    party: tx.party || '',
    note: tx.note || '',
    date: tx.date ? new Date(tx.date).toISOString().split('T')[0] : '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/transactions/${tx.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qty: parseInt(form.qty),
        party: form.party,
        note: form.note,
        date: form.date,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { onSave(null, data.error); return; }
    onSave(data, null);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{type === 'in' ? '✏️ Edit Inflow' : '✏️ Edit Outflow'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>Product</label>
            <input value={tx.product_name} disabled style={{ opacity: 0.6 }} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Quantity</label>
              <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)} min="1" />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>{type === 'in' ? 'Supplier / Source' : 'Customer / Destination'}</label>
            <input value={form.party} onChange={e => set('party', e.target.value)} placeholder={type === 'in' ? 'e.g. Raj Traders' : 'e.g. Walk-in'} />
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>Note</label>
            <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Optional" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InventoryTab({ products, onRefresh, onAlert, stockFilter, setStockFilter }) {
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchStock = !stockFilter || stockFilter === 'all' ||
      (stockFilter === 'low' && Number(p.qty) > 0 && Number(p.qty) <= Number(p.threshold)) ||
      (stockFilter === 'out' && Number(p.qty) === 0);
    return matchSearch && matchStock;
  });

  async function handleDelete(p) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
    if (res.ok) { onAlert('Product deleted.', 'success'); onRefresh(); }
    else onAlert('Failed to delete.', 'error');
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Speech recognition not supported. Use Chrome.'); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-IN';
    recognition.start();
    setListening(true);
    recognition.onresult = (e) => {
      setSearch(e.results[0][0].transcript);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); alert('Could not hear you. Try again.'); };
  }

  return (
    <>
      {!stockFilter && (
        <AddProductForm onAdd={(data, err) => {
          if (err) { onAlert(err, 'error'); return; }
          onAlert(`"${data.name}" added!`, 'success');
          onRefresh();
        }} />
      )}

      {!stockFilter && (
        <div className="search-bar" style={{ position: 'relative' }}>
          <input
            placeholder={listening ? 'Listening... speak now' : 'Search by name or tap mic to speak...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingRight: 52, border: listening ? '2px solid #cc0000' : undefined }}
          />
          <button
            type="button"
            onClick={startListening}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: listening ? '#cc0000' : 'transparent',
              border: 'none', borderRadius: '50%',
              width: 34, height: 34, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: listening ? 'pulse 1s infinite' : 'none',
              transition: 'background 0.2s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={listening ? '#fff' : 'currentColor'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          {listening && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, right: 0,
              background: '#fff', border: '1px solid #ddd', borderRadius: 10,
              padding: '20px', textAlign: 'center', zIndex: 50,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            }}>
              <div style={{
                width: 64, height: 64, background: '#cc0000', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', animation: 'pulse 1s infinite',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a18', marginBottom: 4 }}>Listening...</div>
              <div style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>Speak the product name clearly</div>
              <button onClick={() => { recognitionRef.current?.stop(); setListening(false); }}
                style={{ padding: '8px 24px', background: '#f0f0f0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {stockFilter && (
        <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
            {stockFilter === 'low' ? '⚠️ Low Stock Products' : stockFilter === 'out' ? ' Out of Stock Products' :
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <img src="/logo3.png" style={{ width: 20, height: 20, objectFit: 'contain' }} /> All Products
              </span>}
            <span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 8 }}>({filtered.length} items)</span>
          </span>
          <button className="btn btn-sm" onClick={() => setStockFilter('')}>✕ Clear filter</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">📦</span>
            {products.length === 0 ? 'No products yet. Add one above!' : 'No products match your search.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.category}</td>
                    <td>{Number(p.qty).toLocaleString()} <span style={{ color: 'var(--text3)', fontSize: 12 }}>{p.unit}</span></td>
                    <td>₹{Number(p.price).toFixed(2)}</td>
                    <td><StockBadge qty={Number(p.qty)} threshold={Number(p.threshold)} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm" onClick={() => setEditProduct(p)}> Edit</button>
                        <button className="btn btn-ghost" onClick={() => handleDelete(p)} style={{ fontSize: 20, padding: '8px 14px' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editProduct && (
        <EditModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSave={(data, err) => {
            setEditProduct(null);
            if (err) { onAlert(err, 'error'); return; }
            onAlert(`"${data.name}" updated.`, 'success');
            onRefresh();
          }}
        />
      )}
    </>
  );
}

function InflowTab({ products, onRefresh, onAlert }) {
  const [form, setForm] = useState({ product_id: '', qty: '', supplier: '', note: '', date: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);
  const [txs, setTxs] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [inflowSearch, setInflowSearch] = useState('');
  const [groupBy, setGroupBy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadTxs = useCallback(async () => {
    const res = await fetch('/api/transactions?type=in');
    const data = await res.json();
    setTxs(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { loadTxs(); }, []);

  async function deleteTransaction(id) {
    if (!confirm('Delete this inflow record?')) return;
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    if (res.ok) { onAlert('Record deleted.', 'success'); loadTxs(); onRefresh(); }
    else onAlert('Failed to delete.', 'error');
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.product_id || !form.qty) return;
    setLoading(true);
    const res = await fetch('/api/inflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, qty: parseInt(form.qty), product_id: parseInt(form.product_id) }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { onAlert(data.error, 'error'); return; }
    const p = products.find(x => x.id === parseInt(form.product_id));
    onAlert(`${form.qty} units added to "${p?.name}". New stock: ${data.product.qty}`, 'success');
    setForm(f => ({ ...f, product_id: '', qty: '', supplier: '', note: '' }));
    onRefresh(); loadTxs();
  }

  const filteredTxs = txs ? txs.filter(t =>
    t.product_name.toLowerCase().includes(inflowSearch.toLowerCase()) ||
    (t.party && t.party.toLowerCase().includes(inflowSearch.toLowerCase()))
  ) : [];

  const groupedTxs = filteredTxs.reduce((acc, t) => {
    const key = t.party || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <>
      <div className="card">
        <div className="card-title" style={{ color: 'var(--green)' }}>⬇ Record Stock Inflow (Purchase / Received)</div>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label>Select Product *</label>
              <select value={form.product_id} onChange={e => set('product_id', e.target.value)} required>
                <option value="">— Select product —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Stock: {Number(p.qty)} {p.unit})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity Received *</label>
              <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)} placeholder="0" min="1" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Supplier / Source</label>
              <input value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="e.g. Raj Traders" />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Note (Invoice no., batch, remarks…)</label>
            <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Optional" />
          </div>
          <button type="submit" className="btn btn-success" disabled={loading}>
            {loading ? <><span className="spinner" /> Recording…</> : '⬇ Record Inflow'}
          </button>
        </form>
      </div>

      <div className="search-bar">
        <input
          placeholder="Search by product name or supplier..."
          value={inflowSearch}
          onChange={e => setInflowSearch(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: '0 1.25rem' }}>
        <div style={{ paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div className="card-title" style={{ margin: 0 }}>Recent Inflows</div>
          <button className={`btn btn-sm ${groupBy ? 'btn-primary' : ''}`} onClick={() => setGroupBy(g => !g)}>
            {groupBy ? 'Grouped by Supplier' : 'Group by Supplier'}
          </button>
        </div>

        {!txs ? (
          <div className="empty">Loading…</div>
        ) : filteredTxs.length === 0 ? (
          <div className="empty"><span className="empty-icon">📋</span>No inflow records found.</div>
        ) : groupBy ? (
          <div>
            {Object.entries(groupedTxs).map(([supplier, items]) => (
              <div key={supplier} style={{ marginBottom: '1rem' }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text2)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  padding: '8px 0 4px', borderBottom: '1px solid var(--border)',
                  marginBottom: 4, display: 'flex', justifyContent: 'space-between'
                }}>
                  <span>🏭 {supplier}</span>
                  <span style={{ color: 'var(--text3)' }}>{items.length} items · +{items.reduce((s, t) => s + Number(t.qty), 0)} units</span>
                </div>
                {items.map(t => (
                  <div className="log-item" key={t.id}>
                    <div className="log-dot in">↓</div>
                    <div className="log-body">
                      <div className="log-name">{t.product_name}</div>
                      <div className="log-meta">
                        {t.date ? new Date(t.date).toLocaleDateString('en-IN') : ''}{t.note ? ` · ${t.note}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <div className="log-qty in">+{t.qty}</div>
                      <button className="btn btn-sm" onClick={() => setEditTx(t)}>Edit</button>
                      <button className="btn btn-ghost" onClick={() => deleteTransaction(t.id)} style={{ fontSize: 20, padding: '8px 14px' }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="log-list">
            {filteredTxs.map(t => (
              <div className="log-item" key={t.id}>
                <div className="log-dot in">↓</div>
                <div className="log-body">
                  <div className="log-name">{t.product_name}</div>
                  <div className="log-meta">
                    {t.date ? new Date(t.date).toLocaleDateString('en-IN') : ''}{t.party ? ` · From: ${t.party}` : ''}{t.note ? ` · ${t.note}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div className="log-qty in">+{t.qty}</div>
                  <button className="btn btn-sm" onClick={() => setEditTx(t)}>Edit</button>
                  <button className="btn btn-ghost" onClick={() => deleteTransaction(t.id)} style={{ fontSize: 20, padding: '8px 14px' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editTx && (
        <EditTransactionModal
          tx={editTx}
          type="in"
          onClose={() => setEditTx(null)}
          onSave={(data, err) => {
            setEditTx(null);
            if (err) { onAlert(err, 'error'); return; }
            onAlert('Record updated.', 'success');
            loadTxs(); onRefresh();
          }}
        />
      )}
    </>
  );
}

function OutflowTab({ products, onRefresh, onAlert }) {
  const [form, setForm] = useState({ product_id: '', qty: '', customer: '', note: '', date: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);
  const [txs, setTxs] = useState(null);
  const [outflowSearch, setOutflowSearch] = useState('');
  const [groupBy, setGroupBy] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadTxs = useCallback(async () => {
    const res = await fetch('/api/transactions?type=out');
    const data = await res.json();
    setTxs(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { loadTxs(); }, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.product_id || !form.qty) return;
    setLoading(true);
    const res = await fetch('/api/outflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, qty: parseInt(form.qty), product_id: parseInt(form.product_id) }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { onAlert(data.error, 'error'); return; }
    const p = products.find(x => x.id === parseInt(form.product_id));
    onAlert(`${form.qty} units removed from "${p?.name}". Remaining: ${data.product.qty}`, 'success');
    if (Number(data.product.qty) <= Number(data.product.threshold)) {
      setTimeout(() => onAlert(`⚠️ Low stock: "${p?.name}" has only ${data.product.qty} left!`, 'error'), 4200);
    }
    setForm(f => ({ ...f, product_id: '', qty: '', customer: '', note: '' }));
    onRefresh(); loadTxs();
  }

  async function deleteTransaction(id) {
    if (!confirm('Delete this outflow record?')) return;
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    if (res.ok) { onAlert('Record deleted.', 'success'); loadTxs(); onRefresh(); }
    else onAlert('Failed to delete.', 'error');
  }

  const filteredTxs = txs ? txs.filter(t =>
    t.product_name.toLowerCase().includes(outflowSearch.toLowerCase()) ||
    (t.party && t.party.toLowerCase().includes(outflowSearch.toLowerCase()))
  ) : [];

  const groupedTxs = filteredTxs.reduce((acc, t) => {
    const key = t.party || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <>
      <div className="card">
        <div className="card-title" style={{ color: 'var(--red)' }}>⬆ Record Stock Outflow (Sale / Issued)</div>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label>Select Product *</label>
              <select value={form.product_id} onChange={e => set('product_id', e.target.value)} required>
                <option value="">— Select product —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Stock: {Number(p.qty)} {p.unit})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity Issued *</label>
              <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)} placeholder="0" min="1" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Customer / Destination</label>
              <input value={form.customer} onChange={e => set('customer', e.target.value)} placeholder="e.g. Walk-in, Shop Name" />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Note (Bill no., reason, remarks…)</label>
            <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Optional" />
          </div>
          <button type="submit" className="btn btn-danger" disabled={loading}>
            {loading ? <><span className="spinner" /> Recording…</> : '⬆ Record Outflow'}
          </button>
        </form>
      </div>

      <div className="search-bar">
        <input
          placeholder="Search by product name or customer..."
          value={outflowSearch}
          onChange={e => setOutflowSearch(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: '0 1.25rem' }}>
        <div style={{ paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div className="card-title" style={{ margin: 0 }}>Recent Outflows</div>
          <button className={`btn btn-sm ${groupBy ? 'btn-primary' : ''}`} onClick={() => setGroupBy(g => !g)}>
             {groupBy ? 'Grouped by Customer' : 'Group by Customer'}
          </button>
        </div>

        {!txs ? (
          <div className="empty">Loading…</div>
        ) : filteredTxs.length === 0 ? (
          <div className="empty"><span className="empty-icon">📋</span>No outflow records found.</div>
        ) : groupBy ? (
          <div>
            {Object.entries(groupedTxs).map(([customer, items]) => (
              <div key={customer} style={{ marginBottom: '1rem' }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text2)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  padding: '8px 0 4px', borderBottom: '1px solid var(--border)',
                  marginBottom: 4, display: 'flex', justifyContent: 'space-between'
                }}>
                  <span>👤 {customer}</span>
                  <span style={{ color: 'var(--text3)' }}>{items.length} items · −{items.reduce((s, t) => s + Number(t.qty), 0)} units</span>
                </div>
                {items.map(t => (
                  <div className="log-item" key={t.id}>
                    <div className="log-dot out">↑</div>
                    <div className="log-body">
                      <div className="log-name">{t.product_name}</div>
                      <div className="log-meta">
                        {t.date ? new Date(t.date).toLocaleDateString('en-IN') : ''}{t.note ? ` · ${t.note}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <div className="log-qty out">−{t.qty}</div>
                      <button className="btn btn-sm" onClick={() => setEditTx(t)}>Edit</button>
                      <button className="btn btn-ghost" onClick={() => deleteTransaction(t.id)} style={{ fontSize: 20, padding: '8px 14px' }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="log-list">
            {filteredTxs.map(t => (
              <div className="log-item" key={t.id}>
                <div className="log-dot out">↑</div>
                <div className="log-body">
                  <div className="log-name">{t.product_name}</div>
                  <div className="log-meta">
                    {t.date ? new Date(t.date).toLocaleDateString('en-IN') : ''}{t.party ? ` · To: ${t.party}` : ''}{t.note ? ` · ${t.note}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div className="log-qty out">−{t.qty}</div>
                  <button className="btn btn-sm" onClick={() => setEditTx(t)}>Edit</button>
                  <button className="btn btn-ghost" onClick={() => deleteTransaction(t.id)} style={{ fontSize: 20, padding: '8px 14px' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editTx && (
        <EditTransactionModal
          tx={editTx}
          type="out"
          onClose={() => setEditTx(null)}
          onSave={(data, err) => {
            setEditTx(null);
            if (err) { onAlert(err, 'error'); return; }
            onAlert('Record updated.', 'success');
            loadTxs(); onRefresh();
          }}
        />
      )}
    </>
  );
}

function LogTab() {
  const [txs, setTxs] = useState(null);
  const [filter, setFilter] = useState('');

  async function load() {
    const url = filter ? `/api/transactions?type=${filter}` : '/api/transactions';
    const res = await fetch(url);
    const data = await res.json();
    setTxs(Array.isArray(data) ? data : []);
  }

  useEffect(() => { load(); }, [filter]);

  const icon = { in: '↓', out: '↑', add: '+', edit: '✎' };
  const sign = { in: '+', out: '−', add: '+', edit: '~' };
  const qtyClass = { in: 'in', out: 'out', add: 'in', edit: 'in' };

  return (
    <div className="card" style={{ padding: '0 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 0 1rem', flexWrap: 'wrap', gap: 8 }}>
        <div className="card-title" style={{ margin: 0 }}>Full Transaction Log</div>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 150 }}>
          <option value="">All types</option>
          <option value="in">Inflow only</option>
          <option value="out">Outflow only</option>
          <option value="add">Added stock</option>
          <option value="edit">Manual edits</option>
        </select>
      </div>
      {!txs ? <div className="empty">Loading…</div> : txs.length === 0 ? (
        <div className="empty"><span className="empty-icon">📋</span>No transactions found.</div>
      ) : (
        <div className="log-list">
          {txs.map(t => (
            <div className="log-item" key={t.id}>
              <div className={`log-dot ${t.type}`}>{icon[t.type]}</div>
              <div className="log-body">
                <div className="log-name">
                  {t.product_name}
                  <span className={`badge badge-${t.type === 'in' ? 'in' : t.type === 'out' ? 'out-tx' : 'edit'}`} style={{ marginLeft: 6, fontSize: 10 }}>
                    {t.type.toUpperCase()}
                  </span>
                </div>
                <div className="log-meta">
                  {t.date ? new Date(t.date).toLocaleDateString('en-IN') : ''}
                  {t.party ? ` · ${t.party}` : ''}
                  {t.note ? ` · ${t.note}` : ''}
                </div>
              </div>
              <div className={`log-qty ${qtyClass[t.type]}`}>{sign[t.type]}{t.qty}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardTab({ products }) {
  const [txs, setTxs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState({ recent: false, monthly: false, top: false, restock: false });
  const toggle = (key) => setOpen(o => ({ ...o, [key]: !o[key] }));

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      setTxs(Array.isArray(data) ? data : []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="empty" style={{ padding: '3rem' }}>Loading dashboard…</div>;

  const totalProducts = products.length;
  const totalStock = products.reduce((s, p) => s + Number(p.qty), 0);
  const totalValue = products.reduce((s, p) => s + Number(p.qty) * Number(p.price), 0);
  const lowStock = products.filter(p => Number(p.qty) > 0 && Number(p.qty) <= Number(p.threshold));
  const outOfStock = products.filter(p => Number(p.qty) === 0);

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({ label: d.toLocaleString('en-IN', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() });
  }

  const monthlyData = months.map(m => {
    const inflow = txs.filter(t => {
      const d = new Date(t.date || t.created_at);
      return t.type === 'in' && d.getMonth() === m.month && d.getFullYear() === m.year;
    }).reduce((s, t) => s + Number(t.qty), 0);
    const outflow = txs.filter(t => {
      const d = new Date(t.date || t.created_at);
      return t.type === 'out' && d.getMonth() === m.month && d.getFullYear() === m.year;
    }).reduce((s, t) => s + Number(t.qty), 0);
    return { ...m, inflow, outflow };
  });

  const maxVal = Math.max(...monthlyData.map(m => Math.max(m.inflow, m.outflow)), 1);
  const topProducts = [...products].filter(p => Number(p.price) > 0)
    .sort((a, b) => (Number(b.qty) * Number(b.price)) - (Number(a.qty) * Number(a.price))).slice(0, 8);
  const maxTopVal = Math.max(...topProducts.map(p => Number(p.qty) * Number(p.price)), 1);
  const recentTxs = txs.filter(t => t.type === 'in' || t.type === 'out').slice(0, 8);


  return (
    <div>
      <div className="card" style={{ padding: 0, marginBottom: '1rem' }}>
        <div onClick={() => toggle('recent')} style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}> Recent Activity</div>
          <span style={{ fontSize: 18, color: 'var(--text3)', display: 'inline-block', transform: open.recent ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>⌄</span>
        </div>
        {open.recent && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            {recentTxs.length === 0 ? <div className="empty">No activity yet.</div> : recentTxs.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: t.type === 'in' ? 'var(--green-bg)' : 'var(--red-bg)', color: t.type === 'in' ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{t.type === 'in' ? '↓' : '↑'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.product_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.date ? new Date(t.date).toLocaleDateString('en-IN') : ''}{t.party ? ` · ${t.party}` : ''}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.type === 'in' ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>{t.type === 'in' ? '+' : '−'}{t.qty}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, marginBottom: '1rem' }}>
        <div onClick={() => toggle('monthly')} style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Monthly Flow (Last 6 Months)</div>
          <span style={{ fontSize: 18, color: 'var(--text3)', display: 'inline-block', transform: open.monthly ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>⌄</span>
        </div>
        {open.monthly && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
              {monthlyData.map(m => (
                <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 120 }}>
                    <div style={{ flex: 1, background: 'var(--green)', borderRadius: '3px 3px 0 0', opacity: 0.85, height: `${(m.inflow / maxVal) * 100}%`, minHeight: m.inflow > 0 ? 3 : 0, transition: 'height 0.5s ease' }} title={`Inflow: ${m.inflow}`} />
                    <div style={{ flex: 1, background: 'var(--red)', borderRadius: '3px 3px 0 0', opacity: 0.85, height: `${(m.outflow / maxVal) * 100}%`, minHeight: m.outflow > 0 ? 3 : 0, transition: 'height 0.5s ease' }} title={`Outflow: ${m.outflow}`} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500 }}>{m.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text2)' }}><div style={{ width: 10, height: 10, background: 'var(--green)', borderRadius: 2 }} /> Inflow</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text2)' }}><div style={{ width: 10, height: 10, background: 'var(--red)', borderRadius: 2 }} /> Outflow</div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, marginBottom: '1rem' }}>
        <div onClick={() => toggle('top')} style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Top Products by Stock Value</div>
          <span style={{ fontSize: 18, color: 'var(--text3)', display: 'inline-block', transform: open.top ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>⌄</span>
        </div>
        {open.top && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            {topProducts.length === 0 ? <div className="empty">Add product prices to see stock value.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topProducts.map(p => {
                  const val = Number(p.qty) * Number(p.price);
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, width: 200, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--blue-text)', borderRadius: 4, width: `${(val / maxTopVal) * 100}%`, transition: 'width 0.5s ease' }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', flexShrink: 0, width: 80, textAlign: 'right' }}>₹{val.toLocaleString('en-IN')}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {lowStock.length > 0 && (
        <div className="card" style={{ padding: 0, border: '1px solid #f0d090' }}>
          <div onClick={() => toggle('restock')} style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#854F0B' }}> Products Needing Restock ({lowStock.length})</div>
            <span style={{ fontSize: 18, color: '#854F0B', display: 'inline-block', transform: open.restock ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>⌄</span>
          </div>
          {open.restock && (
            <div style={{ padding: '0 1.25rem 1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {lowStock.map(p => (
                  <div key={p.id} style={{ background: 'var(--amber-bg)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber-text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--amber-text)', opacity: 0.8 }}>{p.qty} {p.unit} left · threshold: {p.threshold}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  // null = show the workspace chooser; otherwise 'inventory' | 'quotations'
  const [module, setModule] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ msg: '', type: 'success' });
  const [stockFilter, setStockFilter] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.body.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const loadProducts = useCallback(async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadProducts(); }, []);

  function showAlert(msg, type = 'success') {
    setAlert({ msg, type });
  }

  const router = useRouter();
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // Tabs belong to a module, so each workspace shows only its own nav.
  const MODULE_TABS = {
    inventory: [
      { id: 'dashboard', label: '📊 Dashboard' },
      { id: 'inventory', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><img src="/logo3.png" style={{ width: 18, height: 18, objectFit: 'contain' }} />Inventory</span> },
      { id: 'inflow', label: '⬇ Inflow' },
      { id: 'outflow', label: '⬆ Outflow' },
      { id: 'log', label: '📋 Log' },
    ],
    quotations: [
      { id: 'quotations', label: '📄 Quotations' },
      { id: 'clients', label: '👥 Clients' },
    ],
  };

  const MODULE_LABEL = { inventory: 'Inventory', quotations: 'Quotations' };

  function pickModule(id) {
    setModule(id);
    setTab(MODULE_TABS[id][0].id);
    setStockFilter('');
  }

  function backToPicker() {
    setModule(null);
    setStockFilter('');
    setAlert({ msg: '', type: 'success' });
  }

  // No module chosen yet — show the chooser instead of the app shell.
  if (!module) {
    return (
      <>
        <Head>
          <title>Raj Agencies</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/logo3.png" />
        </Head>
        <ModulePicker
          onPick={pickModule}
          onLogout={handleLogout}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode(d => !d)}
        />
      </>
    );
  }

  const tabs = MODULE_TABS[module];
  const isInventory = module === 'inventory';

  return (
    <>
      <Head>
        <title>{MODULE_LABEL[module]} — Raj Agencies</title>
        <meta name="description" content="Simple inventory management for vendors" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logo3.png" />
      </Head>

      <div className="topbar">
        <div className="container">
          <div className="topbar-inner">
            <div className="brand">
              <button
                onClick={backToPicker}
                title="Switch workspace"
                className="brand-back"
              >
                <img src="/logo2.png" alt="Raj Agencies" style={{ height: 40, width: 40, objectFit: 'contain' }} />
                <span style={{ color: darkMode ? '#ffffff' : '#363434', fontSize: 18, fontWeight: 700 }}>
                  Raj Agencies
                </span>
                <span className="brand-module">{MODULE_LABEL[module]}</span>
              </button>
            </div>
            <nav className="nav-tabs">
              {tabs.map(t => (
                <button
                  key={t.id}
                  className={`nav-tab${tab === t.id ? ' active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={backToPicker} className="btn btn-sm" style={{ color: 'var(--text2)' }}>
                ⇄ Switch
              </button>
              <button onClick={() => setDarkMode(d => !d)} className="btn btn-sm" style={{ color: 'var(--text2)' }}>
                {darkMode ? '☀️ Light' : '🌙 Dark'}
              </button>
              <button onClick={handleLogout} className="btn btn-sm" style={{ color: 'var(--text2)' }}>
               Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="main">
        <div className="container">
          {/* Stock stat cards are inventory context; they'd be noise above a
              quotation, and they scroll the actual work off the screen. */}
          {isInventory && (loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 80 }} />
              ))}
            </div>
          ) : (
            <StatCards products={products} stockFilter={stockFilter} setStockFilter={setStockFilter} setTab={setTab} />
          ))}

          <Alert msg={alert.msg} type={alert.type} onClose={() => setAlert({ msg: '', type: 'success' })} />

          {tab === 'dashboard' && <DashboardTab products={products} />}
          {tab === 'inventory' && <InventoryTab products={products} onRefresh={loadProducts} onAlert={showAlert} stockFilter={stockFilter} setStockFilter={setStockFilter} />}
          {tab === 'inflow' && <InflowTab products={products} onRefresh={loadProducts} onAlert={showAlert} />}
          {tab === 'outflow' && <OutflowTab products={products} onRefresh={loadProducts} onAlert={showAlert} />}
          {tab === 'quotations' && <QuotationsTab products={products} onAlert={showAlert} />}
          {tab === 'clients' && <ClientsTab onAlert={showAlert} />}
          {tab === 'log' && <LogTab />}
        </div>
      </main>
    </>
  );
}
