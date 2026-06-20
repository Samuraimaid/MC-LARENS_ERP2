import http.server
import socketserver
import sys
from pathlib import Path


class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        # Try to serve the requested file; if not found, serve index.html (SPA fallback)
        path = self.translate_path(self.path)
        p = Path(path)
        if p.is_file():
            return super().send_head()

        index = Path(self.directory) / "index.html"
        if index.exists():
            self.path = "/index.html"
            return super().send_head()

        return super().send_head()


def run(port: int = 3001, directory: str = "build"):
    handler = SPARequestHandler
    handler.directory = directory
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Serving SPA from {directory} on port {port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Shutting down")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3001
    directory = sys.argv[2] if len(sys.argv) > 2 else "build"
    run(port, directory)
