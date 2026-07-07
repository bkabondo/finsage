import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TEST_USERS = [
  { email: 'kabondobenjamin1@gmail.com', password: 'Admin@Kabondo123!', full_name: 'Benjamin Kabondo', role: 'admin' },
  { email: 'testuser1@proj.com', password: 'TestUser1@123', full_name: 'Alice Johnson', role: 'user' },
  { email: 'testuser2@proj.com', password: 'TestUser2@123', full_name: 'Bob Smith', role: 'user' },
  { email: 'testuser3@proj.com', password: 'TestUser3@123', full_name: 'Carol Davis', role: 'user' },
]

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

  const { data: { users: existing } } = await admin.auth.admin.listUsers()
  const results: Record<string, unknown>[] = []

  for (const u of TEST_USERS) {
    let userId = existing.find(usr => usr.email === u.email)?.id
    if (!userId) {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: u.email, password: u.password, email_confirm: true,
        user_metadata: { full_name: u.full_name },
      })
      if (authError) { results.push({ email: u.email, error: authError.message }); continue }
      userId = authData.user.id
    }

    const { error: profileErr } = await admin.from('finsage_users').upsert(
      { id: userId, email: u.email, full_name: u.full_name, role: u.role, monthly_budget: 3000 },
      { onConflict: 'id' }
    )
    if (profileErr) { results.push({ email: u.email, error: profileErr.message }); continue }

    if (u.role === 'user') {
      await seedTransactions(admin, userId)
    }
    results.push({ email: u.email, status: 'OK' })
  }

  return NextResponse.json({ seeded: results })
}

async function seedTransactions(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const transactions = [
    { amount: 3500, type: 'income', category: 'Salary', description: 'Monthly salary', daysBack: 28 },
    { amount: 500, type: 'income', category: 'Salary', description: 'Freelance payment', daysBack: 15 },
    { amount: randomBetween(50, 120), type: 'expense', category: 'Food', description: 'Grocery shopping', daysBack: 2 },
    { amount: randomBetween(20, 60), type: 'expense', category: 'Food', description: 'Restaurant dinner', daysBack: 5 },
    { amount: randomBetween(30, 80), type: 'expense', category: 'Transport', description: 'Fuel & parking', daysBack: 3 },
    { amount: randomBetween(15, 50), type: 'expense', category: 'Entertainment', description: 'Streaming subscriptions', daysBack: 10 },
    { amount: randomBetween(80, 150), type: 'expense', category: 'Utilities', description: 'Electricity bill', daysBack: 20 },
  ]
  for (const txn of transactions) {
    await admin.from('finsage_transactions').insert({
      user_id: userId, amount: txn.amount, type: txn.type,
      category: txn.category, description: txn.description,
      transaction_date: randomDate(txn.daysBack + 5),
    })
  }
  const now = new Date()
  const budgets = [
    { category: 'Food', monthly_limit: 400 },
    { category: 'Transport', monthly_limit: 200 },
    { category: 'Entertainment', monthly_limit: 100 },
    { category: 'Utilities', monthly_limit: 200 },
  ]
  for (const b of budgets) {
    await admin.from('finsage_budgets').upsert(
      { user_id: userId, category: b.category, monthly_limit: b.monthly_limit, month: now.getMonth() + 1, year: now.getFullYear() },
      { onConflict: 'user_id,category,month,year' }
    )
  }
}
