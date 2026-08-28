# PROMPT PARA ANTIGRAVITY
# Copia desde "INICIO DEL PROMPT" hasta "FIN DEL PROMPT" y pégalo en el chat.

---

INICIO DEL PROMPT

Eres Antigravity trabajando en el repo MC-LARENS_ERP2 (ERP de Mundo de Accesorios / McLarens, Nicaragua).

Tu misión: reescribir el escáner de Tarjeta de Circulación para que funcione como el escáner de tarjeta de Amazon/Stripe. La cámara queda abierta, hay un recuadro guía, la app captura SOLA cuando la tarjeta está nítida y alineada. NO hay que pulsar el obturador en el camino feliz. Quita Tesseract.js del navegador. Una sola llamada de visión al backend llena el formulario. El vendedor confirma antes de guardar.

No refactorices ventas, PIN, RRHH ni Docker salvo lo mínimo para este módulo.

============================================================
1. CONTEXTO DEL CÓDIGO ACTUAL
============================================================

Repo: Samuraimaid/MC-LARENS_ERP2

Archivos clave:
- frontend/src/components/vehicles/CirculationCardOcrScannerModal.jsx
- frontend/src/components/customers/CustomerVehicleFormTabs.jsx
  (handleApplyOcr ya parte la placa en prefix + number)
- frontend/src/pages/CustomersPage.jsx
  (PLATE_PREFIXES y form de cliente/vehículo)
- frontend/src/lib/cameraAccess.js y HTTPS :3443 (no romper cámara en LAN)
- frontend/src/lib/vehicleCatalog.js + vehicleCatalog.json
- frontend/src/lib/formatters.js (formatChasis, formatPlateNumber, formatCedula)
- POST /api/vehicles/ocr-circulation-card
  body actual: { raw_text, image_base64 }
- GET /api/vehicles/decode-vin?vin=

Flujo HOY (lento, hay que cambiarlo):
1. Usuario pulsa cámara o sube archivo
2. El BROWSER carga tesseract.js con spa+eng
3. Extrae raw_text
4. POST al backend con raw_text + image_base64
5. Backend parsea + vPIC
6. Modal editable → onApply

Eso tarda 8–20 s y falla con holograma, plástico y poca luz.

Flujo OBJETIVO:
1. Al abrir el modal, arranca getUserMedia (facingMode environment)
2. Preview a pantalla + recuadro redondeado (aspecto documento ~1.6)
3. Cada 180–250 ms se puntúa el recorte del recuadro EN EL CLIENTE:
   nitidez, fill, glare
4. 3 muestras OK seguidas (~450–750 ms) → auto-captura
5. Se comprime a JPEG ≤ 1600 px, quality 0.72
6. UNA llamada POST /api/vehicles/ocr-circulation-card-v2 { image_base64 }
7. Formulario editable con confidence
8. Botón Aplicar al vehículo (ya existe). El OCR NUNCA hace POST a /customers ni /vehicles.

Mantén botones de fallback:
- Subir archivo
- Captura manual (si a los 8 s no hay lock, o si getUserMedia falla)

Capacitor Camera.getPhoto solo como fallback nativo, no como camino principal.

============================================================
2. NO ROMPER ESTOS CONTRATOS
============================================================

onApply / handleApplyOcr espera al menos:
{
  vin, plate, brand, model, year, color,
  vehicle_type, vehicle_type_slug, version_level, trim
}

También rellenar si vienen:
numero_motor, tipo_combustible, propietario_cedula

Prefijos de placa Nicaragua (lista ERP):
M LE CH MY GR CZ MT BO CT RI NS ES MZ JI RS AN AS TM ZC PN EN CD MI OI

Cédula: 001-000000-0000A
VIN: 17 chars, alfabeto A-HJ-NPR-Z0-9 (sin I, O, Q)
Año: 1980 … añoActual+1

handleApplyOcr ya hace:
cleanPlate.match(/^([A-Z]{1,4})[\s\-_]*(.*)$/)
y busca el prefix en platePrefixes; si no matchea usa "M".
En v2, si el prefix es desconocido NO inventes M en el backend. Devuelve plate cruda y needs_review: ["plate"]. El form puede seguir teniendo su fallback, pero el JSON debe ser honesto.

============================================================
3. ARCHIVOS A CREAR / EDITAR
============================================================

CREAR:
- frontend/src/lib/liveDocumentScan.js
- backend endpoint y parser (el archivo real donde hoy vive ocr-circulation-card; búscale en backend/, no asumas que todo está en server.py monolito si ya hay dominio vehicles)

