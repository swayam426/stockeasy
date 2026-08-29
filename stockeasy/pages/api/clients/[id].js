import { initDb } from '../../../lib/db';

export default async function handler(req, res) {
  const id = parseInt(req.query.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid client id' });

  let sql;
  try {
    sql = await initDb();
  } catch (e) {
    return res.status(500).json({ error: 'Database connection failed: ' + e.message });
  }

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM clients WHERE id = ${id}`;
      if (!rows.length) return res.status(404).json({ error: 'Client not found' });
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'PUT') {
      const {
        name, contact_person, phone, email,
        billing_address, shipping_address, gst_number, notes,
      } = req.body || {};

      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Client name is required' });
      }

      const rows = await sql`
        UPDATE clients SET
          name             = ${String(name).trim()},
          contact_person   = ${contact_person || null},
          phone            = ${phone || null},
          email            = ${email || null},
          billing_address  = ${billing_address || null},
          shipping_address = ${shipping_address || null},
          gst_number       = ${gst_number ? String(gst_number).trim().toUpperCase() : null},
          notes            = ${notes || null},
          updated_at       = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      if (!rows.length) return res.status(404).json({ error: 'Client not found' });
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      // Quotations keep their snapshotted client details (client_id is
      // ON DELETE SET NULL), so deleting a client never destroys quotation
      // history. Still worth telling the user what they're affecting.
      const [{ count }] = await sql`
        SELECT COUNT(*)::int AS count FROM quotations WHERE client_id = ${id}
      `;

      const rows = await sql`DELETE FROM clients WHERE id = ${id} RETURNING id`;
      if (!rows.length) return res.status(404).json({ error: 'Client not found' });

      return res.status(200).json({ success: true, detachedQuotations: count });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
