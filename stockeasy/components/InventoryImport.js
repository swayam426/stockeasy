import { useRef, useState } from 'react';
import { parseInventoryFile, diffInventory } from '../lib/inventoryImport';

/**
 * "Import" button + review dialog.
 *
 * Pick the Excel file you downloaded and edited; you see exactly what will
 * change before anything is saved.
 */
export default function InventoryImport({ products, onDone, onAlert }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null); // { rows, problems, diff }
  const [applying, setApplying] = useState(false);

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      onAlert('Please choose an .xlsx file (Excel workbook).', 'error');
      return;
    }
    setBusy(true);
    try {
      const { rows, problems } = await parseInventoryFile(await file.arrayBuffer());
      if (!rows.length) {
        onAlert(problems[0] || 'No product rows found in the file.', 'error');
        return;
      }
      setReview({ rows, problems, diff: diffInventory(rows, products), fileName: file.name });
    } catch (err) {
      onAlert(err.message || 'Could not read that file.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const { diff } = review;
    // Send only rows that actually change something.
    const send = [...diff.updates.map(u => u.row), ...diff.additions];
    if (!send.length) { setReview(null); return; }
    setApplying(true);
    try {
      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: send }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      const bits = [];
      if (data.updated) bits.push(`${data.updated} updated`);
      if (data.added) bits.push(`${data.added} added`);
      onAlert(`Import complete: ${bits.join(', ') || 'no changes'}.` +
        (data.failed && data.failed.length ? ` ${data.failed.length} failed.` : ''),
        data.failed && data.failed.length ? 'error' : 'success');
      setReview(null);
      onDone();
    } catch (err) {
      onAlert(err.message || 'Import failed.', 'error');
    } finally {
      setApplying(false);
    }
  }

  const d = review && review.diff;
  const nothing = d && d.updates.length === 0 && d.additions.length === 0;

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={onFile} />
      <button
        className="btn btn-sm"
        onClick={() => inputRef.current && inputRef.current.click()}
        disabled={busy}
        title="Upload an edited inventory Excel file to update products"
      >
        {busy ? <><span className="spinner" /> Reading…</> : '⬆ Import'}
      </button>

      {review && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !applying && setReview(null)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div className="modal-title">Review import</div>
              <button className="modal-close" onClick={() => !applying && setReview(null)}>×</button>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>{review.fileName}</div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12, fontSize: 14 }}>
              <span><b>{d.updates.length}</b> to update</span>
              <span><b>{d.additions.length}</b> new</span>
              <span style={{ color: 'var(--text3)' }}>{d.unchanged} unchanged</span>
            </div>

            <div style={{ maxHeight: '45vh', overflowY: 'auto', fontSize: 13 }}>
              {d.updates.map(u => (
                <div key={u.product.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border, #eee)' }}>
                  <div style={{ fontWeight: 600 }}>{u.product.name} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {u.product.sku}</span></div>
                  {u.changes.map(c => (
                    <div key={c.field} style={{ color: 'var(--text2, #555)' }}>
                      {c.label}: <s>{String(c.before) || '—'}</s> → <b>{String(c.after)}</b>
                    </div>
                  ))}
                </div>
              ))}
              {d.additions.map(r => (
                <div key={r.sku} style={{ padding: '6px 0', borderBottom: '1px solid var(--border, #eee)' }}>
                  <span className="badge badge-ok" style={{ marginRight: 6 }}>NEW</span>
                  <b>{r.name}</b> <span style={{ color: 'var(--text3)' }}>· {r.sku} · stock {r.qty ?? 0}</span>
                </div>
              ))}
              {nothing && <div style={{ padding: '12px 0' }}>No differences from your current inventory.</div>}
            </div>

            {review.problems.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#b45309' }}>
                {review.problems.length} row(s) skipped:
                {review.problems.slice(0, 5).map((p, i) => <div key={i}>• {p}</div>)}
                {review.problems.length > 5 && <div>…and {review.problems.length - 5} more</div>}
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              Products are matched by SKU. Nothing is deleted. Stock changes are logged in history.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn" onClick={() => setReview(null)} disabled={applying}>Cancel</button>
              {!nothing && (
                <button className="btn btn-primary" onClick={apply} disabled={applying}>
                  {applying ? <><span className="spinner" /> Applying…</> : `Apply ${d.updates.length + d.additions.length} change(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
