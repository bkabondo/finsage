"""FinSage delete-transaction endpoint (Python). Replaces app/api/transactions/[id]/route.ts.
  DELETE /api/transactions/<id>  ->  { success: true }
"""
import json
import sys
import os
import urllib.parse
from http.server import BaseHTTPRequestHandler

# allow importing the sibling helper from the parent api/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _supa import user_from_request, rest  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        b = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_DELETE(self):
        user, token = user_from_request(self.headers)
        if not user:
            return self._json(401, {"error": "Unauthorized"})
        # id is the last path segment
        path = urllib.parse.urlparse(self.path).path.rstrip("/")
        txn_id = path.rsplit("/", 1)[-1]
        status, text = rest(
            "DELETE",
            f"finsage_transactions?id=eq.{urllib.parse.quote(txn_id)}&user_id=eq.{user['id']}",
            token,
        )
        if status >= 400:
            return self._json(500, {"error": text})
        return self._json(200, {"success": True})
