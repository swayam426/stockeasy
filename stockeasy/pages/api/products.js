import { initDb } from '../../lib/db';

export default async function handler(req, res) {
  let sql;
  try {
    sql = await initDb();
  } catch (e) {
    return res.status(500).json({ error: 'Database connection failed: ' + e.message });
  }

  // GET /api/products
  if (req.method === 'GET') {
    try {
      const products = await sql`
        SELECT * FROM products ORDER BY created_at DESC
      `;
      return res.status(200).json(products);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST /api/products — add new product
  if (req.method === 'POST') {
    const { name, sku, category, qty, threshold, price, unit } = req.body;
    if (!name) return res.status(400).json({ error: 'Product name is required' });

    try {
      const [product] = await sql`
        INSERT INTO products (name, sku, category, qty, threshold, price, unit)
        VALUES (
          ${name},
          ${sku || null},
          ${category || 'General'},
          ${qty || 0},
          ${threshold || 10},
          ${price || 0},
          ${unit || 'pcs'}
        )
        ON CONFLICT (sku) DO NOTHING
        RETURNING *
      `;

      if (!product) {
        return res.status(409).json({ error: 'A product with this SKU already exists' });
      }

      // Log opening stock as a transaction
      if ((qty || 0) > 0) {
        await sql`
          INSERT INTO transactions (type, product_id, product_name, qty, party, note, date)
          VALUES ('add', ${product.id}, ${product.name}, ${qty}, NULL, 'Opening stock', ${new Date().toISOString().split('T')[0]})
        `;
      }

      return res.status(201).json(product);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
