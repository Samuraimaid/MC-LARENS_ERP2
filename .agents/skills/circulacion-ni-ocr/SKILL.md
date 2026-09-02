---
name: circulacion-ni-ocr
description: Improve McLarens ERP scanner for Nicaraguan tarjeta de circulacion. Use when editing CirculationCardOcrScannerModal, ocr-circulation-card, VIN decode, customer vehicle intake, live camera auto-capture, or Antigravity work on OCR speed and accuracy.
metadata:
  type: workflow
  version: "1.0"
  product: MC-LARENS_ERP2
  locale: ni
---

# Circulacion NI OCR (live scan)

Transform the existing shutter-based Tesseract.js scanner into an Amazon/Stripe-style live scan. The clerk holds the card in a guide box. The app auto-captures when the frame is sharp. One backend vision call fills the vehicle form. The clerk confirms. Nothing saves without confirm.

## Current system (do not break)

Repo `Samuraimaid/MC-LARENS_ERP2`.

| Piece | Path / contract |
|---|---|
| Modal | `frontend/src/components/vehicles/CirculationCardOcrScannerModal.jsx` |
| Form apply | `CustomerVehicleFormTabs.jsx` → `handleApplyOcr` |
| Endpoint | `POST /api/vehicles/ocr-circulation-card` body `{ raw_text, image_base64 }` |
| VIN | `GET /api/vehicles/decode-vin?vin=` (vPIC) |
| Plates | prefixes in `CustomersPage.jsx` (`M LE CH MY GR CZ…`) |
| IDs | cedula `001-000000-0000A`, RUC `J` + digits |

Keep `onApply` payload compatible so the customer form does not rewrite.

Required apply fields today: `vin`, `plate`, `brand`, `model`, `year`, `color`, `vehicle_type`, `vehicle_type_slug`, `version_level`, `trim`.

Also parse when present: `numero_motor`, `tipo_combustible`, `propietario_cedula`.

## Target UX (Amazon card scan)

No shutter for the happy path.

1. Open modal → camera starts immediately (`facingMode: environment`).
2. Full-screen preview + rounded guide (document aspect ~1.6).
3. Status chip only. `Alinea la tarjeta` → `No te muevas` → `Listo`.
4. When quality is stable ~450 ms, freeze, flash the guide, haptic, send ONE jpeg.
5. Show extracted fields. Clerk edits. `Aplicar al vehiculo`.
6. Fallback buttons stay. `Subir archivo` and `Captura manual` if camera denied or auto-scan fails twice.

Never run Tesseract.js in the browser. It is the current slowness.

## Architecture

```
getUserMedia preview
    → local quality gate (every 180–250 ms)
    → auto-shutter (best frame)
    → compress jpeg ≤ 1600 px, quality 0.72
    → POST /api/vehicles/ocr-circulation-card-v2  { image_base64 }
    → vision model + NI normalizer + optional vPIC
    → JSON + confidence
    → editable form → onApply (existing)
```

Local loop never calls the LLM. Backend is called once per successful lock.

Fallback if vision fails plate or VIN. Crop those regions and retry once. Then PaddleOCR/Tesseract server-side only. Not in the browser.

## Frontend work

Replace the dashed upload-first screen with a live viewfinder.

File to rewrite. `CirculationCardOcrScannerModal.jsx`.

New helper (create). `frontend/src/lib/liveDocumentScan.js`

Responsibilities of the helper:

- `startCamera(videoEl)`
- `stopCamera()`
- `scoreFrame(videoEl, guideRect)` returns `{ sharpness, fill, glare, ok }`
- `grabJpeg(videoEl, maxW=1600, quality=0.72)` dataURL
- Auto-lock after 3 consecutive `ok` samples (~450–750 ms)

Quality heuristics (good enough, no OpenCV required):

- Sample the guide crop onto a small canvas (320 px wide).
- Sharpness. Variance of grayscale Laplacian or simple 3x3 high-pass energy.
- Fill. Fraction of edge pixels near the guide border (card occupies the box).
- Glare. Fraction of pixels with luma > 245.
- Reject if sharpness low, glare > 8%, or fill < 55%.

Capacitor. Keep `Camera.getPhoto` only as manual fallback. Prefer live `getUserMedia` even in the webview when `isSecureContext`.

HTTPS remains mandatory on LAN (`:3443`). Do not regress `cameraAccess.js`.

Compress before upload. DataURLs of 4K photos kill Cloud Run time.

## Backend work

Add `POST /api/vehicles/ocr-circulation-card-v2`.

Keep the old route working for one release.

Request:

```json
{ "image_base64": "data:image/jpeg;base64,..." }
```

`raw_text` optional. Ignore client OCR.

Response (stable):

```json
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
```

Rules:

- Do not invent VIN or cedula. Null if unread.
- VIN must be 17 chars, charset `A-HJ-NPR-Z0-9` (no I, O, Q).
- Plate must match NI prefixes. See `references/ni-document-rules.md`.
- Brand/model fuzzy-match `vehicleCatalog`. Prefer catalog spelling.
- If VIN valid, call existing vPIC decoder and fill brand/model/year when OCR is weaker.
- Color default only if missing. Do not overwrite a read color with `Blanco`.
- Log latency + engine + which fields were empty. No raw images in logs.

Vision prompt lives in `assets/prompt-extractor.md`. Load that text. Do not improvise a weaker prompt.

## Confirmation UX

Paint a field amber when `confidence[field] < 0.85` or field is in `needs_review`.

Plate and VIN stay large, mono, top of the form.

**Direct Year Entry Rule:** If the chassis/VIN does not encode the manufacture year (e.g. Japanese/Thai Toyota/Nissan with `0` in position 10 or non-standard format), the system MUST directly prompt and autofocus the Year field for immediate clerk input in one step. The system MUST NEVER force or mandate a second scan of the back of the card. Taking a photo of the back is strictly an optional alternative.

If catalog matches brand+model+year, show the lateral blueprint thumbnail already used by the ERP.

Apply still requires clerk tap. OCR never POSTs `/customers` or `/vehicles` by itself.

## Performance budget

| Step | Budget |
|---|---|
| Camera start | < 800 ms |
| Lock after alignment | 0.4–1.0 s |
| Upload + vision | < 3.5 s |
| Photo → editable form | < 5 s p95 |
| Auto-retry crop | +1.5 s max, once |

If lock cannot happen in 8 s, show `Captura manual`.

## Antigravity implementation order

1. Add `liveDocumentScan.js` and unit-test scoring with 3 fixture frames if available.
2. Rewrite modal to live preview + auto-lock. Keep file upload.
3. Add `ocr-circulation-card-v2` with schema + NI normalizer + vPIC.
4. Point modal at v2. Stop importing `tesseract.js`.
5. Map catalog + thumbnail.
6. Manual QA with 20 circulation photos (glare, night, plastic sleeve).

Do not refactor unrelated sales or PIN auth in the same change.

## Done when

- No Tesseract.js in the client bundle path for this modal.
- Auto-capture works without shutter on Chrome Android + desktop HTTPS.
- Plate prefixes and VIN charset validated.
- Existing `handleApplyOcr` still fills prefix + number.
- Clerk must confirm.
- p95 under 5 s on a mid-range phone with a decent photo.

Read `references/live-scan.md` before coding the viewfinder.
Read `references/ni-document-rules.md` before writing the normalizer.
Use `assets/prompt-extractor.md` as the vision system prompt.
