import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const type = searchParams.get('type')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  let query = supabase
    .from('finsage_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })

  if (category) query = query.eq('category', category)
  if (type) query = query.eq('type', type)
  if (startDate) query = query.gte('transaction_date', startDate)
  if (endDate) query = query.lte('transaction_date', endDate)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ transactions: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { amount, type, category, description, transaction_date } = body

  if (!amount || !type || !category) {
    return NextResponse.json({ error: 'amount, type, and category are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('finsage_transactions')
    .insert({
      user_id: user.id,
      amount: Number(amount),
      type,
      category,
      description,
      transaction_date: transaction_date || new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ transaction: data }, { status: 201 })
}
