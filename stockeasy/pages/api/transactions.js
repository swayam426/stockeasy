import { initDb } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let sql;
  try {
    sql = await initDb();
  } catch (e) {
    return res.status(500).json({ error: 'Database connection failed: ' + e.message });
  }

  try {
    const { product_id, type, limit = 100 } = req.query;

    let transactions;

    if (product_id && type) {
      transactions = await sql`
        SELECT * FROM transactions
        WHERE product_id = ${product_id} AND type = ${type}
        ORDER BY created_at DESC
        LIMIT ${parseInt(limit)}
      `;
    } else if (product_id) {
      transactions = await sql`
        SELECT * FROM transactions
        WHERE product_id = ${product_id}
        ORDER BY created_at DESC
        LIMIT ${parseInt(limit)}
      `;
    } else if (type) {
      transactions = await sql`
        SELECT * FROM transactions
        WHERE type = ${type}
        ORDER BY created_at DESC
        LIMIT ${parseInt(limit)}
      `;
    } else {
      transactions = await sql`
        SELECT * FROM transactions
        ORDER BY created_at DESC
        LIMIT ${parseInt(limit)}
      `;
    }

    return res.status(200).json(transactions);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
