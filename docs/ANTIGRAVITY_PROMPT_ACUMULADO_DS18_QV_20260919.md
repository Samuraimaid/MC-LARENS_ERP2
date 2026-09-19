# Antigravity — LOTE DS18 ficha completa + Quick View full + fotos PDF · 2026-09-19

Repo: `Samuraimaid/MC-LARENS_ERP2`  
ERP live: `https://mclarens-erp-836176703716.us-central1.run.app`  
Auth API: `POST /api/auth/pin/login` `{"pin":"01011990"}` → `Bearer session_token`  
GCS: `gs://mclarens-erp-products` / `products/ds18/{SKU}/`  
Windows: **no usar `py`**.

Xinon: **carga pesada la hace Antigravity**. Case solo dejó este prompt + el piloto de ejemplo.

Página oficial de referencia (3 acordeones):  
https://ds18.com/products/ds18-zr1000-1d-class-d-1-channel-monoblock-amplifier-1000-watts-rms-1-ohm

---

## ⚠️ LEE ESTO PRIMERO — Producto ejemplo (antes → después)

**No reinventes el formato.** Replica el mismo proceso para todos los DS18 usando este ejemplo ya aplicado en vivo.

| Campo | Valor |
|-------|--------|
| SKU | `ZR1000.1D` |
| product_id | `product_5ee83a00a2b8` |
| URL oficial | https://ds18.com/products/ds18-zr1000-1d-class-d-1-channel-monoblock-amplifier-1000-watts-rms-1-ohm |
| GET live | `GET /api/products/product_5ee83a00a2b8` (o search `ZR1000.1D`) |

### ANTES (estado típico post-rebuild PDF, corto / sin ficha)

- **name:** `ZR1000.1D — Amplificador 1-Channel · 1Ω`
- **description** (~126 chars, genérica):
```
Amplificador DS18 ZR1000.1D (amplificación). Specs: 1-Channel · 1Ω. Respetar carga mínima y calibración de ganancia. PDF p.36.
```
- **specs:** vacío / ausente → el Quick View casi no muestra ficha técnica
- **media:** solo fotos `main` + `additional` (sin PDF)
- **UI:** modal estrecho (`max-w-4xl`); descripción en un solo bloque plano; sin acordeones; sin botón de manual

### DESPUÉS (piloto Case ya en LIVE — este es el target)

Tags actuales incluyen: `ds18_detail_blocks_es_20260919`, `ds18_manual_pdf`.

**1) description** = Overview en español + sección `Características principales:` con bullets (así la UI puede partir el texto si aún no hay campo `features`):

```
DS18 ZR1000.1D — Amplificador monoblock Clase D 1000 W RMS @ 1 Ω

La serie ZR está pensada para sacar el máximo de tu sistema de sonido. El ZR1000.1D ofrece opciones de ajuste (pasa bajos, subsonic y bass boost) para afinar cada tema a tu gusto.

Entrega 380 W RMS @ 4 Ω, 650 W RMS @ 2 Ω y 1000 W RMS @ 1 Ω, con respuesta de 10 Hz a 220 Hz y hasta 3000 W de pico. Indicadores LED de clipping, power y protect; bornes de poder/tierra para cable 4 GA; crossover seleccionable para integrar el bajo con el resto del sistema.

Ideal para impulsar subwoofers con potencia limpia y control preciso.

Características principales:
• Monoblock 1 canal para subwoofer
• Clase D
• Estable de 1 a 4 ohmios
• 1 x 1000 W RMS @ 1 Ω
• Indicador de clip / protección
• Perilla de control de bajos (bass knob)
```

**2) specs** = objeto plano, claves en español, valores tal cual de la web (39 keys en el piloto). Ejemplo parcial:

```json
{
  "SKU": "ZR1000.1D",
  "Potencia total (pico)": "3000 W",
  "RMS @ 4 Ω": "380 W",
  "RMS @ 2 Ω": "650 W",
  "RMS @ 1 Ω": "1000 W",
  "Respuesta en frecuencia": "10–220 Hz",
  "Relación señal/ruido": ">95 dB",
  "Eficiencia @ 4 Ω": "80%",
  "...": "(completar TODAS las filas de SPECS/AUDIO/FEATURES/MEASUREMENT de la página)"
}
```

Specs completas del piloto están en live; al hacer GET del producto las verás las 39.

**3) media** = **merge** (no borrar galería). Añadir al final:

```json
{
  "url": "https://ds18.com/cdn/shop/files/ZR_AMP_SPANGLISH_MANUAL_WEB_V1_2_1_fd85a0c9-f259-46ac-94b9-ef2f78b5200e.pdf?v=5196881650409041332",
  "type": "document",
  "title": "Manual del producto (PDF)",
  "filename": "ZR1000.1D_manual.pdf"
}
```

Cómo se obtuvo el PDF en la página: buscar `manualFile` en el HTML o links `.pdf` bajo `ds18.com/cdn/shop/files/` / `cdn.shopify.com/.../files/`.

### Proceso completo (copiar para cada SKU)

