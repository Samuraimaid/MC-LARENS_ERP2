#!/bin/bash
# ==============================================================================
# MC-LARENS ERP: Sincronización de Imágenes de Productos a Google Cloud Storage (CDN)
# ==============================================================================
# Sube las imágenes de productos (halógenos DLAA, etc.) a Cloud Storage.
# ==============================================================================

set -e

PROJECT_ID="gen-lang-client-0971793042"
BUCKET_NAME="mclarens-erp-products"
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

echo "=== 3. Sincronizando Imágenes de Productos en Paralelo ==="
echo "Iniciando rsync de alta velocidad..."
gcloud storage rsync -r frontend/public/uploads/products "gs://${BUCKET_NAME}/products" || gsutil -m rsync -r frontend/public/uploads/products "gs://${BUCKET_NAME}/products"

echo ""
echo "=============================================================================="
echo "✔ SINCRONIZACIÓN DE PRODUCTOS A GOOGLE CLOUD STORAGE COMPLETADA CON ÉXITO"
echo "Las imágenes están disponibles globalmente en:"
echo "https://storage.googleapis.com/${BUCKET_NAME}/products/"
echo "=============================================================================="
