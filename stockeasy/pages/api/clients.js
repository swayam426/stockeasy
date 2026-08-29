import { initDb } from '../../lib/db';

export default async function handler(req, res) {
  let sql;
  try {
    sql = await initDb();
  } catch (e) {
    return res.status(500).json({ error: 'Database connection failed: ' + e.message });
  }

  try {
    if (req.method === 'GET') {
      const { search } = req.query;
      const clients = search
        ? await sql`
            SELECT * FROM clients
            WHERE name ILIKE ${'%' + search + '%'}
               OR contact_person ILIKE ${'%' + search + '%'}
               OR phone ILIKE ${'%' + search + '%'}
               OR gst_number ILIKE ${'%' + search + '%'}
            ORDER BY name ASC
          `
        : await sql`SELECT * FROM clients ORDER BY name ASC`;
      return res.status(200).json(clients);
    }

    if (req.method === 'POST') {
      const {
        name, contact_person, phone, email,
        billing_address, shipping_address, gst_number, notes,
      } = req.body || {};

      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Client name is required' });
      }

      const rows = await sql`
        INSERT INTO clients (
          name, contact_person, phone, email,
          billing_address, shipping_address, gst_number, notes
        ) VALUES (
          ${String(name).trim()},
          ${contact_person || null},
          ${phone || null},
          ${email || null},
          ${billing_address || null},
          ${shipping_address || null},
          ${gst_number ? String(gst_number).trim().toUpperCase() : null},
          ${notes || null}
        )
        RETURNING *
      `;
      return res.status(201).json(rows[0]);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
