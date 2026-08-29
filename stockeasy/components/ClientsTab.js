import { useState, useEffect, useCallback } from 'react';

const EMPTY = {
  name: '', contact_person: '', phone: '', email: '',
  billing_address: '', shipping_address: '', gst_number: '', notes: '',
};

function ClientModal({ client, onClose, onSave }) {
  const [form, setForm] = useState(client ? { ...EMPTY, ...client } : EMPTY);
  const [loading, setLoading] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(
    !client || !client.shipping_address || client.shipping_address === client.billing_address
  );
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // A client object without an id is a NEW record pre-filled from sales
  // history — it must POST, not PUT to /api/clients/undefined.
  const isEdit = Boolean(client && client.id);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);

    const payload = {
      ...form,
      shipping_address: sameAsBilling ? form.billing_address : form.shipping_address,
    };

    const res = await fetch(isEdit ? `/api/clients/${client.id}` : '/api/clients', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { onSave(null, data.error); return; }
    onSave(data, null);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Client' : 'Add Client'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label>Client / Company Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label>Contact Person</label>
              <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>GST Number</label>
            <input
              value={form.gst_number}
              onChange={e => set('gst_number', e.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>Billing Address</label>
            <textarea
              rows={3}
              value={form.billing_address}
              onChange={e => set('billing_address', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sameAsBilling}
                onChange={e => setSameAsBilling(e.target.checked)}
                style={{ width: 'auto', margin: 0 }}
              />
              Shipping address same as billing
            </label>
          </div>

          {!sameAsBilling && (
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Shipping Address</label>
              <textarea
                rows={3}
                value={form.shipping_address}
                onChange={e => set('shipping_address', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>Notes</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Saving…</> : isEdit ? 'Save Changes' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '');

export default function ClientsTab({ onAlert }) {
  const [clients, setClients] = useState(null);
  // Customer names pulled from outflow history that aren't saved clients yet.
  const [knownParties, setKnownParties] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { client } | { client: null }

  const load = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([
      fetch('/api/clients'),
      fetch('/api/known-parties?type=out'),
    ]);
    const cData = await cRes.json();
    const pData = await pRes.json();
    setClients(Array.isArray(cData) ? cData : []);
    setKnownParties(Array.isArray(pData) ? pData : []);
  }, []);

  useEffect(() => { load(); }, []);

  async function handleDelete(c) {
    if (!confirm(`Delete "${c.name}"?\n\nQuotations already created for this client will keep their saved details.`)) return;
    const res = await fetch(`/api/clients/${c.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { onAlert(data.error || 'Failed to delete.', 'error'); return; }
    onAlert(
      data.detachedQuotations
        ? `Client deleted. ${data.detachedQuotations} quotation(s) kept their saved details.`
        : 'Client deleted.',
      'success'
    );
    load();
  }

  const s = search.trim().toLowerCase();

  const filtered = (clients || []).filter(c => {
    if (!s) return true;
    return (c.name || '').toLowerCase().includes(s)
      || (c.contact_person || '').toLowerCase().includes(s)
      || (c.phone || '').toLowerCase().includes(s)
      || (c.gst_number || '').toLowerCase().includes(s);
  });

  // History names only appear once you search — showing hundreds of past
  // customers unprompted would bury the clients you've actually set up.
  const matchingParties = s
    ? knownParties.filter(p => p.name.toLowerCase().includes(s))
    : [];

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <input
          placeholder={
            knownParties.length
              ? `Search saved clients or ${knownParties.length} past customers…`
              : 'Search clients by name, contact, phone or GST…'
          }
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => setModal({ client: null })}>
          + Add Client
        </button>
      </div>

      {/* Names found in outflow history but not yet saved as clients. */}
      {matchingParties.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 10 }}>
            From your sales history · not saved yet
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {matchingParties.slice(0, 8).map(p => (
              <div key={p.name} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, background: 'var(--surface2)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {p.txn_count} sale{p.txn_count === 1 ? '' : 's'}
                    {p.total_qty ? ` · ${p.total_qty} units` : ''}
                    {p.last_date ? ` · last ${fmtDate(p.last_date)}` : ''}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  style={{ flexShrink: 0 }}
                  onClick={() => setModal({ client: { name: p.name } })}
                >
                  + Save as client
                </button>
              </div>
            ))}
          </div>
          {matchingParties.length > 8 && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
              +{matchingParties.length - 8} more — keep typing to narrow.
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {!clients ? (
          <div className="empty">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">👥</span>
            {clients.length === 0
              ? (knownParties.length > 0
                  ? `No saved clients yet — search a name to pull it from your ${knownParties.length} past customers.`
                  : 'No clients yet. Add one to get started.')
              : matchingParties.length > 0
                ? 'No saved clients match — see the history matches above.'
                : 'No clients match your search.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>GST</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      {c.email && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.email}</div>}
                    </td>
                    <td>{c.contact_person || '—'}</td>
                    <td>{c.phone || '—'}</td>
                    <td style={{ fontSize: 12 }}>{c.gst_number || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm" onClick={() => setModal({ client: c })}>Edit</button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleDelete(c)}
                          style={{ fontSize: 18, padding: '6px 12px' }}
                        >🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ClientModal
          client={modal.client}
          onClose={() => setModal(null)}
          onSave={(data, err) => {
            if (err) { onAlert(err, 'error'); return; }
            setModal(null);
            onAlert(`"${data.name}" saved.`, 'success');
            load();
          }}
        />
      )}
    </>
  );
}
