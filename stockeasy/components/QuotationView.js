import { useState } from 'react';
import { COMPANY, quoteIntro } from '../lib/company';
import { exactTax } from '../lib/quoteMath';
import { downloadQuotationPdf } from '../lib/quotePdf';
import { downloadIndividualQuotationPdf } from '../lib/quotePdfIndividual';
import { DownloadCloud } from './Icons';

/**
 * The on-screen quotation, laid out to match the printed house format
 * exactly — so Print and Download PDF produce the same document.
 *
 * The print stylesheet in globals.css hides the app chrome, so
 * "Print → Save as PDF" yields a clean page with no navigation on it.
 */

/**
 * The house format prints plain numbers — no currency symbol and no
 * thousand separators (54004.24, not ₹54,004.24). These must match the
 * PDF helpers in lib/quotePdf.js exactly, or screen and download would
 * disagree on the same quotation.
 */
const rate2 = (v) => (Number(v) || 0).toFixed(2);

/** Drops trailing zeros: 5466.10 -> 5466.1, 90.00 -> 90. */
const trim = (v) => String(parseFloat((Number(v) || 0).toFixed(4)));

/** Whole rupees for the TOTAL column. */
const whole = (v) => String(Math.round(Number(v) || 0));

export default function QuotationView({ quote, onClose, onEdit, onAlert }) {
  const [downloading, setDownloading] = useState(false);
  const [letterheadFailed, setLetterheadFailed] = useState(false);

  if (!quote) return null;

  // Individual quotations use a simplified 6-column layout with
  // tax-inclusive rates, and their own letterhead arrangement.
  const isIndividual = quote.quote_type === 'individual';
  const letterhead = (isIndividual ? COMPANY.letterheadIndividual : COMPANY.letterhead) || {};

  const items = quote.items || [];
  const subject = String(quote.subject || '').trim();

  // Totals, mirroring lib/quotePdf.js so screen and PDF always agree.
  // Unavailable lines contribute nothing.
  const sum = (fn) => items.reduce((t, it) => t + (it.not_available ? 0 : fn(it)), 0);
  const taxableSum = sum(it => Number(it.line_subtotal) || 0);
  const taxSum = sum(it => exactTax(it));
  const columnSum = sum(it => Math.round(Number(it.line_total) || 0));
  const discount = Number(quote.discount_amount) || 0;
  const charges = Number(quote.other_charges) || 0;
  const grand = Math.max(0, columnSum - discount + charges);

  async function handleDownload() {
    setDownloading(true);
    try {
      await (isIndividual
        ? downloadIndividualQuotationPdf(quote)
        : downloadQuotationPdf(quote));
    } catch {
      const msg = 'Could not generate the PDF. You can still use Print.';
      if (onAlert) onAlert(msg, 'error'); else alert(msg);
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
        <button className="btn" onClick={() => window.print()}>🖨 Print</button>
        <button className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
          {downloading ? <><span className="spinner" /> Preparing…</> : <><DownloadCloud /> Download PDF</>}
        </button>
      </div>

      <div className="quote-doc">
      
        {letterhead.src && !letterheadFailed ? (
          <img
            src={letterhead.src}
            alt={COMPANY.name}
            className="qh-image"
            style={{
              width: letterhead.widthMm ? `${(letterhead.widthMm / 186) * 100}%` : '100%',
              // Same nudge as the PDF, expressed in mm so both agree.
              marginLeft: letterhead.offsetXMm ? `${letterhead.offsetXMm}mm` : undefined,
            }}
            onError={() => setLetterheadFailed(true)}
          />
        ) : (
          <div className="qh">
            <div className="qh-text">
              <div className="qh-wordmark">{COMPANY.name.toUpperCase()}</div>
              {(COMPANY.address || []).filter(Boolean).map((l, i) => (
                <div key={i} className="qh-addr">{String(l).toUpperCase()}</div>
              ))}
              <div className="qh-line">
                {COMPANY.phone && <>PH:{String(COMPANY.phone).replace(/\s+/g, '')}&nbsp;&nbsp;</>}
                {COMPANY.email && <>MAIL:{COMPANY.email}</>}
              </div>
              {COMPANY.gst && <div className="qh-line">GST:{COMPANY.gst}</div>}
            </div>
            {COMPANY.logo && <img src={COMPANY.logo} alt="" className="qh-logo" />}
          </div>
        )}
        {/* Only the text letterhead needs a rule — the image has its own. */}
        {(!letterhead.src || letterheadFailed) && <hr className="qh-rule" />}

        {/* Financial-year / date reference */}
        <div className="q-ref">
          {isIndividual ? `REF NO:${quote.ref_number || ''}` : (quote.ref_number || '')}
        </div>

        {/* ── Recipient ──────────────────────────────────────── */}
        <div className="q-to-label">TO</div>
        <div className="q-to-name">{String(quote.client_name || '').toUpperCase()}</div>
        {(quote.billing_address || quote.shipping_address || '')
          .split('\n').filter(Boolean).map((l, i) => (
            <div key={i} className="q-to-addr">{l.toUpperCase()}</div>
          ))}
        {quote.gst_number && <div className="q-to-addr">GST:{quote.gst_number}</div>}

        {/* ── Heading + covering line ────────────────────────── */}
        <div className="q-heading">QUOTATION  ONLY</div>
        <div className="q-intro">{COMPANY.greeting || 'Dear Sir'}</div>
        <div className="q-intro q-intro-indent">{quoteIntro(quote.subject)}</div>

        {/* ── Items ──────────────────────────────────────────── */}
        <table className="q-table">
          <thead>
            {isIndividual ? (
              /* Individual: no HSN and no tax columns — the rate already
                 includes GST, so there is nothing to break out. */
              <tr>
                <th style={{ width: 44 }}>S.No</th>
                <th>ITEMS</th>
                <th style={{ width: 52 }}>QTY</th>
                <th style={{ width: 58 }}>UOM</th>
                <th style={{ width: 90 }}>RATE</th>
                <th style={{ width: 100 }}>AMOUNT</th>
              </tr>
            ) : (
              <tr>
                <th style={{ width: 34 }}>S.NO</th>
                <th>ITEM</th>
                <th style={{ width: 74 }}>HSN</th>
                <th style={{ width: 36 }}>QTY</th>
                <th style={{ width: 42 }}>UOM</th>
                <th style={{ width: 76 }}>RATE</th>
                <th style={{ width: 76 }}>TAXABLE</th>
                <th style={{ width: 40 }}>TAX</th>
                <th style={{ width: 76 }}>TAX<br />AMOUNT</th>
                <th style={{ width: 70 }}>TOTAL</th>
              </tr>
            )}
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id || i}>
                <td className="ta-c">{i + 1}</td>
                <td>
                  <div>{String(it.product_name || '').toUpperCase()}</div>
                  {it.description && <div className="q-desc">{it.description}</div>}
                </td>
                {!isIndividual && <td className="ta-c">{it.hsn_code || ''}</td>}
                <td className="ta-c">{Number(it.qty)}</td>
                <td className="ta-c">{it.unit || (isIndividual ? 'Nos' : 'NOS')}</td>
                {it.not_available ? (
                  <td colSpan={isIndividual ? 2 : 5} className="ta-c q-na">NOT AVAILABLE</td>
                ) : isIndividual ? (
                  <>
                    <td className="ta-r">{trim(it.unit_price)}</td>
                    <td className="ta-r">{whole(it.line_total)}</td>
                  </>
                ) : (
                  <>
                    <td className="ta-r">{rate2(it.unit_price)}</td>
                    <td className="ta-r">{trim(it.line_subtotal)}</td>
                    <td className="ta-c">{it.gst_percent ? `${Number(it.gst_percent)}%` : ''}</td>
                    <td className="ta-r">{trim(exactTax(it))}</td>
                    <td className="ta-r">{whole(it.line_total)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>

          {/* Totals sit inside the table so each figure lines up under the
              column it summarises. The grand total is the sum of the TOTAL
              column as printed — see lib/quoteMath.js for why. */}
          <tfoot>
            {/* Individual format: the amount sits alone under its column,
                with no label — matching the stationery. */}
            {isIndividual ? (
              (discount > 0 || charges > 0) && (
                <tr className="q-foot">
                  <td colSpan={5} className="ta-r">Subtotal</td>
                  <td className="ta-r">{whole(columnSum)}</td>
                </tr>
              )
            ) : (
              <tr className="q-foot">
                <td colSpan={6} className="ta-r q-bold">TOTAL</td>
                <td className="ta-r q-bold">{trim(taxableSum)}</td>
                <td />
                <td className="ta-r q-bold">{trim(taxSum)}</td>
                <td className="ta-r q-bold">{whole(columnSum)}</td>
              </tr>
            )}
            {discount > 0 && (
              <tr className="q-foot">
                <td colSpan={isIndividual ? 5 : 9} className="ta-r">Discount</td>
                <td className="ta-r">- {whole(discount)}</td>
              </tr>
            )}
            {charges > 0 && (
              <tr className="q-foot">
                <td colSpan={isIndividual ? 5 : 9} className="ta-r">Other Charges</td>
                <td className="ta-r">{whole(charges)}</td>
              </tr>
            )}
            <tr className="q-foot q-grand">
              <td colSpan={isIndividual ? 5 : 9} className="ta-r q-bold">
                {isIndividual ? '' : 'GRAND TOTAL'}
              </td>
              <td className="ta-r q-bold">{whole(grand)}</td>
            </tr>
          </tfoot>
        </table>

        {/* ── Footer notes ───────────────────────────────────── */}
        <div className="q-notes">
          {((isIndividual ? COMPANY.footerNotesIndividual : COMPANY.footerNotes) || []).map((l, i) => <div key={`f${i}`}>{l}</div>)}
          {quote.terms && String(quote.terms).split('\n').filter(Boolean)
            .map((l, i) => <div key={`t${i}`}>{l}</div>)}
          {quote.notes && String(quote.notes).split('\n').filter(Boolean)
            .map((l, i) => <div key={`n${i}`}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}
