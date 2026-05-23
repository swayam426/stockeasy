import { initDb } from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  let sql;
  try {
    sql = await initDb();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  try {
    await sql`DELETE FROM transactions WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
