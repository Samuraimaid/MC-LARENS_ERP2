#!/usr/bin/env bash
set -euo pipefail

# Start only MongoDB and backend (skip frontend build) using docker-compose
# Usage: ./start-backend-only.sh

if ! command -v docker-compose &> /dev/null; then
  echo "docker-compose not found. Install Docker Compose or use 'docker compose'."
  exit 1
fi

echo "Starting MongoDB and backend via docker-compose (backend only)..."
VITE_BACKEND_URL=http://localhost:8001 REACT_APP_BACKEND_URL=http://localhost:8001 docker-compose up -d --build mongodb backend

echo "Backend and MongoDB started (if containers built successfully)."
