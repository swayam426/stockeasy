import { initDb } from '../../../lib/db';

export default async function handler(req, res) {
  const { id } = req.query;
  let sql;
  try {
    sql = await initDb();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  // DELETE
  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM transactions WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // PUT — edit transaction
  if (req.method === 'PUT') {
  const { qty, party, note, date } = req.body;
  try {
    // Get original transaction
    const [original] = await sql`SELECT * FROM transactions WHERE id = ${id}`;
    if (!original) return res.status(404).json({ error: 'Transaction not found' });

    const oldQty = Number(original.qty);
    const newQty = Number(qty);
    const diff = newQty - oldQty;

    // Update inventory based on transaction type
    if (diff !== 0) {
      if (original.type === 'out') {
        // Outflow reduced → stock goes UP (customer returned more)
        // Outflow increased → stock goes DOWN (sold more)
        await sql`
          UPDATE products SET qty = qty - ${diff} WHERE id = ${original.product_id}
        `;
      } else if (original.type === 'in') {
        // Inflow reduced → stock goes DOWN
        // Inflow increased → stock goes UP
        await sql`
          UPDATE products SET qty = qty + ${diff} WHERE id = ${original.product_id}
        `;
      }
    }

    // Update the transaction record
    const [updated] = await sql`
      UPDATE transactions
      SET
        qty   = ${newQty},
        party = COALESCE(${party}, party),
        note  = COALESCE(${note}, note),
        date  = COALESCE(${date}, date)
      WHERE id = ${id}
      RETURNING *
    `;

    return res.status(200).json(updated);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}}
