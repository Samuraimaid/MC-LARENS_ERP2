# Regla: Extracción y Validación de Tarjetas de Circulación (Nicaragua)

Esta regla define el comportamiento obligatorio para cualquier módulo, componente frontend o endpoint de backend relacionado con el OCR de Tarjetas de Circulación de Nicaragua en **MC-LARENS ERP 2.0**.

---

## 1. Reglas del Documento de Circulación
1. **Cara Frontal (Captura Principal y Obligatoria):**
   - Contiene únicamente: `Placa`, `Chasis/VIN`, `Número de Motor`, `Color`, `Tipo de Vehículo/Carrocería`, `Marca` y `Modelo`.
   - **PROHIBICIÓN ESTRICTA:** La fecha identificada como **"Emisión"** (`DD/MM/YYYY`) en el frente es la fecha administrativa del trámite. **NUNCA debe asignarse ni interpretarse como el año de fabricación del vehículo**.

2. **Año de Fabricación (Inferencia y Entrada Directa del Operador):**
   - **Inferencia por VIN (ISO 3779):** Si el chasis tiene 17 caracteres y el 10mo dígito corresponde a un año válido según el estándar internacional (ej. `D`=2013, `G`=2016, `N`=2022), el sistema lo asigna automáticamente con origen `inferido_vin`.
   - **REGLA DE SOLICITUD DIRECTA AL OPERADOR:** Si el Chasis **NO codifica el año** (por ejemplo, chasis de Toyota, Isuzu o Nissan con `0` en la 10ma posición, chasis cortos o no estándar):
     1. El sistema **NUNCA debe obligar, forzar ni requerir al operador** que tome una segunda captura del reverso.
     2. El sistema debe **solicitar directamente el año al operador en pantalla**, enfocando y resaltando de inmediato el campo `Año de Fabricación`.
     3. El operador puede escribir el año inmediatamente en 1 segundo y presionar **"Aplicar al Vehículo"** sin pasos adicionales.
     4. La captura de foto del reverso permanece únicamente como una opción secundaria y voluntaria.

---

## 2. Experiencia de Usuario (UI / Frontend)
- El formulario extraído debe permitir la edición inmediata de cualquier campo.
- Si el año falta, el campo de Año debe tener foco automático (`autoFocus`) o un indicador visual claro para agilizar el ingreso con botones rápidos de años comunes.
- El operador siempre tiene el control final: ningún dato se guarda en base de datos sin la confirmación explícita del usuario (`onApply`).
- **Control de Lentes en Móvil:** El escáner debe forzar siempre la lente principal 1x (descartando lentes ultra gran angular 0.5x que causan desenfoque) y ofrecer controles en vivo `[ 1x ]`, `[ 1.5x ]`, `[ 2x ]` y `[ 🔄 Lente ]`.

---

## 3. Diagnóstico de Incidencias, Fallback y Arquitectura de Visión

### A. Fallback en Casos de Cuota Agotada (HTTP 429) o Error de API
- **Problema Conocido:** Si la API Key de Google AI Studio devuelve `429 RESOURCE_EXHAUSTED` (créditos prepagos o cuota gratuita agotada), el backend automáticamente recurre a los siguientes niveles en cascada:
  1. `Tier 1`: **Vertex AI Gemini Multimodal** (Nativo en Cloud Run, usa credenciales de servicio GCP sin API Key).
  2. `Tier 2`: **Google AI Studio Gemini REST** (`gemini-2.5-flash`, `gemini-flash-latest`, `gemini-1.5-flash`).
  3. `Tier 3`: **OpenAI Vision API** (si está configurada `OPENAI_API_KEY`).
  4. `Tier 4`: **Tesseract OCR local** (servidor Docker / Linux).
  5. `Tier 5`: **Windows Media OCR nativo** (entorno de desarrollo local).
- **Comportamiento Anómalo en Fallback:** Si la IA falla y se activa Tesseract en una foto de cámara móvil, Tesseract no posee entendimiento semántico y puede leer texto espurio del fondo o de marcas de agua (ej. `VEE8A119YDLETELAT`).
- **Solución Rápida:** Habilitar Vertex AI en el proyecto de GCP (`gcloud services enable aiplatform.googleapis.com --project gen-lang-client-0971793042`) o renovar la API key gratuita en [Google AI Studio](https://aistudio.google.com/apikey).

### B. Formato de Payload REST de Gemini Vision (camelCase Obligatorio)
- En llamadas directas vía HTTP/REST (`urllib.request`) a `generativelanguage.googleapis.com/v1beta/models/...`:
  - Se DEBE usar `"inlineData": { "mimeType": "image/jpeg", "data": "..." }` (en camelCase).
  - En `generationConfig` se DEBE usar `"responseMimeType": "application/json"` (en camelCase).
  - El uso de `inline_data` o `response_mime_type` (snake_case) es rechazado por el endpoint REST con error `400 Bad Request`.

### C. Selección de Lente de Cámara 1x en Teléfonos Móviles
- Los navegadores móviles suelen indexar el sensor ultra gran angular (0.5x) como la primera cámara trasera.
- La lente 0.5x tiene foco infinito/fijo a gran distancia y distorsión de barril; a 15 cm de distancia es incapaz de enfocar el texto pequeño de la tarjeta.
- `liveDocumentScan.js` debe filtrar las cámaras mediante `getBackCameras()` descartando etiquetas `ultra`, `wide`, `0.5x` y forzar `zoom >= 1.0` con `focusMode: "continuous"`.

