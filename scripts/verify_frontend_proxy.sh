#!/usr/bin/env bash
FRONTEND_HOST=${1:-http://localhost:3000}
BACKEND_HOST=${2:-http://localhost:8001}
PIN=${3:-010190}

echo "1) host -> frontend (nginx proxy)"
curl -sS -X POST -H "Content-Type: application/json" -d "{\"pin\":\"$PIN\"}" "$FRONTEND_HOST/api/auth/pin/login" || true

echo "\n2) host -> backend directo"
curl -sS -X POST -H "Content-Type: application/json" -d "{\"pin\":\"$PIN\"}" "$BACKEND_HOST/api/auth/pin/login" || true

echo "\n3) desde contenedor frontend (wget)"
# preparar body local
echo "{\"pin\":\"$PIN\"}" > /tmp/mc_larens_body.json
docker cp /tmp/mc_larens_body.json mundo-frontend:/tmp/body.json || true
docker exec mundo-frontend wget --header="Content-Type: application/json" --post-file=/tmp/body.json -O - http://127.0.0.1/api/auth/pin/login || true

echo "\nFin de las pruebas." 
