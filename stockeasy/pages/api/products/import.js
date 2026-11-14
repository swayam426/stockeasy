import { initDb } from '../../../lib/db';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const MAX_ROWS = 5000;

/**
 * POST /api/products/import — applies an edited inventory sheet.
 *
 * Rows are matched on SKU: existing products are updated, unknown SKUs are
 * added. Nothing is deleted. Stock changes are logged as transactions the
 * same way a manual edit is, so the history stays complete.
 *
 * Only fields present on a row are touched; a blank text cell leaves the
 * existing value alone.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rows = req.body && req.body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No rows to import.' });
  }
  if (rows.length > MAX_ROWS) {
    return res.status(400).json({ error: `Too many rows (max ${MAX_ROWS}).` });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (e) {
    return res.status(500).json({ error: 'Database connection failed: ' + e.message });
  }

  const today = new Date().toISOString().split('T')[0];
  const nonNeg = (v) => (v === undefined || v === null ? null : (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null));
  const text = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

  let updated = 0, added = 0, unchanged = 0;
  const failed = [];

  try {
    const skus = rows.map(r => String(r.sku || '').trim()).filter(Boolean);
    const existing = await sql`SELECT * FROM products WHERE lower(sku) = ANY(${skus.map(s => s.toLowerCase())})`;
    const bySku = new Map(existing.map(p => [String(p.sku).toLowerCase(), p]));

    for (const r of rows) {
      const sku = String(r.sku || '').trim();
      const name = text(r.name);
      if (!sku || !name) { failed.push(`${sku || '(no SKU)'}: name and SKU are required`); continue; }

      try {
        const cur = bySku.get(sku.toLowerCase());

        if (!cur) {
          const qty = Math.round(nonNeg(r.qty) ?? 0);
          const [p] = await sql`
            INSERT INTO products (name, sku, category, qty, threshold, price, unit, hsn_code)
            VALUES (${name}, ${sku}, ${text(r.category) || 'General'}, ${qty},
                    ${Math.round(nonNeg(r.threshold) ?? 10)}, ${nonNeg(r.price) ?? 0},
                    ${text(r.unit) || 'pcs'}, ${text(r.hsn_code)})
            ON CONFLICT (sku) DO NOTHING
            RETURNING *
          `;
          if (!p) { failed.push(`${sku}: already exists`); continue; }
          if (qty > 0) {
            await sql`
              INSERT INTO transactions (type, product_id, product_name, qty, party, note, date)
              VALUES ('add', ${p.id}, ${p.name}, ${qty}, NULL, 'Opening stock (Excel import)', ${today})
            `;
          }
          added += 1;
          continue;
        }

        const qty = nonNeg(r.qty) === null ? null : Math.round(nonNeg(r.qty));
        const next = {
          name,
          qty,
          threshold: nonNeg(r.threshold) === null ? null : Math.round(nonNeg(r.threshold)),
          price: nonNeg(r.price),
          unit: text(r.unit),
          category: text(r.category),
          hsn_code: text(r.hsn_code),
        };

        const same =
          next.name === cur.name &&
          (next.qty === null || next.qty === Number(cur.qty)) &&
          (next.threshold === null || next.threshold === Number(cur.threshold)) &&
          (next.price === null || next.price === Number(cur.price)) &&
          (next.unit === null || next.unit === cur.unit) &&
          (next.category === null || next.category === cur.category) &&
          (next.hsn_code === null || next.hsn_code === (cur.hsn_code || ''));
        if (same) { unchanged += 1; continue; }

        await sql`
          UPDATE products SET
            name      = ${next.name},
            qty       = COALESCE(${next.qty}, qty),
            threshold = COALESCE(${next.threshold}, threshold),
            price     = COALESCE(${next.price}, price),
            unit      = COALESCE(${next.unit}, unit),
            category  = COALESCE(${next.category}, category),
            hsn_code  = COALESCE(${next.hsn_code}, hsn_code)
          WHERE id = ${cur.id}
        `;

        if (next.qty !== null && next.qty !== Number(cur.qty)) {
          const diff = next.qty - Number(cur.qty);
          await sql`
            INSERT INTO transactions (type, product_id, product_name, qty, party, note, date)
            VALUES ('edit', ${cur.id}, ${next.name}, ${Math.abs(diff)}, NULL,
                    ${diff > 0 ? 'Stock increase (Excel import)' : 'Stock decrease (Excel import)'}, ${today})
          `;
        }
        updated += 1;
      } catch (e) {
        failed.push(`${sku}: ${e.message}`);
      }
    }

    return res.status(200).json({ updated, added, unchanged, failed });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
