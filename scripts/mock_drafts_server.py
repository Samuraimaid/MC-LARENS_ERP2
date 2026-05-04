#!/usr/bin/env python3
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

HOST = '127.0.0.1'
PORT = 8001

_store = {"entries": []}

class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def do_GET(self):
        p = urlparse(self.path)
        if p.path == '/api/drafts/backup':
            self._send(200, {"entries": _store.get("entries", [])})
            return
        self._send(404, {"detail": "Not Found"})

    def do_POST(self):
        p = urlparse(self.path)
        if p.path == '/api/drafts/backup':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8') if length else ''
            try:
                payload = json.loads(body) if body else {}
            except Exception:
                self._send(400, {"detail": "Invalid JSON"})
                return
            entries = payload.get('entries') if isinstance(payload, dict) else None
            if entries is None:
                self._send(400, {"detail": "No entries provided"})
                return
            _store['entries'] = entries
            self._send(200, {"status": "ok"})
            return
        self._send(404, {"detail": "Not Found"})

    def do_DELETE(self):
        p = urlparse(self.path)
        if p.path == '/api/drafts/backup':
            _store['entries'] = []
            self._send(200, {"status": "deleted"})
            return
        self._send(404, {"detail": "Not Found"})

    def log_message(self, format, *args):
        return

if __name__ == '__main__':
    server = HTTPServer((HOST, PORT), Handler)
    print(f"Mock drafts server running at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
        print("Server stopped")
