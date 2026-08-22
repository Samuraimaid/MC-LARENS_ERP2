#!/bin/bash
# ==============================================================================
# MC-LARENS ERP: Sincronización Ultrarrápida de Imágenes a Google Cloud Storage
# ==============================================================================
# Sube las 16,101 imágenes de vehículos a un Bucket de Cloud Storage (CDN) una sola vez.
# ==============================================================================

set -e

PROJECT_ID="gen-lang-client-0971793042"
BUCKET_NAME="mclarens-erp-vehicles"
REGION="us-central1"

echo "=== 1. Creando / Verificando Bucket de Google Cloud Storage: gs://${BUCKET_NAME} ==="
gcloud storage buckets create "gs://${BUCKET_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --uniform-bucket-level-access 2>/dev/null || echo "El bucket ya existe o ya está configurado."

echo "=== 2. Configurando Acceso de Lectura Pública (CDN) ==="
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
    --member="allUsers" \
    --role="roles/storage.objectViewer" \
    --project="${PROJECT_ID}" 2>/dev/null || true

echo "=== 3. Sincronizando 16,101 Imágenes en Paralelo con Multi-Threading ==="
echo "Iniciando rsync de alta velocidad..."
gcloud storage rsync -r frontend/public/vehicles/models "gs://${BUCKET_NAME}/models" || gsutil -m rsync -r frontend/public/vehicles/models "gs://${BUCKET_NAME}/models"


echo ""
echo "=============================================================================="
echo "✔ SINCRONIZACIÓN A GOOGLE CLOUD STORAGE COMPLETADA CON ÉXITO"
echo "Las imágenes están disponibles globalmente en:"
echo "https://storage.googleapis.com/${BUCKET_NAME}/models/"
echo "=============================================================================="
