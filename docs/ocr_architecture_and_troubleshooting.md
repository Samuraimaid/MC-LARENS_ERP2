# Manual de Arquitectura y Resolución de Incidencias: Escáner OCR de Circulación (Nicaragua)

Este documento describe la arquitectura, niveles de fallback, causas raíz de incidencias conocidas y procedimientos de resolución para el escáner de tarjetas de circulación de Nicaragua en **MC-LARENS ERP 2.0**.

---

## 1. Arquitectura Multi-Nivel de Extracción (OCR Cascade)

El endpoint `POST /api/vehicles/ocr-circulation-card-v2` implementa una estrategia de fallback en 5 niveles para garantizar alta disponibilidad:

```
[Cliente Web / Móvil]
       │
       ▼ (Foto en Base64 JPEG/PNG)
┌────────────────────────────────────────────────────────┐
│ Tier 1: Vertex AI Gemini Multimodal (GCP Cloud Run)    │ ◄── Sin API Key manual (Credenciales de servicio)
└──────────────────────────┬─────────────────────────────┘
                           │ (Si falla o no está en Cloud Run)
┌──────────────────────────▼─────────────────────────────┐
│ Tier 2: Google AI Studio REST API (GEMINI_API_KEY)     │ ◄── gemini-2.5-flash / gemini-flash-latest / 1.5-flash
└──────────────────────────┬─────────────────────────────┘
                           │ (Si 429 Quota Exceeded / Bad Key)
┌──────────────────────────▼─────────────────────────────┐
│ Tier 3: OpenAI Vision API (OPENAI_API_KEY)             │
└──────────────────────────┬─────────────────────────────┘
                           │ (Si no hay conexión externa)
┌──────────────────────────▼─────────────────────────────┐
│ Tier 4: Tesseract OCR Local (Linux Docker)             │ ◄── Fallback heurístico
└──────────────────────────┬─────────────────────────────┘
                           │ (Si estamos en Windows Dev)
┌──────────────────────────▼─────────────────────────────┐
│ Tier 5: Windows Media OCR Nativo (PowerShell / WinRT)  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Incidencias Conocidas y Soluciones Rápidas

### Incidencia 1: Texto Basura / Caracteres Extraños (`VEE8A119YDLETELAT`, Placa y Motor Vacíos)

- **Síntoma:** El escáner extrae letras sin sentido en el Chasis/VIN y deja la Placa o el Motor en blanco.
- **Causa Raíz:** La API de Google devolvió `HTTP 429 RESOURCE_EXHAUSTED` con el mensaje:
  > *"Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing."*
  Al agotarse la cuota de la API Key externa, el backend activó automáticamente el **Tier 4 (Tesseract OCR local)**. Tesseract no tiene comprensión visual y confunde los hologramas azules y marcas de agua de la tarjeta con letras del chasis.
- **Solución 1 (Permanente y Recomendada):**
  Activar Vertex AI en el proyecto de Google Cloud para que Cloud Run use Gemini nativamente con los créditos de GCP:
  ```bash
  gcloud services enable aiplatform.googleapis.com --project gen-lang-client-0971793042
  ```
- **Solución 2 (Clave de Repuesto):**
  Generar una nueva API Key gratuita en [Google AI Studio](https://aistudio.google.com/apikey) y actualizar la variable `GEMINI_API_KEY` en el despliegue de Cloud Run.

---

### Incidencia 2: Fotos Borrosas en Teléfonos Móviles (Lente Gran Angular 0.5x)

- **Síntoma:** Al abrir el escáner en teléfonos modernos (Samsung Galaxy, Xiaomi, iPhone, Motorola), la imagen en el visor se ve desenfocada y no enfoca el texto a 15-20 cm.
- **Causa Raíz:** El navegador móvil por defecto asigna el primer sensor trasero de `navigator.mediaDevices.enumerateDevices()`, que casi siempre es la **lente Ultra Gran Angular (0.5x)**. Esta lente está diseñada para paisajes lejanos (foco fijo a más de 1 metro) y produce distorsión de barril.
- **Solución Implementada:**
  - En `frontend/src/lib/liveDocumentScan.js`, la función `getBackCameras()` filtra y descarta sensores con nombres `ultra`, `wide`, `0.5x`, `macro` o auxiliares, priorizando la **cámara principal 1x**.
  - Se fuerza `zoom >= 1.0` y auto-enfoque continuo (`focusMode: "continuous"`).
  - Se añadieron botones rápidos en el visor: `[ 1x ]`, `[ 1.5x ]`, `[ 2x (Macro) ]` y `[ 🔄 Lente ]` para alternar manualmente entre cámaras físicas.

---

### Incidencia 3: Filtro de Calidad Previo (Anti-Quemado de Tokens)

- **Síntoma:** El usuario toma una foto con reflejo directo de luz artificial o desenfocada.
- **Causa Raíz:** Enviar imágenes cegadas por flash o desenfocadas consume tokens de IA innecesariamente.
- **Solución Implementada:**
  - `validateImageQuality()` en `liveDocumentScan.js` analiza:
    - **Reflejo cegador:** `glareRatio > 0.07` (destellos en más del 7% del área).
    - **Nitidez:** Varianza de Laplaciano `< 13.5`.
    - **Luminosidad:** Luma promedio `< 55` (muy oscura).
  - Si no pasa el filtro, la app muestra un diálogo de advertencia con la foto en miniatura y consejos para reposicionar la tarjeta antes de procesarla.

---

### Incidencia 4: Esquema REST de Gemini API (camelCase vs snake_case)

- **Síntoma:** Error `HTTP 400 Bad Request` en llamadas directas vía HTTP/REST con `urllib`.
- **Causa Raíz:** La API REST de Gemini (`generativelanguage.googleapis.com`) requiere nombres de propiedades en **camelCase**:
  - Correcto: `inlineData`, `mimeType`, `responseMimeType`.
  - Incorrecto: `inline_data`, `mime_type`, `response_mime_type` (estos solo son válidos en el SDK oficial de Python, no en llamadas REST directas).

---

## 3. Lista de Modelos Activos Soportados (2026)

El backend itera en el siguiente orden de preferencia:
1. `gemini-2.5-flash` (Óptimo en velocidad, visión y precisión)
2. `gemini-flash-latest` (Alias dinámico de Google)
3. `gemini-3.6-flash` / `gemini-3.5-flash` / `gemini-3.1-flash-lite`
4. `gemini-1.5-flash`
5. `gemini-2.0-flash`
6. `gemini-pro-latest`
