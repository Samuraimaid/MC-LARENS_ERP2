#!/bin/bash
# ============================================================
# MUNDO DE ACCESORIOS - Script de Instalación para Linux/macOS
# ============================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║    MUNDO DE ACCESORIOS - Instalación Local            ║"
echo "║         Sistema de Facturación e Inventario           ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Detectar sistema operativo
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    if [ -f /etc/debian_version ]; then
        DISTRO="debian"
    elif [ -f /etc/redhat-release ]; then
        DISTRO="redhat"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
fi

echo -e "${YELLOW}Sistema detectado: $OS${NC}"

# Función para verificar comando
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓ $1 instalado${NC}"
        return 0
    else
        echo -e "${RED}✗ $1 no encontrado${NC}"
        return 1
    fi
chmod +x start-mundo.sh

# Verificar requisitos
echo -e "\n${BLUE}Verificando requisitos...${NC}"

MISSING_DEPS=()

if ! check_command "mongod"; then
    MISSING_DEPS+=("mongodb")
echo "║    ./start-mundo.sh                                   ║"

if ! check_command "node"; then
    MISSING_DEPS+=("nodejs")
fi

if ! check_command "python3"; then
    MISSING_DEPS+=("python3")
fi

if ! check_command "pip3"; then
    MISSING_DEPS+=("pip3")
fi

# Instalar dependencias faltantes
if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo -e "\n${YELLOW}Instalando dependencias faltantes: ${MISSING_DEPS[*]}${NC}"
    
    if [[ "$OS" == "linux" && "$DISTRO" == "debian" ]]; then
        sudo apt update
        
        for dep in "${MISSING_DEPS[@]}"; do
            case $dep in
                "mongodb")
                    echo -e "${BLUE}Instalando MongoDB...${NC}"
                    curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
                    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
                    sudo apt update
                    sudo apt install -y mongodb-org
                    sudo systemctl start mongod
                    sudo systemctl enable mongod
                    ;;
                "nodejs")
                    echo -e "${BLUE}Instalando Node.js...${NC}"
                    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
                    sudo apt install -y nodejs
                    ;;
                "python3")
                    echo -e "${BLUE}Instalando Python 3...${NC}"
                    sudo apt install -y python3 python3-venv python3-pip
                    ;;
                "pip3")
                    sudo apt install -y python3-pip
                    ;;
            esac
        done
        
    elif [[ "$OS" == "macos" ]]; then
        if ! check_command "brew"; then
            echo -e "${BLUE}Instalando Homebrew...${NC}"
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        for dep in "${MISSING_DEPS[@]}"; do
            case $dep in
                "mongodb")
                    brew tap mongodb/brew
                    brew install mongodb-community@7.0
                    brew services start mongodb-community@7.0
                    ;;
                "nodejs")
                    brew install node@18
                    ;;
                "python3"|"pip3")
                    brew install python@3.11
                    ;;
            esac
        done
    fi
fi

# Obtener directorio del script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Obtener IP local
if [[ "$OS" == "linux" ]]; then
    LOCAL_IP=$(hostname -I | awk '{print $1}')
elif [[ "$OS" == "macos" ]]; then
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
fi

echo -e "\n${GREEN}IP del servidor: $LOCAL_IP${NC}"

# Configurar Backend
echo -e "\n${BLUE}Configurando Backend...${NC}"
cd backend

# Crear entorno virtual
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Activar entorno virtual
source venv/bin/activate

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt

# Configurar .env
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=mundo_accesorios_erp
CORS_ORIGINS=*
STRIPE_API_KEY=sk_test_your_key_here
EOF

echo -e "${GREEN}✓ Backend configurado${NC}"

# Configurar Frontend
echo -e "\n${BLUE}Configurando Frontend...${NC}"
cd ../frontend

# Instalar dependencias
if command -v yarn &> /dev/null; then
    yarn install
else
    npm install
fi

# Configurar .env con IP local
cat > .env << EOF
VITE_BACKEND_URL=http://${LOCAL_IP}:8001
EOF

echo -e "${GREEN}✓ Frontend configurado${NC}"

# Configurar firewall (Linux)
if [[ "$OS" == "linux" ]]; then
    echo -e "\n${BLUE}Configurando firewall...${NC}"
    if command -v ufw &> /dev/null; then
        sudo ufw allow 3000/tcp
        sudo ufw allow 8001/tcp
        echo -e "${GREEN}✓ Puertos 3000 y 8001 abiertos${NC}"
    fi
fi

# Crear script de inicio
cd "$SCRIPT_DIR"
cat > start-autoparts.sh << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Iniciando MUNDO DE ACCESORIOS..."

# Iniciar Backend
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!

# Esperar a que el backend inicie
sleep 3

# Iniciar Frontend
cd "$SCRIPT_DIR/frontend"
PORT=3000 npm start &
FRONTEND_PID=$!

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           MUNDO DE ACCESORIOS Iniciado                ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║  Frontend:  http://$(hostname -I | awk '{print $1}'):3000              ║"
echo "║  Backend:   http://$(hostname -I | awk '{print $1}'):8001/api          ║"
echo "║  Técnicos:  http://$(hostname -I | awk '{print $1}'):3000/technician   ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "Presiona Ctrl+C para detener..."

# Esperar señal de terminación
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
EOF

chmod +x start-autoparts.sh

# Crear servicios systemd (Linux)
if [[ "$OS" == "linux" ]]; then
    echo -e "\n${BLUE}Creando servicios systemd...${NC}"
    
    # Backend service
    sudo tee /etc/systemd/system/mundo-backend.service > /dev/null << EOF
[Unit]
Description=MUNDO DE ACCESORIOS Backend
After=network.target mongod.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$SCRIPT_DIR/backend
Environment=PATH=$SCRIPT_DIR/backend/venv/bin
ExecStart=$SCRIPT_DIR/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

    # Frontend service
    sudo tee /etc/systemd/system/mundo-frontend.service > /dev/null << EOF
[Unit]
Description=MUNDO DE ACCESORIOS Frontend
After=network.target mundo-backend.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$SCRIPT_DIR/frontend
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    echo -e "${GREEN}✓ Servicios systemd creados${NC}"
    echo -e "${YELLOW}Para habilitar inicio automático:${NC}"
    echo "  sudo systemctl enable mundo-backend mundo-frontend"
fi

# Finalizar
echo -e "\n${GREEN}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║          ¡Instalación Completada!                     ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║                                                       ║"
echo "║  Para iniciar la aplicación:                          ║"
echo "║    ./start-autoparts.sh                               ║"
echo "║                                                       ║"
echo "║  Acceso desde la red local:                           ║"
echo "║    http://$LOCAL_IP:3000                              ║"
echo "║                                                       ║"
echo "║  App móvil técnicos:                                  ║"
echo "║    http://$LOCAL_IP:3000/technician                   ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"
