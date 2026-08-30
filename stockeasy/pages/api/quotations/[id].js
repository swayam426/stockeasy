import { initDb, quoteRefNumber } from '../../../lib/db';
import { calcQuotation, effectiveStatus, QUOTE_STATUSES } from '../../../lib/quoteMath';

export default async function handler(req, res) {
  const id = parseInt(req.query.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid quotation id' });

  let sql;
  try {
    sql = await initDb();
  } catch (e) {
    return res.status(500).json({ error: 'Database connection failed: ' + e.message });
  }

  try {
    if (req.method === 'GET') {
      const [quote] = await sql`SELECT * FROM quotations WHERE id = ${id}`;
      if (!quote) return res.status(404).json({ error: 'Quotation not found' });

      const items = await sql`
        SELECT * FROM quotation_items
        WHERE quotation_id = ${id}
        ORDER BY sort_order ASC, id ASC
      `;

      return res.status(200).json({ ...quote, status: effectiveStatus(quote), items });
    }

    if (req.method === 'PATCH') {
      // Status-only change, kept separate from a full edit so the list page
      // can flip a status without resubmitting the whole document.
      const { status } = req.body || {};
      if (!QUOTE_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const [existing] = await sql`SELECT status FROM quotations WHERE id = ${id}`;
      if (!existing) return res.status(404).json({ error: 'Quotation not found' });

      // 'converted' is set by the conversion flow (which records the stock
      // outflow); allowing it here would mark a quotation as converted
      // without any stock actually moving.
      if (status === 'converted' && existing.status !== 'converted') {
        return res.status(400).json({
          error: 'Use the convert action so the stock outflow is recorded',
        });
      }

      const [updated] = await sql`
        UPDATE quotations
        SET status = ${status},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      return res.status(200).json(updated);
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const items = Array.isArray(body.items) ? body.items : [];

      const [existing] = await sql`SELECT * FROM quotations WHERE id = ${id}`;
      if (!existing) return res.status(404).json({ error: 'Quotation not found' });

      // A converted quotation has stock movement behind it; editing the
      // figures afterwards would leave the inventory log inconsistent.
      if (existing.status === 'converted') {
        return res.status(400).json({
          error: 'This quotation has been converted to a sale and can no longer be edited. Duplicate it instead.',
        });
      }

      if (!body.client_name || !String(body.client_name).trim()) {
        return res.status(400).json({ error: 'Client name is required' });
      }
      if (items.length === 0) {
        return res.status(400).json({ error: 'Add at least one product' });
      }
      for (const it of items) {
        if (!(Number(it.qty) > 0)) {
          return res.status(400).json({ error: `Quantity must be greater than 0 for "${it.product_name}"` });
        }
      }

      const totals = calcQuotation({
        items,
        discount_type: body.discount_type,
        discount_value: body.discount_value,
        other_charges: body.other_charges,
      });

      const [quote] = await sql`
        UPDATE quotations SET
          client_id        = ${body.client_id || null},
          client_name      = ${String(body.client_name).trim()},
          contact_person   = ${body.contact_person || null},
          phone            = ${body.phone || null},
          email            = ${body.email || null},
          billing_address  = ${body.billing_address || null},
          shipping_address = ${body.shipping_address || null},
          gst_number       = ${body.gst_number || null},
          quote_date       = ${body.quote_date || existing.quote_date},
          valid_until      = ${body.valid_until || null},
          status           = ${body.status || existing.status},
          subject          = ${body.subject || null},
          ref_number       = ${body.ref_number || existing.ref_number || quoteRefNumber(body.quote_date || existing.quote_date)},
          discount_type    = ${body.discount_type || 'none'},
          discount_value   = ${Number(body.discount_value) || 0},
          other_charges    = ${totals.other_charges},
          subtotal         = ${totals.subtotal},
          total_gst        = ${totals.total_gst},
          discount_amount  = ${totals.discount_amount},
          grand_total      = ${totals.grand_total},
          total_qty        = ${totals.total_qty},
          notes            = ${body.notes || null},
          terms            = ${body.terms || null},
          updated_at       = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      // Replace line items wholesale — simpler and less error-prone than
      // diffing, and the ON DELETE CASCADE keeps it clean.
      await sql`DELETE FROM quotation_items WHERE quotation_id = ${id}`;

      let order = 0;
      for (const line of totals.lines) {
        await sql`
          INSERT INTO quotation_items (
            quotation_id, product_id, product_name, description, unit,
            hsn_code, not_available,
            qty, unit_price, gst_percent,
            line_subtotal, gst_amount, line_total, sort_order
          ) VALUES (
            ${id},
            ${line.product_id || null},
            ${String(line.product_name).trim()},
            ${line.description || null},
            ${line.unit || 'pcs'},
            ${line.hsn_code || null},
            ${Boolean(line.not_available)},
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

      return res.status(200).json({ ...quote, items: totals.lines });
    }

    if (req.method === 'DELETE') {
      const [existing] = await sql`SELECT status FROM quotations WHERE id = ${id}`;
      if (!existing) return res.status(404).json({ error: 'Quotation not found' });

      if (existing.status === 'converted') {
        return res.status(400).json({
          error: 'Converted quotations cannot be deleted — they are the record behind a stock movement.',
        });
      }

      // quotation_items go with it via ON DELETE CASCADE.
      await sql`DELETE FROM quotations WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
