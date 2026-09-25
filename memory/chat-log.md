# Registro Histórico y Memoria del Chat (MC-LARENS ERP 2.0)

Este archivo actúa como **memoria persistente local** de las sesiones de trabajo, decisiones arquitectónicas, resoluciones de incidencias y estado del proyecto. Su objetivo es evitar la pérdida de contexto en caso de reinicio de chat, saturación del contexto de la IA o bucles accidentales.

---

## 📌 Contexto General del Proyecto
- **Proyecto:** MC-LARENS ERP 2.0
- **Sucursales:**
  - `branch_main`: Mundo de Accesorios (Central - Ventas, Taller, Polarizados, Despachos).
  - `branch_north`: TopCar El Calvario (Ventas/Distribución).
  - `branch_south`: TopCar La Tigre (Ventas/Distribución).
- **Despliegue Producción (Google Cloud):**
  - Servicio: `mclarens-erp` en Google Cloud Run (`us-central1`).
  - Proyecto GCP: `gen-lang-client-0971793042`.
  - URL Activa: `https://mclarens-erp-836176703716.us-central1.run.app`.
  - CDN para 16,101 siluetas/blueprints: `gs://mclarens-erp-vehicles` (`https://storage.googleapis.com/mclarens-erp-vehicles/models/`).
  - Base de datos: MongoDB Atlas en GCP (`mc-larens2_mundo_accesorios_erp`).
  - Respaldos: Script diario a Google Drive 5 TB (`scripts/backup_google_drive.py`).

---

## 📝 Registro de Sesiones y Decisiones

### Sesión 2026-08-28 (Auditoría Integral y Configuración de Respaldo Local de Chat)
- **Acción realizada:**
  1. Revisión completa de todos los documentos arquitectónicos, manuales, políticas de código, planes de refactorización y módulos funcionales del ERP.
  2. Documentación y consolidación de la arquitectura de despliegue en Google Cloud Run, Cloud Storage CDN, Vertex AI y MongoDB Atlas.
  3. Configuración de este registro persistente de memoria local (`memory/chat-log.md`) y regla activa en `.agents/rules/session_memory_and_loop_prevention.md` para evitar pérdida de contexto y bucles infinitos.
- **Estado del sistema:**
  - Frontend en Vite + React con 35 páginas lazy-loaded y capa `env.js`.
  - Backend en FastAPI con extracción de dominios en `backend/domains/`.
  - Escáner OCR v2 para Tarjetas de Circulación de Nicaragua en `:3443` (HTTPS) con normalización de placas y cédulas.
  - Mesa de corte de polarizados con rollos de 20", 36", 40", inventario dual y vouchers térmicos de 80mm con croquis vehicular.
  - Autenticación por PIN dual (8 dígitos login / 4 dígitos kiosco y desbloqueo).

---


### Respaldo Automático de Conversación (2026-08-28 17:45:31)
- **Usuario:** <USER_REQUEST>
hola
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:36:31-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote4.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\generate_toyota_catalog_live.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_vertex_imagen.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\domains\vehicles\circulation_ocr.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\components\ui\BrandMosaicLoader.jsx (LANGUAGE_JAVASCRIPT)
</ADDITIONAL_METADATA>
<USER_SETTINGS_CHANGE>
The user changed setting `Model Selection` from None to Gemini 3.7 Flash (High). No need to comment on this change if the user doesn't ask about it. If reporting what model you are, please use a human readable name instead of the exact string.
</USER_SETTINGS_CHANGE>
- **Asistente (Resumen):** ¡Hola! ¿En qué te puedo ayudar hoy con **MC-LARENS ERP**?...
- **Usuario:** <USER_REQUEST>
quiero que revises todos los archvos de informacion de estes repositrio y aprensas para que sirve, de que trata, como funciona, que cambios ha tenido y todo lo que puedas recopilar
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:39:40-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\audit_vehicle_image_matching.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\process_generated_image.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote18.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote11.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote4.py (LANGUAGE_PYTHON)
</ADDITIONAL_METADATA>
- **Asistente (Resumen):** He analizado exhaustivamente todos los archivos de documentación, arquitectura, políticas de código, planes de refactorización, especificaciones de negocio, historial de git y manuales de **MC-LARENS ERP 2.0**. 

A continuación te presento un informe completo y detallado con todo lo recopilado:
...
- **Usuario:** <USER_REQUEST>
puedes recabar informacion acerca de los despliegues en el servidor de ggogle?
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:42:50-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_vertex_imagen.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\domains\vehicles\circulation_ocr.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\components\ui\BrandMosaicLoader.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote12.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote10.py (LANGUAGE_PYTHON)
</ADDITIONAL_METADATA>
- **Asistente (Resumen):** Toda la infraestructura y despliegues en **Google Cloud Platform (GCP)** y los servicios de Google asociados a **MC-LARENS ERP 2.0** están estructurados de la siguiente manera:

---
...
- **Usuario:** <USER_REQUEST>
si, en una conversacion anterior hubo un error de bucle indefinido que provoco que se perdiera el historial del chat. me gustaria que guardes en local el historial del chat en local cada vez que se llene el chat, para evitar que vuelva a suceder esto
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:44:51-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\components\ui\LogoCascadeLoader.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\pages\QuotationsPage.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\pages\LoginPage.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\verify_all_frontend_js.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote9.py (LANGUAGE_PYTHON)
</ADDITIONAL_METADATA>


### Respaldo Automático de Conversación (2026-08-28 17:52:54)
- **Asistente (Resumen):** ¡Hola! ¿En qué te puedo ayudar hoy con **MC-LARENS ERP**?...
- **Usuario:** <USER_REQUEST>
quiero que revises todos los archvos de informacion de estes repositrio y aprensas para que sirve, de que trata, como funciona, que cambios ha tenido y todo lo que puedas recopilar
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:39:40-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\audit_vehicle_image_matching.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\process_generated_image.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote18.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote11.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote4.py (LANGUAGE_PYTHON)
</ADDITIONAL_METADATA>
- **Asistente (Resumen):** He analizado exhaustivamente todos los archivos de documentación, arquitectura, políticas de código, planes de refactorización, especificaciones de negocio, historial de git y manuales de **MC-LARENS ERP 2.0**. 

