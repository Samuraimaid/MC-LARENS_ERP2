# Catálogo DLAA — Faros antiniebla / iluminación automotriz

Catálogo generado desde [dlaa.com.cn](https://dlaa.com.cn/) (API Shopify `products.json`).
Productos publicados scrapeados: **142**.

Compatibilidad cruzada con la base ERP de vehículos Mc-Larens (`vehicleCatalog.json`, 8318 entradas / 40 marcas).

## Totales de matching
| Estado | Cantidad |
|--------|----------|
| Compatibles con ≥1 vehículo ERP (`matched`) | **105** |
| Universales / off-road sin vehículo específico (`universal`) | **22** |
| Sin match ERP (`unmatched`) | **15** |
| Total publicados | **142** |

## Contenido
- `catalogo.json` — Todos los productos (matched + universal + unmatched), con `match_status` y `erp_matches`
- `catalogo_matched.json` / `catalogo_universal.json` / `catalogo_unmatched.json` — Particiones
- `catalogo.xlsx` — Hojas `productos`, `especificaciones`, `erp_matches`
- `matching_report.json` — Mapa de códigos, conteos, lista unmatched
- `imagenes/<handle>/principal.jpg` (+ `adicional_XX.jpg`)
- `dlaa_catalogo_datos.zip` — JSON + XLSX + README
- `README.md` — Este archivo

## Mapa de códigos de marca DLAA
| Código | Marca ERP / nota |
|--------|------------------|
| NS | NISSAN |
| TY | TOYOTA |
| HD | HONDA |
| MB | **MITSUBISHI** (no Mercedes Benz) |
| JP | JEEP |
| RN | RENAULT |
| VW | VOLKSWAGEN |
| KA | KIA |
| CV | CHEVROLET |
| FD | FORD |
| AD | AUDI |
| DW | DAEWOO *(no está en ERP)* |
| FT | FIAT *(no está en ERP)* |
| HV | HUMMER *(no está en ERP)* |
| PL | Universal / off-road |

## Categorías
- Faros antiniebla OE: 78
- Faros antiniebla: 25
- Faros antiniebla LED: 16
- Luces diurnas: 7
- Luces off-road: 6
- Luces diurnas OE: 4
- Faros antiniebla universales: 2
- Faros delanteros: 1
- Luces traseras: 1
- Luces de señalización: 1
- Partes de decoración: 1

## Campos principales
| Campo | Descripción |
|-------|-------------|
| sku / skus | Códigos modelo DLAA (se conservan en latín) |
| handle | Slug / carpeta de imágenes |
| nombre | Título traducido EN→ES |
| nombre_original | Título original de la tienda |
| categoria | Colección / tipo de lámpara |
| descripcion | Texto descriptivo traducido |
| especificaciones | Clave-valor desde Quick Details |
| potencia / tension_trabajo | Si figuran; si no, "No especificado" |
| compatibilidad | Fitment crudo normalizado (marca/modelo/años) |
| match_status | matched / universal / unmatched |
| erp_matches | Lista de {id, brand, model, descriptor, label} (máx. 40) |
| erp_match_count | Total de matches antes del tope |
| imagen_principal | Ruta relativa local |

Si un dato no figura de forma fiable en la fuente, el campo es **"No especificado"** (no se inventa).

## Cómo importar
1. Descomprimir manteniendo la estructura de carpetas.
2. Usar `catalogo.json` o `catalogo.xlsx` según el conector ERP.
3. Filtrar por `match_status=matched` para el catálogo compatible primario.
4. Mapear SKU, nombre, categoría, specs, compatibilidad, `erp_matches` e imágenes.

Fuente: https://dlaa.com.cn/ — generado 2026-09-11 UTC.
