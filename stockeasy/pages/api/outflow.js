import { initDb } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let sql;
  try {
    sql = await initDb();
  } catch (e) {
    return res.status(500).json({ error: 'Database connection failed: ' + e.message });
  }

  const { product_id, qty, customer, note, date } = req.body;

  if (!product_id) return res.status(400).json({ error: 'Product is required' });
  if (!qty || qty < 1) return res.status(400).json({ error: 'Quantity must be at least 1' });

  try {
    const [product] = await sql`SELECT * FROM products WHERE id = ${product_id}`;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (qty > product.qty) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${product.qty} ${product.unit}`
      });
    }

    // Deduct stock
    const [updated] = await sql`
      UPDATE products SET qty = qty - ${qty} WHERE id = ${product_id} RETURNING *
    `;

    // Log transaction
    const [tx] = await sql`
      INSERT INTO transactions (type, product_id, product_name, qty, party, note, date)
      VALUES ('out', ${product_id}, ${product.name}, ${qty}, ${customer || null}, ${note || null}, ${date || new Date().toISOString().split('T')[0]})
      RETURNING *
    `;

    return res.status(200).json({ product: updated, transaction: tx });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