```
1. Listar DS18 activos con skip= (NO page=) → ver sección Paginación abajo
2. Para SKU S:
   a. Abrir/buscar producto en ds18.com
   b. Extraer: Key Features | Technical Data tables | Product Overview | manual PDF URL
   c. Traducir a español (no inventar números)
   d. Armar description = overview_ES + "\n\nCaracterísticas principales:\n" + bullets
   e. Armar specs = dict ES
   f. GET producto actual → clonar media[] → append document si hay PDF
   g. PUT { description, specs, media, tags: [...existentes, "ds18_detail_blocks_es_20260919", ("ds18_manual_pdf" si PDF)] }
3. Verificar GET: description larga, specs no vacío, media con type=document
4. (UI) Abrir Quick View → 3 acordeones + botón Descargar manual
```

### PUT de ejemplo (forma; no hace falta re-aplicar ZR1000 si ya tiene el tag)

```http
PUT /api/products/product_5ee83a00a2b8
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "description": "<overview ES + Características principales…>",
  "specs": { "RMS @ 1 Ω": "1000 W", "...": "..." },
  "media": [ /* fotos existentes */, { "type":"document", "title":"Manual del producto (PDF)", "url":"<pdf>", "filename":"ZR1000.1D_manual.pdf" } ],
  "tags": [ "...tags previos...", "ds18_detail_blocks_es_20260919", "ds18_manual_pdf" ]
}
```

**Campos que NO persisten** (no los uses como fuente de verdad): `features`, `manual_url`, `documents` top-level. Solo `description` + `specs` + `media`.

**No re-procesar** SKUs que ya tengan tag `ds18_detail_blocks_es_20260919` y `description` > 400 chars (salvo que falte PDF y la web sí lo tenga).

---

## Paginación API (no te confundas)

- ❌ `GET /api/products?brand=DS18&page=2` → **siempre los mismos ~100** (empieza en DX2).
- ✅ `GET /api/products?brand=DS18&limit=100&skip=0` luego `skip=100`, `200`, … hasta vacío.
- Deduplicar por `product_id`. Esperar ~1100–1465 DS18 del rebuild PDF (hay lista slim de apoyo ~1465 en docs de Case si la copias al repo).

---

## P0 — UI Quick View (`ProductQuickViewDialog.jsx`)

### A) Modal ancho/alto
Xinon autorizó casi fullscreen.
- Hoy: `max-w-4xl max-h-[92vh]` → insuficiente para 3 bloques + galería.
- Objetivo: casi `100vw`/`100dvh` o `min(100vw-1rem,1400px)` × `min(100dvh-1rem,960px)`; 2 columnas desktop; scroll en body.

### B) Galería (bug live)
Imagen abajo-derecha + scrollbar / vacía.
- Stage `relative aspect-[4/3] overflow-hidden` + wrapper `absolute inset-0 flex items-center justify-center`.
- `img` `object-contain object-center`; sin scroll en stage; flechas solo si ≥2 imgs válidas.
- Lightbox fondo **blanco**.

Smoke layout: `A-CTK-52633`, `No-especificado` (pinitos), `ZR1000.1D`.

### C) Tres acordeones (mapear al ejemplo)

| Acordeón UI | De dónde sale en el DESPUÉS del ZR1000 |
|-------------|----------------------------------------|
| **Características principales** | Bullets bajo `Características principales:` en `description` (o `features[]` si más adelante persiste) |
| **Ficha técnica y manual** | `specs` grid + botón PDF desde `media[].type==="document"` |
| **Descripción del producto** | Parte overview de `description` (antes de la línea `Características principales:`) |

Si un producto aún está en estado ANTES: mostrar lo que haya; no inventar texto en el frontend.

---

## P1 — Enriquecer todos los DS18

Seguir el **Proceso completo** del ejemplo. Checkpoint cada 50 SKUs. Reporte JSON: total / enriched / skipped_already / no_page / no_pdf / errors.

---

## P1 — Fotos mal cortadas del PDF

1. Auditar primaries DS18 (crop de página PDF, texto de catálogo, producto a medias).
2. Reemplazar por galería oficial ds18.com → GCS `products/ds18/{SKU}/` → PUT images/media.
3. Tag `ds18_pdf_crop_fix_20260919`. ZR1000 ya tiene galería GCS buena — no tocar si `products/ds18/ZR1000.1D/01.jpg` OK.

---

## Deploy + smoke

1. Implementar UI + scripts; commit; push; `./deploy.sh`.
2. Hard refresh; nuevo `BUILD_ID`.
3. **Smoke obligatorio ZR1000.1D:** abrir Ver detalles → modal ancho → 3 acordeones con contenido del DESPUÉS → Descargar PDF abre el manual → galería centrada.
4. Smoke 2 SKUs más enriquecidos + 1 foto que antes estaba cortada.
5. Nota en `memory/chat-log.md`.

## Fuera de alcance
PIN sync off; soft-delete masivo; otras marcas salvo smoke de layout.

## Relacionado
- PR docs layout: #19  
- Este lote: mantener un solo PR de UI + datos/scripts.