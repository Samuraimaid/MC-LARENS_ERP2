#!/usr/bin/env bash
set -euo pipefail

# Ejecutar verificaciones de DB en segundo plano solo si se solicita, sin bloquear el arranque de uvicorn
if [ "${RUN_STARTUP_MIGRATIONS:-}" = "true" ]; then
  (
    python backend/scripts/migrate_customers_is_active.py 2>&1 || true
    python backend/scripts/create_customers_validator.py 2>&1 || true
  ) &
fi

# Prefer live host_lan_ip.txt for display; only export SERVER_LAN_IP when forced.
# (Stale SERVER_LAN_IP used to hide the real Wi-Fi/Ethernet address on this PC.)
if [ -f /app/backend/data/host_lan_ip.txt ]; then
  _HOST_LAN_IP="$(head -n 1 /app/backend/data/host_lan_ip.txt | tr -d '\r' | xargs || true)"
  if [ -n "${_HOST_LAN_IP}" ]; then
    echo "host_lan_ip.txt present: ${_HOST_LAN_IP}"
    if [ "${SERVER_LAN_IP_FORCE:-}" = "true" ] || [ "${SERVER_LAN_IP_FORCE:-}" = "1" ]; then
      export SERVER_LAN_IP="${SERVER_LAN_IP:-$_HOST_LAN_IP}"
      echo "SERVER_LAN_IP forced from host file: ${SERVER_LAN_IP}"
    fi
  fi
fi

APP_PORT="${PORT:-8080}"
echo "Starting uvicorn on port ${APP_PORT}..."

if [ $# -gt 0 ]; then
  exec "$@"
else
  exec uvicorn backend.server:app --host 0.0.0.0 --port "${APP_PORT}"
fi
