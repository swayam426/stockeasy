import { readXlsx } from './xlsxRead';

/**
 * Turns an edited inventory workbook into product rows, and compares them
 * with what's in the app so the user can review before anything is saved.
 *
 * Rows are matched on SKU. A SKU not in the app becomes a NEW product.
 * Nothing is ever deleted: a product missing from the sheet is left alone.
 */

const HEADERS = {
  name: ['product', 'name', 'product name', 'item'],
  sku: ['sku'],
  hsn_code: ['hsn / sac', 'hsn/sac', 'hsn', 'sac', 'hsn code'],
  category: ['category'],
  qty: ['stock', 'qty', 'quantity'],
  unit: ['unit'],
  price: ['unit price', 'price', 'rate'],
  threshold: ['low stock at', 'threshold', 'low stock'],
};

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const str = (v) => String(v ?? '').trim();

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

export async function parseInventoryFile(arrayBuffer) {
  const grid = await readXlsx(arrayBuffer);

  // The export has a title block above the table, so find the header row
  // instead of assuming it is row 1.
  const headerAt = grid.findIndex((row) => {
    const cells = row.map(norm);
    return cells.some(c => HEADERS.sku.includes(c)) && cells.some(c => HEADERS.name.includes(c));
  });
  if (headerAt < 0) {
    throw new Error('Could not find the "Product" and "SKU" columns. Use a file downloaded from the app.');
  }

  const cols = {};
  grid[headerAt].forEach((h, i) => {
    const key = Object.keys(HEADERS).find(k => HEADERS[k].includes(norm(h)));
    if (key && cols[key] === undefined) cols[key] = i;
  });

  const rows = [];
  const problems = [];

  grid.slice(headerAt + 1).forEach((r, i) => {
    const line = headerAt + 2 + i; // Excel's own row number
    const get = (k) => (cols[k] === undefined ? undefined : r[cols[k]]);
    const name = str(get('name'));
    const sku = str(get('sku'));
    if (!name && !sku) return; // blank / spacer row

    if (!name) { problems.push(`Row ${line}: product name is empty.`); return; }
    if (!sku) { problems.push(`Row ${line} (${name}): SKU is empty — it can't be matched.`); return; }

    const row = { line, name, sku };
    for (const k of ['hsn_code', 'category', 'unit']) {
      if (cols[k] !== undefined) row[k] = str(get(k));
    }
    for (const k of ['qty', 'price', 'threshold']) {
      if (cols[k] === undefined) continue;
      const n = num(get(k));
      if (n !== null && (Number.isNaN(n) || n < 0)) {
        problems.push(`Row ${line} (${name}): "${get(k)}" is not a valid ${k === 'qty' ? 'stock' : k === 'price' ? 'price' : 'low-stock'} number.`);
        return;
      }
      if (n !== null) row[k] = k === 'price' ? n : Math.round(n);
    }
    rows.push(row);
  });

  const seen = new Set();
  const unique = rows.filter((r) => {
    const k = r.sku.toLowerCase();
    if (seen.has(k)) { problems.push(`Row ${r.line} (${r.name}): SKU ${r.sku} appears twice — skipped.`); return false; }
    seen.add(k);
    return true;
  });

  return { rows: unique, problems };
}

const FIELD_LABEL = {
  name: 'Name', hsn_code: 'HSN', category: 'Category', qty: 'Stock',
  unit: 'Unit', price: 'Price', threshold: 'Low stock at',
};

/** Compares parsed rows to the live catalogue. */
export function diffInventory(rows, products) {
  const bySku = new Map(products.map(p => [String(p.sku).toLowerCase(), p]));
  const updates = [];
  const additions = [];
  let unchanged = 0;

  rows.forEach((r) => {
    const p = bySku.get(r.sku.toLowerCase());
    if (!p) { additions.push(r); return; }

    const changes = [];
    for (const k of Object.keys(FIELD_LABEL)) {
      if (r[k] === undefined) continue;
      let before = p[k] ?? '';
      let after = r[k];
      if (['qty', 'threshold'].includes(k)) { before = Number(before); }
      else if (k === 'price') { before = Number(before); }
      else { before = str(before); }
      // An empty cell in a text column means "leave as is", not "wipe it".
      if (after === '' && typeof after === 'string') continue;
      if (before !== after) changes.push({ field: k, label: FIELD_LABEL[k], before, after });
    }
    if (changes.length) updates.push({ row: r, product: p, changes });
    else unchanged += 1;
  });

  return { updates, additions, unchanged };
}
