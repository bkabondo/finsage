import { Pool } from 'pg'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('token') !== process.env.SETUP_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS finsage_users (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT NOT NULL UNIQUE, full_name TEXT,
        role TEXT DEFAULT 'user' CHECK (role IN ('admin','user')),
        currency TEXT DEFAULT 'USD', monthly_budget NUMERIC DEFAULT 2000,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      GRANT ALL ON finsage_users TO anon, authenticated;
      ALTER TABLE finsage_users ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='fs_users_self' AND tablename='finsage_users') THEN
          CREATE POLICY "fs_users_self" ON finsage_users FOR ALL USING (auth.uid()=id OR (SELECT role FROM finsage_users WHERE id=auth.uid())='admin');
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS finsage_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES finsage_users(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL CHECK (amount > 0),
        type TEXT NOT NULL CHECK (type IN ('income','expense')),
        category TEXT NOT NULL,
        description TEXT,
        transaction_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      GRANT ALL ON finsage_transactions TO anon, authenticated;
      ALTER TABLE finsage_transactions ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='fs_txns_user' AND tablename='finsage_transactions') THEN
          CREATE POLICY "fs_txns_user" ON finsage_transactions FOR ALL USING (user_id=auth.uid() OR (SELECT role FROM finsage_users WHERE id=auth.uid())='admin');
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS finsage_budgets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES finsage_users(id) ON DELETE CASCADE,
        category TEXT NOT NULL, monthly_limit NUMERIC NOT NULL,
        month INTEGER NOT NULL, year INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, category, month, year)
      );
      GRANT ALL ON finsage_budgets TO anon, authenticated;
      ALTER TABLE finsage_budgets ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='fs_budgets_user' AND tablename='finsage_budgets') THEN
          CREATE POLICY "fs_budgets_user" ON finsage_budgets FOR ALL USING (user_id=auth.uid() OR (SELECT role FROM finsage_users WHERE id=auth.uid())='admin');
        END IF;
      END $$;
    `)
    return NextResponse.json({ status: 'Migration complete' })
  } catch (e: unknown) {
    const error = e as Error
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
    await pool.end()
  }
}
