import { COMPANY, quoteIntro } from './company';

/**
 * PDF for the INDIVIDUAL quotation format — used when quoting a person
 * rather than a company.
 *
 * Differs from the company format in three ways that matter:
 *   1. Six columns only: S.No, ITEMS, QTY, UOM, RATE, AMOUNT. No HSN and
 *      no tax columns, because the rate is quoted GST-inclusive.
 *   2. AMOUNT = QTY × RATE with nothing added, and the total row carries
 *      the figure alone with no label, matching the stationery.
 *   3. Centred letterhead: logo left, wordmark centred, address beneath.
 *
 * Shares the loader/formatting conventions of quotePdf.js so the two
 * templates stay consistent.
 */

const MARGIN = 14;
const FONT = 'times';

/** House style prints bare numbers: 31500, not ₹31,500.00 */
const plain = (v) => String(parseFloat((Number(v) || 0).toFixed(2)));
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

function imageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export async function downloadIndividualQuotationPdf(quote) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const centre = pageW / 2;
  const right = pageW - MARGIN;
  const brand = COMPANY.brand || {};
  const brandColor = brand.color || [106, 27, 122];

  let y = MARGIN;

  // ── Letterhead ──────────────────────────────────────────────────────
  const lh = COMPANY.letterheadIndividual || {};
  let drawn = false;

  if (lh.src) {
    const img = await loadImage(lh.src);
    if (img) {
      try {
        const w = lh.fullBleed ? pageW : (lh.widthMm || pageW - MARGIN * 2);
        const x = (lh.fullBleed ? 0 : MARGIN) + (Number(lh.offsetXMm) || 0);
        let h = lh.heightMm;
        if (!h) {
          const dims = await imageSize(img);
          h = dims && dims.w ? (w * dims.h) / dims.w : 26;
        }
        doc.addImage(img, 'PNG', x, lh.fullBleed ? 0 : MARGIN, w, h, undefined, 'FAST');
        y = (lh.fullBleed ? 0 : MARGIN) + h + 4;
        drawn = true;
      } catch { /* fall through to the text header */ }
    }
  }

  if (!drawn) {
    // GST left, phone right, on one line above everything else.
    doc.setFont(FONT, 'bold').setFontSize(10).setTextColor(0);
    if (COMPANY.gst) doc.text(`GST:${COMPANY.gst}`, MARGIN, y + 4);
    if (COMPANY.phone) {
      doc.text(`PH:${String(COMPANY.phone).replace(/\s+/g, '')}`, right, y + 4, { align: 'right' });
    }
    y += 9;

    // Logo sits on the left of the wordmark in this layout.
    const logo = COMPANY.logo ? await loadImage(COMPANY.logo) : null;
    const logoSize = 22;
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', MARGIN, y, logoSize, logoSize, undefined, 'FAST');
      } catch { /* ignore a broken logo */ }
    }

    doc.setFont(FONT, 'bold').setFontSize(24);
    doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.text(COMPANY.name.toUpperCase(), centre, y + 12, { align: 'center' });
    y += Math.max(logoSize, 16) + 3;

    doc.setTextColor(0);
    doc.setFont(FONT, 'bold').setFontSize(11);
    (COMPANY.address || []).filter(Boolean).forEach((line) => {
      doc.text(String(line).toUpperCase(), centre, y, { align: 'center' });
      y += 5.2;
    });

    if (COMPANY.email) {
      doc.setFont(FONT, 'normal').setFontSize(10.5);
      doc.text(`Email: (${COMPANY.email})`, centre, y, { align: 'center' });
      y += 5.5;
    }

    y += 2;
    doc.setDrawColor(0).setLineWidth(0.4);
    doc.line(MARGIN, y, right, y);
    y += 7;
  }

  // ── Reference and recipient ─────────────────────────────────────────
  doc.setFont(FONT, 'bold').setFontSize(11).setTextColor(0);
  doc.text(`REF NO:${quote.ref_number || ''}`, MARGIN, y);
  y += 7.5;

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

  y += 5;

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
  doc.text(COMPANY.greeting || 'Dear Sir', MARGIN, y);
  y += 5.5;

  const intro = quoteIntro(quote.subject);
  doc.splitTextToSize(intro, pageW - MARGIN * 2 - 6).forEach((l, i) => {
    doc.text(l, MARGIN + (i === 0 ? 6 : 0), y);
    y += 5;
  });

  y += 4;

  // ── Items ───────────────────────────────────────────────────────────
  const items = quote.items || [];

  const body = items.map((it, i) => {
    const name = it.description
      ? `${String(it.product_name).toUpperCase()}\n${it.description}`
      : String(it.product_name || '').toUpperCase();

    if (it.not_available) {
      return [String(i + 1), name, String(Number(it.qty)), it.unit || 'Nos', 'NOT AVAILABLE', ''];
    }
    return [
      String(i + 1),
      name,
      String(Number(it.qty)),
      it.unit || 'Nos',
      plain(it.unit_price),
      whole(it.line_total),
    ];
  });

  // Total: the sum of the AMOUNT column, sitting under it with no label —
  // exactly as on the stationery.
  const columnSum = items.reduce(
    (t, it) => t + (it.not_available ? 0 : Math.round(Number(it.line_total) || 0)), 0
  );
  const discount = Number(quote.discount_amount) || 0;
  const charges = Number(quote.other_charges) || 0;
  const grand = Math.max(0, columnSum - discount + charges);

  const foot = [];
  if (discount > 0 || charges > 0) {
    foot.push([{ content: 'Subtotal', colSpan: 5, styles: { halign: 'right' } },
               { content: whole(columnSum), styles: { halign: 'right' } }]);
    if (discount > 0) {
      foot.push([{ content: 'Discount', colSpan: 5, styles: { halign: 'right' } },
                 { content: '- ' + whole(discount), styles: { halign: 'right' } }]);
    }
    if (charges > 0) {
      foot.push([{ content: 'Other Charges', colSpan: 5, styles: { halign: 'right' } },
                 { content: whole(charges), styles: { halign: 'right' } }]);
    }
  }
  foot.push([
    { content: '', colSpan: 5, styles: {} },
    { content: whole(grand), styles: { halign: 'right', fontStyle: 'bold' } },
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['S.No', 'ITEMS', 'QTY', 'UOM', 'RATE', 'AMOUNT']],
    body,
    foot,
    theme: 'grid',
    styles: {
      font: FONT, fontSize: 10, cellPadding: 2,
      textColor: 0, lineColor: 0, lineWidth: 0.25, valign: 'middle',
    },
    headStyles: {
      fillColor: [255, 255, 255], textColor: 0,
      fontStyle: 'bold', fontSize: 10, halign: 'left',
      lineColor: 0, lineWidth: 0.25,
    },
    footStyles: {
      fillColor: [255, 255, 255], textColor: 0,
      lineColor: 0, lineWidth: 0.25, fontSize: 10,
    },
    showFoot: 'lastPage',
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
    showHead: 'everyPage',
    didParseCell: (data) => {
      if (data.section === 'body' && data.cell.raw === 'NOT AVAILABLE') {
        data.cell.colSpan = 2;
        data.cell.styles.halign = 'center';
      }
    },
  });

  y = doc.lastAutoTable.finalY + 7;

  // ── Footer notes ────────────────────────────────────────────────────
  const notes = [
    ...(COMPANY.footerNotesIndividual || ['TAX INCLUDED 18%']),
    ...(quote.terms ? String(quote.terms).split('\n').filter(Boolean) : []),
    ...(quote.notes ? String(quote.notes).split('\n').filter(Boolean) : []),
  ];

  doc.setFont(FONT, 'normal').setFontSize(11).setTextColor(0);
  notes.forEach((line) => {
    if (y > pageH - MARGIN - 6) { doc.addPage(); y = MARGIN; }
    doc.splitTextToSize(String(line), pageW - MARGIN * 2).forEach((l) => {
      doc.text(l, MARGIN, y);
      y += 5.4;
    });
  });

  const pages = doc.internal.getNumberOfPages();
  if (pages > 1) {
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont(FONT, 'normal').setFontSize(9).setTextColor(110);
      doc.text(`Page ${p} of ${pages}`, centre, pageH - 6, { align: 'center' });
    }
  }

  const safeClient = String(quote.client_name || 'client')
    .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  doc.save(`${quote.quote_number}-${safeClient}.pdf`);
}
