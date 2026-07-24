"""Shared Supabase auth + REST helper for FinSage Python endpoints.

Reads the Supabase session from request cookies (same as the TS
supabase.auth.getUser()), verifies it, and provides RLS-scoped PostgREST calls.
Validated end-to-end against a real logged-in session.
"""
import base64
import json
import os
import urllib.request
import urllib.parse
import urllib.error
from http.cookies import SimpleCookie

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
ANON = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
REF = SUPABASE_URL.replace("https://", "").split(".")[0]
COOKIE_BASE = f"sb-{REF}-auth-token"


def http(method, url, headers=None, body=None, timeout=25):
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
        decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode("utf-8", "ignore")
        return json.loads(decoded).get("access_token")
    except Exception:
        return None


def verify_user(token):
    if not token:
        return None
    status, text = http("GET", f"{SUPABASE_URL}/auth/v1/user",
                        {"apikey": ANON, "Authorization": f"Bearer {token}"})
    if status != 200:
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def user_from_request(headers):
    """Return (user_dict, access_token) or (None, None)."""
    token = access_token_from_cookies(headers.get("cookie"))
    return verify_user(token), token


def rest(method, path, token, body=None, extra_headers=None):
    """PostgREST call as the authenticated user (RLS applies)."""
    h = {"apikey": ANON, "Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if extra_headers:
        h.update(extra_headers)
    return http(method, f"{SUPABASE_URL}/rest/v1/{path}", h,
                json.dumps(body) if body is not None else None)
