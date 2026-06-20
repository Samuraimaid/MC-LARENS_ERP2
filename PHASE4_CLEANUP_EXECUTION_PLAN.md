# PHASE 4: CLEANUP EXECUTION PLAN

## Overview

Phase 5 will execute repository cleanup in **3 safe microphases**:
1. **Microphase 1**: Cache & temporary files (0 risk)
2. **Microphase 2**: Dependency cleanup (low risk, regenerable)
3. **Microphase 3**: Build artifacts & legacy structures (safe, verified)

Each microphase includes **pre-checks**, **execution steps**, **validation**, and **rollback procedures**.

---

## Pre-Cleanup Requirements

### ✅ Must Verify Before Starting Any Cleanup

- [ ] Current branch: `git status` shows no uncommitted changes
- [ ] Latest commit saved: `git log --oneline -5`
- [ ] Backup created: `7z a repo_backup_$(date +%Y%m%d).7z .`
- [ ] Docker running: `docker version`
- [ ] All services stopped: `docker compose down`
- [ ] Current tests passing: `pytest backend/tests -q`
- [ ] Current build successful: `npm --prefix frontend run build`

---

## PHASE 5 MICROPHASE 1: Cache & Temporary Files Cleanup

**Duration**: ~5 minutes
**Risk Level**: 🟢 **ZERO** (always regenerated)
**Rollback**: Not needed (deletions auto-recover on next tool run)

### Microphase 1 Execution

#### Step 1: Delete Python Cache

```bash
# Find and delete all __pycache__ directories
find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# Verify deletion
find backend -type d -name __pycache__ | wc -l
# Expected: 0
```

#### Step 2: Delete Python Cache (Root)

```bash
# If any __pycache__ exists in root or other locations
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
```

#### Step 3: Delete pytest Cache

```bash
# Delete pytest cache
rm -rf backend/.pytest_cache
rm -rf .pytest_cache

# Verify
ls backend/.pytest_cache 2>/dev/null && echo "Cache exists" || echo "Cache deleted"
```

#### Step 4: Delete mypy Cache

```bash
# Delete mypy cache
rm -rf backend/.mypy_cache
rm -rf .mypy_cache

# Verify
ls backend/.mypy_cache 2>/dev/null && echo "Cache exists" || echo "Cache deleted"
```

#### Step 5: Delete ESLint Cache

```bash
# Delete ESLint cache (frontend)
rm -f frontend/.eslintcache

# Verify
ls frontend/.eslintcache 2>/dev/null && echo "Cache exists" || echo "Cache deleted"
```

#### Step 6: Delete Coverage Reports

```bash
# Delete coverage data
rm -f .coverage
rm -rf htmlcov

# Verify
ls .coverage 2>/dev/null && echo "Coverage exists" || echo "Coverage deleted"
```

### Microphase 1 Validation

```bash
# 1. Verify cache deletion
echo "=== Cache verification ==="
find backend -name __pycache__ | wc -l      # Expected: 0
ls backend/.pytest_cache 2>/dev/null || echo "✅ No pytest cache"
ls backend/.mypy_cache 2>/dev/null || echo "✅ No mypy cache"
ls frontend/.eslintcache 2>/dev/null || echo "✅ No eslint cache"

# 2. Verify tools still work (regenerate caches)
echo "=== Regeneration test ==="
cd frontend && npm run lint && cd ..        # Will regenerate .eslintcache
pytest backend/tests -q 2>/dev/null || true  # Will regenerate pytest cache

# 3. Check disk space saved
du -sh backend/ frontend/
```

### Microphase 1 Rollback

Not needed — caches auto-regenerate on tool execution.

---

## PHASE 5 MICROPHASE 2: Dependency Cleanup

**Duration**: ~30 minutes (includes validation)
**Risk Level**: 🟡 **LOW** (regenerable, needs Docker validation)
**Rollback**: `npm ci` + `pip install`

### Prerequisites for Microphase 2

```bash
# Ensure Docker is running
docker --version

# Ensure package locks exist
ls frontend/package-lock.json   # Expected: exists ✅
ls backend/requirements.txt     # Expected: exists ✅
```

### Microphase 2 Execution

#### Step 1: Delete frontend/node_modules (Local)

```bash
# Delete frontend node_modules
rm -rf frontend/node_modules

# Verify deletion
ls frontend/node_modules 2>/dev/null && echo "Error: still exists" || echo "✅ Deleted"
```

#### Step 2: Delete .venv (Local)

