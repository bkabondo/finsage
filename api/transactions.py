"""FinSage transactions endpoint (Python). Replaces app/api/transactions/route.ts."""
import json
import urllib.parse
from datetime import date
from http.server import BaseHTTPRequestHandler

from _supa import user_from_request, rest


class handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        b = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        user, token = user_from_request(self.headers)
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
        status, text = rest("GET", "finsage_transactions?" + "&".join(filters), token)
        if status >= 400:
            return self._json(500, {"error": text})
        return self._json(200, {"transactions": json.loads(text or "[]")})

    def do_POST(self):
        user, token = user_from_request(self.headers)
        if not user:
            return self._json(401, {"error": "Unauthorized"})
        length = int(self.headers.get("content-length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        if not body.get("amount") or not body.get("type") or not body.get("category"):
            return self._json(400, {"error": "amount, type, and category are required"})
        row = {
            "user_id": user["id"],
            "amount": float(body["amount"]),
            "type": body["type"],
            "category": body["category"],
            "description": body.get("description"),
            "transaction_date": body.get("transaction_date") or date.today().isoformat(),
        }
        status, text = rest("POST", "finsage_transactions", token, [row],
                            {"Prefer": "return=representation"})
        if status >= 400:
            return self._json(500, {"error": text})
        data = json.loads(text or "[]")
        return self._json(201, {"transaction": data[0] if data else None})
