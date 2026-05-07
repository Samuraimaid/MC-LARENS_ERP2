
# MUNDO DE ACCESORIOS - Guía de Instalación Local

## Requisitos del Sistema

### Hardware Mínimo
- **Procesador**: Intel Core i3 o equivalente
- **RAM**: 4 GB mínimo (8 GB recomendado)
- **Disco**: 10 GB libres

### Perfil recomendado para equipos modestos
- **CPU**: procesador dual-core o de gama de entrada puede ejecutar el ERP en Docker, pero con builds y reinicios mas lentos.
- **RAM**: con 8 GB el sistema puede funcionar, pero con 16 GB o mas hay mas margen para Docker Desktop, navegador y VS Code a la vez.
- **Disco**: preferible SSD; en HDD el primer build y la extraccion de imagenes se vuelven considerablemente mas lentos.
- **Objetivo practico**: en equipos de recursos limitados, priorizar el uso del stack Docker ya construido y evitar recompilar backend y frontend sin necesidad.

### Software Requerido
- **Sistema Operativo**: Windows 10/11, Ubuntu 20.04+, o macOS 12+
- **MongoDB**: 6.0 o superior
- **Node.js**: 18.x o superior
- **Python**: 3.11 o superior
- **Git**: (opcional, para actualizaciones)

### Nota para instalacion con 3 contenedores Docker
- Si el objetivo es montar `mongodb`, `backend` y `frontend` en Docker Compose, no es obligatorio instalar MongoDB, Node.js ni Python en el host para operar el sistema.
- Esas dependencias siguen siendo utiles para desarrollo local, scripts de soporte, pruebas o recuperacion manual fuera de contenedores.
- Para equipos modestos, Docker Desktop con Compose y espacio suficiente en disco es la prioridad real.

---

## Instalación Rápida (Script Automático)

#### Windows
```powershell
# Doble clic en start-mundo.bat
.\start-mundo.bat
```

### Linux/macOS
```bash
# Dar permisos y ejecutar
chmod +x install-linux.sh
sudo ./install-linux.sh
```

## Modo Docker para equipos con pocos recursos

Si este equipo va a usar el ERP en los 3 contenedores (`mongodb`, `backend`, `frontend`), este flujo suele rendir mejor que mezclar Docker con desarrollo local completo:

1. Asignar a Docker Desktop entre 2 CPU y 4 a 6 GB de RAM.
2. Mantener al menos 15 GB libres en disco.
3. Ejecutar el primer build con el navegador y otras apps pesadas cerradas.
4. Construir una sola vez y luego reutilizar imagenes y volumenes.

Comandos recomendados:

```powershell
docker compose build mongodb backend frontend
docker compose up -d mongodb backend
docker compose up -d frontend
```

Para uso diario:

```powershell
docker compose up -d
```

Evitar como rutina:

```powershell
docker compose up -d --build
docker compose down --volumes
```

Solo usar esos comandos cuando hubo cambios de dependencias, Dockerfiles o cuando se necesite limpiar un estado roto.

---

## Instalación Manual Paso a Paso

### 1. Instalar MongoDB

#### Windows
1. Descargar MongoDB Community Server desde: https://www.mongodb.com/try/download/community
2. Ejecutar el instalador MSI
3. Seleccionar "Complete" installation
4. Marcar "Install MongoDB as a Service"
5. Marcar "Install MongoDB Compass" (opcional, para administrar la BD)

#### Ubuntu/Debian
```bash
# Importar clave GPG
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Agregar repositorio
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Instalar
sudo apt update
sudo apt install -y mongodb-org

# Iniciar servicio
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### macOS
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

### 2. Instalar Node.js

#### Windows
1. Descargar desde: https://nodejs.org/
2. Instalar versión LTS (18.x o superior)
3. Verificar: `node --version` y `npm --version`

#### Linux
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

#### macOS
```bash
brew install node@18
```

### 3. Instalar Python

#### Windows
1. Descargar desde: https://www.python.org/downloads/
2. **IMPORTANTE**: Marcar "Add Python to PATH"
3. Verificar: `python --version`

#### Linux
```bash
sudo apt install -y python3.11 python3.11-venv python3-pip
```

#### macOS
```bash
brew install python@3.11
```

### 4. Configurar la Aplicación

```bash
# Clonar o copiar los archivos de la aplicación a una carpeta
cd /ruta/a/mundo-accesorios

# Backend
cd backend
python -m venv venv

# Activar entorno virtual
# Windows: venv\Scripts\activate
# Linux/macOS: source venv/bin/activate

pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
# Desarrollo local con Vite
npm run dev
```
STRIPE_API_KEY=sk_test_your_key_here
```

#### Frontend (.env)
```bash
# Editar frontend/.env
# Reemplazar YOUR_SERVER_IP con la IP de este servidor
VITE_BACKEND_URL=http://YOUR_SERVER_IP:8001
```

