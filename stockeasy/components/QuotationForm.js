import { useState, useEffect, useCallback } from 'react';
import { calcQuotation, formatPaise, GST_RATES } from '../lib/quoteMath';
import ProductPicker from './ProductPicker';

const todayISO = () => new Date().toISOString().split('T')[0];
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];

const BLANK_LINE = {
  product_id: '', product_name: '', description: '',
  unit: 'NOS', qty: '1', unit_price: '0', gst_percent: '18',
  hsn_code: '', not_available: false,
  available_stock: null,
};

export default function QuotationForm({ products, existing, onCancel, onSaved, onAlert }) {
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);

  const [header, setHeader] = useState(() => ({
    client_id: existing?.client_id || '',
    client_name: existing?.client_name || '',
    contact_person: existing?.contact_person || '',
    phone: existing?.phone || '',
    email: existing?.email || '',
    billing_address: existing?.billing_address || '',
    shipping_address: existing?.shipping_address || '',
    gst_number: existing?.gst_number || '',
    quote_date: existing?.quote_date ? String(existing.quote_date).split('T')[0] : todayISO(),
    valid_until: existing?.valid_until ? String(existing.valid_until).split('T')[0] : plusDays(15),
    notes: existing?.notes || '',
    terms: existing?.terms || '',
    subject: existing?.subject || '',
    status: existing?.status || 'draft',
  }));

  const [lines, setLines] = useState(() =>
    existing?.items?.length
      ? existing.items.map(it => ({
          product_id: it.product_id || '',
          product_name: it.product_name || '',
          description: it.description || '',
          unit: it.unit || 'NOS',
          qty: String(it.qty),
          unit_price: String(it.unit_price),
          gst_percent: String(it.gst_percent),
          hsn_code: it.hsn_code || '',
          not_available: Boolean(it.not_available),
          available_stock: null,
        }))
      : [{ ...BLANK_LINE }]
  );

  const [discountType, setDiscountType] = useState(existing?.discount_type || 'none');
  const [discountValue, setDiscountValue] = useState(String(existing?.discount_value || ''));
  const [otherCharges, setOtherCharges] = useState(String(existing?.other_charges || ''));

  const setH = (k, v) => setHeader(h => ({ ...h, [k]: v }));

  const [knownParties, setKnownParties] = useState([]);

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => setClients(Array.isArray(d) ? d : []))
      .catch(() => setClients([]));

    // Past customers from outflow history, offered as a second group so a
    // name you've already sold to doesn't have to be typed out again.
    fetch('/api/known-parties?type=out')
      .then(r => r.json())
      .then(d => setKnownParties(Array.isArray(d) ? d : []))
      .catch(() => setKnownParties([]));
  }, []);

  // Selecting a saved client fills the header, but the fields stay editable —
  // a one-off delivery address shouldn't force you to edit the client record.
  function pickClient(id) {
    // A history entry carries only a name — there's no client record behind
    // it, so it fills the name and leaves the rest for you to complete.
    if (String(id).startsWith('history:')) {
      const name = String(id).slice('history:'.length);
      setHeader(h => ({ ...h, client_id: '', client_name: name }));
      return;
    }

    setH('client_id', id);
    if (!id) return;
    const c = clients.find(x => String(x.id) === String(id));
    if (!c) return;
    setHeader(h => ({
      ...h,
      client_id: id,
      client_name: c.name || '',
      contact_person: c.contact_person || '',
      phone: c.phone || '',
      email: c.email || '',
      billing_address: c.billing_address || '',
      shipping_address: c.shipping_address || '',
      gst_number: c.gst_number || '',
    }));
  }

  function setLine(idx, patch) {
    setLines(ls => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  // Choosing a product pulls its name, unit, price and current stock across.
  function pickProduct(idx, productId) {
    const p = products.find(x => String(x.id) === String(productId));
    if (!p) {
      setLine(idx, { product_id: '', product_name: '', available_stock: null });
      return;
    }
    setLine(idx, {
      product_id: p.id,
      product_name: p.name,
      unit: p.unit || 'NOS',
      unit_price: String(Number(p.price) || 0),
      // HSN comes from the catalogue so it's entered once, not per quote.
      hsn_code: p.hsn_code || '',
      available_stock: Number(p.qty),
    });
  }

  // A one-off item bought in for this job: it has a name and a price but no
  // inventory record, so there's no stock figure and no product_id to link.
  // The quotation stores the name directly, which is why this works without
  // polluting the catalogue with items you'll never stock.
  function setCustomProduct(idx, name) {
    setLine(idx, {
      product_id: '',
      product_name: name,
      available_stock: null,
    });
  }

  const addLine = () => setLines(ls => [...ls, { ...BLANK_LINE }]);
  const removeLine = (idx) => setLines(ls => (ls.length === 1 ? ls : ls.filter((_, i) => i !== idx)));

  // Same helper the server uses, so what you see is what gets stored.
  const totals = calcQuotation({
    items: lines.map(l => ({
      qty: l.qty, unit_price: l.unit_price, gst_percent: l.gst_percent,
      not_available: l.not_available,
    })),
    discount_type: discountType,
    discount_value: discountValue,
    other_charges: otherCharges,
  });

  // Stock is advisory only: a quotation is an offer, so quoting more than
  // you hold is legitimate (you may be restocking). We warn, never block.
  const stockWarnings = lines
    .map((l, i) => {
      if (l.not_available) return null;
      if (l.available_stock == null || !l.product_name) return null;
      const q = Number(l.qty) || 0;
      if (q > l.available_stock) {
        return `${l.product_name}: quoting ${q} but only ${l.available_stock} in stock`;
      }
      return null;
    })
    .filter(Boolean);

  async function submit(e) {
    e.preventDefault();
    if (!header.client_name.trim()) { onAlert('Client name is required.', 'error'); return; }

    const validLines = lines.filter(l => l.product_name.trim() && Number(l.qty) > 0);
    if (validLines.length === 0) { onAlert('Add at least one product with a quantity.', 'error'); return; }

    setSaving(true);
    const payload = {
      ...header,
      client_id: header.client_id || null,
      discount_type: discountType,
      discount_value: Number(discountValue) || 0,
      other_charges: Number(otherCharges) || 0,
      items: validLines.map(l => ({
        product_id: l.product_id || null,
        product_name: l.product_name,
        description: l.description,
        unit: l.unit,
        hsn_code: l.hsn_code || null,
        not_available: Boolean(l.not_available),
        qty: Number(l.qty),
        unit_price: Number(l.unit_price) || 0,
        gst_percent: Number(l.gst_percent) || 0,
      })),
    };

    const res = await fetch(existing ? `/api/quotations/${existing.id}` : '/api/quotations', {
      method: existing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { onAlert(data.error || 'Failed to save quotation.', 'error'); return; }
    onSaved(data);
  }

  const cellStyle = { padding: '6px 4px', verticalAlign: 'top' };

  return (
    <form onSubmit={submit}>
      {/* ─── Client ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-title">Client Details</div>

        <div className="form-row">
          <div className="form-group">
            <label>Select Saved Client</label>
            <select
              value={header.client_id || (header.client_name && !header.client_id ? `history:${header.client_name}` : '')}
              onChange={e => pickClient(e.target.value)}
            >
              <option value="">— New / one-off client —</option>
              {clients.length > 0 && (
                <optgroup label="Saved clients">
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              )}
              {knownParties.length > 0 && (
                <optgroup label="From sales history (name only)">
                  {knownParties.map(p => (
                    <option key={p.name} value={`history:${p.name}`}>{p.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="form-group">
            <label>Client / Company Name *</label>
            <input value={header.client_name} onChange={e => setH('client_name', e.target.value)} required />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Contact Person</label>
            <input value={header.contact_person} onChange={e => setH('contact_person', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={header.phone} onChange={e => setH('phone', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={header.email} onChange={e => setH('email', e.target.value)} />
          </div>
          <div className="form-group">
            <label>GST Number</label>
            <input
              value={header.gst_number}
              onChange={e => setH('gst_number', e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase' }}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Billing Address</label>
            <textarea rows={2} value={header.billing_address}
              onChange={e => setH('billing_address', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div className="form-group">
            <label>Shipping Address</label>
            <textarea rows={2} value={header.shipping_address}
              onChange={e => setH('shipping_address', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Quotation Date</label>
            <input type="date" value={header.quote_date} onChange={e => setH('quote_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Valid Until</label>
            <input type="date" value={header.valid_until} onChange={e => setH('valid_until', e.target.value)} />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Subject</label>
          <input
            value={header.subject}
            onChange={e => setH('subject', e.target.value)}
            placeholder="e.g. CCTV, ACCESS CONTROL, FIRE ALARM…"
          />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
            {header.subject.trim()
              ? <>Prints as: We take pleasure in offering you a quotation for “{header.subject.trim()}”.</>
              : <>Leave blank to print: We take pleasure in offering you a quotation.</>}
          </div>
        </div>
      </div>

      {/* ─── Products ───────────────────────────────────────────── */}
      <div className="card" style={{ padding: '1.25rem 1rem' }}>
        <div className="card-title">Products</div>

        <div className="table-wrap q-lines-wrap">
          <table className="q-lines" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 190 }}>Item</th>
                <th style={{ width: 96 }}>HSN</th>
                <th style={{ width: 66 }}>Qty</th>
                <th style={{ width: 66 }}>UOM</th>
                <th style={{ width: 100 }}>Rate</th>
                <th style={{ width: 80 }}>GST %</th>
                <th style={{ width: 96, textAlign: 'right' }}>Taxable</th>
                <th style={{ width: 96, textAlign: 'right' }}>Tax</th>
                <th style={{ width: 100, textAlign: 'right' }}>Total</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const t = totals.lines[i] || {};
                const over = l.available_stock != null && Number(l.qty) > l.available_stock;
                // Named but not linked to a catalogue product.
                const isCustom = !l.product_id && !!l.product_name;
                return (
                  <tr key={i}>
                    <td style={cellStyle} data-label="Item">
                      <div style={{ marginBottom: 4 }}>
                        <ProductPicker
                          products={products}
                          value={l.product_id}
                          productName={l.product_name}
                          onPick={(id) => pickProduct(i, id)}
                          onCustom={(name) => setCustomProduct(i, name)}
                          placeholder="Search product, or type a new one…"
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          placeholder="Description (optional)"
                          value={l.description}
                          onChange={e => setLine(i, { description: e.target.value })}
                          style={{ fontSize: 11, flex: 1 }}
                        />
                        {/* Catalogue items inherit their unit; a one-off item
                            has none, so it needs to be set here. */}
                        {isCustom && (
                          <input
                            placeholder="unit"
                            value={l.unit}
                            onChange={e => setLine(i, { unit: e.target.value })}
                            style={{ fontSize: 11, width: 60 }}
                            title="Unit (pcs, kg, box…)"
                          />
                        )}
                      </div>

                      {l.available_stock != null && (
                        <div style={{ fontSize: 10, marginTop: 3, color: over ? 'var(--red)' : 'var(--text3)' }}>
                          In stock: {l.available_stock} {l.unit}
                        </div>
                      )}
                      {isCustom && (
                        <div style={{ fontSize: 10, marginTop: 3, color: 'var(--blue-text)' }}>
                          One-off item · not in inventory
                        </div>
                      )}

                      {/* Quote an item you can't currently supply: it prints
                          as NOT AVAILABLE rather than as a zero price. */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: 10, cursor: 'pointer', color: 'var(--text3)' }}>
                        <input
                          type="checkbox"
                          checked={l.not_available}
                          onChange={e => setLine(i, { not_available: e.target.checked })}
                          style={{ width: 'auto', margin: 0 }}
                        />
                        Not available
                      </label>
                    </td>
                    <td style={cellStyle} data-label="HSN">
                      <input
                        value={l.hsn_code}
                        onChange={e => setLine(i, { hsn_code: e.target.value })}
                        placeholder="HSN"
                        style={{ fontSize: 11 }}
                      />
                    </td>
                    <td style={cellStyle} data-label="Qty">
                      <input
                        type="number" min="0" step="any" value={l.qty}
                        onChange={e => setLine(i, { qty: e.target.value })}
                        style={{ borderColor: over ? 'var(--red)' : undefined }}
                      />
                    </td>
                    <td style={cellStyle} data-label="UOM">
                      <input
                        value={l.unit}
                        onChange={e => setLine(i, { unit: e.target.value })}
                        placeholder="NOS"
                        style={{ fontSize: 11 }}
                      />
                    </td>
                    <td style={cellStyle} data-label="Rate">
                      <input type="number" min="0" step="0.01" value={l.unit_price}
                        disabled={l.not_available}
                        onChange={e => setLine(i, { unit_price: e.target.value })} />
                    </td>
                    <td style={cellStyle} data-label="GST %">
                      <select value={l.gst_percent} disabled={l.not_available}
                        onChange={e => setLine(i, { gst_percent: e.target.value })}>
                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    {l.not_available ? (
                      <td colSpan={3} style={{ ...cellStyle, textAlign: 'center', paddingTop: 14, fontStyle: 'italic', color: 'var(--text3)' }}>
                        NOT AVAILABLE
                      </td>
                    ) : (
                      <>
                        <td style={{ ...cellStyle, textAlign: 'right', paddingTop: 14 }} data-label="Taxable">
                          {formatPaise(t.lineSubtotalP || 0)}
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'right', paddingTop: 14 }} data-label="Tax">
                          {formatPaise(t.gstAmountP || 0)}
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'right', paddingTop: 14, fontWeight: 600 }} data-label="Total">
                          {formatPaise(t.lineTotalP || 0)}
                        </td>
                      </>
                    )}
                    <td style={{ ...cellStyle, paddingTop: 10 }} data-label="">
                      <button
                        type="button" className="btn btn-ghost btn-remove-line"
                        onClick={() => removeLine(i)}
                        disabled={lines.length === 1}
                        style={{ fontSize: 16, padding: '4px 8px' }}
                      >×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button type="button" className="btn btn-sm" onClick={addLine} style={{ marginTop: 10 }}>
          + Add Product Line
        </button>

        {stockWarnings.length > 0 && (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 8,
            background: 'var(--amber-bg)', color: 'var(--amber-text)', fontSize: 12,
          }}>
            <strong>Stock note</strong> — you can still send this quotation; stock is not reserved.
            <ul style={{ margin: '6px 0 0 18px' }}>
              {stockWarnings.map(w => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* ─── Summary ────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-title">Summary</div>

        <div className="form-row">
          <div className="form-group">
            <label>Discount</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={discountType} onChange={e => setDiscountType(e.target.value)} style={{ width: 110 }}>
                <option value="none">None</option>
                <option value="percent">Percent %</option>
                <option value="fixed">Fixed ₹</option>
              </select>
              <input
                type="number" min="0" step="0.01"
                value={discountValue}
                onChange={e => setDiscountValue(e.target.value)}
                disabled={discountType === 'none'}
                placeholder="0"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Other Charges (₹)</label>
            <input type="number" min="0" step="0.01" value={otherCharges}
              onChange={e => setOtherCharges(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div style={{
          background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px',
          fontSize: 13, marginBottom: 12,
        }}>
          {[
            ['Total Quantity', String(totals.totalQty)],
            ['Subtotal', formatPaise(totals.subtotalP)],
            ['Total GST', formatPaise(totals.totalGstP)],
            ...(totals.discountP ? [['Discount', '− ' + formatPaise(totals.discountP)]] : []),
            ...(totals.otherP ? [['Other Charges', formatPaise(totals.otherP)]] : []),
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--text2)' }}>
              <span>{label}</span><span>{value}</span>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            paddingTop: 8, marginTop: 6, borderTop: '1px solid var(--border)',
            fontSize: 16, fontWeight: 700, color: 'var(--text)',
          }}>
            <span>Grand Total</span><span>{formatPaise(totals.grandTotalP)}</span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Notes</label>
            <textarea rows={2} value={header.notes} onChange={e => setH('notes', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div className="form-group">
            <label>Terms &amp; Conditions</label>
            <textarea rows={2} value={header.terms} onChange={e => setH('terms', e.target.value)}
              placeholder="Leave blank to use the default terms" style={{ resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : existing ? 'Save Changes' : 'Create Quotation'}
          </button>
        </div>
      </div>
    </form>
  );
}
