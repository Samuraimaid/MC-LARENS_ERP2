#!/usr/bin/env bash
# Script para auditar dependencias de frontend y backend
set -euo pipefail

echo "==> Auditing Python dependencies (pip-audit)"
if command -v pip-audit >/dev/null 2>&1; then
  pip-audit --format text || true
else
  echo "pip-audit not found. Install with: python -m pip install pip-audit"
fi

echo "==> Auditing npm dependencies (npm audit)"
if command -v npm >/dev/null 2>&1; then
  (cd frontend && npm audit --json > ../frontend_npm_audit.json) || true
  echo "npm audit output written to frontend_npm_audit.json"
else
  echo "npm not found"
fi

echo "Done"