Notas:

- El frontend prioriza variables `VITE_*`.
- `REACT_APP_*` sigue funcionando solo como compatibilidad transitoria.

### 6. Obtener IP del Servidor

#### Windows
```powershell
ipconfig | findstr "IPv4"
# Buscar la IP de la red local (ej: 192.168.1.100)
```

#### Linux/macOS
```bash
hostname -I | awk '{print $1}'
# o
ip addr show | grep "inet " | grep -v 127.0.0.1
```

### 7. Configurar Firewall

#### Windows
```powershell
# Abrir puertos de frontend y backend para acceso LAN
netsh advfirewall firewall add rule name="MC-LARENS Frontend 3000" dir=in action=allow protocol=tcp localport=3000
netsh advfirewall firewall add rule name="MC-LARENS Backend 8001" dir=in action=allow protocol=tcp localport=8001
```

#### Linux (UFW)
```bash
sudo ufw allow 8001/tcp
sudo ufw reload
```

---
## Iniciar la Aplicación

### Opcion 1: Scripts de Inicio

#### Windows
```powershell
# Doble clic en start-mundo.bat
# O desde PowerShell:
\start-mundo.bat
```

#### Linux/macOS
```bash
	./start-mundo.sh
```

### Opción 2: Iniciar Manualmente

**Terminal 1 - Backend (sirve frontend + API en el mismo puerto):**
```bash
cd backend
source venv/bin/activate  # Linux/macOS
# o: venv\Scripts\activate  # Windows
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Frontend (build, una sola vez o cuando actualices UI):**
```bash
cd frontend
npm run build
```

**Frontend (desarrollo local con recarga):**
```bash
cd frontend
npm run dev
```

---
## Acceder a la Aplicación

### Desde el Servidor Local
- Web + API: http://localhost:8001
### Desde Otras Computadoras en la Red
Reemplazar `SERVER_IP` con la IP del servidor:
- Frontend (Nginx): http://SERVER_IP:3000
- Backend (FastAPI): http://SERVER_IP:8001

Verificacion rapida (en el servidor):

```powershell
Invoke-WebRequest http://localhost:3000
Invoke-WebRequest http://localhost:8001/docs
Invoke-WebRequest http://SERVER_IP:3000
Invoke-WebRequest http://SERVER_IP:8001/docs
```
---
## Configurar Inicio Automático

### Windows (Servicio)
1. Usar NSSM (Non-Sucking Service Manager):
```powershell
# Descargar NSSM de https://nssm.cc/
nssm install MUNDO_DE_ACCESORIOS_Backend
# Configurar: Path: python, Arguments: -m uvicorn server:app --host 0.0.0.0 --port 8001

:: Frontend es servido por backend (no requiere servicio separado)
```

### Linux (systemd)
```bash
# Copiar archivos de servicio
sudo cp mundo-backend.service /etc/systemd/system/
# Habilitar servicios
sudo systemctl daemon-reload
sudo systemctl enable mundo-backend
sudo systemctl start mundo-backend
```

---
## Solución de Problemas

### MongoDB no inicia
```bash
# Verificar estado
sudo systemctl status mongod

# Ver logs
sudo tail -f /var/log/mongodb/mongod.log
```

### Puerto ocupado
```bash
# Windows
netstat -ano | findstr :8001
taskkill /PID <PID> /F

# Linux
sudo lsof -i :8001
sudo kill -9 <PID>
```

### Errores de conexión desde red
1. Verificar firewall
2. Verificar que el servidor escuche en 0.0.0.0 (no 127.0.0.1)
3. Verificar IP correcta (si usas frontend separado, revisar frontend/.env)
4. Verificar que Docker publique puertos (`docker ps`) en 3000 y 8001
5. Si local funciona y remoto no, revisar aislamiento Wi-Fi en router (AP Isolation/Guest Network)

### Limpiar caché
```bash
# Frontend (rebuild)
cd frontend
rm -rf node_modules/.cache
npm run build
```

En el navegador: abre DevTools -> Application -> Storage -> Clear site data y recarga.

---
## Respaldos

### Respaldar Base de Datos
```bash
# Crear respaldo
mongodump --db mundo_accesorios_erp --out /ruta/respaldos/$(date +%Y%m%d)

# Restaurar respaldo
mongorestore --db mundo_accesorios_erp /ruta/respaldo/mundo_accesorios_erp
```

### Respaldo Automático (Linux)
Agregar al crontab (`crontab -e`):
```
0 2 * * * mongodump --db mundo_accesorios_erp --out /backups/mongodb/$(date +\%Y\%m\%d)
```

---
## Contacto y Soporte

Para soporte técnico o actualizaciones, contactar al administrador del sistema.

**Versión**: 1.0.0
**Última actualización**: Enero 2026
