import { COMPANY } from './company';

/**
 * Generates the quotation PDF in the printed house format:
 *
 *   RAJ AGENCIES            (purple wordmark)      [logo]
 *   58, SARATHY MANSION, SECOND FLOOR, VELLORE-632004
 *   PH:… MAIL:…
 *   ─────────────────────────────────────────────────────
 *   FY/date
 *   TO
 *   CLIENT NAME
 *                    QUOTATION ONLY  (centred, underlined)
 *   Dear Sir
 *       We take pleasure in offering you a quotation for "X". …
 *   [yellow header] S.NO ITEM HSN QTY UOM RATE TAXABLE TAX TAX AMOUNT TOTAL
 *   footer notes
 *
 * Typeset in Times to match the stationery. Built from text primitives
 * rather than a DOM screenshot, so the output stays sharp, selectable
 * and small. jsPDF loads dynamically, only when Download is clicked.
 */

const MARGIN = 12;
const FONT = 'times';

/**
 * The house format prints plain numbers with no grouping separators
 * (54004.24, not 54,004.24) and no currency symbol — which also avoids
 * jsPDF's missing rupee glyph entirely.
 */
const rate2 = (v) => (Number(v) || 0).toFixed(2);

/** Drops trailing zeros: 5466.10 -> 5466.1, 90.00 -> 90, 983.898 stays. */
const trim = (v) => String(parseFloat((Number(v) || 0).toFixed(4)));

/** Whole rupees for the TOTAL column. */
const whole = (v) => String(Math.round(Number(v) || 0));

