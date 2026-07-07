import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TICKERS = ['SPY', 'QQQ', 'SCHD', 'VTI', 'AAPL', 'MSFT', 'GOOGL', 'NVDA', 'JPM', 'BRK-B']

interface Quote {
  symbol: string
  name: string
  price: number
  change1d: number      // % change today
  low52: number
  high52: number
  peRatio: number | null
  dividendYield: number | null
  // computed scores
  rangeScore: number    // 0=near 52wk low (cheap), 100=near high (expensive)
  momentumScore: number // % above/below 50-day avg (positive = uptrend)
  compositeScore: number
  type: 'ETF' | 'Stock'
}

async function fetchQuotes(): Promise<Quote[]> {
  const symbols = TICKERS.join(',')
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=shortName,regularMarketPrice,regularMarketChangePercent,fiftyTwoWeekLow,fiftyTwoWeekHigh,trailingPE,trailingAnnualDividendYield,fiftyDayAverage,quoteType`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 300 }, // cache 5 min
  })
  if (!res.ok) throw new Error('Failed to fetch quotes')
  const json = await res.json()
  const results: Quote[] = []

  for (const q of json.quoteResponse?.result ?? []) {
    const price: number = q.regularMarketPrice ?? 0
    const low52: number = q.fiftyTwoWeekLow ?? price
    const high52: number = q.fiftyTwoWeekHigh ?? price
    const avg50: number = q.fiftyDayAverage ?? price

    const range = high52 - low52
    // rangeScore: 0 = at 52wk low (value), 100 = at 52wk high
    const rangeScore = range > 0 ? Math.round(((price - low52) / range) * 100) : 50
    // momentumScore: % above/below 50-day avg
    const momentumScore = avg50 > 0 ? Math.round(((price - avg50) / avg50) * 100) : 0

    // Composite: prefer low range score (value) + positive momentum
    // compositeScore higher = better buy signal
    const compositeScore = Math.round((100 - rangeScore) * 0.5 + Math.min(Math.max(momentumScore, -20), 20) * 1.25 + 50)

    results.push({
      symbol: q.symbol,
      name: q.shortName ?? q.symbol,
      price,
      change1d: q.regularMarketChangePercent ?? 0,
      low52,
      high52,
      peRatio: q.trailingPE ?? null,
      dividendYield: q.trailingAnnualDividendYield ? q.trailingAnnualDividendYield * 100 : null,
      rangeScore,
      momentumScore,
      compositeScore,
      type: q.quoteType === 'ETF' ? 'ETF' : 'Stock',
    })
  }

  return results.sort((a, b) => b.compositeScore - a.compositeScore)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { surplus } = await req.json()
  if (!surplus || surplus <= 0) {
    return NextResponse.json({ error: 'No surplus to invest' }, { status: 400 })
  }

  let quotes: Quote[]
  try {
    quotes = await fetchQuotes()
  } catch {
    return NextResponse.json({ error: 'Could not fetch real-time stock data' }, { status: 502 })
  }

  const top5 = quotes.slice(0, 5)
  const stockSummary = top5.map(q =>
    `${q.symbol} (${q.name}): $${q.price.toFixed(2)}, ` +
    `Day: ${q.change1d >= 0 ? '+' : ''}${q.change1d.toFixed(2)}%, ` +
    `52wk range: $${q.low52.toFixed(2)}–$${q.high52.toFixed(2)}, ` +
    `Range position: ${q.rangeScore}% (0=at low, 100=at high), ` +
    `50d momentum: ${q.momentumScore >= 0 ? '+' : ''}${q.momentumScore}%, ` +
    (q.peRatio ? `P/E: ${q.peRatio.toFixed(1)}, ` : '') +
    (q.dividendYield ? `Dividend: ${q.dividendYield.toFixed(2)}%, ` : '') +
    `Composite score: ${q.compositeScore}/100`
  ).join('\n')

  const prompt = `You are FinSage, a personal finance AI. The user has a surplus of $${surplus.toFixed(2)} to invest RIGHT NOW.

Here are today's top-scoring assets based on value + momentum formulas:
${stockSummary}

Formula used:
- Range Score (0=near 52-week low/value, 100=near 52-week high/expensive)
- Momentum Score (% above/below 50-day moving average; positive = uptrend)
- Composite Score = (100 - rangeScore) × 0.5 + momentum × 1.25 + 50 (higher = better buy signal)

Given a surplus of $${surplus.toFixed(2)}, provide:
1. A specific allocation plan (e.g. "Put $X in SPY, $Y in AAPL") — be concrete with dollar amounts
2. For each pick: why this asset NOW based on the formula data (mention the actual price and range position)
3. One risk caveat
4. Expected outcome if held 6–12 months based on current technicals

Keep advice direct, specific, and grounded in the numbers above. Format as JSON:
{
  "headline": "one-line summary of the strategy",
  "allocations": [
    {
      "symbol": "TICKER",
      "name": "Full Name",
      "amount": 150.00,
      "price": 123.45,
      "rationale": "why this pick, citing actual formula scores and price",
      "signal": "BUY" | "HOLD" | "WATCH"
    }
  ],
  "riskCaveat": "one sentence risk warning",
  "outlook": "expected 6-12 month outcome"
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected AI response' }, { status: 500 })
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
  }

  const advice = JSON.parse(jsonMatch[0])

  return NextResponse.json({ advice, quotes: top5 })
}
