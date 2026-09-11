# Cobertura de códigos de barras — catálogos MC-LARENS_ERP2

Fecha: 2026-09-11

| Catálogo | ¿Barcode en fuente? | Resultado | Notas |
|----------|---------------------|-----------|-------|
| **KEKO** | Sí (VTEX `items[].ean`) | **Enriquecido** ~191/212 productos; ~948/970 variantes | Se filtró «A Definir». Campos `codigo_barras`, `codigos_barras`, `ean`. |
| **Fox** | No | 0 | RideFOX Shopify `variant.barcode` vacío. Queda SKU Fox (`987-02-009`, etc.). |
| **AFN** | No | 0 | Solo refs internas `4800…`. Shopify USA sin barcode. |
| **DLAA** | No | 0 | `dlaa.com.cn` Shopify: 0 barcodes en variantes. |
| **Meguiar's** | No público | 0 | Store API sin GTIN; WC v3 requiere auth; HTML sin gtin en muestra. |
| **Fernández Sera** | No verificado | 0 | Store API SSL inestable desde este entorno; no expuesto en JSON actual. |
| **Pioneer** | No en catálogo actual | 0 | Sin `products.json` público usable; catálogo sin campo barcode. |
| **DS18** | No | 0 | Origen PDF 2021 + ds18.com Shopify sin barcode en muestra. |

## Política
- Solo se escriben EAN/UPC/GTIN **publicados por la fuente**.
- Si no hay dato: `No especificado` (no se inventa ni se adivina desde el SKU).
- Fox/AFN/DLAA/Meguiar's/Pioneer/DS18: omitir barcode salvo que aparezca una fuente confiable después.

## KEKO — campos añadidos
- Producto: `codigo_barras`, `codigos_barras[]`, `ean`
- Variante: `ean`, `codigo_barras`
- Excel: hoja `codigos_barras`
