# MC-LARENS ERP: Reglas Maestras de Despliegue Cloud Run y Almacenamiento CDN

Este documento establece las políticas obligatorias de DevOps, exclusión de archivos pesados y gestión de imágenes para evitar fallos de memoria, subidas lentas o despliegues bloqueados.

---

## 1. Arquitectura de Almacenamiento de Imágenes (GCS CDN Bucket)

Para evitar que el código fuente pese gigabytes y los despliegues tarden más de 20 minutos:

- **Bucket Público CDN:** `gs://mclarens-erp-vehicles`
- **URL Base CDN:** `https://storage.googleapis.com/mclarens-erp-vehicles/models/`
- **Script de Sincronización Única:** `scripts/sync_vehicles_to_gcs.sh`
- **Resolución Frontend:** [vehicleSilhouette.js](file:///c:/ANTIGRAVITY/MC-LARENS_ERP2/frontend/src/lib/vehicleSilhouette.js) resuelve automáticamente las siluetas, modelos y planos desde el bucket de Google Cloud Storage.

---

## 2. Exclusiones Obligatorias en `.gcloudignore` y `.dockerignore`

**NUNCA** se deben empaquetar ni subir las carpetas locales de imágenes ni builds en los despliegues de código a Cloud Run. Ambos archivos deben contener estrictamente:

```gitignore
backend/data/blueprints_raw/
backend/data/blueprints_cleaned/
frontend/public/vehicles/models/
frontend/public/vehicles/blueprints/
temporary_cleanup_validation/
backups/
node_modules/
**/node_modules/
frontend/node_modules/
frontend/build/
frontend/dist/
build/
dist/
```

> **Efecto de la Optimización:** Reduce el tamaño de subida de **2,940 MB (~3 GB)** a menos de **80 MB** (un 97.3% más liviano y subida en 10 segundos).

---

## 3. Comando Oficial de Despliegue a Google Cloud Run

```bash
gcloud run deploy mclarens-erp \
    --source . \
    --region us-central1 \
    --project gen-lang-client-0971793042 \
    --allow-unauthenticated
```

- **ID de Proyecto GCP:** `gen-lang-client-0971793042`
- **Región:** `us-central1`
- **Servicio Cloud Run:** `mclarens-erp`
- **URL en Producción:** `https://mclarens-erp-836176703716.us-central1.run.app`
