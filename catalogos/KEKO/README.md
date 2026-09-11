# Catálogo KEKO — Accesorios para pickup / SUV / utilitarios

Catálogo generado desde [keko.com.br](https://www.keko.com.br/) (API VTEX `catalog_system/pub/products/search`).
Productos publicados scrapeados: **212**.

Compatibilidad cruzada con la base ERP de vehículos Mc-Larens (`vehicleCatalog.json`, 8318 entradas / 40 marcas).

## Totales de matching
| Estado | Cantidad |
|--------|----------|
| Compatibles con ≥1 vehículo ERP (`matched`) | **104** |
| Universales / multi-fit sin vehículo específico (`universal`) | **80** |
| Sin match ERP (`unmatched`) | **28** |
| Total publicados | **212** |

## Contenido
- `catalogo.json` — Todos los productos (matched + universal + unmatched), con `match_status` y `erp_matches`
- `catalogo_matched.json` / `catalogo_universal.json` / `catalogo_unmatched.json` — Particiones
- `catalogo.xlsx` — Hojas `productos`, `especificaciones`, `erp_matches`
- `matching_report.json` — Conteos, uso de marcas/modelos, lista unmatched
- `stats.json` — Resumen numérico
- `imagenes/<handle>/principal.jpg` — Muestra de imágenes (tope ~30); todas las URLs quedan en el JSON
- `keko_catalogo_datos.zip` — JSON + XLSX + README + stats
- `README.md` — Este archivo

## Fuente VTEX
- Búsqueda: `https://www.keko.com.br/api/catalog_system/pub/products/search?_from=0&_to=49` (páginas de 50)
- Árbol de categorías: `https://www.keko.com.br/api/catalog_system/pub/category/tree/3`
- Fitment nativo: `sku-montadora`, `sku-modelo`, `sku-ano`, `sku-versão`, `sku-cabine` y `Montadora` / `Modelo` / `Ano`

## Marcas KEKO → ERP
| KEKO | Marca ERP / nota |
|------|------------------|
| Toyota | TOYOTA (Hilux, SW4) |
| Ford | FORD (Ranger, Maverick, F-150) |
| Chevrolet | CHEVROLET (S10*, Silverado, Colorado, Montana*) |
| Nissan | NISSAN (Frontier / NP300) |
| Mitsubishi | MITSUBISHI (L200 / Triton) |
| Volkswagen | VOLKSWAGEN (Amarok, Saveiro) |
| RAM | RAM (1500 / 2500 / 3500; ERP con OCR) |
| Jeep | JEEP (Gladiator, Compass, Renegade) |
| Isuzu | ISUZU (D-Max) |
| Mazda | MAZDA (BT-50) |
| GWM / Great Wall | GREATWALL (Poer, Wingle) |
| Renault | RENAULT (Oroch, Duster) |
| Fiat | **FIAT no está en el ERP** (Toro, Strada, Titano) |
| Volvo | **VOLVO no está en el ERP** |

\* Chevrolet S10 y Montana no tienen entradas ERP limpias; un producto solo-S10/Montana queda `unmatched`.

## Categorías
- Ítems de reposición: 137
- Enganches de remolque: 26
- Capota rígida retráctil: 14
- Santo Antonio: 10
- Capotas marítimas: 8
- Estribos: 8
- Utilitarios: 5
- Traviesas: 2
- Estribo eléctrico: 1
- Rejilla de vidrio trasero: 1

## Campos principales
| Campo | Descripción |
|-------|-------------|
| sku / skus | Referencia VTEX (`productReference`, RefId, códigos Kxxxx) |
| handle / linkText | Slug VTEX / carpeta de imágenes |
| nombre | Título traducido PT→ES |
| nombre_original | Título original de keko.com.br |
| categoria | Categoría superior VTEX (traducida) |
| descripcion | Texto descriptivo traducido |
| especificaciones | Clave-valor desde specs VTEX |
| precio | Precio en **BRL** según oferta comercial |
| variantes | SKUs con montadora/modelo/año/cabina |
| compatibilidad | Fitment crudo normalizado |
| match_status | matched / universal / unmatched |
| erp_matches | Lista de id/brand/model/descriptor/label (máx. 40) |
| erp_match_count | Total de matches antes del tope |
| imagen_principal | Ruta local o URL de origen |
| source_url | Ficha en keko.com.br |

Si un dato no figura de forma fiable en la fuente, el campo es **"No especificado"** (no se inventa).

## Reglas de matching
1. Se recorre cada SKU con `sku-montadora` + `sku-modelo` + `sku-ano`.
2. Marca ERP + modelo normalizado (L200/Triton, Frontier/NP300, F-150/F150) en model/descriptor/label.
3. Si hay años, se intersecta con year_start/year_end; si el filtro deja 0, se reintenta sin año.
4. Sin años → todas las generaciones de ese modelo.
5. SKU Universal → `universal`.
6. Nombre tipo “picapes médias e grandes” sin modelo → `universal`.
7. Marca/modelo concretos sin overlap ERP (solo Fiat Toro) → `unmatched`.
8. `erp_matches` recortado a 40; `erp_match_count` guarda el total.

## Cómo importar
1. Descomprimir `keko_catalogo_datos.zip` manteniendo la estructura.
2. Usar `catalogo.json` o `catalogo.xlsx` según el conector ERP.
3. Filtrar por `match_status=matched` para el catálogo compatible primario.
4. Mapear SKU, nombre, categoría, specs, compatibilidad, `erp_matches` e imágenes.
5. Los precios están en BRL; convertir si el ERP trabaja en otra moneda.

Fuente: https://www.keko.com.br/ — generado 2026-09-11 UTC.
