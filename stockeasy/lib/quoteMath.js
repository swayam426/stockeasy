/**
 * Money math for quotations.
 *
 * All arithmetic happens in PAISE (integers), never in rupees as floats.
 * 0.1 + 0.2 !== 0.3 in JavaScript, and on a quotation that shows up as a
 * grand total that's one paisa off the sum of its own lines — the kind of
 * thing a client notices and you can't explain.
 *
 * Every function here is pure, so the API routes and the UI can share them
 * and are guaranteed to agree. The server recomputes on save regardless of
 * what the browser sent, so a tampered request can't change the stored total.
 */

/** Rupees (or any numeric input) → integer paise. */
export function toPaise(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Integer paise → a Number with 2 decimals, for storage/display. */
export function toRupees(paise) {
  return Math.round(paise) / 100;
}

/** Formats paise as an Indian-format currency string, e.g. ₹1,18,000.00 */
export function formatPaise(paise) {
  return '₹' + toRupees(paise).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Computes one product line.
 *
 * subtotal = qty × unitPrice
 * gst      = subtotal × gstPercent / 100
 * total    = subtotal + gst
 *
 * Rounding happens once per line, at the paisa. Rounding later (at the
 * document level) would make the printed line items fail to add up to the
 * printed total, which is worse than a sub-paisa inaccuracy.
 */
/**
 * Line maths for a TAX-INCLUSIVE quotation (the individual format).
 *
 * Here the rate already contains GST, so nothing is added on top:
 *   amount = qty × rate           (6 × 5250 = 31500)
 *
 * The tax component is still backed out and recorded, because the figure
 * is needed for accounts even though it never appears on the document:
 *   taxable = amount / (1 + rate/100)
 *   tax     = amount − taxable
 */
export function calcLineInclusive({ qty, unit_price, gst_percent, not_available }) {
  if (not_available) {
    return {
      lineSubtotalP: 0, gstAmountP: 0, gstExactP: 0, lineTotalP: 0,
      line_subtotal: 0, gst_amount: 0, gst_exact: 0, line_total: 0,
      not_available: true,
    };
  }

  const qtyNum = Number(qty);
  const priceP = toPaise(unit_price);
  const gstPct = Number(gst_percent);

  const safeQty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
  const safeGst = Number.isFinite(gstPct) && gstPct >= 0 ? gstPct : 0;

  // The printed AMOUNT — no rounding games, this is simply qty × rate.
  const lineTotalP = Math.round(priceP * safeQty);

  // Reverse-calculate the tax hidden inside that amount.
  const taxableExactP = lineTotalP / (1 + safeGst / 100);
  const lineSubtotalP = Math.round(taxableExactP);
  const gstExactP = lineTotalP - taxableExactP;
  const gstAmountP = Math.round(gstExactP);

  return {
    lineSubtotalP,
    gstAmountP,
    gstExactP,
    lineTotalP,
    line_subtotal: toRupees(lineSubtotalP),
    gst_amount: toRupees(gstAmountP),
    gst_exact: gstExactP / 100,
    line_total: toRupees(lineTotalP),
    not_available: false,
  };
}

export function calcLine({ qty, unit_price, gst_percent, not_available }) {
  // A line marked unavailable carries no figures at all. Treating it as
  // zero would print "Rs. 0.00" and read as though it were free.
  if (not_available) {
    return {
      lineSubtotalP: 0, gstAmountP: 0, lineTotalP: 0,
      line_subtotal: 0, gst_amount: 0, line_total: 0,
      not_available: true,
    };
  }

  const qtyNum = Number(qty);
  const priceP = toPaise(unit_price);
  const gstPct = Number(gst_percent);

  const safeQty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
  const safeGst = Number.isFinite(gstPct) && gstPct >= 0 ? gstPct : 0;

  const lineSubtotalP = Math.round(priceP * safeQty);

  // GST is kept at full precision here (983.898 on the sample) because
  // that's what the TAX column prints; only the line TOTAL is rounded.
  const gstExactP = (lineSubtotalP * safeGst) / 100;
  const gstAmountP = Math.round(gstExactP);

  // The printed TOTAL is rounded to the nearest whole rupee, matching the
  // house format: 5466.10 + 983.898 = 6449.998 prints as 6450.
  const lineTotalP = Math.round((lineSubtotalP + gstExactP) / 100) * 100;

  return {
    lineSubtotalP,
    gstAmountP,
    gstExactP,
    lineTotalP,
    line_subtotal: toRupees(lineSubtotalP),
    gst_amount: toRupees(gstAmountP),
    gst_exact: gstExactP / 100,
    line_total: toRupees(lineTotalP),
    not_available: false,
  };
}

/**
 * Totals a whole quotation.
 *
 * ── Discount timing ─────────────────────────────────────────────────
 * A percentage discount here is taken on the SUBTOTAL (the pre-GST
 * figure), then subtracted from the GST-inclusive total:
 *
 *   grand_total = subtotal + total_gst - discount + other_charges
 *
 * This matches the order the summary block is laid out in, and keeps
 * GST reported on the full invoice value.
 *
 * Note that Indian GST practice often applies a trade discount BEFORE
 * GST is computed, so that GST is charged on the discounted value —
 * which produces a different (smaller) tax figure. Which one is correct
 * depends on the nature of the discount and how it's shown on the
 * invoice. Worth confirming with whoever files your GST returns; if you
 * need the pre-GST behaviour, that's a change to this function alone.
 */
export function calcQuotation({ items = [], discount_type = 'none', discount_value = 0, other_charges = 0, quote_type = 'company' }) {
  let subtotalP = 0;
  let totalGstP = 0;
  let totalQty = 0;
  let linesTotalP = 0;

  // Individual quotations quote tax-inclusive rates; company ones add GST.
  const lineFn = quote_type === 'individual' ? calcLineInclusive : calcLine;

  const lines = items.map(item => {
    const line = lineFn(item);
    subtotalP += line.lineSubtotalP;
    totalGstP += line.gstAmountP;
    // Sum of the ROUNDED line totals — this is what the printed TOTAL
    // column adds up to. Deriving the grand total from the unrounded
    // figures instead would print a total that disagrees with its own
    // column by a rupee or two, which clients query.
    linesTotalP += line.lineTotalP;
    // Unavailable lines are shown but not counted — quoting a quantity
    // for something you can't supply shouldn't inflate the totals.
    if (!line.not_available) totalQty += Number(item.qty) || 0;
    return { ...item, ...line };
  });

  let discountP = 0;
  if (discount_type === 'percent') {
    const pct = Number(discount_value);
    if (Number.isFinite(pct) && pct > 0) {
      discountP = Math.round((subtotalP * Math.min(pct, 100)) / 100);
    }
  } else if (discount_type === 'fixed') {
    discountP = Math.max(0, toPaise(discount_value));
  }

  const otherP = toPaise(other_charges);

  // Built from linesTotalP so the grand total always equals the sum of the
  // TOTAL column as printed. Clamped so a discount larger than the bill
  // can't produce a negative total (which would read as the business
  // owing the client money).
  let grandTotalP = linesTotalP - discountP + otherP;
  if (grandTotalP < 0) grandTotalP = 0;

  return {
    lines,
    totalQty,
    subtotalP,
    totalGstP,
    discountP,
    otherP,
    linesTotalP,
    grandTotalP,
    lines_total: toRupees(linesTotalP),
    // Rupee values, ready to store in NUMERIC(12,2) columns.
    subtotal: toRupees(subtotalP),
    total_gst: toRupees(totalGstP),
    discount_amount: toRupees(discountP),
    other_charges: toRupees(otherP),
    grand_total: toRupees(grandTotalP),
    total_qty: totalQty,
  };
}

/**
 * The exact GST on a line, at full precision (983.898, not 983.90).
 *
 * Derived from the stored taxable value and rate rather than read from a
 * column: gst_amount is NUMERIC(12,2) so the database rounds it to paise,
 * and gst_exact is computed at save time and never persisted. Recomputing
 * here means a saved quotation reprints exactly as it was first shown.
 */
export function exactTax(item) {
  if (!item || item.not_available) return 0;
  const taxable = Number(item.line_subtotal);
  const pct = Number(item.gst_percent);
  if (!Number.isFinite(taxable) || !Number.isFinite(pct)) {
    return Number(item.gst_amount) || 0;
  }
  return (taxable * pct) / 100;
}

/** Standard Indian GST slabs, for the rate dropdown. */
export const GST_RATES = [0, 5, 12, 18, 28];

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'];

/**
 * A quotation is treated as expired once valid_until has passed, unless it
 * already reached a terminal state. This is derived at read time rather
 * than written to the row, so it stays correct without a cron job.
 */
export function effectiveStatus(quote) {
  if (!quote) return 'draft';
  if (['accepted', 'rejected', 'converted'].includes(quote.status)) return quote.status;
  if (quote.valid_until) {
    const until = new Date(quote.valid_until);
    until.setHours(23, 59, 59, 999);
    if (Date.now() > until.getTime()) return 'expired';
  }
  return quote.status;
}
