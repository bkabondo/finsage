"""FinSage AI insights endpoint (Python). Replaces app/api/insights/route.ts."""
import base64
import json
import os
import re
import urllib.request
import urllib.parse
import urllib.error
from datetime import date, timedelta
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler

import anthropic

MODEL = "claude-sonnet-4-6"
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
ANON = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
COOKIE_BASE = f"sb-{SUPABASE_URL.replace('https://', '').split('.')[0]}-auth-token"


def _http(method, url, headers=None, body=None, timeout=25):
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
    s, t = _http("GET", f"{SUPABASE_URL}/auth/v1/user", {"apikey": ANON, "Authorization": f"Bearer {tok}"})
    if s != 200:
        return None, None
    try:
        return json.loads(t), tok
    except Exception:
        return None, None


def rest(method, path, tok, body=None, extra_headers=None):
    h = {"apikey": ANON, "Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    if extra_headers:
        h.update(extra_headers)
    return _http(method, f"{SUPABASE_URL}/rest/v1/{path}", h, json.dumps(body) if body is not None else None)


def text_of(resp):
    return "".join(b.text for b in (resp.content or []) if getattr(b, "type", None) == "text")


class handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        b = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        try:
            user, token = user_from_request(self.headers)
            if not user:
                return self._json(401, {"error": "Unauthorized"})

            start = (date.today() - timedelta(days=30)).isoformat()
            status, text = rest(
                "GET",
                f"finsage_transactions?user_id=eq.{user['id']}&transaction_date=gte.{start}"
                "&order=transaction_date.desc&select=*",
                token,
            )
            if status >= 400:
                return self._json(500, {"error": text})
            txns = json.loads(text or "[]")

            _, ptext = rest("GET", f"finsage_users?id=eq.{user['id']}&select=monthly_budget,currency", token)
            profile = (json.loads(ptext or "[]") or [{}])
            profile = profile[0] if profile else {}
            currency = profile.get("currency") or "USD"
            budget = profile.get("monthly_budget")

            total_income = sum(float(t["amount"]) for t in txns if t.get("type") == "income")
            total_expenses = sum(float(t["amount"]) for t in txns if t.get("type") == "expense")
            cat = {}
            for t in txns:
                if t.get("type") == "expense":
                    cat[t["category"]] = cat.get(t["category"], 0) + float(t["amount"])

            cat_lines = "\n".join(f"- {c}: {currency} {a:.2f}" for c, a in cat.items())
            recent = "\n".join(
                f"- {t['transaction_date']}: {'+' if t['type']=='income' else '-'}{currency}{float(t['amount']):.2f} "
                f"({t['category']}) - {t.get('description') or 'No description'}"
                for t in txns[:5]
            )
            prompt = f"""You are FinSage, an AI personal finance coach. Analyze this user's financial data from the last 30 days and provide actionable insights.

Financial Summary:
- Total Income: {currency} {total_income:.2f}
- Total Expenses: {currency} {total_expenses:.2f}
- Net Balance: {currency} {(total_income - total_expenses):.2f}
- Monthly Budget: {currency} {budget if budget is not None else 'Not set'}
- Number of Transactions: {len(txns)}

Expense Breakdown by Category:
{cat_lines}

Recent Transactions (last 5):
{recent}

Please provide:
1. A brief overall financial health assessment (2-3 sentences)
2. Exactly 3 specific, actionable recommendations based on the spending patterns
3. One savings opportunity you noticed

Format your response as JSON with this structure:
{{
  "assessment": "overall health assessment text",
  "recommendations": [
    {{"title": "short title", "detail": "specific actionable advice"}},
    {{"title": "short title", "detail": "specific actionable advice"}},
    {{"title": "short title", "detail": "specific actionable advice"}}
  ],
  "savingsOpportunity": "specific savings tip based on their data"
}}"""

            client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
            msg = client.messages.create(model=MODEL, max_tokens=1200,
                                         messages=[{"role": "user", "content": prompt}])
            m = re.search(r"\{[\s\S]*\}", text_of(msg))
            if not m:
                return self._json(500, {"error": "Could not parse AI response"})
            insights = json.loads(m.group(0))

            return self._json(200, {
                "insights": insights,
                "summary": {
                    "totalIncome": total_income,
                    "totalExpenses": total_expenses,
                    "netBalance": total_income - total_expenses,
                    "transactionCount": len(txns),
                    "categoryBreakdown": cat,
                },
            })
        except Exception as err:  # noqa: BLE001
            return self._json(500, {"error": str(err) or "Unknown error"})
