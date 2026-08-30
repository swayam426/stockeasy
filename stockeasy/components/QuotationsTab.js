import { useState, useEffect, useCallback } from 'react';
import QuotationForm from './QuotationForm';
import QuotationView from './QuotationView';
import { formatPaise, toPaise, QUOTE_STATUSES } from '../lib/quoteMath';
import { downloadQuotationPdf } from '../lib/quotePdf';
import { DownloadCloud } from './Icons';

const STATUS_COLORS = {
  draft:     { bg: 'var(--surface2)', fg: 'var(--text2)' },
  sent:      { bg: 'var(--blue-bg)', fg: 'var(--blue-text)' },
  accepted:  { bg: 'var(--green-bg)', fg: 'var(--green-text)' },
  rejected:  { bg: 'var(--red-bg)', fg: 'var(--red-text)' },
  expired:   { bg: 'var(--amber-bg)', fg: 'var(--amber-text)' },
  converted: { bg: 'var(--green-bg)', fg: 'var(--green-text)' },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

function StatusPill({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return (
    <span className="badge" style={{ background: c.bg, color: c.fg }}>
      {String(status).toUpperCase()}
    </span>
  );
}

export default function QuotationsTab({ products, onAlert }) {
  // 'list' | 'create' | 'edit' | 'view'
  const [mode, setMode] = useState('list');
  const [active, setActive] = useState(null);

  const [quotes, setQuotes] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/quotations');
    const data = await res.json();
    setQuotes(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { if (mode === 'list') load(); }, [mode, load]);

  async function openQuote(id, nextMode = 'view') {
    const res = await fetch(`/api/quotations/${id}`);
    const data = await res.json();
    if (!res.ok) { onAlert(data.error || 'Could not load quotation.', 'error'); return; }
    setActive(data);
    setMode(nextMode);
  }

  async function changeStatus(q, status) {
    const res = await fetch(`/api/quotations/${q.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) { onAlert(data.error || 'Could not change status.', 'error'); return; }
    onAlert(`${q.quote_number} marked ${status}.`, 'success');
    load();
  }

  // The list rows only carry summary fields, so fetch the full quotation
  // (with its line items) before building the PDF.
  async function handleDownload(q) {
    setDownloadingId(q.id);
    try {
      const res = await fetch(`/api/quotations/${q.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load quotation');
      await downloadQuotationPdf(data);
    } catch (err) {
      onAlert(err.message || 'Could not generate the PDF.', 'error');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(q) {
    if (!confirm(`Delete ${q.quote_number} for ${q.client_name}?\n\nThis cannot be undone.`)) return;
    const res = await fetch(`/api/quotations/${q.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { onAlert(data.error || 'Failed to delete.', 'error'); return; }
    onAlert('Quotation deleted.', 'success');
    load();
  }

  // Duplicating loads the original, strips its identity, and opens the
  // form as a fresh create — so the new quotation gets its own number.
  async function handleDuplicate(q) {
    const res = await fetch(`/api/quotations/${q.id}`);
    const data = await res.json();
    if (!res.ok) { onAlert('Could not load quotation to duplicate.', 'error'); return; }
    const { id, quote_number, created_at, updated_at, status, converted_at, ...rest } = data;
    setActive({ ...rest, status: 'draft' });
    setMode('create');
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <QuotationForm
        products={products}
        existing={mode === 'edit' ? active : (active || null)}
        onCancel={() => { setActive(null); setMode('list'); }}
        onAlert={onAlert}
        onSaved={(saved) => {
          onAlert(
            mode === 'edit' ? `${saved.quote_number} updated.` : `${saved.quote_number} created.`,
            'success'
          );
          setActive(null);
          setMode('list');
        }}
      />
    );
  }

  if (mode === 'view') {
    return (
      <QuotationView
        quote={active}
        onClose={() => { setActive(null); setMode('list'); }}
        onEdit={(q) => openQuote(q.id, 'edit')}
        onAlert={onAlert}
      />
    );
  }

  const filtered = (quotes || []).filter(q => {
    if (statusFilter && q.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (q.quote_number || '').toLowerCase().includes(s)
      || (q.client_name || '').toLowerCase().includes(s);
  });

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          placeholder="Search by quotation number or client…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 140 }}>
          <option value="">All status</option>
          {QUOTE_STATUSES.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          style={{ flexShrink: 0 }}
          onClick={() => { setActive(null); setMode('create'); }}
        >
          + New Quotation
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {!quotes ? (
          <div className="empty">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">📄</span>
            {quotes.length === 0
              ? 'No quotations yet. Create your first one.'
              : 'No quotations match your filters.'}
          </div>
        ) : (
          <div className="table-wrap q-list-wrap">
            <table className="q-list">
              <thead>
                <tr>
                  <th>Quotation</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Valid Until</th>
                  <th className="ta-r">Items</th>
                  <th className="ta-r">Grand Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id}>
                    <td data-label="Quotation">
                      <strong>{q.quote_number}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>by {q.created_by}</div>
                    </td>
                    <td data-label="Client">{q.client_name}</td>
                    <td data-label="Date">{fmtDate(q.quote_date)}</td>
                    <td data-label="Valid until">{fmtDate(q.valid_until)}</td>
                    <td className="ta-r" data-label="Items">{q.item_count}</td>
                    <td className="ta-r" style={{ fontWeight: 600 }} data-label="Grand total">
                      {formatPaise(toPaise(q.grand_total))}
                    </td>
                    <td data-label="Status">
                      <select
                        value={q.status}
                        onChange={e => changeStatus(q, e.target.value)}
                        disabled={q.status === 'converted'}
                        style={{ width: 120, fontSize: 11, padding: '4px 6px' }}
                      >
                        {QUOTE_STATUSES.filter(s => s !== 'converted' || q.status === 'converted').map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td data-label="" className="q-actions-cell">
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm" onClick={() => openQuote(q.id, 'view')}>View</button>
                        {q.status !== 'converted' && (
                          <button className="btn btn-sm" onClick={() => openQuote(q.id, 'edit')}>Edit</button>
                        )}
                        <button
                          className="btn btn-sm"
                          onClick={() => handleDownload(q)}
                          disabled={downloadingId === q.id}
                          title="Download PDF"
                        >
                          {downloadingId === q.id ? '…' : <><DownloadCloud size={14} /> PDF</>}
                        </button>
                        <button className="btn btn-sm" onClick={() => handleDuplicate(q)}>Copy</button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleDelete(q)}
                          style={{ fontSize: 16, padding: '4px 8px' }}
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
    </>
  );
}
