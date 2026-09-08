# StreetCheck findings dashboard

A local dashboard for exploring aggregate and record-level StreetCheck drug-checking results from PostgreSQL.

## Run locally

1. Create a local `.pgpass` file in this folder (it is ignored by Git):

   ```text
   localhost:5432:*:postgres:YOUR_PASSWORD
   ```

2. Start the server:

   ```powershell
   .\.venv\Scripts\python.exe server.py
   ```

3. Open `http://127.0.0.1:8000` in a browser.

If port 8000 is in use, run this before starting the server:

```powershell
$env:PORT = '8001'
```

## Data privacy boundary

The API in `server.py` uses an explicit field allowlist. It does **not** send names, emails, phones, collector/group details, flags, or free-text narratives/notes to the browser. The database remains local; no source records or credentials are stored in this repository.

This dashboard is for exploratory harm-reduction insight and is not a clinical, forensic, or individual-identification tool.
