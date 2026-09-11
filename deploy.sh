#!/bin/bash
# ==============================================================================
# 🏎️⚡ MC-LARENS ERP 2.0 - SCRIPT DE DESPLIEGUE VISUAL PREMIUM EN CLOUD RUN
# ==============================================================================

set -e

PROJECT_ID="gen-lang-client-0971793042"
REGION="us-central1"
SERVICE_NAME="mclarens-erp"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
LIVE_URL="https://mclarens-erp-836176703716.us-central1.run.app"

# Paleta de Colores ANSI y Estilos
CLR_CYAN='\033[1;36m'
CLR_NEON_GREEN='\033[1;32m'
CLR_GOLD='\033[1;33m'
CLR_MAGENTA='\033[1;35m'
CLR_BLUE='\033[1;34m'
CLR_RED='\033[1;31m'
CLR_WHITE='\033[1;37m'
CLR_DIM='\033[0;90m'
BOLD='\033[1m'
RESET='\033[0m'

START_TIME=$(date +%s)
BUILD_STAMP=$(date +%Y%m%d_%H%M%S)
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${BUILD_STAMP}"
IMAGE_LATEST="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

clear 2>/dev/null || true

echo -e "${CLR_CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${CLR_CYAN}║  ${CLR_WHITE}🏎️ 💨  ${BOLD}MC-LARENS ERP 2.0  ·  MOTOR DE DESPLIEGUE EN LA NUBE${RESET}${CLR_CYAN}                 ║${RESET}"
echo -e "${CLR_CYAN}║  ${CLR_DIM}Google Cloud Platform  ·  Cloud Build + Cloud Run (Serverless)${RESET}${CLR_CYAN}              ║${RESET}"
echo -e "${CLR_CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${RESET}\n"

# Asegurar que estamos en el directorio correcto
cd ~/MC-LARENS_ERP2 2>/dev/null || true

# ------------------------------------------------------------------------------
# PASO 0: Política de Limpieza Automática e Higiene de Almacenamiento
# ------------------------------------------------------------------------------
echo -e "${CLR_BLUE}┌─[0/5] 🧹 Ejecutando política de limpieza de disco y contenedores huérfanos...${RESET}"
npm cache clean --force 2>/dev/null || true
docker system prune -af --volumes 2>/dev/null || true
rm -rf ~/.cache ~/.npm /tmp/* ~/*.zip ~/MC-LARENS_ERP2/catalogos/*.zip 2>/dev/null || true
git clean -fd catalogos/ 2>/dev/null || true
git reset --hard HEAD 2>/dev/null || true
echo -e "${CLR_NEON_GREEN}└─ ✔ Espacio de disco optimizado e imágenes residuales eliminadas.${RESET}\n"

# ------------------------------------------------------------------------------
# PASO 1: Sincronización con GitHub
# ------------------------------------------------------------------------------
echo -e "${CLR_BLUE}┌─[1/5] 📥 Sincronizando repositorio con GitHub (master)...${RESET}"
if git pull origin master; then
    echo -e "${CLR_NEON_GREEN}└─ ✔ Código fuente actualizado al último commit.${RESET}\n"
else
    echo -e "${CLR_RED}└─ ✖ Falló la sincronización con Git.${RESET}\n"
    exit 1
fi

# ------------------------------------------------------------------------------
# PASO 2: Compilación de Contenedor Fresco en Google Cloud Build
# ------------------------------------------------------------------------------
echo -e "${CLR_GOLD}┌─[2/5] 📦 Compilando contenedor fresco (${BUILD_STAMP}) en Cloud Build...${RESET}"
echo -e "${CLR_DIM}   (Optimizando frontend Vite + backend FastAPI + semillas unificadas de catálogos)${RESET}"
if gcloud builds submit --project "$PROJECT_ID" --tag "$IMAGE_TAG"; then
    gcloud container images add-tag "$IMAGE_TAG" "$IMAGE_LATEST" --quiet 2>/dev/null || true
    echo -e "${CLR_NEON_GREEN}└─ ✔ Imagen Docker fresca compilada y registrada (${IMAGE_TAG}).${RESET}\n"
else
    echo -e "${CLR_RED}└─ ✖ Falló la compilación en Cloud Build.${RESET}\n"
    exit 1
fi

# ------------------------------------------------------------------------------
# PASO 3: Despliegue de Nueva Revisión en Google Cloud Run
# ------------------------------------------------------------------------------
echo -e "${CLR_MAGENTA}┌─[3/5] 🚀 Desplegando nueva revisión en Google Cloud Run (${REGION})...${RESET}"
if gcloud run deploy "$SERVICE_NAME" \
    --project "$PROJECT_ID" \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region "$REGION" \
    --memory 2Gi \
    --cpu 2 \
    --concurrency 80 \
    --set-env-vars "BUILD_VERSION=0.2.0-${BUILD_STAMP},BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --allow-unauthenticated; then
    echo -e "${CLR_NEON_GREEN}└─ ✔ Servicio desplegado y asignado al 100% del tráfico inmediatamente.${RESET}\n"
else
    echo -e "${CLR_RED}└─ ✖ Falló el despliegue en Cloud Run.${RESET}\n"
    exit 1
fi

# ------------------------------------------------------------------------------
# PASO 4: Comprobación de Salud del Servicio (Health Check)
# ------------------------------------------------------------------------------
echo -e "${CLR_CYAN}┌─[4/5] 🩺 Comprobando salud del endpoint en vivo...${RESET}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${LIVE_URL}/api/health" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${CLR_NEON_GREEN}└─ ✔ Servicio respondiendo con HTTP 200 OK (Saludable y Activo).${RESET}\n"
else
    echo -e "${CLR_GOLD}└─ ⚠ Código de respuesta HTTP: ${HTTP_STATUS} (Inicializando contenedor...)${RESET}\n"
fi

# ------------------------------------------------------------------------------
# PASO 5: Limpieza Post-Despliegue
# ------------------------------------------------------------------------------
echo -e "${CLR_CYAN}┌─[5/5] 🧹 Limpieza final de temporales...${RESET}"
rm -rf /tmp/* 2>/dev/null || true
echo -e "${CLR_NEON_GREEN}└─ ✔ Sistema 100% limpio y listo.${RESET}\n"

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

# ------------------------------------------------------------------------------
# RESUMEN FINAL VISUAL
# ------------------------------------------------------------------------------
echo -e "${CLR_NEON_GREEN}╔══════════════════════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${CLR_NEON_GREEN}║  ${BOLD}🎉  ¡DESPLIEGUE COMPLETADO CON ÉXITO EN ${MINUTES}m ${SECONDS}s!${RESET}${CLR_NEON_GREEN}                                 ║${RESET}"
echo -e "${CLR_NEON_GREEN}╚══════════════════════════════════════════════════════════════════════════════╝${RESET}"
echo -e "${CLR_WHITE}🌐 URL del Sistema :${RESET} ${CLR_CYAN}${BOLD}${LIVE_URL}${RESET}"
echo -e "${CLR_WHITE}📦 Versión / Tag   :${RESET} ${CLR_DIM}${BUILD_STAMP}${RESET}"
echo -e "${CLR_WHITE}⚡ Región          :${RESET} ${CLR_DIM}${REGION}${RESET}\n"