```bash
# Delete virtual environment
rm -rf .venv

# Verify deletion
ls .venv 2>/dev/null && echo "Error: still exists" || echo "✅ Deleted"
```

#### Step 3: Verify package lock files intact

```bash
# Must have lock files for regeneration
ls frontend/package-lock.json  && echo "✅ Lock file exists"
ls backend/requirements.txt && echo "✅ Requirements exist"
```

### Microphase 2 Validation

#### Validation 1: Docker Frontend Build

```bash
cd frontend

# Build Docker image (will npm ci internally)
docker build -t mundo-frontend-test:validation \
  -f Dockerfile \
  --build-arg VITE_BACKEND_URL="http://localhost:8001" .

# Expected: Build succeeds, new node_modules created inside container
```

#### Validation 2: Docker Backend Build

```bash
cd backend

# Build Docker image (will pip install internally)
docker build -t mundo-backend-test:validation -f Dockerfile .

# Expected: Build succeeds, new packages installed inside container
```

#### Validation 3: Local Regeneration

```bash
# Regenerate frontend dependencies
cd frontend && npm ci && cd ..

# Verify
ls frontend/node_modules/react && echo "✅ Frontend deps regenerated"

# Test build
npm --prefix frontend run build

# Expected: Build completes successfully, outputs to frontend/build/
```

#### Validation 4: Local Python Regeneration

```bash
# Create new virtual environment
python -m venv .venv

# Activate (Windows: .venv\Scripts\Activate.ps1; Unix: source .venv/bin/activate)
source .venv/bin/activate  # Unix
# or
.venv\Scripts\Activate.ps1  # Windows PowerShell

# Install requirements
pip install -r backend/requirements.txt

# Test
pytest backend/tests -q

# Expected: Tests pass
```

### Microphase 2 Rollback

If any validation fails:

```bash
# Rollback frontend
cd frontend && npm ci && cd ..

# Rollback backend
python -m venv .venv && \
source .venv/bin/activate && \
pip install -r backend/requirements.txt
```

---

## PHASE 5 MICROPHASE 3: Build Artifacts & Legacy Structures

**Duration**: ~10 minutes
**Risk Level**: 🟢 **ZERO** (verified safe in deployment check)
**Rollback**: `git checkout`

### Microphase 3 Execution

#### Step 1: Delete frontend/frontend/ (Critical Finding)

```bash
# Backup first (safety)
7z a frontend_frontend_backup_$(date +%Y%m%d_%H%M%S).7z frontend/frontend/

# Delete
rm -rf frontend/frontend

# Verify
ls frontend/frontend 2>/dev/null && echo "Error: still exists" || echo "✅ Deleted 49.21MB artifact"
```

#### Step 2: Delete frontend/build/

```bash
# Delete Vite build output (will regenerate)
rm -rf frontend/build

# Verify
ls frontend/build 2>/dev/null && echo "Error: still exists" || echo "✅ Deleted build output"
```

#### Step 3: Clean Other Build Artifacts (If Found)

```bash
# Delete any other build outputs
rm -rf frontend/dist        # If Next.js build exists
rm -rf backend/build        # If exists
rm -f backend/build.log     # If exists

# Verify
echo "=== Build artifacts cleanup ==="
find . -maxdepth 2 -type d -name "build" -o -name "dist" | grep -v node_modules || echo "✅ No remaining build artifacts"
```

### Microphase 3 Validation

#### Validation 1: Docker Compose Build

```bash
# Full rebuild from scratch
docker compose build --no-cache frontend backend

# Expected: Both build successfully
# - frontend: npm ci + vite build + nginx setup
# - backend: pip install + uvicorn setup
```

#### Validation 2: Docker Compose Up

```bash
# Start all services
docker compose up -d

# Wait for startup
sleep 10

# Verify all running
docker compose ps

# Expected: 3 services running (mongodb, backend, frontend)
```

#### Validation 3: Health Checks

```bash
# Frontend health
curl http://localhost:3000/

# Backend health
curl http://localhost:8001/api/

# Expected: Both respond with 200 OK
```

#### Validation 4: Full Integration

```bash
# Navigate in browser
# http://localhost:3000/login → page loads
# Try PIN login with test user

# Check console for errors
docker logs mundo-frontend  # Should not show errors
docker logs mundo-backend   # Should not show errors
```

#### Validation 5: Tests Pass

```bash
# Backend tests
pytest backend/tests -q

# Frontend linting
npm --prefix frontend run lint

# Expected: All pass
```

### Microphase 3 Rollback

If any issue:

```bash
# Restore frontend/frontend if needed
7z x frontend_frontend_backup_*.7z

# Restore frontend/build
npm --prefix frontend run build

# Restart Docker
docker compose down
docker compose up --build -d
```

---

## .gitignore Updates (All Microphases)

After cleanup, update .gitignore to prevent future reintroduction:

```bash
# Create or update .gitignore in root
cat >> .gitignore << 'EOF'

# === Phase 5 Cleanup Additions ===

# Python cache
__pycache__/
*.py[cod]
*$py.class
.pytest_cache/
.mypy_cache/
.coverage
htmlcov/

# Virtual environments
.venv/
venv/
env/

# npm packages & cache
frontend/node_modules/
frontend/.eslintcache
frontend/.parcel-cache

# Build outputs (always regenerated)
frontend/build/
frontend/dist/
backend/build/

# Legacy/migration artifacts
frontend/frontend/  # CRA→Vite migration artifact

# OS/IDE files
.DS_Store
.vscode/*local*
*.swp
EOF
```

---

## Cleanup Timeline & Execution Order

### Recommended Execution Sequence

**Day 1: Microphase 1 (Cache)**
- ⏱️ 5 minutes
- 💾 ~5-10MB saved
- Risk: ZERO

**Day 1-2: Microphase 2 (Dependencies) + Validation**
- ⏱️ 30 minutes
- 💾 ~235MB saved (local disk)
- Risk: LOW (regenerable, needs Docker test)

**Day 2: Microphase 3 (Artifacts) + Full Validation**
- ⏱️ 10 minutes
- 💾 ~50MB saved
- Risk: ZERO (verified safe)

**Total Time**: ~45 minutes
**Total Space Saved**: ~295MB (73% footprint reduction)

---

## Parallel Cleanup (Alternative: Single Session)

If cleanup in one session is preferred:

```bash
# 1. Pre-checks (5 min)
git status && docker version && pytest backend/tests -q

# 2. Backup (5 min)
7z a full_backup_$(date +%Y%m%d).7z .

# 3. Execute all microphases (20 min)
# ... run all steps from above ...

# 4. Validate all microphases (15 min)
docker compose build --no-cache
docker compose up -d
curl http://localhost:3000/
pytest backend/tests -q

# 5. Commit changes (5 min)
git add .
git commit -m "Phase 5: Complete cleanup (remove artifacts, cache, regenerables)"
```

---

## Success Criteria

✅ **Cleanup is successful if**:

- [x] All cache directories deleted or ignore
- [x] node_modules regenerate from package-lock.json
- [x] .venv regenerates from requirements.txt
- [x] frontend/frontend deleted (49.21MB saved)
- [x] frontend/build deleted and regenerates
- [x] Docker builds succeed without frontend/frontend
- [x] All services start: `docker compose up -d`
- [x] Health endpoints respond (frontend: 3000, backend: 8001)
- [x] Tests pass: `pytest backend/tests -q`
- [x] Lint passes: `npm --prefix frontend run lint`
- [x] .gitignore updated to prevent reintroduction
- [x] Commit message documents cleanup

---

## Failure Scenarios & Recovery

### Scenario 1: Docker Build Fails

**Symptom**: `docker compose build` fails with error about missing files

**Recovery**:
```bash
# Restore from backup
7z x full_backup_*.7z

# Or regenerate from git
git checkout .

# Or restore specific folder
7z x frontend_frontend_backup_*.7z
```

### Scenario 2: Tests Fail After Cleanup

**Symptom**: `pytest backend/tests -q` shows failures

**Recovery**:
```bash
# Regenerate dependencies
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# Rerun tests
pytest backend/tests -q
```

### Scenario 3: npm Build Fails

**Symptom**: `npm --prefix frontend run build` fails

**Recovery**:
```bash
# Regenerate frontend dependencies
cd frontend && npm ci && npm run build && cd ..
```

---

## Post-Cleanup Verification (1 Week)

After Phase 5 cleanup completion, verify:

- [x] New clone from git works: `git clone ... && cd ... && docker compose up --build`
- [x] CI/CD pipeline passes (if applicable)
- [x] Docker images build faster (measure time)
- [x] No regressions in functionality

---

## Next Document: IGNORE_STRATEGY.md

Will cover:
- .gitignore optimization
- .dockerignore creation
- Backup & archive strategies
- Prevention of future bloat