A continuación te presento un informe completo y detallado con todo lo recopilado:
...
- **Usuario:** <USER_REQUEST>
puedes recabar informacion acerca de los despliegues en el servidor de ggogle?
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:42:50-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_vertex_imagen.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\domains\vehicles\circulation_ocr.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\components\ui\BrandMosaicLoader.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote12.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote10.py (LANGUAGE_PYTHON)
</ADDITIONAL_METADATA>
- **Asistente (Resumen):** Toda la infraestructura y despliegues en **Google Cloud Platform (GCP)** y los servicios de Google asociados a **MC-LARENS ERP 2.0** están estructurados de la siguiente manera:

---
...
- **Usuario:** <USER_REQUEST>
si, en una conversacion anterior hubo un error de bucle indefinido que provoco que se perdiera el historial del chat. me gustaria que guardes en local el historial del chat en local cada vez que se llene el chat, para evitar que vuelva a suceder esto
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:44:51-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\components\ui\LogoCascadeLoader.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\pages\QuotationsPage.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\pages\LoginPage.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\verify_all_frontend_js.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote9.py (LANGUAGE_PYTHON)
</ADDITIONAL_METADATA>
- **Asistente (Resumen):** ¡Listo! He implementado y configurado un **sistema de respaldo local y prevención de bucles** directamente en el repositorio:

---
...
- **Usuario:** <USER_REQUEST>
anteriorimente se ingresaron unos archivos que grok configuro para mejorar el ocr de tarjetas de circulacion con este prompt: Eres Antigravity trabajando en el repo MC-LARENS_ERP2 (ERP de Mundo de Accesorios / McLarens, Nicaragua).



Tu misión: reescribir el escáner de Tarjeta de Circulación para que funcione como el escáner de tarjeta de Amazon/Stripe. La cámara queda abierta, hay un recuadro guía, la app captura SOLA cuando la tarjeta está nítida y alineada. NO hay que pulsar el obturador en el camino feliz. Quita Tesseract.js del navegador. Una sola llamada de visión al backend llena el formulario. El vendedor confirma antes de guardar.



No refactorices ventas, PIN, RRHH ni Docker salvo lo mínimo para este módulo.



CONTEXTO ACTUAL

- Modal: frontend/src/components/vehicles/CirculationCardOcrScannerModal.jsx

- Apply: frontend/src/components/customers/CustomerVehicleFormTabs.jsx (handleApplyOcr)

- Prefijos placa: frontend/src/pages/CustomersPage.jsx

- Cámara LAN HTTPS: frontend/src/lib/cameraAccess.js (:3443)

- Catálogo: frontend/src/lib/vehicleCatalog.js

- POST /api/vehicles/ocr-circulation-card  body { raw_text, image_base64 }

- GET /api/vehicles/decode-vin?vin=

Hoy el browser corre tesseract.js spa+eng y por eso es lento. Eso se elimina.



FLUJO OBJETIVO

1) Al abrir el modal arranca getUserMedia facingMode environment

2) Preview + recuadro guía aspecto ~1.6

3) Cada 180–250 ms puntuar EN EL CLIENTE nitidez, fill, glare

4) 3 muestras OK → auto-captura

5) JPEG ≤ 1600 px quality 0.72

6) UNA llamada POST /api/vehicles/ocr-circulation-card-v2 { image_base64 }

7) Form editable + confidence

8) Aplicar al vehículo. El OCR nunca guarda cliente/vehículo solo.

Fallback: subir archivo y captura manual si no hay lock en 8 s o si falla la cámara.



CREAR frontend/src/lib/liveDocumentScan.js con startCamera, stopCamera, scoreFrame, grabJpeg, createAutoLock.

Heurística sin OpenCV. glare < 8%, fill > 55%, streak de 3. Cámara ideal 1280x720, no 4K.



NO ROMPER onA
<truncated 53 bytes>
type, vehicle_type_slug, version_level, trim.

También numero_motor, tipo_combustible, propietario_cedula si salen.



Placas NI: M LE CH MY GR CZ MT BO CT RI NS ES MZ JI RS AN AS TM ZC PN EN CD MI OI

VIN 17 chars A-HJ-NPR-Z0-9 (sin I O Q). Cédula 001-000000-0000A.



BACKEND v2

POST /api/vehicles/ocr-circulation-card-v2

Mantén el endpoint viejo una release.

Visión (usa el vendor que ya exista en el repo: Gemini/OpenAI/etc) + normalizer NI + fuzzy vehicleCatalog + vPIC si VIN válido.

No inventar VIN ni cédula. Log latency, no loguear imagen ni PII.

Respuesta con confidence y needs_review. Slugs: sedan hatchback pickup suv van truck moto.



Prompt visión: extrae JSON de tarjeta de circulación de Nicaragua; null si no se lee; ignorar hologramas y sellos.



UI en español, sin emojis. VIN y placa grandes mono. Campos con conf < 0.85 en ámbar.

Presupuesto: foto → form < 5 s p95.



Orden: liveDocumentScan.js → reescribir modal → endpoint v2 → quitar tesseract del cliente → QA cámara/archivo/glare/apply.



