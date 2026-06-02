import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Pool } from 'pg'

const TEST_USERS = [
  { email: 'admin@finsage.dev', password: 'Admin1234!', full_name: 'Admin User', role: 'admin' },
  { email: 'alice@finsage.dev', password: 'Alice1234!', full_name: 'Alice Johnson', role: 'user' },
  { email: 'bob@finsage.dev', password: 'Bob12345!', full_name: 'Bob Martinez', role: 'user' },
  { email: 'carol@finsage.dev', password: 'Carol123!', full_name: 'Carol Williams', role: 'user' },
]

const CATEGORIES = ['Salary', 'Food', 'Transport', 'Entertainment', 'Utilities', 'Shopping', 'Health', 'Education']

function randomBetween(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function randomDate(daysBack: number) {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack))
  return d.toISOString().split('T')[0]
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('token') !== process.env.SETUP_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  const results: Record<string, unknown>[] = []

  try {
    for (const u of TEST_USERS) {
      // Create auth user
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      })

      if (authError && !authError.message.includes('already been registered')) {
        results.push({ email: u.email, error: authError.message })
        continue
      }

      const userId = authData?.user?.id
      if (!userId) {
        // User may already exist, try to find them
        const { data: listData } = await admin.auth.admin.listUsers()
        const existing = listData?.users?.find((usr) => usr.email === u.email)
        if (!existing) {
          results.push({ email: u.email, error: 'Could not find or create user' })
          continue
        }
        const existingId = existing.id

        // Upsert profile
        await client.query(
          `INSERT INTO finsage_users (id, email, full_name, role, monthly_budget)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET full_name=$3, role=$4`,
          [existingId, u.email, u.full_name, u.role, 3000]
        )

        if (u.role === 'user') {
          await seedTransactions(client, existingId)
        }
        results.push({ email: u.email, status: 'already existed, updated' })
        continue
      }

      // Insert profile
      await client.query(
        `INSERT INTO finsage_users (id, email, full_name, role, monthly_budget)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET full_name=$3, role=$4`,
        [userId, u.email, u.full_name, u.role, 3000]
      )

      if (u.role === 'user') {
        await seedTransactions(client, userId)
      }
      results.push({ email: u.email, status: 'created', id: userId })
    }

    return NextResponse.json({ status: 'Seed complete', results })
  } catch (e: unknown) {
    const error = e as Error
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
    await pool.end()
  }
}

async function seedTransactions(client: import('pg').PoolClient, userId: string) {
  const transactions = [
    { amount: 3500, type: 'income', category: 'Salary', description: 'Monthly salary', daysBack: 28 },
    { amount: 500, type: 'income', category: 'Salary', description: 'Freelance payment', daysBack: 15 },
    { amount: randomBetween(50, 120), type: 'expense', category: 'Food', description: 'Grocery shopping', daysBack: 2 },
    { amount: randomBetween(20, 60), type: 'expense', category: 'Food', description: 'Restaurant dinner', daysBack: 5 },
    { amount: randomBetween(30, 80), type: 'expense', category: 'Transport', description: 'Fuel & parking', daysBack: 3 },
    { amount: randomBetween(10, 30), type: 'expense', category: 'Transport', description: 'Uber ride', daysBack: 7 },
    { amount: randomBetween(15, 50), type: 'expense', category: 'Entertainment', description: 'Streaming subscriptions', daysBack: 10 },
    { amount: randomBetween(50, 200), type: 'expense', category: 'Shopping', description: 'Clothing purchase', daysBack: 12 },
    { amount: randomBetween(80, 150), type: 'expense', category: 'Utilities', description: 'Electricity bill', daysBack: 20 },
    { amount: randomBetween(20, 60), type: 'expense', category: 'Health', description: 'Pharmacy', daysBack: 8 },
    { amount: randomBetween(100, 300), type: 'expense', category: 'Education', description: 'Online course', daysBack: 25 },
    { amount: randomBetween(30, 70), type: 'expense', category: 'Food', description: 'Coffee & snacks', daysBack: 1 },
  ]

  for (const txn of transactions) {
    await client.query(
      `INSERT INTO finsage_transactions (user_id, amount, type, category, description, transaction_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, txn.amount, txn.type, txn.category, txn.description, randomDate(txn.daysBack + 5)]
    )
  }

  // Add budgets for current month
  const now = new Date()
  const budgets = [
    { category: 'Food', monthly_limit: 400 },
    { category: 'Transport', monthly_limit: 200 },
    { category: 'Entertainment', monthly_limit: 100 },
    { category: 'Shopping', monthly_limit: 300 },
    { category: 'Utilities', monthly_limit: 200 },
    { category: 'Health', monthly_limit: 150 },
  ]
  for (const b of budgets) {
    await client.query(
      `INSERT INTO finsage_budgets (user_id, category, monthly_limit, month, year)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, category, month, year) DO NOTHING`,
      [userId, b.category, b.monthly_limit, now.getMonth() + 1, now.getFullYear()]
    )
  }
}
