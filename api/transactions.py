"""FinSage transactions endpoint (Python). Replaces app/api/transactions/route.ts.
Self-contained (Vercel builds every api/*.py as a function, so no shared imports)."""
import base64
import json
import os
import urllib.request
import urllib.parse
import urllib.error
from datetime import date
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
ANON = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
REF = SUPABASE_URL.replace("https://", "").split(".")[0]
COOKIE_BASE = f"sb-{REF}-auth-token"


def _http(method, url, headers=None, body=None, timeout=25):
    req = urllib.request.Request(url, data=(body.encode() if isinstance(body, str) else body), method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")


def _token(cookie_header):
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
        d = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode("utf-8", "ignore")
        return json.loads(d).get("access_token")
    except Exception:
        return None


def _user(headers):
    tok = _token(headers.get("cookie"))
    if not tok:
        return None, None
    s, t = _http("GET", f"{SUPABASE_URL}/auth/v1/user", {"apikey": ANON, "Authorization": f"Bearer {tok}"})
    if s != 200:
        return None, None
    try:
        return json.loads(t), tok
    except Exception:
        return None, None


def _rest(method, path, tok, body=None, extra=None):
    h = {"apikey": ANON, "Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return _http(method, f"{SUPABASE_URL}/rest/v1/{path}", h, json.dumps(body) if body is not None else None)


class handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        b = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        user, tok = _user(self.headers)
        if not user:
            return self._json(401, {"error": "Unauthorized"})
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        filters = [f"user_id=eq.{user['id']}", "order=transaction_date.desc", "select=*"]
        if params.get("category"):
            filters.append(f"category=eq.{urllib.parse.quote(params['category'][0])}")
        if params.get("type"):
            filters.append(f"type=eq.{urllib.parse.quote(params['type'][0])}")
        if params.get("start_date"):
            filters.append(f"transaction_date=gte.{params['start_date'][0]}")
        if params.get("end_date"):
            filters.append(f"transaction_date=lte.{params['end_date'][0]}")
        s, t = _rest("GET", "finsage_transactions?" + "&".join(filters), tok)
        if s >= 400:
            return self._json(500, {"error": t})
        return self._json(200, {"transactions": json.loads(t or "[]")})

    def do_POST(self):
        user, tok = _user(self.headers)
        if not user:
            return self._json(401, {"error": "Unauthorized"})
        length = int(self.headers.get("content-length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        if not body.get("amount") or not body.get("type") or not body.get("category"):
            return self._json(400, {"error": "amount, type, and category are required"})
        row = {
            "user_id": user["id"], "amount": float(body["amount"]), "type": body["type"],
            "category": body["category"], "description": body.get("description"),
            "transaction_date": body.get("transaction_date") or date.today().isoformat(),
        }
        s, t = _rest("POST", "finsage_transactions", tok, [row], {"Prefer": "return=representation"})
        if s >= 400:
            return self._json(500, {"error": t})
        data = json.loads(t or "[]")
        return self._json(201, {"transaction": data[0] if data else None})