Inspecciona el repo, localiza el handler real de ocr-circulation-card e implementa de punta a punta. puedes encontrar ese archvo en la carpeta de descargas C:\Users\Xinon\Downloads necesito que lo analices primero antes de ejecuar los comandos para prevenir que suceda de nuevo el error de bucle
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:49:55-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\pages\QuotationsPage.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\pages\LoginPage.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\verify_all_frontend_js.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote9.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote7.py (LANGUAGE_PYTHON)
</ADDITIONAL_METADATA>
- **Asistente (Resumen):** He localizado y analizado el archivo **`antigravity_circulacion_ni_ocr.zip`** que descargaste en `C:\Users\Xinon\Downloads`, así como el estado actual del código en el repositorio.

A continuación te presento el diagnóstico completo y el plan de acción detallado **antes de ejecutar cualquier cambio**, para evitar bucles o inconsistencias:
...
- **Usuario:** <USER_REQUEST>
si prodece
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:52:01-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\build_prompts_catalog.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\check_manifest_status.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\components\sales\SaleForm.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\lib\tintPlanResolver.js (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote17.py (LANGUAGE_PYTHON)
</ADDITIONAL_METADATA>


### Respaldo Automático de Conversación (2026-08-28 17:59:07)
- **Usuario:** <USER_REQUEST>
si, en una conversacion anterior hubo un error de bucle indefinido que provoco que se perdiera el historial del chat. me gustaria que guardes en local el historial del chat en local cada vez que se llene el chat, para evitar que vuelva a suceder esto
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:44:51-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\components\ui\LogoCascadeLoader.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\pages\QuotationsPage.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\pages\LoginPage.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\verify_all_frontend_js.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote9.py (LANGUAGE_PYTHON)
</ADDITIONAL_METADATA>
- **Asistente (Resumen):** ¡Listo! He implementado y configurado un **sistema de respaldo local y prevención de bucles** directamente en el repositorio:

---
...
- **Usuario:** <USER_REQUEST>
anteriorimente se ingresaron unos archivos que grok configuro para mejorar el ocr de tarjetas de circulacion con este prompt: Eres Antigravity trabajando en el repo MC-LARENS_ERP2 (ERP de Mundo de Accesorios / McLarens, Nicaragua).



Tu misión: reescribir el escáner de Tarjeta de Circulación para que funcione como el escáner de tarjeta de Amazon/Stripe. La cámara queda abierta, hay un recuadro guía, la app captura SOLA cuando la tarjeta está nítida y alineada. NO hay que pulsar el obturador en el camino feliz. Quita Tesseract.js del navegador. Una sola llamada de visión al backend llena el formulario. El vendedor confirma antes de guardar.



No refactorices ventas, PIN, RRHH ni Docker salvo lo mínimo para este módulo.



CONTEXTO ACTUAL

- Modal: frontend/src/components/vehicles/CirculationCardOcrScannerModal.jsx

- Apply: frontend/src/components/customers/CustomerVehicleFormTabs.jsx (handleApplyOcr)

- Prefijos placa: frontend/src/pages/CustomersPage.jsx

- Cámara LAN HTTPS: frontend/src/lib/cameraAccess.js (:3443)

- Catálogo: frontend/src/lib/vehicleCatalog.js

- POST /api/vehicles/ocr-circulation-card  body { raw_text, image_base64 }

- GET /api/vehicles/decode-vin?vin=

Hoy el browser corre tesseract.js spa+eng y por eso es lento. Eso se elimina.



FLUJO OBJETIVO

1) Al abrir el modal arranca getUserMedia facingMode environment

2) Preview + recuadro guía aspecto ~1.6

3) Cada 180–250 ms puntuar EN EL CLIENTE nitidez, fill, glare

4) 3 muestras OK → auto-captura

5) JPEG ≤ 1600 px quality 0.72

6) UNA llamada POST /api/vehicles/ocr-circulation-card-v2 { image_base64 }

7) Form editable + confidence

8) Aplicar al vehículo. El OCR nunca guarda cliente/vehículo solo.

Fallback: subir archivo y captura manual si no hay lock en 8 s o si falla la cámara.



CREAR frontend/src/lib/liveDocumentScan.js con startCamera, stopCamera, scoreFrame, grabJpeg, createAutoLock.

Heurística sin OpenCV. glare < 8%, fill > 55%, streak de 3. Cámara ideal 1280x720, no 4K.



NO ROMPER onA
<truncated 53 bytes>
type, vehicle_type_slug, version_level, trim.

También numero_motor, tipo_combustible, propietario_cedula si salen.



Placas NI: M LE CH MY GR CZ MT BO CT RI NS ES MZ JI RS AN AS TM ZC PN EN CD MI OI

VIN 17 chars A-HJ-NPR-Z0-9 (sin I O Q). Cédula 001-000000-0000A.



BACKEND v2

POST /api/vehicles/ocr-circulation-card-v2

Mantén el endpoint viejo una release.

Visión (usa el vendor que ya exista en el repo: Gemini/OpenAI/etc) + normalizer NI + fuzzy vehicleCatalog + vPIC si VIN válido.

No inventar VIN ni cédula. Log latency, no loguear imagen ni PII.

Respuesta con confidence y needs_review. Slugs: sedan hatchback pickup suv van truck moto.



Prompt visión: extrae JSON de tarjeta de circulación de Nicaragua; null si no se lee; ignorar hologramas y sellos.



UI en español, sin emojis. VIN y placa grandes mono. Campos con conf < 0.85 en ámbar.

Presupuesto: foto → form < 5 s p95.



Orden: liveDocumentScan.js → reescribir modal → endpoint v2 → quitar tesseract del cliente → QA cámara/archivo/glare/apply.



Inspecciona el repo, localiza el handler real de ocr-circulation-card e implementa de punta a punta. puedes encontrar ese archvo en la carpeta de descargas C:\Users\Xinon\Downloads necesito que lo analices primero antes de ejecuar los comandos para prevenir que suceda de nuevo el error de bucle
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:49:55-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\pages\QuotationsPage.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\pages\LoginPage.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\verify_all_frontend_js.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote9.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote7.py (LANGUAGE_PYTHON)
</ADDITIONAL_METADATA>
- **Asistente (Resumen):** He localizado y analizado el archivo **`antigravity_circulacion_ni_ocr.zip`** que descargaste en `C:\Users\Xinon\Downloads`, así como el estado actual del código en el repositorio.

