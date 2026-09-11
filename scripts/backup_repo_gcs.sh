#!/bin/bash
# ==============================================================================
# 🏎️ MC-LARENS ERP 2.0 - SCRIPT DE RESPALDO A GOOGLE CLOUD STORAGE (GCS)
# ==============================================================================
# Este script crea un Git Bundle con el 100% de los commits, ramas y código,
# y lo sube de forma segura a un bucket de Google Cloud Storage.

set -e

PROJECT_ID="gen-lang-client-0971793042"
BUCKET_NAME="gs://mclarens-erp-repo-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BUNDLE_NAME="mclarens_erp_backup_${TIMESTAMP}.bundle"
LATEST_BUNDLE_NAME="mclarens_erp_backup_latest.bundle"

echo "📦 1. Creando bucket en Google Cloud Storage si no existe..."
gsutil mb -p "$PROJECT_ID" -c standard -l us-central1 "$BUCKET_NAME" 2>/dev/null || true

echo "📦 2. Generando paquete maestro autónomo de Git (Git Bundle)..."
cd ~/MC-LARENS_ERP2
git bundle create "$BUNDLE_NAME" --all

echo "☁️ 3. Subiendo respaldo a Google Cloud Storage ($BUCKET_NAME)..."
gsutil cp "$BUNDLE_NAME" "$BUCKET_NAME/$BUNDLE_NAME"
gsutil cp "$BUNDLE_NAME" "$BUCKET_NAME/$LATEST_BUNDLE_NAME"

echo "🧹 4. Limpiando archivo local temporal..."
rm -f "$BUNDLE_NAME"

echo ""
echo "✅ ¡Respaldo completado exitosamente!"
echo "📍 Ubicación en Google Cloud: $BUCKET_NAME/$BUNDLE_NAME"
echo ""
echo "💡 Para clonar este respaldo en cualquier otro equipo si GitHub no está disponible:"
echo "   1) gsutil cp $BUCKET_NAME/$LATEST_BUNDLE_NAME ./mclarens.bundle"
echo "   2) git clone ./mclarens.bundle MC-LARENS_ERP2"
echo "   3) cd MC-LARENS_ERP2 && git checkout master"