async function loadImage(src) {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Reads a data URL's pixel dimensions, so we can preserve its aspect ratio. */
function imageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export async function downloadQuotationPdf(quote) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();   // 210mm
  const pageH = doc.internal.pageSize.getHeight();  // 297mm
  const right = pageW - MARGIN;
  const brand = COMPANY.brand || {};
  const brandColor = brand.color || [106, 27, 122];
  const headerFill = brand.tableHeader || [255, 255, 0];

  let y = MARGIN + 2;

  // ── Letterhead ──────────────────────────────────────────────────────
  // A letterhead image replaces the whole text header when configured,
  // so the PDF carries your actual stationery rather than a rebuild of it.
  const lh = COMPANY.letterhead || {};
  let letterheadDrawn = false;

  if (lh.src) {
    const img = await loadImage(lh.src);
    if (img) {
      try {
        const w = lh.fullBleed ? pageW : (lh.widthMm || pageW - MARGIN * 2);
        // offsetXMm shifts the artwork to compensate for blank space
        // baked into the image itself.
        const x = (lh.fullBleed ? 0 : MARGIN) + (Number(lh.offsetXMm) || 0);

        // Height defaults to the image's own aspect ratio — forcing a
        // value that doesn't match squashes the artwork.
        let h = lh.heightMm;
        if (!h) {
          const dims = await imageSize(img);
          h = dims && dims.w ? (w * dims.h) / dims.w : 26;
        }

        doc.addImage(img, 'PNG', x, lh.fullBleed ? 0 : MARGIN, w, h, undefined, 'FAST');
        y = (lh.fullBleed ? 0 : MARGIN) + h + 3;
        letterheadDrawn = true;
      } catch {
        // Fall through to the text letterhead below.
      }
    }
  }

  if (!letterheadDrawn) {
    const logo = COMPANY.logo ? await loadImage(COMPANY.logo) : null;
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', right - 24, MARGIN, 24, 24, undefined, 'FAST');
      } catch { /* a broken logo must not block the download */ }
    }

    doc.setFont(FONT, 'bold').setFontSize(26);
    doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.text(COMPANY.name.toUpperCase(), MARGIN, y + 7);
    y += 12;

    doc.setTextColor(0, 0, 0);
    doc.setFont(FONT, 'bold').setFontSize(11.5);
    (COMPANY.address || []).filter(Boolean).forEach((line) => {
      doc.text(String(line).toUpperCase(), MARGIN, y + 4);
      y += 5.2;
    });

    doc.setFont(FONT, 'bold').setFontSize(10.5);
    const contact = [];
    if (COMPANY.phone) contact.push(`PH:${String(COMPANY.phone).replace(/\s+/g, '')}`);
    if (COMPANY.email) contact.push(`MAIL:${COMPANY.email}`);
    if (contact.length) {
      doc.text(contact.join(' '), MARGIN, y + 4);
      y += 5;
    }
    if (COMPANY.gst) {
      doc.text(`GST:${COMPANY.gst}`, MARGIN, y + 4);
      y += 5;
    }
    y += 2.5;
  }

  // The rule only belongs to the text letterhead. A letterhead image
  // carries its own bottom border, so drawing one here would double it.
  if (!letterheadDrawn) {
    doc.setDrawColor(0).setLineWidth(0.5);
    doc.line(0, y, pageW, y);
  }
  y += 7;

  // ── Reference and recipient ─────────────────────────────────────────
  doc.setFont(FONT, 'normal').setFontSize(11);
  doc.text(String(quote.ref_number || ''), MARGIN, y);
  y += 7;

  doc.setFont(FONT, 'normal').setFontSize(11);
  doc.text('TO', MARGIN, y);
  y += 5.5;

  doc.setFont(FONT, 'bold').setFontSize(11.5);
  doc.text(String(quote.client_name || '').toUpperCase(), MARGIN, y);
  y += 5.5;

  doc.setFont(FONT, 'normal').setFontSize(11);
  const addr = quote.billing_address || quote.shipping_address || '';
  String(addr).split('\n').filter(Boolean).forEach((line) => {
    doc.text(line.toUpperCase(), MARGIN, y);
    y += 5;
  });
  if (quote.gst_number) {
    doc.text(`GST:${quote.gst_number}`, MARGIN, y);
    y += 5;
  }

  y += 4;

  // ── Centred, underlined heading ─────────────────────────────────────
  doc.setFont(FONT, 'bold').setFontSize(13);
  const heading = 'QUOTATION  ONLY';
  const hw = doc.getTextWidth(heading);
  const hx = (pageW - hw) / 2;
  doc.text(heading, hx, y);
  doc.setLineWidth(0.4);
  doc.line(hx, y + 1.2, hx + hw, y + 1.2);
  y += 8;

  // ── Covering line ───────────────────────────────────────────────────
  doc.setFont(FONT, 'normal').setFontSize(11);
  doc.text('Dear Sir', MARGIN, y);
  y += 5.5;

  const subject = String(quote.subject || '').trim();
  const intro = subject
    ? `We take pleasure in offering you a quotation for “${subject}”. Accordance with the below terms and conditions.`
    : 'We take pleasure in offering you a quotation. Accordance with the below terms and conditions.';

  // First line is indented, as on the stationery.
  const introLines = doc.splitTextToSize(intro, pageW - MARGIN * 2 - 8);
  introLines.forEach((l, i) => {
    doc.text(l, MARGIN + (i === 0 ? 6 : 0), y);
    y += 5;
  });

  y += 3;

  // ── Items ───────────────────────────────────────────────────────────
  const items = quote.items || [];

  const body = items.map((it, i) => {
    const name = it.description
      ? `${String(it.product_name).toUpperCase()}\n${it.description}`
      : String(it.product_name || '').toUpperCase();

    const head = [
      String(i + 1),
      name,
      it.hsn_code || '',
      String(Number(it.qty)),
      String(it.unit || 'NOS').toUpperCase(),
    ];

    if (it.not_available) {
      return [...head, 'NOT AVAILABLE', '', '', '', ''];
    }

    return [
      ...head,
      rate2(it.unit_price),
      trim(it.line_subtotal),
      it.gst_percent ? `${Number(it.gst_percent)}%` : '',
      trim(it.gst_exact != null ? it.gst_exact : it.gst_amount),
      whole(it.line_total),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['S.NO', 'ITEM', 'HSN', 'QTY', 'UOM', 'RATE', 'TAXABLE', 'TAX', 'TAX\nAMOUNT', 'TOTAL']],
    body,
    theme: 'grid',
    styles: {
      font: FONT, fontSize: 8.5, cellPadding: 1.4,
      textColor: 0, lineColor: 0, lineWidth: 0.25, valign: 'middle',
    },
    headStyles: {
      fillColor: headerFill, textColor: 0,
      fontStyle: 'bold', fontSize: 8.5,
      halign: 'left', valign: 'middle',
      lineColor: 0, lineWidth: 0.25,
      // Header labels must not wrap — "TAXABLE" breaking into "TAXABL E"
      // is the giveaway that a column is too narrow.
      cellPadding: { top: 1.4, bottom: 1.4, left: 1, right: 1 },
    },
    // Fixed widths total 131mm, leaving ~55mm for ITEM on A4 — enough for
    // long product names to wrap to 3 lines rather than 6.
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 9,  halign: 'center' },
      4: { cellWidth: 11, halign: 'center' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 19, halign: 'right' },
      7: { cellWidth: 11, halign: 'center' },
      8: { cellWidth: 19, halign: 'right' },
      9: { cellWidth: 16, halign: 'right' },
    },
    showHead: 'everyPage',
    didParseCell: (data) => {
      // "NOT AVAILABLE" sits in the RATE column and spans the money columns.
      if (data.section === 'body' && data.cell.raw === 'NOT AVAILABLE') {
        data.cell.colSpan = 5;
        data.cell.styles.halign = 'center';
      }
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── Footer notes ────────────────────────────────────────────────────
  const notes = [
    ...(COMPANY.footerNotes || []),
    ...(quote.terms ? String(quote.terms).split('\n').filter(Boolean) : []),
    ...(quote.notes ? String(quote.notes).split('\n').filter(Boolean) : []),
  ];

  doc.setFont(FONT, 'normal').setFontSize(11).setTextColor(0);
  notes.forEach((line) => {
    if (y > pageH - MARGIN - 6) { doc.addPage(); y = MARGIN; }
    doc.splitTextToSize(String(line), pageW - MARGIN * 2).forEach((l) => {
      doc.text(l, MARGIN, y);
      y += 5.2;
    });
  });

  // Page numbers only when the document actually runs over.
  const pages = doc.internal.getNumberOfPages();
  if (pages > 1) {
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont(FONT, 'normal').setFontSize(9).setTextColor(80);
      doc.text(`Page ${p} of ${pages}`, pageW / 2, pageH - 6, { align: 'center' });
    }
  }

  const safeClient = String(quote.client_name || 'client')
    .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  doc.save(`${quote.quote_number}-${safeClient}.pdf`);
}