A continuación te presento el diagnóstico completo y el plan de acción detallado **antes de ejecutar cualquier cambio**, para evitar bucles o inconsistencias:
...
- **Usuario:** <USER_REQUEST>
si prodece
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:52:01-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\build_prompts_catalog.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\check_manifest_status.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\components\sales\SaleForm.jsx (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\lib\tintPlanResolver.js (LANGUAGE_JAVASCRIPT)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote17.py (LANGUAGE_PYTHON)
</ADDITIONAL_METADATA>
- **Asistente (Resumen):** He completado la implementación y modernización del **Escáner de Tarjetas de Circulación en Vivo** siguiendo fielmente las especificaciones de Grok y el skill de Antigravity:

---
...
- **Usuario:** <USER_REQUEST>
se peuede hacer un redespliegue para ver los resultados en la pagina https://mclarens-erp-836176703716.us-central1.run.app/login podrias confirmarlo tu,  usa el pin 01011990
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-28T17:54:07-06:00.

The user's current state is as follows:
Active Document: c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\test_real_cards_ocr.py (LANGUAGE_PYTHON)
Cursor is on line: 1
Other open documents:
- c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\db\distributed.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\inspect_lote1_images.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\ingest_lote1.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\process_incoming_grok_hyundai_kia_images.py (LANGUAGE_PYTHON)
- c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\build_official_catalog_index.py (LANGUAGE_PYTHON)
</ADDITIONAL_METADATA>
- **Asistente (Resumen):** Estoy buscando la instalación de Google Cloud SDK en tu equipo para ejecutar el comando de despliegue a Cloud Run......
- **Asistente (Resumen):** Verificando si `gcloud` se encuentra configurado en el entorno de Bash / WSL......
- **Asistente (Resumen):** Enviando los cambios a GitHub (`git push origin master`)......

---

### Sesión 2026-09-01 (Corrección Logo Neón, Skins en Backend y Regla Cloud Shell One-Liner)
- **Acciones realizadas:**
  1. **Logotipo McLarenS Login:** Eliminado halo difuso de neón y animación; aplicado contorno nítido de 1px (`.logo-mclarens-contour`).
  2. **Error "Invalid theme skin":** Agregadas las marcas oficiales (`mclarens`, `auxbeam`, `fox`, `rigid`, `solargard`, `ds18`, `keko`, `autobull`, `afn`) a `ALLOWED_THEME_SKINS` en `backend/server.py`.
  3. **Regla de Operación:** Al finalizar cada respuesta con cambios/correcciones, mostrar siempre el comando one-liner de actualización y redespliegue para Google Cloud Shell.

---

### Sesión 2026-09-02 (Optimización y Verificación Integral de OCR para Circulación Vehicular Nicaragüense)
- **Contexto y Reglas de Negocio del Documento:**
  - El Frente de la Tarjeta de Circulación contiene únicamente: Placa, Chasis/VIN, Motor, Color, Tipo de Vehículo, Marca y Modelo.
  - La fecha de "Emisión" es la fecha de expedición del trámite/documento, **NO es el año de fabricación del vehículo**.
  - El Año de Fabricación real se encuentra en el Reverso de la tarjeta.
  - El flujo de escaneo solicita la foto frontal (obligatoria) y la foto trasera (opcional). Si no hay reverso, se infiere del 10mo dígito del VIN (ISO 3779).
- **Acciones y Mejoras Implementadas:**
  1. **Motor OCR Backend (`backend/domains/vehicles/circulation_ocr.py`):**
     - Fallback ultrarrápido con Windows WinRT PowerShell (`[Windows.Media.Ocr.OcrEngine]`) procesando en ~450-570ms offline.
     - Prohibición estricta de usar la fecha de emisión como año de fabricación en prompts de visión.
     - Soporte para `image_back_base64` en `process_circulation_card_v2` con extractor dedicado `parse_circulation_card_back_text`.
     - Tabla WMI (`MR0`, `JTD` -> Toyota, `KNA` -> Kia, `WBA` -> BMW, `3N1` -> Nissan, etc.) para inferencia de marca y modelos nicaragüenses scoped por marca.
     - Inferencia del año mediante decodificación del 10mo carácter del VIN con tracking de fuente (`reverso_tarjeta`, `inferido_vin`, `no_detectado`).
  2. **Endpoint Backend (`backend/server.py`):**
     - `/api/vehicles/ocr-circulation-card-v2` ahora procesa `image_base64` (frente) e `image_back_base64` (reverso).
  3. **Frontend Modal UI (`frontend/src/components/vehicles/CirculationCardOcrScannerModal.jsx`):**
     - Nueva UI dual con previsualización para el Frente (datos) y Reverso (año).
     - Botones para escanear/subir el reverso opcional en vivo o por archivo sin perder los datos del frente.
     - Badges de procedencia de año (`✓ Reverso`, `Del VIN`, `Revisa`) y llamada explicativa sobre la fecha de emisión.
  4. **Pruebas de Validación:**
     - `images.jpg` (Toyota Hilux): Placa `M 145-835`, Chasis `MR0FR22G800550800`, Motor `207854925`, Color `Blanco`, Tipo `Camioneta / Pickup`.
     - `images (1).jpg` (Kia Rio): Placa `LE 29646`, Chasis `KNADM4A3XD6124749`, Motor `G4FDCHS30772`, Año `2013` (del VIN).
     - `images (4).jpg` (Toyota Yaris): Placa `CZ 13206`, Chasis `JTDBW923X01121180`, Motor `2NZ5032362`, Tipo `Sedán`.
     - `images (6).jpg` (BMW X3): Placa `M 243-616`, Chasis `WBAWX9107G0K0K057`, Motor `A9821078`, Año `2016` (del VIN).
  5. **Regla de Entrada Directa de Año para el Operador:**
     - Establecida en `.agents/rules/circulation_card_ocr_rules.md` y `.agents/skills/circulacion-ni-ocr/SKILL.md`.
     - Cuando el Chasis/VIN no codifica el año (ej. Toyota/Isuzu con `0`), el sistema **NUNCA fuerza una segunda captura del reverso**.
     - En su lugar, el sistema enfoca automáticamente el campo de Año (`autoFocus` / `select`), muestra botones de años rápidos (`2024`, `2023`, `2022`, ...) y permite aplicar directamente con `Enter` o clic.
  6. **Forzado de Lente Principal 1x y Controles de Zoom en Móvil:**
     - En teléfonos modernos, los navegadores abren por defecto el sensor Gran Angular 0.5x (foco fijo lejano, incapaz de enfocar a 15 cm).
     - Se implementó `getBackCameras()` en `liveDocumentScan.js` para descartar lentes `ultra`, `wide`, `0.5x` y forzar la lente 1x con `focusMode: "continuous"`.
     - Controles en pantalla: botones rápidos `[ 1x ]`, `[ 1.5x ]`, `[ 2x (Macro) ]` y `[ 🔄 Lente ]`.
  7. **Filtro de Calidad Previo (Client-side Anti-Quemado de Tokens):**
     - Función `vvalidateImageQuality()` analiza reflejos cegadores (`glareRatio > 0.07`), borrosidad (Laplaciano `< 13.5`) y baja iluminación antes de enviar a la IA.
  8. **Lista Negra Anti-Encabezados Institucionales y Eliminación de Cédula:**
     - `HEADER_BLACKLIST_WORDS` en `circulation_ocr.py` descarta textos como "República de Nicaragua" o "Policía Nacional" para evitar contaminar chasis y placa.
     - Eliminado el campo Cédula de Identidad de las respuestas y del modal por no ser relevante para recepción vehicular.

---

### Sesión 2026-09-03 (Resolución Cuota 429, Esquema REST camelCase, Auto-Vinculación con Catálogo Vehicular y Validación Flexible)
- **Incidencias Atendidas y Resoluciones:**
  1. **Diagnóstico de Falso Positivo / Caracteres Basura (`VEE8A119YDLETELAT`):**
     - **Causa:** La API Key configurada arrojaba `HTTP 429 RESOURCE_EXHAUSTED: Your prepayment credits are depleted`.
     - Al fallar la IA de visión por cuota, el backend caía en cascada al Tier 4 (Tesseract OCR local), el cual leía marcas de agua y hologramas en la tarjeta.
     - **Solución:** Corrección de la llamada a Vertex AI en Cloud Run (`gcloud services enable aiplatform.googleapis.com --project gen-lang-client-0971793042`) y actualización a modelos activos (`gemini-2.5-flash`, `gemini-flash-latest`, `gemini-1.5-flash`).
  2. **Corrección de Esquema REST en Gemini API:**
     - En llamadas HTTP REST directas (`urllib.request`), Google exige `inlineData`, `mimeType` y `responseMimeType` en **camelCase**.
     - Se reemplazaron las propiedades en snake_case que causaban `HTTP 400 Bad Request`.
  3. **Corrección del Error "Marca, año y modelo deben seleccionarse desde la lista":**
     - **Causa:** El catálogo interno de 8,300+ vehículos usa etiquetas con rangos generacionales (ej. `"Rio [2011-2017]"`). El OCR extraía el nombre plano `"Rio"`, haciendo que el validador estricto (`isValidVehicleSelection`) rechazara el guardado.
     - **Solución:**
       - `handleApplyOcr` ahora llama a `findCatalogEntryForVehicle(brand, year, model)` para vincular automáticamente el nombre plano con la entrada exacta del catálogo (`Rio [2011-2017]`).
       - `isValidVehicleSelection` en `vehicleCatalog.js` flexibilizado para aceptar coincidencias exactas, entradas resueltas de catálogo, nombres base y mayúsculas/minúsculas.
       - Auto-detección de variante de cabina en camionetas (`camioneta-cabina-y-media` para doble cabina).
       - Activación automática de `add_vehicle: true` y cambio de pestaña a `vehicle` al aplicar el escaneo.
   4. **Documentación Técnica Creada:**
      - `docs/ocr_architecture_and_troubleshooting.md`: Manual de arquitectura en 5 niveles de fallback y guía de resolución rápida.
      - Actualizados `.agents/rules/circulation_card_ocr_rules.md` y `.agents/skills/circulacion-ni-ocr/SKILL.md`.

---

### Sesión 2026-09-03 (Corrección Mismatch de Chasis/VIN Extendido y Clasificación "Camioneta Station / SUV")
- **Incidencias Atendidas y Resoluciones:**
  1. **Mismatch en Número de Chasis / VIN (Truncamiento a 17 Caracteres):**
     - **Problema:** En vehículos con número de chasis extendido (ej. BMW X3 con `Chasis WBAWX9107G0K0K05752` de 19 caracteres), el sistema truncaba los últimos dos dígitos (`52`), mostrando en pantalla `WBAWX9107G0K0K057`. Además, el input modal limitaba la entrada a `maxLength={17}`.
     - **Causa:** `normalize_vin` forzaba cortes `sub = fixed[0:17]`, el prompt de visión instruía buscar exactamente 17 caracteres, y el modal restringía a 17 caracteres.
     - **Solución:**
       - `normalize_vin` preserva íntegramente series de 8 a 22 caracteres sin truncar dígitos válidos posteriores.
       - Actualizado `SYSTEM_VISION_PROMPT` para instruir a la IA a extraer el número de chasis completo sin importar su longitud.
       - En `CirculationCardOcrScannerModal.jsx`, cambiado el label a `Chasis / VIN:` y ampliado `maxLength={25}`.
       - Actualizado el endpoint en `server.py` para consultar vPIC usando `vin[:17]` si el chasis tiene $\ge 17$ caracteres.
  2. **Mismatch en Tipo de Carrocería ("Camioneta / Pickup" en lugar de "Camioneta Station / SUV"):**
     - **Problema:** Tarjetas de circulación con clasificación `CAMIONETA,BMW,X3 2.8I` y sub-clasificación `ST/WAGON` se clasificaban erróneamente como `Camioneta / Pickup`.
     - **Causa:** `VEHICLE_TYPE_SLUG_MAP["pickup"]` contenía la palabra clave genérica `"camioneta"`, la cual evaluaba primero y absorbía todos los vehículos cuya primera línea decía "CAMIONETA" (incluyendo Station Wagons/SUVs).
     - **Solución:**
       - Reordenada la jerarquía en `resolve_vehicle_type_slug`: los indicadores explícitos de SUV/Station Wagon (`st/wagon`, `station wagon`, `rural`, `camioneta cerrada`, `camioneta station`, etc.) y modelos conocidos de SUV (`X3`, `Prado`, `Fortuner`, `RAV4`, `Tucson`, etc.) tienen máxima prioridad.
       - La categoría `pickup` solo se asigna si hay indicadores de tina/batea (`d/cabina`, `cabina sencilla`, `pickup`, etc.) o modelos pickup (`Hilux`, `Frontier`, `D-Max`, etc.).
       - Actualizada la etiqueta canónica en backend y frontend a **`Camioneta Station / SUV`** (`suv`).
  3. **Corrección en `clean_ocr_text` (Protección contra Líneas Mixtas de OCR Local):**
     - Se reemplazó el filtro que descartaba líneas completas por un limpiador regex de frases institucionales (`HEADER_PHRASES`), permitiendo que líneas combinadas de Windows OCR conserven placa, chasis y motor.

---

### Sesión 2026-09-19 (Lote Integración Master: Merges PR #12, #13, #14, #15, Quick View Fullscreen Carousel, Badge Universal, Scrub China Origin)
- **Acciones y Mejoras Implementadas:**
  1. **Consolidación de Ramas y PRs en Master:**
     - Merge de PR #12 (`docs/antigravity-pr2-productthumb`), PR #13 (`fix/build-badge-shows-deploy-id`), PR #14 (`fix/product-quickview-image-aspect-20260918`) y PR #15 (`docs/antigravity-prompt-acumulado-20260919`).
     - Badge de Header (`MainLayout.jsx`) ahora muestra dinámicamente `BUILD_ID` y hora exacta del despliegue en Google Cloud Run.
  2. **Completar Quick View Modal (`ProductQuickViewDialog.jsx`):**
     - Al tocar/hacer clic en la foto principal del modal de detalle, se abre un **Lightbox Pantalla Completa** con fondo backdrop difuminado oscuro.
     - Carrusel completo con botones flotantes Anterior (`<`) y Siguiente (`>`) accesibles en hover para desktop y táctil en móviles.
     - Navegación por teclado (`Escape` para cerrar, `ArrowLeft` / `ArrowRight` para cambiar imagen) y gestos táctiles de deslizamiento (swipe).
     - Contador de imágenes `n / total` y tira inferior de miniaturas para salto directo a cualquiera de las fotos.
     - Eliminado el zoom scale interno que recortaba los bordes de los productos en el diálogo regular, usando `object-contain` nítido.
  3. **Badge "Universal" y Filtros de Compatibilidad (`CatalogPage.jsx` & `ProductQuickViewDialog.jsx`):**
     - Si `compatibility.is_universal === true` o el producto contiene `compatibilidad_texto`, se despliega el badge verde **Universal** (con icono de destellos) o el detalle de aplicación.
     - Se eliminó el texto engañoso "Sin datos de compatibilidad" para productos universales.
     - En modo selección de venta (`sale-pick`), los productos con `is_universal` superan el filtro vehicular y están siempre disponibles para agregar.
  4. **Scrubbing de Procedencia China en Todo el Catálogo:**
     - Limpieza de 32 productos en semillas maestras (`backend/data/seeds/all_catalogs_unified_seed.json`) eliminando textos como `"Lugar de origen: Guangdong, China"`, `"Made in China"` y encabezados vacíos de `"Detalles rápidos"`.
     - Script ejecutable `scripts/scrub_china_origin_live.py` y `scripts/scrub_china_origin.ps1`.
     - Reporte JSON de auditoría generado en `docs/SCRUB_CHINA_ORIGIN_20260919.json` y `scripts/reports/SCRUB_CHINA_ORIGIN_20260919.json` con la etiqueta `scrub_china_origin_20260919`.
     - Módulo de defensa en frontend `frontend/src/lib/sanitizeCopy.js` (`sanitizeProductCopy` y `isUniversalProduct`) aplicado en el Catálogo y en la Vista Rápida.

---

### Sesión 2026-09-24 (Validación Buscador PR #42 y Despliegue P0 de Seguridad S1 Idempotencia + C1 Validación de Dinero en Servidor)
- **Acciones y Mejoras Implementadas:**
  1. **Smoke y Verificación de Buscador PR #42:**
     - Verificado en código y ejecutada suite unitaria en Node.js de `frontend/src/lib/productLookup.test.js`: 12/12 tests PASS.
     - Presionar `Enter` cierra el autocompletado y desenfoca sin disparar la Vista Rápida accidentalmente ni recargar.
     - Búsqueda multi-término AND funciona a través de SKU, nombre, marca, categoría, descripción, compatibilidad vehicular y bombillo.
     - Selección automática del texto (`select-all`) al enfocar con protección mouseup en `CatalogPage.jsx` y `SaleForm.jsx`.
  2. **Implementación de S1 (Idempotency-Key en Mutaciones Críticas - `backend/core/idempotency.py`):**
     - Módulo dedicado para extracción de clave desde cabeceras HTTP (`Idempotency-Key`, `X-Idempotency-Key`), payload JSON o `draft_id`.
     - Almacenamiento en colección `idempotency_records` con índice TTL automático de 24 horas y caché en memoria para baja latencia.
     - Bloqueo y protección contra condiciones de carrera concurrentes (`in_progress`), retornando HTTP 409 si un reintento idéntico llega en el mismo milisegundo.
     - Integración en creación de ventas (`POST /api/sales`), cobros en caja (`POST /caja/facturas/{sale_id}/cobrar`, `POST /cashier/invoices/{sale_id}/collect`).
     - Al reintentar la misma petición con igual clave, el servidor responde con la venta/cobro original sin volver a descontar inventario ni duplicar registros.
  3. **Implementación de C1 (Validación y Recálculo de Dinero en Servidor - `backend/core/money_vvalidate.py`):**
     - El cliente no es fuente de verdad del dinero; el backend calcula y valida montos estrictamente.
     - Saneamiento y validación de cantidades de ítems ($1 \le qty \le 10,000$), rechazo estricto de cantidades negativas, nulas o flotantes.
     - Validación de descuentos por línea ($0.0\% \le disc \le 100.0\%$), rechazando descuentos negativos o superiores al 100%.
     - `enforce_server_settlement_total`: Si el cliente envía un `total_amount` manipulado con una discrepancia $> \$0.05$ respecto al cálculo del servidor, se rechaza con `HTTP 409 TOTAL_MISMATCH` retornando el desglose exacto esperado por el backend.
  4. **Pruebas y Verificación Automatizada (`backend/tests/test_idempotency_and_money.py`):**
     - Pruebas unitarias completas de extracción de headers, ciclo de vida de idempotencia (inicio, concurrencia 409, finalización y cache hit).
     - Validación de rechazo de montos manipulados y recálculo con 100% de éxito (`ALL S1 & C1 TESTS PASSED SUCCESSFULLY`).
  5. **Actualización de Documentación:**
     - Actualizada tabla de cierre en `docs/ANTIGRAVITY_PLAN_PR42_API_SECURITY_12_20260922.md` marcando PR #42, Idea #9 (Idempotency Key) y Regla Case C1 como **DONE**.
  6. **Implementación de S2 (Rate Limiting en PIN y Mutaciones Sensibles - `backend/middlewares/rate_limit.py`):**
     - Módulo de ventana deslizante en memoria `SlidingWindowRateLimiter` para discriminar tráfico por IP y señal de terminal/dispositivo (C6).
     - Límite de ráfaga estricto en `/api/auth/pin/login` (máximo 5 peticiones cada 10 segundos, 20 por minuto). Al excederse, responde con `HTTP 429 Too Many Requests`, cabecera `Retry-After` y JSON estructurado.
     - Límite de 60 mutaciones por minuto en endpoints sensibles de caja, ventas e inventario (`/api/sales`, `/caja/facturas/`, `/api/inventory`).
     - Suite unitaria automatizada en `backend/tests/test_rate_limit.py` ejecutada con 100% PASS.
     - Registrado `RateLimitMiddleware` en `backend/server.py`.
  7. **Implementación de S3 (Higiene de Errores sin Stack Traces en Prod - `backend/core/error_handler.py`):**
     - Módulo `register_error_handlers(app)` que captura excepciones imprevistas (`Exception`) y `HTTPException`.
     - Registro seguro y detallado en logs internos para observabilidad/depuración de backend sin exponer trazas a clientes externos.
     - Respuesta limpia y estandarizada `HTTP 500 INTERNAL_SERVER_ERROR` sin nombres de archivos, números de línea ni palabras clave de tracebacks.
     - Suite unitaria automatizada en `backend/tests/test_error_hygiene.py` ejecutada con 100% PASS.



   8. **Implementación de S4 (Audit Logging de Mutaciones Críticas) y C4 (Observabilidad de Abuso):**
      - Creado módulo dedicado backend/core/audit_log.py con motor recursivo de sanitización sanitize_for_audit que redacta incondicionalmente claves y subcadenas sensibles (pin, session_token, password, secret, authorization, auth, cvv, card_number, pan, Bearer tokens).
      - Función record_critical_mutation que registra trazabilidad de mutaciones críticas (CREATE_SALE, COLLECT_INVOICE, VOID_INVOICE, PIN_LOGIN) tanto en éxito (status='ok') como en fallo (status='fail'), con user_id, path, action, resource_id, ip, details saneados y persistencia en MongoDB (db.critical_audit_logs).
      - Clase AbuseSignalTracker y helper record_abuse_signal (C4) que detecta en tiempo real mediante ventanas deslizantes patrones sospechosos: ráfagas de 401 (401_BURST, 5 en 60s), picos de 429 (429_SPIKE, 5 en 60s) y fallos repetidos de finalización/settlement (FINALIZE_FAIL, 3 en 60s). Emite logs estructurados [ABUSE_SIGNAL] y persiste alertas en db.security_abuse_events.
      - Integración activa en backend/server.py (create_sale, collect_sale_invoice, cancel_cashier_invoice, login_with_pin, ensure_runtime_indexes) y en backend/middlewares/rate_limit.py (bloqueos 429 disparan señal de abuso).
      - Suite unitaria automatizada en backend/tests/test_audit_abuse.py ejecutada con 100% PASS.
      - Actualizada tabla de cierre en docs/ANTIGRAVITY_PLAN_PR42_API_SECURITY_12_20260922.md marcando Idea #10 (Audit Logging) y Caso C4 como DONE.
   9. **Implementación de S5 (Authz / BOLA Protection) y C3 (Least Privilege / Separación Lecturas vs Mutaciones):**
      - Creado módulo dedicado backend/core/authz_bola.py con guardas can_access_resource y enforce_resource_ownership para mitigar ataques BOLA (Broken Object Level Authorization).
      - Los vendedores y técnicos quedan restringidos a acceder únicamente a recursos de su propia sucursal o de su autoría (salesperson_id, technician_id, branch_id), mientras que roles administrativos globales (gerencia, supervisor, recursos_humanos, programador) mantienen visibilidad global.
      - Validación de BOLA integrada en GET /sales/{sale_id}, GET /work-orders/{work_order_id} y POST /samples/{sample_id}/return, rechazando accesos no autorizados con HTTP 403 FORBIDDEN_OBJECT_ACCESS.
      - Principio de Menor Privilegio (Least Privilege / C3): Separadas lecturas públicas/abiertas de catálogos y productos contra mutaciones privilegiadas de stock e inventario (POST /products, PUT /products/{id}) y dinero/caja (POST /sales, /caja/facturas/{id}/cobrar, anular), blindadas con roles específicos.
      - Suite unitaria automatizada en backend/tests/test_authz_bola.py ejecutada con 100% PASS.
      - Actualizada tabla de cierre en docs/ANTIGRAVITY_PLAN_PR42_API_SECURITY_12_20260922.md marcando Idea #2 (Authorization), Idea #8 (Least Privilege) y Caso C3 como DONE.

   10. **Implementación de C2 (Session Idle TTL e Invalidación en Cierre de Turno / Cambio de Rol):**
       - Módulo backend/domains/auth/session_policy.py: configurado idle timeout de cajero en 10 horas (600 minutos, dentro de la ventana de 8-12 horas de jornada continua de caja), manteniendo 5 minutos en terminales de piso/ventas y 60 minutos en roles administrativos.
       - Creado módulo backend/core/session_security.py con helpers invvalidate_user_sessions, invvalidate_session_token y check_session_validity.
       - Integrado en backend/server.py:
         - En POST /caja/cierre: invalidación automática de sesiones activas del cajero al cerrar el turno (reason='caja_cierre').
         - En PUT /users/{user_id}/role: invalidación inmediata de todas las sesiones activas del usuario modificado (reason='role_change') para forzar re-autenticación con sus nuevos privilegios.
       - Suites unitarias automatizadas en backend/tests/test_session_policy.py y backend/tests/test_session_ttl.py ejecutadas con 100% PASS.
       - Actualizada tabla de cierre en docs/ANTIGRAVITY_PLAN_PR42_API_SECURITY_12_20260922.md marcando Idea #1 (Authentication) y Caso C2 como DONE.

   11. **Implementación de S6 (Input Validation & Output Encoding - Top 12 #4 y #5):**
       - Creado módulo dedicado backend/core/validation_encoding.py con validadores y filtros seguros:
         - strip_html_tags y nencode_safe_html: neutraliza scripts (<script>...</script>), pseudo-protocolos javascript:, eventos maliciosos (onerror=...) y codifica entidades HTML.
         - sanitize_text: elimina bytes nulos \x00 y caracteres de control no imprimibles, aplicando saneamiento de etiquetas y limitación de longitud.
         - validate_identifier: valida formato alfanumérico estricto (^[a-zA-Z0-9_\-\.]+$) previniendo ataques de path traversal (../) e inyecciones en parámetros de ruta.
         - validate_numeric_range: asegura números finitos válidos rechazando NaN, Inf y valores negativos fuera de rango.
         - Validadores por endpoint: validate_sale_input (ventas), validate_cashier_collect_input (cobro), validate_cashier_cancel_input (anulación con justificación interna >= 20 caracteres) y validate_pin_login_input (4-12 dígitos numéricos estrictos).
         - sanitize_output_for_json y build_secure_json_response: sanitización recursiva de respuestas JSON salientes y emisión de cabeceras de seguridad MIME (Content-Type: application/json; charset=utf-8, X-Content-Type-Options: nosniff).
       - Integrado en backend/server.py protegiendo /api/sales, /cashier/invoices/{sale_id}/collect, /caja/facturas/{sale_id}/anular, /api/auth/pin/login, /sales/{sale_id}, /work-orders/{work_order_id} y /samples/{sample_id}/return.
       - Suite unitaria automatizada en backend/tests/test_validation_encoding.py ejecutada con 100% PASS.
       - Actualizada tabla de cierre en docs/ANTIGRAVITY_PLAN_PR42_API_SECURITY_12_20260922.md marcando Idea #4 (Input Validation) e Idea #5 (Output Encoding) como DONE.

   12. **Implementación de F1 (Frontend Idempotency-Key Header en Finalizar Venta y Cobro de Factura):**
       - frontend/src/pages/SalesPage.jsx: Inyección de cabecera HTTP 'Idempotency-Key': (window.crypto?.randomUUID ? window.crypto.randomUUID() : ...) en las llamadas POST /sales (tanto flujo estándar como venta rápida) sin tocar la lógica de borradores, totales ni estados de formulario.
       - frontend/src/pages/QuotationsPage.jsx: Inyección de cabecera HTTP 'Idempotency-Key' en la conversión de cotización a venta POST /sales.
       - frontend/src/pages/CashierPage.jsx: Inyección de cabecera HTTP 'Idempotency-Key' en el cobro de factura en caja POST /caja/facturas/{sale_id}/cobrar.
       - Protección integral de extremo a extremo: si el usuario o cajero realiza un doble tap o experimenta reconexión de red, la clave de idempotencia enviada en los headers HTTP garantiza que el servidor procese la operación exactamente una vez.
       - Actualizada tabla de cierre en docs/ANTIGRAVITY_PLAN_PR42_API_SECURITY_12_20260922.md marcando Idea #9 (Idempotency Key) con soporte completo frontend (F1) y backend (S1).
