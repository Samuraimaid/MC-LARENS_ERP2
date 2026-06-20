#!/usr/bin/env bash
set -euo pipefail

# Start services locally with Docker Compose.
# Usage: ./start-local.sh

if ! command -v docker-compose &> /dev/null; then
  echo "docker-compose not found. Install Docker Compose or use 'docker compose'."
  exit 1
fi

echo "Starting MongoDB and backend via docker-compose..."
VITE_BACKEND_URL=http://localhost:8001 REACT_APP_BACKEND_URL=http://localhost:8001 docker-compose up -d --build

echo "Services started. Backend available at http://localhost:8001 (if container started successfully)."
