#!/usr/bin/env python3
"""
FlowMaster — local launcher.
Service workers (offline mode) require http://, not file://. This serves the
app on http://localhost:8000 and opens it in your browser.

Run:  python3 serve.py     (or double-click on most systems)
Stop: Ctrl+C
"""
import http.server, socketserver, webbrowser, os, threading

PORT = 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Ensure correct MIME for the manifest + no aggressive caching while developing
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def log_message(self, *a):  # quieter console
        pass

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    url = f"http://localhost:{PORT}/index.html"
    print(f"FlowMaster running at {url}\nPress Ctrl+C to stop.")
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
