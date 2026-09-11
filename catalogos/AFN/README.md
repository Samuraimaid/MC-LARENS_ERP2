# Catálogo AFN 4x4 Accessories — Portugal

**AFN** es un fabricante **portugués** de accesorios 4x4 (NO brasileño).

Sitios oficiales:
- https://www.afn.pt/
- https://www.afn4x4usa.com/ (tienda Shopify USA)
- https://special-projects.afn.pt/ (proyectos especiales)

Productos: bull bars / parachoques delanteros, parachoques traseros, skid plates, estribos, portallantas, portaequipajes, etc.
Fitment principal: Ford Ranger / Ranger Raptor, Toyota Hilux, VW Amarok, Land Cruiser, Bronco, Isuzu D-Max, Mitsubishi L200, Nissan Navara, Jeep, Mercedes G/Sprinter, entre otros.

## Fuentes de datos
1. **Shopify USA** `products.json` — 26 productos (precios USD, descripciones EN).
2. **afn.pt** páginas de vehículo (`detail-*`) — 216 referencias únicas con REF + título + imagen + contexto de fitment.
3. Cruce con ERP Mc-Larens `vehicleCatalog.json` (8318 entradas / 40 marcas).

No se inventa fitment: si no hay evidencia de marca/modelo, el producto queda `unmatched` o con compatibilidad «No especificado».

## Totales de matching
| Estado | Cantidad |
|--------|----------|
| Compatibles con ≥1 vehículo ERP (`matched`) | **216** |
| Universales sin vehículo específico (`universal`) | **0** |
| Sin match ERP (`unmatched`) | **4** |
| Total productos | **220** |
| Imágenes descargadas | **30** |

## Contenido
- `catalogo.json` — Todos los productos con `match_status` y `erp_matches`
- `catalogo_matched.json` / `catalogo_universal.json` / `catalogo_unmatched.json` — Particiones
- `catalogo.xlsx` — Hojas `productos`, `especificaciones`, `erp_matches`
- `matching_report.json` — Conteos, handles, notas
- `stats.json` — Resumen numérico
- `imagenes/<handle>/principal.jpg` — Hasta ~30 imágenes
- `afn_catalogo_datos.zip` — JSON + XLSX + README + stats
- `README.md` — Este archivo

## Categorías
- Protección delantera: 87
- Protección inferior / lateral: 86
- Protección trasera: 28
- Almacenamiento / carga: 19

## Campos principales
| Campo | Descripción |
|-------|-------------|
| sku / skus | Referencia AFN numérica (ej. `48002864`) |
| handle | Slug Shopify o REF |
| nombre | Título traducido EN→ES |
| nombre_original | Título original (tienda / ficha) |
| categoria | Tipo de accesorio |
| descripcion | Texto descriptivo (si hay en Shopify) |
| especificaciones | Marca, referencia, origen Portugal, años/modelos |
| precio / moneda | USD desde Shopify USA; si no, «No especificado» (precios afn.pt requieren login dealer) |
| compatibilidad | Fitment normalizado marca/modelo/años |
| match_status | matched / universal / unmatched |
| erp_matches | Lista de {id, brand, model, descriptor, label} (máx. 40) |
| erp_match_count | Total de matches antes del tope |
| imagen_principal | Ruta relativa local |
| source_url | URL de evidencia |

Si un dato no figura de forma fiable en la fuente, el campo es **«No especificado»**.

## Cómo importar
1. Descomprimir `afn_catalogo_datos.zip` manteniendo la estructura de carpetas.
2. Usar `catalogo.json` o `catalogo.xlsx` según el conector ERP.
3. Filtrar por `match_status=matched` para el catálogo compatible primario.
4. Mapear SKU, nombre, categoría, specs, compatibilidad, `erp_matches` e imágenes.
5. Revisar `unmatched` (p. ej. INEOS Grenadier u otros sin entrada ERP).

## Notas
- AFN = Portugal (Europa), no confundir con marcas brasileñas homónimas.
- El feed Shopify USA estaba disponible (no bloqueado) al generar este catálogo.
- Las páginas afn.pt se usaron como fuente principal de referencias y fitment por vehículo.
- Generado: 2026-09-11T22:16:05.095544+00:00
