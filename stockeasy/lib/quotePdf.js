import { COMPANY } from './company';

/**
 * Generates a downloadable PDF of a quotation.
 *
 * Built programmatically with jsPDF rather than by screenshotting the DOM.
 * A canvas-based approach (html2canvas) produces a fuzzy raster image that
 * can't be searched or copied and balloons to several MB; this keeps the
 * text as real vector text, so the file is small, sharp at any zoom, and
 * the client can select the figures out of it.
 *
 * jsPDF is imported dynamically so its ~350KB never lands in the initial
 * page bundle — it only loads when someone actually clicks Download.
 */

const MARGIN = 14;

/**
 * jsPDF's built-in fonts are WinAnsi-encoded and have no rupee glyph, so
 * '₹' would render as a mojibake box. "Rs." is the standard fallback and
 * is unambiguous on an Indian quotation. (Embedding a Unicode font would
 * fix the symbol but adds ~300KB to every download.)
 */
function money(value) {
  const n = Number(value) || 0;
  return 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

/** Loads a same-origin image as a data URL so jsPDF can embed it. */
async function loadImage(src) {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadQuotationPdf(quote) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const right = pageW - MARGIN;

  let y = MARGIN;

  // ── Header: logo + company on the left, document meta on the right ──
  const logo = COMPANY.logo ? await loadImage(COMPANY.logo) : null;
  let textX = MARGIN;

  if (logo) {
    try {
      doc.addImage(logo, 'PNG', MARGIN, y, 20, 20, undefined, 'FAST');
      textX = MARGIN + 24;
    } catch {
      // A broken logo shouldn't stop the download.
      textX = MARGIN;
    }
  }

  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(20);
  doc.text(COMPANY.name, textX, y + 5);

  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90);
  let ly = y + 10;
  (COMPANY.address || []).filter(Boolean).forEach((line) => {
    doc.text(String(line), textX, ly);
    ly += 3.6;
  });
  if (COMPANY.phone) { doc.text(`Phone: ${COMPANY.phone}`, textX, ly); ly += 3.6; }
  if (COMPANY.email) { doc.text(`Email: ${COMPANY.email}`, textX, ly); ly += 3.6; }
  if (COMPANY.gst) { doc.text(`GSTIN: ${COMPANY.gst}`, textX, ly); ly += 3.6; }

  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(20);
  doc.text('QUOTATION', right, y + 5, { align: 'right' });

  doc.setFontSize(11);
  doc.text(String(quote.quote_number || ''), right, y + 11, { align: 'right' });

  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90);
  doc.text(`Date: ${fmtDate(quote.quote_date)}`, right, y + 16, { align: 'right' });
  doc.text(`Valid Until: ${fmtDate(quote.valid_until)}`, right, y + 20, { align: 'right' });

  y = Math.max(ly, y + 24) + 2;

  doc.setDrawColor(30).setLineWidth(0.5);
  doc.line(MARGIN, y, right, y);
  y += 6;

  // ── Client ──────────────────────────────────────────────────────────
  const hasShip = quote.shipping_address && quote.shipping_address !== quote.billing_address;
  const colW = hasShip ? (pageW - MARGIN * 2) / 2 - 4 : pageW - MARGIN * 2;

  // The recipient label prints black and bold; the other section headings
  // stay grey so the eye lands on who the quotation is for.
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(0);
  doc.text('TO', MARGIN, y);
  if (hasShip) {
    doc.setFontSize(7.5).setTextColor(130);
    doc.text('SHIP TO', MARGIN + colW + 8, y);
  }
  y += 4.5;

  const billTop = y;
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(20);
  doc.text(String(quote.client_name || ''), MARGIN, y);
  let by = y + 4.5;

  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90);
  const billLines = [
    quote.contact_person ? `Attn: ${quote.contact_person}` : null,
    ...(quote.billing_address ? String(quote.billing_address).split('\n') : []),
    quote.phone ? `Phone: ${quote.phone}` : null,
    quote.email ? `Email: ${quote.email}` : null,
    quote.gst_number ? `GSTIN: ${quote.gst_number}` : null,
  ].filter(Boolean);

  billLines.forEach((line) => {
    doc.splitTextToSize(String(line), colW).forEach((l) => {
      doc.text(l, MARGIN, by);
      by += 3.6;
    });
  });

  let sy = billTop;
  if (hasShip) {
    doc.setFontSize(8).setTextColor(90);
    doc.splitTextToSize(String(quote.shipping_address), colW).forEach((l) => {
      doc.text(l, MARGIN + colW + 8, sy);
      sy += 3.6;
    });
  }

  y = Math.max(by, sy) + 4;

  // ── Items ───────────────────────────────────────────────────────────
  const items = quote.items || [];
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['#', 'Product', 'Qty', 'Unit Price', 'Subtotal', 'GST', 'GST Amt', 'Total']],
    body: items.map((it, i) => [
      String(i + 1),
      it.description ? `${it.product_name}\n${it.description}` : String(it.product_name || ''),
      `${Number(it.qty)} ${it.unit || ''}`.trim(),
      money(it.unit_price),
      money(it.line_subtotal),
      `${Number(it.gst_percent)}%`,
      money(it.gst_amount),
      money(it.line_total),
    ]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: 40, lineColor: 220, lineWidth: 0.1 },
    headStyles: { fillColor: [240, 239, 233], textColor: 60, fontStyle: 'bold', fontSize: 7.5, halign: 'left' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 12, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    // Repeat the header if the table runs onto a second page.
    showHead: 'everyPage',
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── Totals ──────────────────────────────────────────────────────────
  const rows = [
    ['Total Quantity', String(Number(quote.total_qty) || 0)],
    ['Subtotal', money(quote.subtotal)],
    ['Total GST', money(quote.total_gst)],
  ];
  if (Number(quote.discount_amount) > 0) rows.push(['Discount', '- ' + money(quote.discount_amount)]);
  if (Number(quote.other_charges) > 0) rows.push(['Other Charges', money(quote.other_charges)]);

  const boxW = 74;
  const boxX = right - boxW;

  // Start a new page rather than splitting the totals block across pages.
  if (y + rows.length * 5 + 22 > doc.internal.pageSize.getHeight() - MARGIN) {
    doc.addPage();
    y = MARGIN;
  }

  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90);
  rows.forEach(([label, value]) => {
    doc.text(label, boxX, y);
    doc.text(value, right, y, { align: 'right' });
    y += 5;
  });

  y += 1;
  doc.setDrawColor(30).setLineWidth(0.4);
  doc.line(boxX, y, right, y);
  y += 5.5;

  doc.setFont('helvetica', 'bold').setFontSize(11.5).setTextColor(20);
  doc.text('Grand Total', boxX, y);
  doc.text(money(quote.grand_total), right, y, { align: 'right' });
  y += 10;

  // ── Notes / terms / signature ───────────────────────────────────────
  const bottomBlock = (title, text) => {
    if (!text) return;
    const lines = doc.splitTextToSize(String(text), pageW - MARGIN * 2 - 60);
    if (y + lines.length * 3.6 + 12 > doc.internal.pageSize.getHeight() - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(130);
    doc.text(title, MARGIN, y);
    y += 4;
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90);
    lines.forEach((l) => { doc.text(l, MARGIN, y); y += 3.6; });
    y += 4;
  };

  bottomBlock('NOTES', quote.notes);
  bottomBlock('TERMS & CONDITIONS', quote.terms || COMPANY.defaultTerms);
  bottomBlock('PAYMENT TERMS', COMPANY.defaultPaymentTerms);

  // Signature sits bottom-right of the last page.
  const pageH = doc.internal.pageSize.getHeight();
  const signY = Math.max(y + 6, pageH - 40);
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90);
  doc.text(`For ${COMPANY.name}`, right, signY, { align: 'right' });
  doc.setDrawColor(150).setLineWidth(0.3);
  doc.line(right - 50, signY + 16, right, signY + 16);
  doc.text('Authorised Signatory', right, signY + 20, { align: 'right' });

  // Page numbers, added last so the total count is known.
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(150);
    doc.text(`Page ${p} of ${pages}`, pageW / 2, pageH - 6, { align: 'center' });
  }

  const safeClient = String(quote.client_name || 'client').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  doc.save(`${quote.quote_number}-${safeClient}.pdf`);
}
