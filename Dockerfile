# ==============================================================================
# MC-LARENS ERP 2.0 - Dockerfile Unificado para Google Cloud Run (Serverless)
# ==============================================================================
# Construye el frontend con Vite y empaqueta el backend FastAPI en 1 solo contenedor
# ==============================================================================

# ------------------------------------------------------------------------------
# Fase 0: Extracción de herramientas de MongoDB
# ------------------------------------------------------------------------------
FROM mongo:7.0 AS mongo-tools

# ------------------------------------------------------------------------------
# Fase 1: Compilación del Frontend (Node 20 + Vite)
# ------------------------------------------------------------------------------
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY frontend/ ./
RUN rm -rf public/uploads public/vehicles/models public/vehicles/blueprints public/videos/promos
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV VITE_BACKEND_URL=""
ENV VITE_AUTH_URL="/api/auth/login"
ENV VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN="50005000"
RUN npm run build

# ------------------------------------------------------------------------------
# Fase 2: Imagen Final Backend + Frontend Estático (Python 3.11)
# ------------------------------------------------------------------------------
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema y de Python (incluye Tesseract OCR para Linux)
COPY backend/requirements.txt .
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       fonts-dejavu-core bash tar gzip libjpeg62-turbo zlib1g libgssapi-krb5-2 \
       tesseract-ocr tesseract-ocr-spa tesseract-ocr-eng libtesseract-dev \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt

# Herramientas de respaldo de MongoDB
COPY --from=mongo-tools /usr/bin/mongodump /usr/bin/mongodump
COPY --from=mongo-tools /usr/bin/mongorestore /usr/bin/mongorestore

# Copiar Backend y Frontend compilado
RUN mkdir -p /app/backend /app/frontend/build /app/uploads /app/backups
COPY backend /app/backend
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

ENV PYTHONPATH=/app
ENV PORT=8080
EXPOSE 8080

COPY backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && chmod +x /app/backend/scripts/backup_server_node.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD []
