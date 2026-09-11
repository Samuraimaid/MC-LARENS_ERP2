# Catálogo FOX / RideFOX — Suspensiones (shocks) para pickup / SUV / truck

Catálogo generado desde [ridefox.com](https://www.ridefox.com/) (API Shopify `products.json`, páginas de 250).
Productos automotrices incluidos: **632** (tipos Truck / Automotive / Shocks / Coil Springs; se excluyen bike, apparel, snow, UTV, motorsports, etc.).

Compatibilidad cruzada con la base ERP de vehículos Mc-Larens (`vehicleCatalog.json`, 8318 entradas / 40 marcas).

## Totales de matching
| Estado | Cantidad |
|--------|----------|
| Compatibles con ≥1 vehículo ERP (`matched`) | **571** |
| Universales / multi-fit sin vehículo específico (`universal`) | **52** |
| Sin match ERP (`unmatched`) | **9** |
| Total publicados en catálogo | **632** |

## Contenido
- `catalogo.json` — Todos los productos (matched + universal + unmatched), con `match_status` y `erp_matches`
- `catalogo_matched.json` / `catalogo_universal.json` / `catalogo_unmatched.json` — Particiones
- `catalogo.xlsx` — Hojas `productos`, `especificaciones`, `erp_matches`
- `matching_report.json` — Conteos, uso de marcas/modelos, lista unmatched
- `stats.json` — Resumen numérico
- `imagenes/<handle>/principal.jpg` — Muestra de imágenes (tope ~30); todas las URLs quedan en el JSON / `image_sources.json`
- `fox_catalogo_datos.zip` — JSON + XLSX + README + stats
- `REPO_ADD.md` — Ruta propuesta para commit en el repo ERP
- `README.md` — Este archivo

## Fuente Shopify
- Productos: `https://www.ridefox.com/products.json?limit=250&page=N`
- Fitment nativo principalmente en **tags** Shopify: años (`2020`…), marca (`Toyota`, `Ford`…), modelo (`Tundra`, `F-150`…), `Position: Front/Rear`, `Lift Height: …`, `Body Diameter`, `Travel Length`, `Series: Performance|Performance Elite|Factory Race`, mounts.
- Descripción HTML (`body_html`) se usa como texto auxiliar; no se inventa fitment si falta en la fuente.

## Marcas FOX → ERP
| FOX / RideFOX | Marca ERP / nota |
|---------------|------------------|
| Toyota | TOYOTA (Tundra, Tacoma, Hilux, 4Runner, Land Cruiser, Sequoia) |
| Ford | FORD (F-150, Ranger, Bronco, Super Duty→F250/F350, Expedition) |
| Chevrolet | CHEVROLET (Silverado, Colorado, Tahoe, Suburban, Corvette) |
| GMC | **GMC no está en el ERP** (Sierra suele ir emparejado con Silverado → match Chevy) |
| Jeep | JEEP (Wrangler, Gladiator, Cherokee, Grand Cherokee) |
| RAM | RAM (1500/2500/3500; entradas ERP con OCR ruidoso) |
| Nissan | NISSAN (Frontier, Navara, Titan, Pathfinder) |
| Lexus | LEXUS (GX, LX) |
| Volkswagen | VOLKSWAGEN (Amarok) |
| Land Rover | LAND ROVER (Defender, Discovery) |
| Isuzu | ISUZU (D-Max, MU-X) |
| Mercedes-Benz | MERCEDES BENZ (Sprinter) |
| Dodge | **DODGE no está en el ERP** (Charger/Challenger → unmatched) |
| Hummer | **HUMMER no está en el ERP** |

## Categorías
- Amortiguadores — Performance: 311
- Coil-overs: 119
- Amortiguadores — Performance Elite: 65
- Amortiguadores — Factory Race: 47
- Estabilizador de dirección: 33
- Amortiguadores con reservoir — Performance: 16
- Amortiguadores: 15
- Repuestos / herrajes: 5
- Suspensión / shocks — Parts: 5
- Amortiguadores IFP — Performance: 4
- Amortiguadores con reservoir — Performance Elite: 4
- Amortiguadores con reservoir — Parts: 2
- Amortiguadores con reservoir — Factory Race: 2
- Amortiguadores — Factory: 2
- Suspensión / shocks: 1
- Resortes helicoidales: 1

## Campos principales
| Campo | Descripción |
|-------|-------------|
| sku / skus | Números de parte FOX (p. ej. `987-02-009`, `883-26-172`) |
| handle | Slug Shopify / carpeta de imágenes |
| nombre | Título traducido EN→ES (glosario + Argos) |
| nombre_original | Título original en ridefox.com |
| categoria / serie | Familia de producto y serie (Performance, Factory Race, …) |
| descripcion | Texto descriptivo traducido (recortado) |
| especificaciones | Travel, body size, lift, position, mounts, etc. |
| precio | Precio en **USD** según variante Shopify (si figura) |
| fitment_raw | Marcas/modelos/años extraídos de tags/título/HTML |
| compatibilidad | Resumen legible del fitment |
| match_status | matched / universal / unmatched |
| erp_matches | Lista de id/brand/model/descriptor/label (máx. 40) |
| erp_match_count | Total de matches antes del tope |
| imagen_principal | Ruta local o URL de origen |
| source_url | Ficha en ridefox.com |

Si un dato no figura de forma fiable en la fuente, el campo es **"No especificado"** (no se inventa).

## Reglas de matching
1. Se leen marca y modelo desde tags Shopify y título (`MARCA MODELO | SERIE`).
2. Marca ERP + tokens de modelo normalizados (F-150/F150, D-Max/Dmax, Hilux, etc.) sobre model/descriptor/label.
3. Si hay años en tags, se intersecta con `year_start`/`year_end`; si el filtro deja 0, se reintenta sin año.
4. Sin años → todas las generaciones de ese modelo en ERP.
5. Hardware sin vehículo (abrazaderas, llaves) → `universal` solo si no hay marca/modelo.
6. Solo GMC / Dodge / Hummer (fuera de ERP) sin pareja Chevy/otra → `unmatched`.
7. `erp_matches` recortado a 40; `erp_match_count` guarda el total.
8. **Nunca** se inventa fitment: si la fuente no indica vehículo, no se asigna.

## Cómo importar
1. Descomprimir `fox_catalogo_datos.zip` manteniendo la estructura.
2. Usar `catalogo.json` o `catalogo.xlsx` según el conector ERP.
3. Filtrar por `match_status=matched` para el catálogo compatible primario.
4. Mapear SKU FOX, nombre, categoría/serie, specs, compatibilidad, `erp_matches` e imágenes.
5. Los precios están en USD; convertir si el ERP trabaja en otra moneda.
6. Imágenes locales: muestra ~30 en `imagenes/`; el resto conserva URL CDN en JSON.

Fuente: https://www.ridefox.com/ — generado 2026-09-11T22:25:12.710465+00:00.
