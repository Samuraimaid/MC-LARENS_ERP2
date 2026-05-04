#!/bin/bash
# ============================================================
# MUNDO DE ACCESORIOS - Script de Inicio
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Obtener IP local
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    LOCAL_IP=$(hostname -I | awk '{print $1}')
elif [[ "$OSTYPE" == "darwin"* ]]; then
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
fi

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║    MUNDO DE ACCESORIOS - Iniciando Servicios          ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Función para limpiar al salir
cleanup() {
    echo ""
    echo "Deteniendo servicios..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Verificar MongoDB
if ! pgrep -x "mongod" > /dev/null; then
    echo "Iniciando MongoDB..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo systemctl start mongod
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start mongodb-community@7.0
    fi
    sleep 2
fi

# Iniciar Backend
echo "[1/2] Iniciando Backend en puerto 8001..."
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 > /tmp/mundo-backend.log 2>&1 &
BACKEND_PID=$!

# Esperar a que el backend inicie
sleep 3

# Verificar que el backend está corriendo
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "ERROR: El backend no pudo iniciar. Ver /tmp/mundo-backend.log"
    exit 1
fi

# Iniciar Frontend
echo "[2/2] Iniciando Frontend en puerto 3000..."
cd "$SCRIPT_DIR/frontend"
PORT=3000 npm start > /tmp/mundo-frontend.log 2>&1 &
FRONTEND_PID=$!

# Esperar a que el frontend inicie
sleep 10

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║         MUNDO DE ACCESORIOS - Sistema Iniciado        ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║                                                       ║"
echo "║  ACCESOS:                                             ║"
echo "║  --------                                             ║"
echo "║  Aplicación Web:  http://$LOCAL_IP:3000               ║"
echo "║  API Backend:     http://$LOCAL_IP:8001/api           ║"
echo "║  App Técnicos:    http://$LOCAL_IP:3000/technician    ║"
echo "║                                                       ║"
echo "║  USUARIOS EN RED LOCAL:                               ║"
echo "║  ----------------------                               ║"
echo "║  Desde cualquier computadora o celular en la misma    ║"
echo "║  red, abrir el navegador e ir a:                      ║"
echo "║    http://$LOCAL_IP:3000                              ║"
echo "║                                                       ║"
echo "║  Para instalar la app en el celular:                  ║"
echo "║  1. Abrir http://$LOCAL_IP:3000/technician en Chrome  ║"
echo "║  2. Menú (3 puntos) → Instalar aplicación             ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "Presiona Ctrl+C para detener los servicios..."

# Mantener el script corriendo
wait
