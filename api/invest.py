"""FinSage invest endpoint (Python). Replaces app/api/invest/route.ts."""
import base64
import json
import os
import re
import urllib.request
import urllib.parse
import urllib.error
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler

import anthropic

MODEL = "claude-sonnet-4-6"
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
ANON = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
COOKIE_BASE = f"sb-{SUPABASE_URL.replace('https://', '').split('.')[0]}-auth-token"


def http(method, url, headers=None, body=None, timeout=25):
    req = urllib.request.Request(url, data=(body.encode() if isinstance(body, str) else body), method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")


def _tok(cookie_header):
    if not cookie_header:
        return None
    jar = SimpleCookie()
    try:
        jar.load(cookie_header)
    except Exception:
        return None
    parts = []
    if COOKIE_BASE in jar:
        parts.append((-1, jar[COOKIE_BASE].value))
    i = 0
    while f"{COOKIE_BASE}.{i}" in jar:
        parts.append((i, jar[f"{COOKIE_BASE}.{i}"].value))
        i += 1
    if not parts:
        return None
    parts.sort(key=lambda p: p[0])
    raw = urllib.parse.unquote("".join(p[1] for p in parts))
    if raw.startswith("base64-"):
        raw = raw[len("base64-"):]
    try:
        return json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode("utf-8", "ignore")).get("access_token")
    except Exception:
        return None


def user_from_request(headers):
    tok = _tok(headers.get("cookie"))
    if not tok:
        return None, None
    s, t = http("GET", f"{SUPABASE_URL}/auth/v1/user", {"apikey": ANON, "Authorization": f"Bearer {tok}"})
    if s != 200:
        return None, None
    try:
        return json.loads(t), tok
    except Exception:
        return None, None
TICKERS = ["SPY", "QQQ", "SCHD", "VTI", "AAPL", "MSFT", "GOOGL", "NVDA", "JPM", "BRK-B"]


def text_of(resp):
    return "".join(b.text for b in (resp.content or []) if getattr(b, "type", None) == "text")


def fetch_quotes():
    symbols = ",".join(TICKERS)
    url = ("https://query1.finance.yahoo.com/v7/finance/quote?symbols=" + symbols +
           "&fields=shortName,regularMarketPrice,regularMarketChangePercent,fiftyTwoWeekLow,"
           "fiftyTwoWeekHigh,trailingPE,trailingAnnualDividendYield,fiftyDayAverage,quoteType")
    status, text = http("GET", url, {"User-Agent": "Mozilla/5.0"})
    if status >= 400:
        raise RuntimeError("Failed to fetch quotes")
    data = json.loads(text)
    out = []
    for q in (data.get("quoteResponse", {}).get("result") or []):
        price = q.get("regularMarketPrice") or 0
        low52 = q.get("fiftyTwoWeekLow") or price
        high52 = q.get("fiftyTwoWeekHigh") or price
        avg50 = q.get("fiftyDayAverage") or price
        rng = high52 - low52
        range_score = round(((price - low52) / rng) * 100) if rng > 0 else 50
        momentum = round(((price - avg50) / avg50) * 100) if avg50 > 0 else 0
        composite = round((100 - range_score) * 0.5 + min(max(momentum, -20), 20) * 1.25 + 50)
        out.append({
            "symbol": q.get("symbol"),
            "name": q.get("shortName") or q.get("symbol"),
            "price": price,
            "change1d": q.get("regularMarketChangePercent") or 0,
            "low52": low52, "high52": high52,
            "peRatio": q.get("trailingPE"),
            "dividendYield": (q.get("trailingAnnualDividendYield") * 100) if q.get("trailingAnnualDividendYield") else None,
            "rangeScore": range_score, "momentumScore": momentum, "compositeScore": composite,
            "type": "ETF" if q.get("quoteType") == "ETF" else "Stock",
        })
    return sorted(out, key=lambda x: x["compositeScore"], reverse=True)


class handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        b = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        user, _ = user_from_request(self.headers)
        if not user:
            return self._json(401, {"error": "Unauthorized"})
        length = int(self.headers.get("content-length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        surplus = body.get("surplus")
        if not surplus or surplus <= 0:
            return self._json(400, {"error": "No surplus to invest"})
        try:
            quotes = fetch_quotes()
        except Exception:
            return self._json(502, {"error": "Could not fetch real-time stock data"})

        top5 = quotes[:5]
        summary = "\n".join(
            f"{q['symbol']} ({q['name']}): ${q['price']:.2f}, "
            f"Day: {'+' if q['change1d'] >= 0 else ''}{q['change1d']:.2f}%, "
            f"52wk range: ${q['low52']:.2f}–${q['high52']:.2f}, "
            f"Range position: {q['rangeScore']}% (0=at low, 100=at high), "
            f"50d momentum: {'+' if q['momentumScore'] >= 0 else ''}{q['momentumScore']}%, "
            + (f"P/E: {q['peRatio']:.1f}, " if q.get("peRatio") else "")
            + (f"Dividend: {q['dividendYield']:.2f}%, " if q.get("dividendYield") else "")
            + f"Composite score: {q['compositeScore']}/100"
            for q in top5
        )
        prompt = f"""You are FinSage, a personal finance AI. The user has a surplus of ${surplus:.2f} to invest RIGHT NOW.

Here are today's top-scoring assets based on value + momentum formulas:
{summary}

Formula used:
- Range Score (0=near 52-week low/value, 100=near 52-week high/expensive)
- Momentum Score (% above/below 50-day moving average; positive = uptrend)
- Composite Score = (100 - rangeScore) × 0.5 + momentum × 1.25 + 50 (higher = better buy signal)

Given a surplus of ${surplus:.2f}, provide:
1. A specific allocation plan (e.g. "Put $X in SPY, $Y in AAPL") — be concrete with dollar amounts
2. For each pick: why this asset NOW based on the formula data (mention the actual price and range position)
3. One risk caveat
4. Expected outcome if held 6–12 months based on current technicals

Keep advice direct, specific, and grounded in the numbers above. Format as JSON:
{{
  "headline": "one-line summary of the strategy",
  "allocations": [
    {{
      "symbol": "TICKER",
      "name": "Full Name",
      "amount": 150.00,
      "price": 123.45,
      "rationale": "why this pick, citing actual formula scores and price",
      "signal": "BUY" | "HOLD" | "WATCH"
    }}
  ],
  "riskCaveat": "one sentence risk warning",
  "outlook": "expected 6-12 month outcome"
}}"""
        try:
            client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
            msg = client.messages.create(model=MODEL, max_tokens=1500,
                                         messages=[{"role": "user", "content": prompt}])
            m = re.search(r"\{[\s\S]*\}", text_of(msg))
            if not m:
                return self._json(500, {"error": "Could not parse AI response"})
            return self._json(200, {"advice": json.loads(m.group(0)), "quotes": top5})
        except Exception as err:  # noqa: BLE001
            return self._json(500, {"error": str(err) or "Unknown error"})
