# Catálogo Meguiar's (Costa Rica) — MC-LARENS ERP2

Catálogo de productos Meguiar's generado a partir de [meguiars.cr](https://meguiars.cr/) 
para uso interno en el ERP Samuraimaid/MC-LARENS_ERP2.

## Resumen

- **Productos:** 210
- **Con imagen:** 210 (100.0%)
- **Imágenes limpias externas (official/retail, calidad alta/media):** 156 (74.3%)
- **Imagen oficial (meguiarsdirect / CDN fabricante):** 156
- **Imagen sitio local (fallback):** 54
- **Calidad alta / media / baja:** 183 / 0 / 27
- **Con precio CRC:** 210
- **Con descripción útil:** 209

## Fuentes

1. WooCommerce Store API — `https://meguiars.cr/wp-json/wc/store/v1/products` (SKU, precio CRC, imágenes locales, categorías).
2. WP REST — `https://meguiars.cr/wp-json/wp/v2/product` y `product_cat`.
3. PDFs del sitio (enriquecimiento de códigos/especificaciones en español):
   - Meguiars_2023_BSC_Catalog_Body_web.pdf
   - catalogo-profesional.pdf
4. Fotografía de producto preferida desde **Meguiar's Direct** (CDN Shopify oficial de la marca), 
   buscada por código/SKU (packshots 10x10 fondo blanco). Las imágenes del sitio CR a menudo tienen fondo oscuro.

## Campos por producto

| Campo | Descripción |
|-------|-------------|
| sku / codigos | SKU local y códigos Meguiar's detectados (G18216, M105, etc.) |
| nombre, url_local, categorias, precio_crc | Datos de meguiars.cr |
| descripcion, especificaciones | Español; `No especificado` si no hay dato (no se inventa) |
| uso / superficie | Inferido de categoría/nombre cuando aplica |
| imagen_principal / adicionales | Rutas relativas bajo `imagenes/<slug>/` |
| imagen_fuente | ``official` | `retail` | `local_site` | `pdf` |
| imagen_fuente_url | URL de origen atribuida (uso interno ERP) |
| imagen_calidad | `alta` | `media` | `baja` (fondo blanco/estudio) |

## Estructura

```
catalogos/Meguiars/
  README.md
  catalogo.json
  catalogo.xlsx
  meguiars_catalogo_datos.zip  (JSON/XLSX/README/image_sources; las fotos están en `imagenes/`)
  image_sources.json
  imagenes/<slug>/principal.jpg
```

## Categorías (conteo de asignaciones)

- Cuidado Automotriz: 110
- Linea Profesional: 98
- Pads Pulido: 18
- Accesorios: 15
- Accesorios LP: 13
- Ceras: 13
- Ceras Linea Profesional: 10
- Promociones: 10
- Shampoo: 10
- Cuidado Interno: 9
- Pulido de Pintura LP: 9
- Abrillantadores para Llantas: 7
- Eliminadores de Olores: 7
- Abrillantadores para Pintura LP: 6
- Cuidado de Cuero: 6
- Detalladores de Pintura LP: 6
- Cuidado de Vidrios: 5
- Detalladores de Pintura: 5
- Recubrimientos: 5
- Shampoo LP: 5
- Cuidado Interno LP: 4
- Limpieza de Alfombras LP: 4
- Abrillantadores para Llantas LP: 3
- Cuidado de Aros: 3
- Cuidado de Aros LP: 3
- Cuidado de Molduras: 3
- Descontaminación: 3
- Platos para Maquina: 3
- Pulido de Pintura: 3
- Abrillantadores para Pintura: 2
- Cuidado de Capotas: 2
- Cuidado de Focos: 2
- Cuidado de Motor: 2
- Desengrasantes LP: 2
- Outlet: 2
- Cuidado de Cuero LP: 1
- Cuidado de Focos LP: 1
- Cuidado de Molduras Partes Negras: 1
- Cuidado de Vidrios LP: 1
- Desengrasantes: 1
- Kits de Pulido LP: 1
- Limpieza de Alfombras: 1
- Pulidores de Metales: 1
- Sin Categoría: 1

## Atribución de imágenes

Las imágenes se descargaron para **uso interno del ERP**. No se reclama propiedad de los derechos de autor. 
Cada registro incluye `imagen_fuente_url` con la URL de origen. Preferencia: packshot oficial Meguiar's con fondo blanco.

## Notas / gaps

- Productos sin imagen limpia externa: 54
- Productos con descripción 'No especificado': 1
- Kits/accesorios sin código estándar Meguiar's pueden carecer de packshot oficial.

Generado: 2026-09-11
