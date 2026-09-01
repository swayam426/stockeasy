import { neon } from '@neondatabase/serverless';

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
}

export async function initDb() {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id        SERIAL PRIMARY KEY,
      name      TEXT NOT NULL,
      sku       TEXT NOT NULL UNIQUE,
      category  TEXT NOT NULL DEFAULT 'General',
      qty       INTEGER NOT NULL DEFAULT 0,
      threshold INTEGER NOT NULL DEFAULT 10,
      price     NUMERIC(10,2) NOT NULL DEFAULT 0,
      unit      TEXT NOT NULL DEFAULT 'pcs',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id           SERIAL PRIMARY KEY,
      type         TEXT NOT NULL CHECK (type IN ('in','out','add','edit')),
      product_id   INTEGER REFERENCES products(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      qty          INTEGER NOT NULL,
      party        TEXT,
      note         TEXT,
      date         DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ─── Quotation module ────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id               SERIAL PRIMARY KEY,
      name             TEXT NOT NULL,
      contact_person   TEXT,
      phone            TEXT,
      email            TEXT,
      billing_address  TEXT,
      shipping_address TEXT,
      gst_number       TEXT,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS clients_name_idx ON clients (LOWER(name))`;

  await sql`
    CREATE TABLE IF NOT EXISTS quotations (
      id             SERIAL PRIMARY KEY,
      quote_number   TEXT NOT NULL UNIQUE,

      -- Client is referenced for convenience, but the details below are
      -- SNAPSHOTTED at creation time. A quotation is a legal-ish document:
      -- if the client later changes address or GST number, the quotation
      -- as issued must not silently change. ON DELETE SET NULL keeps the
      -- quotation readable even if the client record is removed.
      client_id        INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_name      TEXT NOT NULL,
      contact_person   TEXT,
      phone            TEXT,
      email            TEXT,
      billing_address  TEXT,
      shipping_address TEXT,
      gst_number       TEXT,

      quote_date     DATE NOT NULL DEFAULT CURRENT_DATE,
      valid_until    DATE,

      status         TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','accepted','rejected','expired','converted')),

      -- Discount is stored as both a type and a value so "10%" and "₹10"
      -- stay distinguishable after saving.
      discount_type  TEXT NOT NULL DEFAULT 'none'
                     CHECK (discount_type IN ('none','percent','fixed')),
      discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      other_charges  NUMERIC(12,2) NOT NULL DEFAULT 0,

      -- Computed totals are persisted so the list page doesn't have to
      -- re-derive them, and so a saved quotation's figures never drift.
      subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_gst      NUMERIC(12,2) NOT NULL DEFAULT 0,
      discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      grand_total    NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_qty      INTEGER NOT NULL DEFAULT 0,

      notes          TEXT,
      terms          TEXT,

      created_by     TEXT NOT NULL DEFAULT 'admin',
      converted_at   TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS quotations_client_idx ON quotations (client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS quotations_status_idx ON quotations (status)`;
  await sql`CREATE INDEX IF NOT EXISTS quotations_date_idx ON quotations (quote_date DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS quotation_items (
      id           SERIAL PRIMARY KEY,
      quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,

      -- Same snapshot reasoning: product_name and unit_price are copied in,
      -- so renaming or repricing a product doesn't rewrite past quotations.
      product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      description  TEXT,
      unit         TEXT NOT NULL DEFAULT 'pcs',

      qty          NUMERIC(12,2) NOT NULL CHECK (qty > 0),
      unit_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
      gst_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,

      line_subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
      gst_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
      line_total    NUMERIC(12,2) NOT NULL DEFAULT 0,

      sort_order   INTEGER NOT NULL DEFAULT 0
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS quotation_items_quote_idx ON quotation_items (quotation_id)`;

  // ─── Migrations ──────────────────────────────────────────────────────
  // ADD COLUMN IF NOT EXISTS is idempotent, so these run harmlessly on
  // every boot and bring older databases up to date without a separate
  // migration step. Existing rows get NULL, which the UI treats as blank.

  // HSN/SAC code — required on GST documents, and per-product rather than
  // per-quotation, so it's stored on the catalogue and copied onto lines.
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code TEXT`;
  await sql`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS hsn_code TEXT`;

  // Lines quoted without a price ("ELECTRICAL BOARDS ... NOT AVAILABLE")
  // still need to appear on the document, so they're flagged rather than
  // priced at zero — a zero would wrongly imply the item is free.
  await sql`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS not_available BOOLEAN NOT NULL DEFAULT FALSE`;

  // Subject of the quotation, e.g. CCTV — appears in the covering line.
  await sql`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS subject TEXT`;

  // The customer-facing reference in financial-year/date form
  // (26-27/29/08/2026). quote_number stays as the unique internal key.
  await sql`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS ref_number TEXT`;

  // Which printed template to use.
  //   'company'    — full GST layout: HSN, TAXABLE, TAX, TAX AMOUNT columns,
  //                  rates exclusive of tax.
  //   'individual' — simplified layout: S.No/ITEMS/QTY/UOM/RATE/AMOUNT only,
  //                  rates INCLUSIVE of tax.
  // Existing rows default to 'company', which is what they were written as.
  await sql`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quote_type TEXT NOT NULL DEFAULT 'company'`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE quotations ADD CONSTRAINT quotations_type_chk
        CHECK (quote_type IN ('company','individual'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `;

  // Counter table for quotation numbering. A dedicated row per year lets us
  // generate QT-2026-0001 atomically without scanning the quotations table
  // (which would race under concurrent creates).
  await sql`
    CREATE TABLE IF NOT EXISTS quote_counters (
      year      INTEGER PRIMARY KEY,
      last_seq  INTEGER NOT NULL DEFAULT 0
    )
  `;

  return sql;
}

/**
 * The first quotation number to issue. Set this to continue an existing
 * series — e.g. if your previous book ended at 700, start at 701.
 * Lowering it later has no effect: numbers only ever move forward, so
 * already-issued numbers can never be handed out twice.
 */
export const QUOTE_START_SEQ = 701;

/**
 * Reserves the next quotation number, e.g. QT-2026-0701.
 *
 * Numbering runs CONTINUOUSLY across years rather than resetting each
 * January — the year in the string is a label, not a counter reset. So a
 * series that reaches 0748 in December continues at QT-2027-0749.
 *
 * The increment itself is an atomic upsert with RETURNING, so two
 * simultaneous requests can't be handed the same sequence: the database
 * decides the order, not the app. GREATEST() enforces the floor, which
 * also means bumping QUOTE_START_SEQ upward is safe at any time.
 */
export async function nextQuoteNumber(sql, year = new Date().getFullYear()) {
  // Highest sequence issued in any year, so a new year picks up where the
  // last one left off instead of colliding with old numbers.
  const [{ high }] = await sql`
    SELECT COALESCE(MAX(last_seq), 0)::int AS high FROM quote_counters
  `;
  const floor = Math.max(QUOTE_START_SEQ, high + 1);

  const rows = await sql`
    INSERT INTO quote_counters (year, last_seq)
    VALUES (${year}, ${floor})
    ON CONFLICT (year)
    DO UPDATE SET last_seq = GREATEST(quote_counters.last_seq + 1, ${floor})
    RETURNING last_seq
  `;
  const seq = rows[0].last_seq;
  return `QT-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Customer-facing reference in the form used on the printed quotation:
 *   26-27/29/08/2026   =  financial year / date
 *
 * The Indian financial year runs April–March, so anything before April
 * belongs to the year that started the previous April.
 */
export function quoteRefNumber(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  // Jan–Mar (months 0–2) still fall in the FY that began last April.
  const fyStart = d.getMonth() < 3 ? year - 1 : year;
  const fy = `${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`;

  return `${fy}/${day}/${month}/${year}`;
}
