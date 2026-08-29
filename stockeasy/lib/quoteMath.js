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
export function calcLine({ qty, unit_price, gst_percent }) {
  const qtyNum = Number(qty);
  const priceP = toPaise(unit_price);
  const gstPct = Number(gst_percent);

  const safeQty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
  const safeGst = Number.isFinite(gstPct) && gstPct >= 0 ? gstPct : 0;

  const lineSubtotalP = Math.round(priceP * safeQty);
  const gstAmountP = Math.round((lineSubtotalP * safeGst) / 100);
  const lineTotalP = lineSubtotalP + gstAmountP;

  return {
    lineSubtotalP,
    gstAmountP,
    lineTotalP,
    line_subtotal: toRupees(lineSubtotalP),
    gst_amount: toRupees(gstAmountP),
    line_total: toRupees(lineTotalP),
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
export function calcQuotation({ items = [], discount_type = 'none', discount_value = 0, other_charges = 0 }) {
  let subtotalP = 0;
  let totalGstP = 0;
  let totalQty = 0;

  const lines = items.map(item => {
    const line = calcLine(item);
    subtotalP += line.lineSubtotalP;
    totalGstP += line.gstAmountP;
    totalQty += Number(item.qty) || 0;
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

  // Clamp so a discount larger than the bill can't produce a negative
  // grand total (which would look like the business owes the client).
  let grandTotalP = subtotalP + totalGstP - discountP + otherP;
  if (grandTotalP < 0) grandTotalP = 0;

  return {
    lines,
    totalQty,
    subtotalP,
    totalGstP,
    discountP,
    otherP,
    grandTotalP,
    // Rupee values, ready to store in NUMERIC(12,2) columns.
    subtotal: toRupees(subtotalP),
    total_gst: toRupees(totalGstP),
    discount_amount: toRupees(discountP),
    other_charges: toRupees(otherP),
    grand_total: toRupees(grandTotalP),
    total_qty: totalQty,
  };
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
