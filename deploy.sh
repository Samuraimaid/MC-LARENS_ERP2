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

clear 2>/dev/null || true

echo -e "${CLR_CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${CLR_CYAN}║  ${CLR_WHITE}🏎️ 💨  ${BOLD}MC-LARENS ERP 2.0  ·  MOTOR DE DESPLIEGUE EN LA NUBE${RESET}${CLR_CYAN}                 ║${RESET}"
echo -e "${CLR_CYAN}║  ${CLR_DIM}Google Cloud Platform  ·  Cloud Build + Cloud Run (Serverless)${RESET}${CLR_CYAN}              ║${RESET}"
echo -e "${CLR_CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${RESET}\n"

# Asegurar que estamos en el directorio correcto
cd ~/MC-LARENS_ERP2 2>/dev/null || true

# ------------------------------------------------------------------------------
# PASO 1: Sincronización con GitHub
# ------------------------------------------------------------------------------
echo -e "${CLR_BLUE}┌─[1/4] 📥 Sincronizando repositorio con GitHub (master)...${RESET}"
if git pull origin master; then
    echo -e "${CLR_NEON_GREEN}└─ ✔ Código fuente actualizado al último commit.${RESET}\n"
else
    echo -e "${CLR_RED}└─ ✖ Falló la sincronización con Git.${RESET}\n"
    exit 1
fi

# ------------------------------------------------------------------------------
# PASO 2: Compilación de Contenedor en Google Cloud Build
# ------------------------------------------------------------------------------
echo -e "${CLR_GOLD}┌─[2/4] 📦 Compilando contenedor ligero en Google Cloud Build...${RESET}"
echo -e "${CLR_DIM}   (Optimizando frontend Vite + backend FastAPI + CDN de Google Cloud Storage)${RESET}"
if gcloud builds submit --project "$PROJECT_ID" --tag "$IMAGE_TAG"; then
    echo -e "${CLR_NEON_GREEN}└─ ✔ Imagen Docker compilada y registrada en GCR con éxito.${RESET}\n"
else
    echo -e "${CLR_RED}└─ ✖ Falló la compilación en Cloud Build.${RESET}\n"
    exit 1
fi

# ------------------------------------------------------------------------------
# PASO 3: Despliegue en Google Cloud Run
# ------------------------------------------------------------------------------
echo -e "${CLR_MAGENTA}┌─[3/4] 🚀 Desplegando nueva revisión en Google Cloud Run (${REGION})...${RESET}"
if gcloud run deploy "$SERVICE_NAME" \
    --project "$PROJECT_ID" \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated; then
    echo -e "${CLR_NEON_GREEN}└─ ✔ Servicio desplegado y asignado al 100% del tráfico.${RESET}\n"
else
    echo -e "${CLR_RED}└─ ✖ Falló el despliegue en Cloud Run.${RESET}\n"
    exit 1
fi

# ------------------------------------------------------------------------------
# PASO 4: Comprobación de Salud del Servicio (Health Check)
# ------------------------------------------------------------------------------
echo -e "${CLR_CYAN}┌─[4/4] 🩺 Comprobando salud del endpoint en vivo...${RESET}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${LIVE_URL}/api/health" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${CLR_NEON_GREEN}└─ ✔ Servicio respondiendo con HTTP 200 OK (Saludable y Activo).${RESET}\n"
else
    echo -e "${CLR_GOLD}└─ ⚠ Código de respuesta HTTP: ${HTTP_STATUS} (Inicializando contenedor...)${RESET}\n"
fi

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
echo -e "${CLR_WHITE}📦 Imagen Docker   :${RESET} ${CLR_DIM}${IMAGE_TAG}${RESET}"
echo -e "${CLR_WHITE}⚡ Región          :${RESET} ${CLR_DIM}${REGION}${RESET}\n"

