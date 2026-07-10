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
      const [updated] = await sql`
        UPDATE transactions
        SET
          qty   = COALESCE(${qty}, qty),
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
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
