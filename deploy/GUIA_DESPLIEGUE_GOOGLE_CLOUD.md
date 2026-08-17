# 🚀 Guía de Despliegue en la Nube: Google Cloud + Google Drive (5 TB)
## Proyecto: **MC-LARENS ERP 2.0 (Sucursal Central - Mundo de Accesorios)**

Esta guía contiene los pasos exactos para poner en producción tu ERP en la nube de Google para **1 sola sucursal** (`branch_main` - Mundo de Accesorios), utilizando tu suscripción de **Google AI Pro (5 TB)** para resguardo inmutable de copias de seguridad.

---

## 🏛️ Arquitectura de la Solución (1 Sucursal)

```mermaid
graph TD
    subgraph Local [Sucursal Mundo de Accesorios]
        Caja[PC de Caja / Ventas]
        Tablets[Tablets / Kiosco]
        Printers[Impresoras POS y Etiquetas]
    end

    subgraph GoogleCloud [Google Cloud Platform]
        CloudRun[Cloud Run o Compute Engine]
        BackendAPI[FastAPI Backend :8001]
        FrontendApp[React Web :80/:443]
        CloudRun --> BackendAPI
        CloudRun --> FrontendApp
    end

    subgraph Database [Capa de Datos Gestionada]
        AtlasMongo[(MongoDB Atlas en GCP)]
    end

    subgraph GoogleDrive [Tu Plan Google AI Pro 5 TB]
        DriveStorage[(Google Drive 5 TB: Backups Diarios)]
    end

    Caja -->|HTTPS / Web| CloudRun
    Tablets -->|HTTPS / Web| CloudRun
    BackendAPI --> AtlasMongo
    BackendAPI -.->|Script Diario| DriveStorage
    Caja -->|Web-Print Directo| Printers
```

---

## Paso 1: Configurar la Base de Datos en la Nube (MongoDB Atlas en GCP)

1. Ingresa a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Crea una cuenta o inicia sesión con tu cuenta de Google.
3. Crea un nuevo Cluster:
   - **Proveedor Cloud:** Selecciona **Google Cloud Platform (GCP)**.
   - **Región:** `us-central1` (Iowa) o `us-east4` (Virginia del Norte) para menor latencia con Nicaragua.
   - **Nivel:** Selecciona **M0 (Gratuito)** para pruebas o **M10 (Dedicado)** para producción.
4. Crea un usuario de base de datos (ejemplo: `mclarens_admin` y una contraseña segura).
5. En **Network Access**, agrega la IP `0.0.0.0/0` (permitir acceso desde servicios cloud con usuario/password).
6. Copia tu cadena de conexión URI:
   ```text
   mongodb+srv://mclarens_admin:<PASSWORD>@cluster0.abcde.mongodb.net/mc-larens2_mundo_accesorios_erp?retryWrites=true&w=majority
   ```

---

## Paso 2: Configurar el Acceso a tus 5 TB de Google Drive

Para que el servidor suba los respaldos automáticamente a tu cuenta de Google Drive:

