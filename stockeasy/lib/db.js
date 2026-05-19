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

  return sql;
}
