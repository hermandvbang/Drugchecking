"""Local dashboard server for the StreetCheck drug-checking dataset.

The API intentionally returns only analysis fields. It never exposes contact,
collector, group, or narrative fields from the source table.
"""

import json
import os
import subprocess
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8000"))
PSQL = os.environ.get("PSQL_PATH", r"C:\Program Files\PostgreSQL\18\bin\psql.exe")

# This explicit allowlist is the privacy boundary for the browser API.
SAFE_RECORDS_QUERY = '''
SELECT COALESCE(
  json_agg(
    json_build_object(
      'labCode', "Laboratory Code",
      'sampleId', "Sample ID",
      'acquiredOn', "Date Sample Acquired",
      'town', "Town",
      'neighborhood', "Neighborhood",
      'sampleForm', "Sample Form",
      'suspected', "Suspected",
      'soldAs', "Sold/Given As",
      'ftirSubstances', "FTIR Result: Substances",
      'ftsResult', "Overall FTS Result @ 1 mL",
      'xtsResult', "Overall XTS Result @ 1 mL",
      'btsResult', "Overall BTS Result @ 2 mL",
      'ntsResult', "Overall NTS Result @ 1 mL",
      'mtsResult', "Overall MTS Result @ 1 mL",
      'phLevel', "pH Level"
    )
    ORDER BY "Laboratory Code" NULLS LAST
  ),
  '[]'::json
)
FROM "DrugChecking"."streetCheckDrugSamples";
'''


def fetch_safe_records():
    """Read only the public analysis allowlist from local PostgreSQL."""
    environment = os.environ.copy()
    environment.setdefault("PGPASSFILE", str(ROOT / ".pgpass"))
    command = [
        PSQL, "-X", "-w", "-q", "-A", "-t",
        "-U", environment.get("PGUSER", "postgres"),
        "-d", environment.get("PGDATABASE", "postgres"),
        "-c", SAFE_RECORDS_QUERY,
    ]
    completed = subprocess.run(command, capture_output=True, text=True, env=environment, check=True)
    return json.loads(completed.stdout)


class DashboardHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        request_path = unquote(urlparse(self.path).path)
        if any(part.startswith(".") for part in PurePosixPath(request_path).parts):
            self.send_error(404)
            return
        if request_path == "/api/records":
            try:
                payload = json.dumps({"records": fetch_safe_records()}).encode("utf-8")
            except (subprocess.CalledProcessError, json.JSONDecodeError, FileNotFoundError):
                self.send_error(503, "The local database could not be reached.")
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")


if __name__ == "__main__":
    os.chdir(ROOT)
    server = ThreadingHTTPServer((HOST, PORT), DashboardHandler)
    print(f"StreetCheck dashboard is running at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping StreetCheck dashboard.")
    finally:
        server.server_close()
