import { useState } from 'react';
import { formatPaise, toPaise } from '../lib/quoteMath';
import { COMPANY } from '../lib/company';
import { downloadQuotationPdf } from '../lib/quotePdf';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * The printable quotation.
 *
 * This renders on screen and is also what the browser prints. The print
 * stylesheet (in globals.css) hides the app chrome so "Print → Save as PDF"
 * produces a clean single document with no navigation or buttons on it.
 */
export default function QuotationView({ quote, onClose, onEdit, onAlert }) {
  const [downloading, setDownloading] = useState(false);

  if (!quote) return null;

  const items = quote.items || [];

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadQuotationPdf(quote);
    } catch (err) {
      // Most likely cause is the dynamic import failing on a flaky
      // connection; printing still works, so say so rather than just failing.
      if (onAlert) onAlert('Could not generate the PDF. You can still use Print.', 'error');
      else alert('Could not generate the PDF. You can still use Print.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="quote-print-root">
      {/* Toolbar — excluded from print output */}
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button className="btn" onClick={onClose}>← Back to list</button>
        <div style={{ flex: 1 }} />
        {onEdit && quote.status !== 'converted' && (
          <button className="btn" onClick={() => onEdit(quote)}>Edit</button>
        )}
        <button className="btn" onClick={() => window.print()}>
          🖨 Print
        </button>
        <button className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
          {downloading ? <><span className="spinner" /> Preparing…</> : '⬇ Download PDF'}
        </button>
      </div>

      <div className="quote-doc">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="quote-head">
          <div className="quote-head-left">
            {COMPANY.logo && <img src={COMPANY.logo} alt={COMPANY.name} className="quote-logo" />}
            <div>
              <div className="quote-company">{COMPANY.name}</div>
              {COMPANY.address.map((l, i) => <div key={i} className="quote-muted">{l}</div>)}
              <div className="quote-muted">Phone: {COMPANY.phone}</div>
              <div className="quote-muted">Email: {COMPANY.email}</div>
              {COMPANY.gst && <div className="quote-muted">GSTIN: {COMPANY.gst}</div>}
            </div>
          </div>
          <div className="quote-head-right">
            <div className="quote-title">QUOTATION</div>
            <div className="quote-number">{quote.quote_number}</div>
            <div className="quote-muted">Date: {fmtDate(quote.quote_date)}</div>
            <div className="quote-muted">Valid Until: {fmtDate(quote.valid_until)}</div>
          </div>
        </div>

        {/* ── Client ─────────────────────────────────────────── */}
        <div className="quote-parties">
          <div className="quote-party">
            <div className="quote-party-label quote-to-label">To</div>
            <div className="quote-party-name">{quote.client_name}</div>
            {quote.contact_person && <div className="quote-muted">Attn: {quote.contact_person}</div>}
            {quote.billing_address && <div className="quote-muted quote-pre">{quote.billing_address}</div>}
            {quote.phone && <div className="quote-muted">Phone: {quote.phone}</div>}
            {quote.email && <div className="quote-muted">Email: {quote.email}</div>}
            {quote.gst_number && <div className="quote-muted">GSTIN: {quote.gst_number}</div>}
          </div>
          {quote.shipping_address && quote.shipping_address !== quote.billing_address && (
            <div className="quote-party">
              <div className="quote-party-label">Ship To</div>
              <div className="quote-muted quote-pre">{quote.shipping_address}</div>
            </div>
          )}
        </div>

        {/* ── Items ──────────────────────────────────────────── */}
        <table className="quote-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th>Product</th>
              <th className="ta-r" style={{ width: 60 }}>Qty</th>
              <th className="ta-r" style={{ width: 90 }}>Unit Price</th>
              <th className="ta-r" style={{ width: 90 }}>Subtotal</th>
              <th className="ta-r" style={{ width: 50 }}>GST</th>
              <th className="ta-r" style={{ width: 90 }}>GST Amt</th>
              <th className="ta-r" style={{ width: 100 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id || i}>
                <td>{i + 1}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                  {it.description && <div className="quote-muted">{it.description}</div>}
                </td>
                <td className="ta-r">{Number(it.qty)} {it.unit}</td>
                <td className="ta-r">{formatPaise(toPaise(it.unit_price))}</td>
                <td className="ta-r">{formatPaise(toPaise(it.line_subtotal))}</td>
                <td className="ta-r">{Number(it.gst_percent)}%</td>
                <td className="ta-r">{formatPaise(toPaise(it.gst_amount))}</td>
                <td className="ta-r" style={{ fontWeight: 600 }}>{formatPaise(toPaise(it.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Totals ─────────────────────────────────────────── */}
        <div className="quote-summary-wrap">
          <div className="quote-summary">
            <div><span>Total Quantity</span><span>{Number(quote.total_qty)}</span></div>
            <div><span>Subtotal</span><span>{formatPaise(toPaise(quote.subtotal))}</span></div>
            <div><span>Total GST</span><span>{formatPaise(toPaise(quote.total_gst))}</span></div>
            {Number(quote.discount_amount) > 0 && (
              <div><span>Discount</span><span>− {formatPaise(toPaise(quote.discount_amount))}</span></div>
            )}
            {Number(quote.other_charges) > 0 && (
              <div><span>Other Charges</span><span>{formatPaise(toPaise(quote.other_charges))}</span></div>
            )}
            <div className="quote-grand">
              <span>Grand Total</span><span>{formatPaise(toPaise(quote.grand_total))}</span>
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="quote-footer">
          {quote.notes && (
            <div className="quote-footer-block">
              <div className="quote-party-label">Notes</div>
              <div className="quote-muted quote-pre">{quote.notes}</div>
            </div>
          )}

          <div className="quote-footer-block">
            <div className="quote-party-label">Terms &amp; Conditions</div>
            <div className="quote-muted quote-pre">{quote.terms || COMPANY.defaultTerms}</div>
          </div>

          <div className="quote-footer-row">
            <div className="quote-footer-block">
              <div className="quote-party-label">Payment Terms</div>
              <div className="quote-muted">{COMPANY.defaultPaymentTerms}</div>
            </div>

            <div className="quote-sign">
              <div className="quote-muted">For {COMPANY.name}</div>
              <div className="quote-sign-line" />
              <div className="quote-muted">Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
