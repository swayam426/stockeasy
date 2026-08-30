/**
 * Minimal .xlsx writer.
 *
 * An .xlsx file is a ZIP archive of XML parts, so this builds those parts
 * directly and zips them with fflate — which is already in the tree as a
 * jsPDF dependency. The alternative, exceljs, drags in archiver, jszip and
 * fstream (several MB) to do the same job, which is a poor trade for one
 * download button.
 *
 * Supports what a stock report actually needs: a bold filled header row,
 * frozen panes, autofilter, column widths, and number/currency/date
 * formats. Strings are written inline, avoiding a shared-strings table.
 */

/**
 * XML escaping is not optional here — a product named
 * `1/2" ELBOW <BRASS> & CAP` would otherwise produce a corrupt file that
 * Excel refuses to open.
 */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Control characters are illegal in XML 1.0 and can arrive via pasted data.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/** 0 -> A, 25 -> Z, 26 -> AA … */
function colName(index) {
  let s = '';
  let n = index;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** Excel counts days from 1899-12-30 (the Lotus 1-2-3 leap-year quirk). */
function toExcelDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return null;
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return (utc - Date.UTC(1899, 11, 30)) / 86400000;
}

const STYLE = { DEFAULT: 0, HEADER: 1, TEXT: 2, INT: 3, MONEY: 4, DATE: 5, TITLE: 6, MUTED: 7 };

function stylesXml(headerColor) {
  const fill = String(headerColor || 'FFFFFF00').replace('#', '').toUpperCase();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;₹&quot;#,##0.00"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
<font><sz val="10"/><color rgb="FF808080"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${fill}"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="14" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function cellXml(ref, value, style) {
  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}" s="${style}"/>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  // Inline strings keep the file self-contained — no sharedStrings part.
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

/**
 * Builds the workbook.
 *
 * columns: [{ header, key, width, type: 'text'|'int'|'money'|'date' }]
 * rows:    array of plain objects keyed by column.key
 * title:   optional bold line above the table (with a subtitle beneath)
 */
export function buildXlsx({ sheetName = 'Sheet1', columns = [], rows = [], title = null, subtitle = null, headerColor = 'FFFFFF00' }) {
  const typeStyle = { text: STYLE.TEXT, int: STYLE.INT, money: STYLE.MONEY, date: STYLE.DATE };

  // Title block sits above the header row, with a blank spacer row between
  // it and the table: title(1), subtitle(2), blank(3), header(4).
  const titleRows = title ? (subtitle ? 3 : 2) : 0;
  const headerRowNum = titleRows + 1;

  const parts = [];

  if (title) {
    parts.push(`<row r="1" ht="20" customHeight="1">${cellXml('A1', title, STYLE.TITLE)}</row>`);
    if (subtitle) parts.push(`<row r="2">${cellXml('A2', subtitle, STYLE.MUTED)}</row>`);
  }

  parts.push(
    `<row r="${headerRowNum}" ht="28" customHeight="1">` +
    columns.map((c, i) => cellXml(`${colName(i)}${headerRowNum}`, c.header, STYLE.HEADER)).join('') +
    `</row>`
  );

  rows.forEach((row, r) => {
    const rowNum = headerRowNum + 1 + r;
    const cells = columns.map((c, i) => {
      let v = row[c.key];
      if (c.type === 'date' && v) v = toExcelDate(v);
      if ((c.type === 'int' || c.type === 'money') && v !== null && v !== undefined && v !== '') {
        const n = Number(v);
        v = Number.isFinite(n) ? n : null;
      }
      return cellXml(`${colName(i)}${rowNum}`, v, typeStyle[c.type] || STYLE.TEXT);
    }).join('');
    parts.push(`<row r="${rowNum}">${cells}</row>`);
  });

  const lastCol = colName(Math.max(columns.length - 1, 0));
  const lastRow = headerRowNum + rows.length;

  const cols = columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 14}" customWidth="1"/>`)
    .join('');

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0" tabSelected="1">
<pane ySplit="${headerRowNum}" topLeftCell="A${headerRowNum + 1}" activePane="bottomLeft" state="frozen"/>
</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${parts.join('')}</sheetData>
<autoFilter ref="A${headerRowNum}:${lastCol}${lastRow}"/>
</worksheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  return {
    '[Content_Types].xml': contentTypes,
    '_rels/.rels': rootRels,
    'xl/workbook.xml': workbook,
    'xl/_rels/workbook.xml.rels': workbookRels,
    'xl/worksheets/sheet1.xml': sheet,
    'xl/styles.xml': stylesXml(headerColor),
  };
}

/** Zips the parts and triggers a browser download. */
export async function downloadXlsx(spec, filename) {
  const { zipSync, strToU8 } = await import('fflate');

  const files = buildXlsx(spec);
  const zipped = {};
  for (const [name, xml] of Object.entries(files)) {
    zipped[name] = strToU8(xml);
  }

  const bytes = zipSync(zipped, { level: 6 });
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
