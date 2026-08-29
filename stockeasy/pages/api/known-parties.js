import { initDb } from '../../lib/db';

/**
 * Distinct party names already recorded against stock transactions.
 *
 * Outflow parties are customers, inflow parties are suppliers — the same
 * column serves both, so `type` decides which set you get. This lets the
 * Clients screen offer names the business has actually traded with,
 * instead of asking someone to retype what the system already knows.
 *
 * Names already saved as proper clients are filtered out, so the list
 * only ever shows what's genuinely missing.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (e) {
    return res.status(500).json({ error: 'Database connection failed: ' + e.message });
  }

  try {
    const type = req.query.type === 'in' ? 'in' : 'out';

    const rows = await sql`
      SELECT
        TRIM(party)                AS name,
        COUNT(*)::int              AS txn_count,
        MAX(date)                  AS last_date,
        SUM(qty)::int              AS total_qty
      FROM transactions
      WHERE type = ${type}
        AND party IS NOT NULL
        AND TRIM(party) <> ''
      GROUP BY TRIM(party)
      ORDER BY MAX(date) DESC NULLS LAST
    `;

    // Exclude anything already promoted to a client record. Compared
    // case-insensitively so "Jasmi Plant B" won't reappear alongside
    // an existing "JASMI PLANT B".
    const existing = await sql`SELECT LOWER(TRIM(name)) AS name FROM clients`;
    const taken = new Set(existing.map(r => r.name));

    const parties = rows
      .filter(r => r.name && !taken.has(r.name.toLowerCase()))
      .map(r => ({
        name: r.name,
        txn_count: r.txn_count,
        last_date: r.last_date,
        total_qty: r.total_qty,
      }));

    return res.status(200).json(parties);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
