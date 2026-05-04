Backup and restore instructions for MC-LARENS ERP

This archive contains the project files necessary to run the app on another machine with VS Code.

Included: source code, docker-compose, scripts, tests, and build config.
Excluded from ZIP: node_modules, frontend/build, .git, Docker volumes and large test artifacts.

Prerequisites on target machine
- Windows 10/11 or Linux/macOS
- VS Code
- Git
- Docker Desktop (with Compose support)
- Node.js 18+ and npm
- Python 3.11

Low-resource recommendation profile
- For Docker-only usage, Docker Desktop is the only mandatory runtime dependency; Node.js and Python are only needed for local development, tests, or manual recovery tasks.
- On older mobile CPUs or entry-level office PCs, prefer Docker Desktop with 2 CPUs and 4 to 6 GB of RAM assigned.
- Keep at least 15 GB of free disk space to avoid slow image extraction and MongoDB volume growth issues.
- Close browsers with many tabs, other local servers, and heavy IDE tasks before the first `docker compose build`.

Restore and run (quick start)
1. Unzip the archive to a working folder and open the folder in VS Code.
2. Start Docker and ensure it has enough resources (2+ CPUs, 4+ GB RAM).
3. From a powershell in project root, build and run services:

```powershell
# build and run backend, frontend and mongodb
docker compose up -d --build
```

4. Backend API will be available on http://localhost:8001 and frontend on http://localhost:3000.

Low-resource startup flow for the 3 containers
1. Run the first build with no other heavy apps open:

```powershell
docker compose build mongodb backend frontend
```

2. Start the data and API containers first:

```powershell
docker compose up -d mongodb backend
```

3. Start the frontend after backend is healthy enough to answer requests:

```powershell
docker compose up -d frontend
```

4. For daily use, avoid rebuilding all services unless dependencies changed. Prefer:

```powershell
docker compose up -d
```

5. Rebuild only the service that changed:

```powershell
docker compose build frontend
docker compose up -d frontend
```

```powershell
docker compose build backend
docker compose up -d backend
```

Operational notes for slower machines
- Do not use `docker compose down --volumes` as a normal shutdown path; it forces MongoDB to reinitialize and increases the next startup time.
- Reserve full rebuilds (`docker compose up -d --build`) for dependency changes, Dockerfile changes, or cache-related incidents.
- If Docker Desktop feels slow on Windows 11, keep WSL2 enabled and avoid running backend locally with Python at the same time as the 3-container stack.
- The first frontend build is usually the slowest step on low-power CPUs; later starts should be noticeably faster if images and volumes are preserved.

If you prefer to run locally without Docker
- Backend: create a Python virtual env and install requirements from `backend/requirements.txt` then run:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
uvicorn backend.server:app --reload --port 8002
```

- Frontend: install dependencies and run dev server

```powershell
cd frontend
npm ci
npm start
```

Running tests
- Python unit tests (backend): run pytest from repo root
- Playwright E2E: from `frontend` run `npx playwright test --project=chromium`

Notes
- If you have large `node_modules` or built files, the ZIP excludes them to keep size small. After restoring, run `npm ci` in `frontend` and `pip install -r backend/requirements.txt` to rehydrate dependencies.
- If you want a full archive (including node_modules), run `npm ci` then create the archive manually (not recommended due to size).

Core data seed (users, customers, inventory)
- The repository now includes a seed snapshot at `backend/data/seeds/core_seed.json`.
- Backend startup autoloads this seed only when DB is empty (controlled by `AUTOLOAD_CORE_SEED`, default `true` in `docker-compose.yml`).
- This protects core data after a full rebuild with a fresh Mongo volume.

Refresh seed with current production-like data
1. Ensure containers are running (`docker compose up -d`).
2. Run export script from backend container DB context:

```powershell
docker cp .\scripts\export_core_seed.py mundo-backend:/tmp/export_core_seed.py
docker exec -e OUTPUT_FILE=/app/backend/data/seeds/core_seed.json mundo-backend python /tmp/export_core_seed.py
docker cp mundo-backend:/app/backend/data/seeds/core_seed.json .\backend\data\seeds\core_seed.json
```

Manual import into an existing DB (optional)

```powershell
python scripts/import_core_seed.py
```

Use overwrite mode only if you want to replace existing rows by unique keys:

```powershell
$env:OVERWRITE='true'; python scripts/import_core_seed.py
```

Contact
If anything fails, open an issue or ask for help with the exact error and OS details.
