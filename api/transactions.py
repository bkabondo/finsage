"""FinSage transactions endpoint (Python).

Replaces app/api/transactions/route.ts.
  GET  /api/transactions[?category=&type=&start_date=&end_date=]  -> { transactions }
  POST /api/transactions  { amount, type, category, description?, transaction_date? } -> { transaction }

Auth: reads the Supabase session from the request cookies (same as the TS
supabase.auth.getUser()), verifies it, and queries PostgREST WITH the user's
token so row-level security applies exactly as before.
"""
import base64
import json
import os
import urllib.request
import urllib.parse
import urllib.error
from datetime import date, timedelta  # noqa: F401 (timedelta used elsewhere/kept for parity)
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
ANON = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
# project ref -> cookie name  sb-<ref>-auth-token
REF = SUPABASE_URL.replace("https://", "").split(".")[0]
COOKIE_BASE = f"sb-{REF}-auth-token"


def _http(method, url, headers=None, body=None, timeout=20):
    data = body.encode() if isinstance(body, str) else body
    req = urllib.request.Request(url, data=data, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")


def access_token_from_cookies(cookie_header):
    """Reconstruct the Supabase session cookie (base64- prefixed, possibly
    chunked as .0/.1/...) and return the access_token, or None."""
    if not cookie_header:
        return None
    jar = SimpleCookie()
    try:
        jar.load(cookie_header)
    except Exception:
        return None
    # collect base cookie + numbered chunks in order
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
    raw = "".join(p[1] for p in parts)
    raw = urllib.parse.unquote(raw)
    if raw.startswith("base64-"):
        raw = raw[len("base64-"):]
    try:
        pad = raw + "=" * (-len(raw) % 4)
        decoded = base64.urlsafe_b64decode(pad).decode("utf-8", "ignore")
        session = json.loads(decoded)
        return session.get("access_token")
    except Exception:
        return None


def verify_user(token):
    """Confirm the token with Supabase and return the user dict, or None."""
    if not token:
        return None
    status, text = _http(
        "GET", f"{SUPABASE_URL}/auth/v1/user",
        {"apikey": ANON, "Authorization": f"Bearer {token}"},
    )
    if status != 200:
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def rest(method, path, token, body=None, extra_headers=None):
    """PostgREST call as the authenticated user (RLS applies)."""
    headers = {
        "apikey": ANON,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    return _http(method, f"{SUPABASE_URL}/rest/v1/{path}", headers,
                 json.dumps(body) if body is not None else None)


class handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        b = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _user(self):
        token = access_token_from_cookies(self.headers.get("cookie"))
        user = verify_user(token)
        return user, token

    def do_GET(self):
        user, token = self._user()
        if not user:
            return self._json(401, {"error": "Unauthorized"})
        q = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(q)
        filters = [
            f"user_id=eq.{user['id']}",
            "order=transaction_date.desc",
            "select=*",
        ]
        if params.get("category"):
            filters.append(f"category=eq.{urllib.parse.quote(params['category'][0])}")
        if params.get("type"):
            filters.append(f"type=eq.{urllib.parse.quote(params['type'][0])}")
        if params.get("start_date"):
            filters.append(f"transaction_date=gte.{params['start_date'][0]}")
        if params.get("end_date"):
            filters.append(f"transaction_date=lte.{params['end_date'][0]}")
        status, text = rest("GET", "finsage_transactions?" + "&".join(filters), token)
        if status >= 400:
            return self._json(500, {"error": text})
        return self._json(200, {"transactions": json.loads(text or "[]")})

    def do_POST(self):
        user, token = self._user()
        if not user:
            return self._json(401, {"error": "Unauthorized"})
        length = int(self.headers.get("content-length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        amount, typ, category = body.get("amount"), body.get("type"), body.get("category")
        if not amount or not typ or not category:
            return self._json(400, {"error": "amount, type, and category are required"})
        row = {
            "user_id": user["id"],
            "amount": float(amount),
            "type": typ,
            "category": category,
            "description": body.get("description"),
            "transaction_date": body.get("transaction_date") or date.today().isoformat(),
        }
        status, text = rest("POST", "finsage_transactions", token, [row],
                            {"Prefer": "return=representation"})
        if status >= 400:
            return self._json(500, {"error": text})
        data = json.loads(text or "[]")
        return self._json(201, {"transaction": data[0] if data else None})
