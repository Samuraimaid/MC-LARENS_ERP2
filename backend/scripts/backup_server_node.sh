#!/usr/bin/env bash
# =============================================================================
# MC-LARENS ERP — Respaldo dual (interno + USB) — Modelo Delta
# Volcado MongoDB + empaquetado de /app/uploads
# =============================================================================
set -euo pipefail

TIMESTAMP="$(date -u +"%Y%m%d_%H%M%S")"
BRANCH_ID="${BRANCH_ID:-branch_main}"
DB_NAME="${DB_NAME:-mc-larens2_mundo_accesorios_erp}"
MONGO_URI="${MONGODB_LOCAL_URI:-${MONGO_URL:-mongodb://mongodb:27017}}"
UPLOADS_DIR="${LOCAL_UPLOAD_ROOT:-/app/uploads}"
INTERNAL_ROOT="${BACKUP_INTERNAL_ROOT:-/app/backups}"
USB_ROOT="${USB_BACKUP_ROOT:-/mnt/usb_backup}"
ARCHIVE_NAME="erp_delta_backup_${BRANCH_ID}_${TIMESTAMP}.tar.gz"
WORK_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

mkdir -p "${WORK_DIR}/dump" "${WORK_DIR}/uploads" "${INTERNAL_ROOT}" "${USB_ROOT}"

echo "[backup] Iniciando respaldo ${ARCHIVE_NAME}"
echo "[backup] Mongo URI: ${MONGO_URI}"
echo "[backup] Uploads: ${UPLOADS_DIR}"

mongodump \
  --uri="${MONGO_URI}" \
  --db="${DB_NAME}" \
  --out="${WORK_DIR}/dump" \
  --gzip

if [ -d "${UPLOADS_DIR}" ]; then
  cp -a "${UPLOADS_DIR}/." "${WORK_DIR}/uploads/"
else
  echo "[backup] WARN: carpeta de uploads no encontrada (${UPLOADS_DIR})"
fi

cat > "${WORK_DIR}/manifest.json" <<EOF
{
  "schema": "erp_delta_backup_v1",
  "branch_id": "${BRANCH_ID}",
  "database": "${DB_NAME}",
  "created_at_utc": "${TIMESTAMP}",
  "includes": ["mongodump", "uploads"]
}
EOF

tar -czf "${INTERNAL_ROOT}/${ARCHIVE_NAME}" -C "${WORK_DIR}" dump uploads manifest.json
cp "${INTERNAL_ROOT}/${ARCHIVE_NAME}" "${USB_ROOT}/${ARCHIVE_NAME}"

echo "[backup] Copia interna: ${INTERNAL_ROOT}/${ARCHIVE_NAME}"
echo "[backup] Copia USB:     ${USB_ROOT}/${ARCHIVE_NAME}"
echo "[backup] Completado."