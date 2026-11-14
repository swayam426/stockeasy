/**
 * Minimal .xlsx reader — the counterpart of lib/xlsx.js.
 *
 * Handles files saved by Excel, Google Sheets or LibreOffice, which (unlike
 * our own export) store text in a shared-strings table.
 * Returns the first sheet as an array of rows, each an array of cell values.
 */

function colIndex(ref) {
  const letters = String(ref).replace(/[^A-Z]/gi, '').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'application/xml');
}

function textOf(node) {
  // Rich-text cells split a string across several <t> runs.
  return Array.from(node.getElementsByTagName('t')).map(t => t.textContent).join('');
}

export async function readXlsx(arrayBuffer) {
  const { unzipSync, strFromU8 } = await import('fflate');

  let files;
  try {
    files = unzipSync(new Uint8Array(arrayBuffer));
  } catch {
    throw new Error('That file is not a valid .xlsx workbook.');
  }

  // Shared strings (absent in files we wrote ourselves).
  let shared = [];
  if (files['xl/sharedStrings.xml']) {
    const doc = parseXml(strFromU8(files['xl/sharedStrings.xml']));
    shared = Array.from(doc.getElementsByTagName('si')).map(textOf);
  }

  // First worksheet, resolved through the workbook relationships.
  let sheetPath = null;
  try {
    const wb = parseXml(strFromU8(files['xl/workbook.xml']));
    const rels = parseXml(strFromU8(files['xl/_rels/workbook.xml.rels']));
    const first = wb.getElementsByTagName('sheet')[0];
    const rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    const rel = Array.from(rels.getElementsByTagName('Relationship')).find(r => r.getAttribute('Id') === rid);
    if (rel) {
      const target = rel.getAttribute('Target').replace(/^\//, '');
      sheetPath = target.startsWith('xl/') ? target : `xl/${target}`;
    }
  } catch { /* fall through to the guess below */ }
  if (!sheetPath || !files[sheetPath]) {
    sheetPath = Object.keys(files).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  }
  if (!sheetPath) throw new Error('No worksheet found in the file.');

  const sheet = parseXml(strFromU8(files[sheetPath]));
  const rows = [];

  Array.from(sheet.getElementsByTagName('row')).forEach((rowEl) => {
    const r = Number(rowEl.getAttribute('r')) - 1;
    const arr = [];
    Array.from(rowEl.getElementsByTagName('c')).forEach((c) => {
      const idx = colIndex(c.getAttribute('r'));
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0];
      let val = '';
      if (t === 'inlineStr') val = textOf(c);
      else if (t === 's') val = shared[Number(v && v.textContent)] ?? '';
      else if (t === 'str' || t === 'e') val = v ? v.textContent : '';
      else if (t === 'b') val = v && v.textContent === '1' ? 'TRUE' : 'FALSE';
      else if (v && v.textContent !== '') val = Number(v.textContent);
      arr[idx] = val;
    });
    rows[r] = arr;
  });

  return Array.from(rows, (r) => r || []);
}
