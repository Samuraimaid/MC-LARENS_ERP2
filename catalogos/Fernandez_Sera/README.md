# Catálogo Fernández Sera — AUTOMOTRIZ (Nicaragua) — MC-LARENS ERP2

Catálogo de productos de la categoría **AUTOMOTRIZ** extraído de [fernandezsera.com](https://fernandezsera.com/categoria-producto/automotriz/) para uso interno en el ERP Samuraimaid/MC-LARENS_ERP2.

## Resumen

- **Productos:** 201
- **Con imagen:** 200 (99.5%)
- **Calidad alta / media / baja:** 197 / 3 / 0
- **Con precio NIO (C$):** 201
- **Con descripción útil:** 201
- **Marcas distintas:** 21

## Fuentes

1. WooCommerce Store API — `https://fernandezsera.com/wp-json/wc/store/v1/products?category=18` (SKU, precio NIO, imágenes, categorías, marcas, descripción).
2. WP REST — `product_cat` (id 18 AUTOMOTRIZ y subcategorías).
3. Imágenes de producto del sitio (packshots PNG/JPG en `wp-content/uploads`); descargadas vía proxy de imágenes por limitación TLS del entorno de extracción.

## Campos por producto

| Campo | Descripción |
|-------|-------------|
| sku / codigos | SKU Fernández Sera (ej. A-PW-400, A-GSP-107-C) |
| marca | Marca comercial (ABRO, COOLZONE, FORMULA 1, etc.) |
| nombre, url_local, categorias, precio_nio | Datos de fernandezsera.com (C$) |
| descripcion, especificaciones | Español; `No especificado` si no hay dato (no se inventa) |
| disponibilidad / en_stock | Estado de inventario del sitio |
| imagen_principal / adicionales | Rutas relativas bajo `imagenes/<slug>/` |
| imagen_fuente | `local_site` (preferido: packshots limpios del sitio) |
| imagen_calidad | `alta` / `media` / `baja` |

## Estructura

```
catalogos/Fernandez_Sera/
  README.md
  catalogo.json
  catalogo.xlsx
  fernandez_sera_catalogo_datos.zip
  image_sources.json
  imagenes/<slug>/principal.jpg
```

## Subcategorías AUTOMOTRIZ (asignaciones por categoría principal)

- LAVADO Y APARIENCIA: 52
- LUBRICANTES Y ACEITES DE MOTOR: 43
- PRODUCTOS DE SERVICIO Y MANTENIMIENTO: 23
- LIMPIADORES Y DESENGRASANTES: 21
- SILICONES Y SELLADORES: 9
- ADITIVOS PARA MOTORES Y COMBUSTIBLES: 9
- AMBIENTADORES EN SPRAY: 8
- ADITIVOS PARA RADIADORES: 7
- AMBIENTADORES REJILLA WRAP: 6
- AMBIENTADORES ORGÁNICOS: 5
- ENVASES PARA COMBUSTIBLE: 4
- LUBRICANTES HIDRÁULICOS Y ANTIDESGASTE: 3
- SEGURIDAD VIAL: 2
- AMBIENTADORES REJILLA LÍQUIDOS: 2
- 3 EN 1: 1
- PRODUCTOS DE USO DOMÉSTICO: 1
- AUTOMOTRIZ: 1
- LUBRICANTES PARA ENGRANAJES Y DIFERENCIALES: 1
- AMBIENTADORES: 1
- PROMOCIONES: 1
- FERRETERO: 1

## Marcas (conteo)

- ABRO: 32
- GOLDEN SUPREME: 26
- FORMULA 1: 23
- BRAVA: 19
- LITTLE TREES: 19
- JOHNSEN'S: 18
- COOLZONE: 14
- STONER CAR CARE: 9
- VERSACHEM: 7
- FORMULA 83: 5
- MOTOR MEDIC: 5
- SCEPTER: 4
- BIO-CLEAN: 3
- CRISTAL: 3
- FAST ORANGE: 3
- WD-40: 3
- 3-EN-UNO: 2
- FALCON PRO: 2
- N0. 7: 2
- AIRBENDER: 1
- GUNK: 1

## Atribución de imágenes

Las imágenes se descargaron para **uso interno del ERP**. No se reclama propiedad de los derechos de autor. Cada registro incluye `imagen_fuente_url` con la URL de origen. Preferencia: packshot del sitio Fernández Sera (generalmente fondo blanco / estudio).

## Notas / gaps

- Productos sin imagen: 1 (A-EC-833 Limpiador de contactos electrónicos — archivo origen 404 vía CDN/proxy)
- Productos con descripción 'No especificado': 0
- Especificaciones de peso/dimensiones WooCommerce no expuestas en Store API pública; se extraen tamaños/viscosidades visibles en nombre o descripción cuando existen.
- El conteo WP (`product_cat` 18) reportó ~197; Store API devolvió 201 (incluye ítems en subcategorías hijas, p.ej. limpiadores también listados en ferretero).

Generado: 2026-09-11
