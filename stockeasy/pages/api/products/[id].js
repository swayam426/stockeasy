import { initDb } from '../../../lib/db';

export default async function handler(req, res) {
  const { id } = req.query;
  let sql;
  try {
    sql = await initDb();
  } catch (e) {
    return res.status(500).json({ error: 'Database connection failed: ' + e.message });
  }

  // PUT /api/products/[id] — edit product
  if (req.method === 'PUT') {
    const { name, qty, threshold, price, unit, category, hsn_code } = req.body;
    try {
      // Get current qty to detect manual stock adjustment
      const [current] = await sql`SELECT qty, name FROM products WHERE id = ${id}`;
      if (!current) return res.status(404).json({ error: 'Product not found' });

      const [updated] = await sql`
        UPDATE products
        SET
          name      = COALESCE(${name}, name),
          qty       = COALESCE(${qty}, qty),
          threshold = COALESCE(${threshold}, threshold),
          price     = COALESCE(${price}, price),
          unit      = COALESCE(${unit}, unit),
          category  = COALESCE(${category}, category),
          hsn_code  = COALESCE(${hsn_code ?? null}, hsn_code)
        WHERE id = ${id}
        RETURNING *
      `;

      // If qty changed manually, log it
      const newQty = qty != null ? qty : current.qty;
      if (qty != null && qty !== current.qty) {
        const diff = qty - current.qty;
        await sql`
          INSERT INTO transactions (type, product_id, product_name, qty, party, note, date)
          VALUES (
            'edit',
            ${id},
            ${current.name},
            ${Math.abs(diff)},
            NULL,
            ${diff > 0 ? 'Manual stock increase' : 'Manual stock decrease'},
            ${new Date().toISOString().split('T')[0]}
          )
        `;
      }

      return res.status(200).json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // DELETE /api/products/[id]
  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM products WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
