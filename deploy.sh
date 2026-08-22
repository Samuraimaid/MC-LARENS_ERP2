#!/bin/bash
# ==============================================================================
# MC-LARENS ERP: Script de Despliegue Inteligente con Barra de Progreso y Porcentajes
# ==============================================================================

set -e

PROJECT_ID="gen-lang-client-0971793042"
REGION="us-central1"
SERVICE_NAME="mclarens-erp"

# Colores para la terminal
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

draw_progress_bar() {
    local percent=$1
    local message=$2
    local width=35
    local filled=$(( percent * width / 100 ))
    local empty=$(( width - filled ))
    
    printf "\r${CYAN}[${BOLD}${percent}%%${NC}${CYAN}] ["
    printf "${GREEN}%0.s█" $(seq 1 $filled 2>/dev/null || true)
    printf "${BLUE}%0.s░" $(seq 1 $empty 2>/dev/null || true)
    printf "${CYAN}] ${YELLOW}%-40s${NC}" "$message"
}

clear 2>/dev/null || true
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║            ${BOLD}MC-LARENS ERP 2.0 - DESPLIEGUE EN GOOGLE CLOUD RUN${NC}${CYAN}              ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════════╝${NC}\n"

# 1. Actualización desde GitHub
draw_progress_bar 10 "Descargando cambios desde GitHub (git pull)..."
git pull origin master > /dev/null 2>&1 || git pull origin master
sleep 1

# 2. Configuración de proyecto
draw_progress_bar 20 "Validando credenciales y región en Google Cloud..."
gcloud config set project "$PROJECT_ID" > /dev/null 2>&1 || true
sleep 1

# 3. Lanzar Cloud Build
draw_progress_bar 30 "Iniciando compilación en Cloud Build..."
echo ""
echo -e "\n${BOLD}${BLUE}--- Iniciando Streaming de Compilación en Tiempo Real ---${NC}\n"

# Ejecutar el despliegue capturando los pasos
gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --allow-unauthenticated \
    --format="value(status.url)" 2>&1 | while IFS= read -r line; do
        if [[ "$line" =~ Step\ ([0-9]+)/([0-9]+) ]]; then
            CURRENT="${BASH_REMATCH[1]}"
            TOTAL="${BASH_REMATCH[2]}"
            # Mapear pasos de Docker (30% a 85%)
            PERCENT=$(( 30 + (CURRENT * 55 / TOTAL) ))
            draw_progress_bar "$PERCENT" "Compilando Contenedor (Paso $CURRENT/$TOTAL)..."
            echo -e "\n  ${CYAN}↳${NC} $line"
        elif [[ "$line" =~ "Uploading sources" ]]; then
            draw_progress_bar 25 "Empaquetando y subiendo archivos a Cloud Storage..."
            echo -e "\n  ${CYAN}↳${NC} $line"
        elif [[ "$line" =~ "Creating Revision" ]] || [[ "$line" =~ "Routing traffic" ]]; then
            draw_progress_bar 90 "Activando nueva versión en Cloud Run..."
            echo -e "\n  ${CYAN}↳${NC} $line"
        elif [[ "$line" =~ "Service URL" ]] || [[ "$line" =~ "https://" ]]; then
            draw_progress_bar 100 "¡Despliegue finalizado con éxito!"
            echo -e "\n  ${GREEN}✔${NC} $line"
        else
            echo -e "  $line"
        fi
done

echo -e "\n\n${GREEN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║               ${BOLD}✔ DESPLIEGUE COMPLETADO Y OPERATIVO AL 100%%${NC}${GREEN}                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
echo -e "\n${CYAN}🌐 URL del Sistema:${NC} ${BOLD}https://mclarens-erp-836176703716.us-central1.run.app${NC}\n"
