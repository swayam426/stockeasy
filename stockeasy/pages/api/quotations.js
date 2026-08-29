import { initDb, nextQuoteNumber } from '../../lib/db';
import { calcQuotation, effectiveStatus } from '../../lib/quoteMath';

export default async function handler(req, res) {
  let sql;
  try {
    sql = await initDb();
  } catch (e) {
    return res.status(500).json({ error: 'Database connection failed: ' + e.message });
  }

  try {
    if (req.method === 'GET') {
      const { status, search, from, to } = req.query;

      // Item counts come from a join rather than N+1 queries, so the list
      // page stays one round trip no matter how many quotations exist.
      let rows = await sql`
        SELECT q.*,
               COALESCE(i.item_count, 0) AS item_count
        FROM quotations q
        LEFT JOIN (
          SELECT quotation_id, COUNT(*)::int AS item_count
          FROM quotation_items GROUP BY quotation_id
        ) i ON i.quotation_id = q.id
        ORDER BY q.created_at DESC
      `;

      // Filtering happens here rather than in SQL because `expired` is a
      // derived status (based on valid_until) and has no stored value.
      rows = rows.map(q => ({ ...q, status: effectiveStatus(q) }));

      if (status) rows = rows.filter(q => q.status === status);
      if (from) rows = rows.filter(q => q.quote_date >= from);
      if (to) rows = rows.filter(q => q.quote_date <= to);
      if (search) {
        const s = String(search).toLowerCase();
        rows = rows.filter(q =>
          (q.quote_number || '').toLowerCase().includes(s) ||
          (q.client_name || '').toLowerCase().includes(s)
        );
      }

      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const items = Array.isArray(body.items) ? body.items : [];

      if (!body.client_name || !String(body.client_name).trim()) {
        return res.status(400).json({ error: 'Client name is required' });
      }
      if (items.length === 0) {
        return res.status(400).json({ error: 'Add at least one product' });
      }
      for (const it of items) {
        if (!it.product_name || !String(it.product_name).trim()) {
          return res.status(400).json({ error: 'Every line needs a product' });
        }
        if (!(Number(it.qty) > 0)) {
          return res.status(400).json({ error: `Quantity must be greater than 0 for "${it.product_name}"` });
        }
      }

      // Totals are ALWAYS recomputed server-side. Whatever the browser sent
      // for subtotal/grand_total is ignored — otherwise a crafted request
      // could store a quotation whose total disagrees with its own lines.
      const totals = calcQuotation({
        items,
        discount_type: body.discount_type,
        discount_value: body.discount_value,
        other_charges: body.other_charges,
      });

      const quoteNumber = await nextQuoteNumber(sql);

      const [quote] = await sql`
        INSERT INTO quotations (
          quote_number, client_id, client_name, contact_person, phone, email,
          billing_address, shipping_address, gst_number,
          quote_date, valid_until, status,
          discount_type, discount_value, other_charges,
          subtotal, total_gst, discount_amount, grand_total, total_qty,
          notes, terms, created_by
        ) VALUES (
          ${quoteNumber},
          ${body.client_id || null},
          ${String(body.client_name).trim()},
          ${body.contact_person || null},
          ${body.phone || null},
          ${body.email || null},
          ${body.billing_address || null},
          ${body.shipping_address || null},
          ${body.gst_number || null},
          ${body.quote_date || new Date().toISOString().split('T')[0]},
          ${body.valid_until || null},
          ${body.status || 'draft'},
          ${body.discount_type || 'none'},
          ${Number(body.discount_value) || 0},
          ${totals.other_charges},
          ${totals.subtotal},
          ${totals.total_gst},
          ${totals.discount_amount},
          ${totals.grand_total},
          ${totals.total_qty},
          ${body.notes || null},
          ${body.terms || null},
          ${body.created_by || 'admin'}
        )
        RETURNING *
      `;

      // Insert line items with their server-computed figures.
      let order = 0;
      for (const line of totals.lines) {
        await sql`
          INSERT INTO quotation_items (
            quotation_id, product_id, product_name, description, unit,
            qty, unit_price, gst_percent,
            line_subtotal, gst_amount, line_total, sort_order
          ) VALUES (
            ${quote.id},
            ${line.product_id || null},
            ${String(line.product_name).trim()},
            ${line.description || null},
            ${line.unit || 'pcs'},
            ${Number(line.qty)},
            ${Number(line.unit_price) || 0},
            ${Number(line.gst_percent) || 0},
            ${line.line_subtotal},
            ${line.gst_amount},
            ${line.line_total},
            ${order++}
          )
        `;
      }

      return res.status(201).json({ ...quote, items: totals.lines });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
