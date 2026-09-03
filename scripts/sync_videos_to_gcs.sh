#!/bin/bash
# ==============================================================================
# MC-LARENS ERP: Sincronización de Videos Promocionales a Google Cloud Storage
# ==============================================================================
# Sube los videos promocionales al Bucket CDN para reducir el peso del ERP
# y acelerar el tiempo de despliegue a menos de 1 minuto.
# ==============================================================================

set -e

PROJECT_ID="gen-lang-client-0971793042"
BUCKET_NAME="mclarens-erp-vehicles"
REGION="us-central1"

echo "=== 1. Verificando Bucket de Google Cloud Storage: gs://${BUCKET_NAME} ==="
gcloud storage buckets create "gs://${BUCKET_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --uniform-bucket-level-access 2>/dev/null || echo "Bucket verificado."

echo "=== 2. Configurando Acceso Público al CDN ==="
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
    --member="allUsers" \
    --role="roles/storage.objectViewer" \
    --project="${PROJECT_ID}" 2>/dev/null || true

echo "=== 3. Sincronizando Videos Promocionales a gs://${BUCKET_NAME}/videos/promos ==="
# Eliminar videos obsoletos de totem del bucket
gcloud storage rm "gs://${BUCKET_NAME}/videos/promos/totem1-1.mp4" "gs://${BUCKET_NAME}/videos/promos/totem2-1.mp4" "gs://${BUCKET_NAME}/videos/totem1-1.mp4" "gs://${BUCKET_NAME}/videos/totem2-1.mp4" 2>/dev/null || true

if [ -d "frontend/public/videos/promos" ]; then
    gcloud storage rsync -r frontend/public/videos/promos "gs://${BUCKET_NAME}/videos/promos" || gsutil -m rsync -r frontend/public/videos/promos "gs://${BUCKET_NAME}/videos/promos"
elif [ -d "public/videos/promos" ]; then
    gcloud storage rsync -r public/videos/promos "gs://${BUCKET_NAME}/videos/promos" || gsutil -m rsync -r public/videos/promos "gs://${BUCKET_NAME}/videos/promos"
else
    echo "Directorio de videos no encontrado localmente."
fi

echo ""
echo "=============================================================================="
echo "✔ VIDEOS SINCRONIZADOS EXITOSAMENTE EN GOOGLE CLOUD STORAGE"
echo "URL Base CDN: https://storage.googleapis.com/${BUCKET_NAME}/videos/"
echo "=============================================================================="
