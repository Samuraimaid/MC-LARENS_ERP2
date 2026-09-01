#!/bin/bash
# ==============================================================================
# MC-LARENS ERP: Script de Despliegue en Google Cloud Run
# ==============================================================================

set -e

PROJECT_ID="gen-lang-client-0971793042"
REGION="us-central1"
SERVICE_NAME="mclarens-erp"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║            ${BOLD}MC-LARENS ERP 2.0 - DESPLIEGUE EN GOOGLE CLOUD RUN${NC}${CYAN}              ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${YELLOW}1. Descargando últimos cambios de GitHub...${NC}"
git pull origin master

echo -e "\n${YELLOW}2. Configurando proyecto en Google Cloud...${NC}"
gcloud config set project "$PROJECT_ID"

echo -e "\n${YELLOW}3. Compilando y Desplegando en Cloud Run...${NC}"
if gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --allow-unauthenticated; then
    
    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║               ${BOLD}✔ DESPLIEGUE COMPLETADO Y OPERATIVO AL 100%${NC}${GREEN}                 ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo -e "\n${CYAN}🌐 URL del Sistema:${NC} ${BOLD}https://mclarens-erp-836176703716.us-central1.run.app${NC}\n"
else
    echo -e "\n${RED}❌ Error durante la compilación o despliegue.${NC}"
    echo -e "${YELLOW}Revisa los mensajes anteriores de Cloud Build para identificar la causa del fallo.${NC}\n"
    exit 1
fi
