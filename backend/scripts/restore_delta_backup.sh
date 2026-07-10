#!/usr/bin/env bash
# =============================================================================
# MC-LARENS ERP — Restauracion Delta desde archivo tar.gz (USB o interno)
# =============================================================================
set -euo pipefail

ARCHIVE="${1:-}"
if [[ -z "${ARCHIVE}" || ! -f "${ARCHIVE}" ]]; then
  echo "[restore] ERROR: archivo no encontrado: ${ARCHIVE:-<vacío>}"
  exit 1
fi

DB_NAME="${DB_NAME:-mc-larens2_mundo_accesorios_erp}"
MONGO_URI="${MONGODB_LOCAL_URI:-${MONGO_URL:-mongodb://mongodb:27017}}"
UPLOADS_DIR="${LOCAL_UPLOAD_ROOT:-/app/uploads}"
WORK_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

echo "[restore] Extrayendo ${ARCHIVE}"
tar -xzf "${ARCHIVE}" -C "${WORK_DIR}"

if [[ -d "${WORK_DIR}/dump/${DB_NAME}" ]]; then
  echo "[restore] mongorestore --gzip --drop (${DB_NAME})"
  mongorestore --uri="${MONGO_URI}" --gzip --drop "${WORK_DIR}/dump/${DB_NAME}"
elif [[ -d "${WORK_DIR}/dump" ]]; then
  echo "[restore] mongorestore --gzip --drop (dump completo)"
  mongorestore --uri="${MONGO_URI}" --gzip --drop "${WORK_DIR}/dump"
else
  echo "[restore] WARN: sin carpeta dump en el archivo"
fi

if [[ -d "${WORK_DIR}/uploads" ]]; then
  mkdir -p "${UPLOADS_DIR}"
  cp -a "${WORK_DIR}/uploads/." "${UPLOADS_DIR}/"
  echo "[restore] uploads restaurados en ${UPLOADS_DIR}"
fi

echo "[restore] Completado."