EDITAR:
- CirculationCardOcrScannerModal.jsx → viewfinder live + auto-lock + quitar import de tesseract.js
- CustomerVehicleFormTabs.jsx solo si hace falta pintar campos en ámbar por confidence
- tests si el repo ya tiene patrón de tests para vehicles/frontend

NO editar PIN, sales cart, docker-compose salvo CORS si el endpoint nuevo lo exige.

============================================================
4. ESPECIFICACIÓN liveDocumentScan.js
============================================================

Exporta:

startCamera(videoEl) → Promise<MediaStream>
stopCamera(stream)
scoreFrame(videoEl, guideRect) → { sharpness, fill, glare, ok }
grabJpeg(videoEl, maxW = 1600, quality = 0.72) → dataURL jpeg
createAutoLock({ videoEl, getGuideRect, onStatus, onCapture, intervalMs = 200 })
  onStatus('searching' | 'closer' | 'glare' | 'hold' | 'capturing' | 'manual')
  onCapture(dataUrl)
  return { stop() }

Heurística (sin OpenCV):
- Recorta el guide a un canvas de 320 px de ancho
- Escala a gris
- sharpness = energía de un high-pass 3x3 o varianza Laplacian aproximada
- glare = % de pixeles con luma > 245
- fill = densidad de bordes cerca del marco del recuadro (la tarjeta ocupa la caja)
- ok = sharpness > umbral && glare < 0.08 && fill > 0.55
- lock cuando ok streak >= 3; elige el frame más nítido del streak
- si el clerk aleja la tarjeta, resetear streak

Constraints cámara:
{
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
}

No pedir 4K. Si getUserMedia falla, onStatus('manual') y abrir file input.

============================================================
5. UI DEL MODAL
============================================================

Estado inicial (cámara OK):
- video full width
- overlay oscuro fuera del recuadro
- recuadro redondeado centrado
- chip de estado arriba o abajo:
  searching: "Pon la tarjeta dentro del recuadro"
  closer: "Un poco más cerca"
  glare: "Inclina para quitar el brillo"
  hold: "No te muevas"
  capturing: "Leyendo…"
- a los 4–8 s sin lock, mostrar botón fantasma "Captura manual"

Después de capturar:
- preview de la foto (como ahora)
- formulario editable (campos actuales del modal)
- campos con confidence < 0.85 en borde ámbar
- VIN y placa grandes, font-mono, arriba
- "Tomar otra foto" reinicia el viewfinder
- "Aplicar al vehículo" = handleApplyToVehicle existente

Textos en español. Sin emojis en UI nueva.

============================================================
6. BACKEND v2
============================================================

POST /api/vehicles/ocr-circulation-card-v2
Auth igual que el endpoint viejo (sesión cookie).
Body:
{ "image_base64": "data:image/jpeg;base64,..." }

raw_text es opcional e ignorado. No dependas de OCR del cliente.

Mantén POST /api/vehicles/ocr-circulation-card una release para no romper clientes viejos.

Respuesta estable:

{
  "vin": "3N1AB7APXHY123456",
  "plate": "M123456",
  "brand": "Nissan",
  "model": "Sentra",
  "year": 2017,
  "color": "Blanco",
  "vehicle_type": "Sedán / Automóvil",
  "vehicle_type_slug": "sedan",
  "numero_motor": null,
  "tipo_combustible": "Gasolina",
  "propietario_cedula": null,
  "origin_country": "Mexico",
  "version_level": "intermedio",
  "trim": "",
  "confidence": {
    "vin": 0.93,
    "plate": 0.97,
    "brand": 0.90,
    "model": 0.84,
    "year": 0.88
  },
  "needs_review": ["model"],
  "engine": "vision"
}

Pipeline backend:
1. Validar dataURL / tamaño (rechazar > ~4 MB ya decodificado)
2. Llamar modelo de visión con el system prompt de abajo (Gemini / el LLM que el proyecto ya use; si no hay cliente de visión, crea un adapter claro con env VISION_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY — usa lo que ya exista en el repo, no inventes un segundo vendor)
3. Parsear JSON estricto
4. Normalizer NI (placa, VIN, cédula, slug, año)
5. Fuzzy match a vehicleCatalog
6. Si VIN queda en 17 chars válidos, llama decode-vin/vPIC y usa marca/modelo/año del decoder cuando OCR traiga menor confidence
7. Si plate y vin salen null, OPCIONAL un retry: crop superior/inferior y una segunda pasada. Máximo 2 llamadas visión.
8. Fallback final server-side PaddleOCR o Tesseract SOLO en el servidor, nunca en el browser
9. Log: latency_ms, engine, campos vacíos. NUNCA loguear la imagen ni PII completa

