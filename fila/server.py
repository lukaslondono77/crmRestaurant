#!/usr/bin/env python3
import http.server
import socketserver
import os

PORT = 3000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"✅ Server running at http://localhost:{PORT}/")
        print(f"✅ App (redirect): http://localhost:{PORT}/index.html")
        print(f"✅ Dashboard: http://localhost:{PORT}/core/index.html")
        print(f"✅ Sign-in: http://localhost:{PORT}/core/sign-in.html")
        print(f"📁 Serving directory: {os.getcwd()}")
        print("\nPress Ctrl+C to stop the server\n")
        httpd.serve_forever()