1. Ingresa a la [Consola de Google Cloud](https://console.cloud.google.com/).
2. Crea un proyecto (ejemplo: `mclarens-erp-cloud`).
3. Ve a **APIs & Services** > **Library** y activa la **Google Drive API**.
4. Ve a **IAM & Admin** > **Service Accounts** y crea una cuenta de servicio (ejemplo: `erp-backup-bot`).
5. Genera una **Key en formato JSON** y descárgala. Nómbrala `google-service-account.json`.
6. En tu Google Drive personal (donde tienes los 5 TB), crea una carpeta llamada `MCLarens_ERP_Backups`.
7. Comparte esa carpeta con el correo de la cuenta de servicio (con permisos de **Editor**).
8. Copia el **ID de la carpeta** desde la URL de Google Drive (la cadena al final de `drive.google.com/drive/folders/ESTE_ES_EL_ID`).

---

## Paso 3: Configuración del Entorno del ERP

En tu servidor cloud, clona el repositorio y crea tu archivo `.env` basado en la plantilla:

```bash
cp deploy/cloud.env.example deploy/.env
```

Edita `deploy/.env` con tus credenciales reales:

```ini
# Base de datos Atlas
MONGODB_LOCAL_URI=mongodb+srv://mclarens_admin:TU_PASSWORD@cluster0.abcde.mongodb.net/mc-larens2_mundo_accesorios_erp?retryWrites=true&w=majority
MONGO_URL=mongodb+srv://mclarens_admin:TU_PASSWORD@cluster0.abcde.mongodb.net/mc-larens2_mundo_accesorios_erp?retryWrites=true&w=majority
DB_NAME=mc-larens2_mundo_accesorios_erp

# Sucursal Central
BRANCH_ID=branch_main
NODE_NAME="Mundo de Accesorios - Central"

# Google Drive 5TB
GOOGLE_APPLICATION_CREDENTIALS=/app/backend/data/google-service-account.json
GOOGLE_DRIVE_BACKUP_FOLDER_ID=TU_ID_DE_CARPETA_EN_GOOGLE_DRIVE
```

Copia tu archivo de llaves `google-service-account.json` dentro de `backend/data/`:
```bash
cp /ruta/hacia/google-service-account.json backend/data/google-service-account.json
```

---

## Paso 4: Levantar los Servicios en la Nube

### Opción A: Despliegue en Google Compute Engine / VPS con Docker (Recomendado)

Ejecuta el docker compose optimizado para la nube:

```bash
docker compose -f deploy/docker-compose.cloud.yml --env-file deploy/.env up -d --build
```

Verifica el estado de los contenedores:
```bash
docker compose -f deploy/docker-compose.cloud.yml ps
```

### Opción B: Despliegue Serverless en Google Cloud Run

1. Construye las imágenes y súbelas a Google Artifact Registry:
   ```bash
   gcloud builds submit --tag gcr.io/mclarens-erp-cloud/backend ./backend
   gcloud builds submit --tag gcr.io/mclarens-erp-cloud/frontend ./frontend
   ```
2. Despliega el Backend en Cloud Run:
   ```bash
   gcloud run deploy mclarens-backend \
     --image gcr.io/mclarens-erp-cloud/backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars MONGO_URL="tu_mongo_uri",DB_NAME="mc-larens2_mundo_accesorios_erp",BRANCH_ID="branch_main"
   ```
3. Despliega el Frontend en Cloud Run apuntando la URL del Backend.

---

## Paso 5: Programar el Respaldo Automático a Google Drive

Configura una tarea programada (*cron job*) en el servidor para que se ejecute todas las noches a las 11:00 PM:

```bash
crontab -e
```

Agrega la siguiente línea:
```text
0 23 * * * python3 /ruta/al/proyecto/scripts/backup_google_drive.py >> /var/log/erp_backup.log 2>&1
```

---

## Paso 6: Operación de Impresoras Locales desde la Nube (Web-Print)

Cuando accedas al ERP desde `https://erp.tu-dominio.com`:
- **Facturas y Recibos:** El sistema genera el PDF/Ticket en pantalla. El cajero simplemente presiona `Ctrl + P` (o el botón Imprimir) y el navegador envía el documento a la impresora térmica POS-80 conectada por USB a la computadora.
- **Etiquetas de Códigos de Barra:** Se pueden imprimir directamente desde el visor PDF o utilizando el puente local en caso de impresoras industriales TSPL.

---

## ✅ Resumen de Beneficios Obtenidos

1. **ERP disponible 24/7:** Acceso seguro desde cualquier computadora, tableta o teléfono celular.
2. **Backups Inmutables en tus 5 TB:** Todos los datos quedan protegidos en tu cuenta de Google One sin costo extra de almacenamiento.
3. **Cero Mantenimiento de Servidores Físicos:** Se eliminan los problemas de fallas de disco duro local en la tienda, caídas de energía o daños por virus en computadoras de mostrador.