Reglas de extracción:
- No inventar VIN ni cédula. null si no se lee.
- Color: no pongas "Blanco" si no se leyó; null o omitir. El modal hoy defaulta Blanco; puedes dejar ese default solo en UI.
- version_level: base | intermedio | full; default intermedio
- vehicle_type_slug: sedan | hatchback | pickup | suv | van | truck | moto

Mapa tipo:
Automóvil/sedán/turismo → sedan
Hatchback/compacto → hatchback
Camioneta/pickup/pick-up → pickup
Jeep/SUV/rural → suv
Microbús/van/panel → van
Camión/furgón → truck
Moto/motocicleta → moto

Etiquetas a buscar en la tarjeta:
PLACA, MATRICULA, NUMERO DE PLACA
CHASIS, VIN, NUMERO DE VIN, N. VIN
MARCA
MODELO, LINEA
ANIO, AÑO, MODELO ANIO
COLOR
MOTOR, N. MOTOR
COMBUSTIBLE
TIPO, CLASE, USO
PROPIETARIO, CEDULA

============================================================
7. SYSTEM PROMPT DEL MODELO DE VISIÓN
============================================================

Usa este texto (o equivalente) en el backend:

You extract fields from a photo of a Nicaraguan vehicle circulation card (tarjeta de circulacion / certificado de matricula).
Return JSON only. No markdown.
Schema keys: vin, plate, brand, model, year, color, vehicle_type, vehicle_type_slug, numero_motor, tipo_combustible, propietario_cedula, propietario_nombre, origin_country, version_level, trim, confidence, needs_review
Rules:
- If a field is unreadable, use null. Never invent a VIN or cedula.
- VIN is 17 characters. Allowed A-H J-N P R-Z 0-9. No I O Q.
- Plate is Nicaraguan. Prefix + numbers. Keep prefix letters as printed.
- year is an integer or null.
- confidence is 0..1 per critical field (vin, plate, brand, model, year).
- needs_review is an array of field names below 0.85 confidence.
- Prefer printed block letters over handwriting.
- Ignore holograms, stamps, and signatures.
- Do not translate brand names.
- vehicle_type_slug one of sedan, hatchback, pickup, suv, van, truck, moto.
- version_level one of base, intermedio, full if inferable, else intermedio.

============================================================
8. NORMALIZER NI
============================================================

Placa:
- uppercase, quitar espacios extras
- aceptar M 123456 y M-123456
- prefix debe estar en la lista ERP
- si prefix desconocido: plate raw + needs_review

VIN:
- uppercase, quitar espacios/guiones
- si aparece I u O o Q, intentar corrección mínima 1↔I, 0↔O, D↔0, 8↔B, 5↔S SOLO si con eso queda length 17 y charset legal
- si no, null

Cédula:
- patrón ###-######-####X
- no adivinar dígito verificador

Marca/modelo:
- exacto → casefold → sin acentos → token overlap contra vehicleCatalog
- ejemplos: TOYTA→Toyota, HILUX D/C→Hilux y cab variant si isPickupCatalogModel

============================================================
9. PRESUPUESTO DE LATENCIA
============================================================

Cámara start < 800 ms
Lock tras alinear 0.4–1.0 s
Upload + visión < 3.5 s
Foto → form editable < 5 s p95
Retry crop +1.5 s máximo, una vez

============================================================
10. ORDEN DE IMPLEMENTACIÓN
============================================================

1. Crear liveDocumentScan.js
2. Reescribir CirculationCardOcrScannerModal (live + fallback archivo)
3. Implementar ocr-circulation-card-v2 + normalizer + vPIC
4. Apuntar el modal a v2 y borrar createWorker/tesseract del cliente
5. Amber fields + thumbnail de catálogo si ya hay helper de thumbnail
6. Probar a mano: cámara denegada, glare, foto archivo, VIN 17, placa M, apply al form

No mezclar este PR con limpieza masiva.

============================================================
11. DEFINICIÓN DE TERMINADO
============================================================

- tesseract.js no se importa en el modal
- auto-captura funciona en Chrome Android y desktop HTTPS sin pulsar obturador
- file upload sigue existiendo
- prefix de placa y charset VIN validados
- handleApplyOcr sigue llenando plate_prefix + plate_number
- el vendedor debe confirmar
- no se loguean imágenes
- endpoint viejo sigue vivo

Empieza ahora. Inspecciona el repo, localiza el handler real de ocr-circulation-card y el cliente HTTP de APIs, e implementa el cambio de punta a punta. Si falta una API key de visión, deja el adapter + env documentado y un fallback server-side, pero el cliente NO debe volver a Tesseract.

FIN DEL PROMPT
