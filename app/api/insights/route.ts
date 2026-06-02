import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get last 30 days of transactions
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const startDate = thirtyDaysAgo.toISOString().split('T')[0]

  const { data: transactions, error: txnError } = await supabase
    .from('finsage_transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('transaction_date', startDate)
    .order('transaction_date', { ascending: false })

  if (txnError) {
    return NextResponse.json({ error: txnError.message }, { status: 500 })
  }

  // Get user profile for budget context
  const { data: profile } = await supabase
    .from('finsage_users')
    .select('monthly_budget, currency')
    .eq('id', user.id)
    .single()

  const totalIncome = transactions
    ?.filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0

  const totalExpenses = transactions
    ?.filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0

  const categoryBreakdown = transactions
    ?.filter((t) => t.type === 'expense')
    .reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
      return acc
    }, {})

  const prompt = `You are FinSage, an AI personal finance coach. Analyze this user's financial data from the last 30 days and provide actionable insights.

Financial Summary:
- Total Income: ${profile?.currency ?? 'USD'} ${totalIncome.toFixed(2)}
- Total Expenses: ${profile?.currency ?? 'USD'} ${totalExpenses.toFixed(2)}
- Net Balance: ${profile?.currency ?? 'USD'} ${(totalIncome - totalExpenses).toFixed(2)}
- Monthly Budget: ${profile?.currency ?? 'USD'} ${profile?.monthly_budget ?? 'Not set'}
- Number of Transactions: ${transactions?.length ?? 0}

Expense Breakdown by Category:
${Object.entries(categoryBreakdown ?? {}).map(([cat, amt]) => `- ${cat}: ${profile?.currency ?? 'USD'} ${(amt as number).toFixed(2)}`).join('\n')}

Recent Transactions (last 5):
${transactions?.slice(0, 5).map((t) => `- ${t.transaction_date}: ${t.type === 'income' ? '+' : '-'}${profile?.currency ?? 'USD'}${Number(t.amount).toFixed(2)} (${t.category}) - ${t.description || 'No description'}`).join('\n')}

Please provide:
1. A brief overall financial health assessment (2-3 sentences)
2. Exactly 3 specific, actionable recommendations based on the spending patterns
3. One savings opportunity you noticed

Format your response as JSON with this structure:
{
  "assessment": "overall health assessment text",
  "recommendations": [
    {"title": "short title", "detail": "specific actionable advice"},
    {"title": "short title", "detail": "specific actionable advice"},
    {"title": "short title", "detail": "specific actionable advice"}
  ],
  "savingsOpportunity": "specific savings tip based on their data"
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response from AI' }, { status: 500 })
  }

  // Extract JSON from the response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
  }

  const insights = JSON.parse(jsonMatch[0])

  return NextResponse.json({
    insights,
    summary: {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      transactionCount: transactions?.length ?? 0,
      categoryBreakdown,
    },
  })
}
