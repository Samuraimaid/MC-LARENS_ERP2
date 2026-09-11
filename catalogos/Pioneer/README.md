# Catálogo Pioneer Latinoamérica

Catálogo generado desde [https://pioneer-latin.com/](https://pioneer-latin.com/) (WooCommerce Store API + páginas de categoría / modelos anteriores).
Productos incluidos: **157** (solo las 5 categorías solicitadas).

## Conteos por categoría

| Categoría | Actual | Anterior | Total |
|-----------|--------|----------|-------|
| Receptores_Multimedia | **23** | **15** | **38** |
| Receptores_de_Audio | **9** | **9** | **18** |
| Parlantes | **43** | **13** | **56** |
| Subwoofers | **22** | **8** | **30** |
| Amplificadores | **14** | **1** | **15** |

## Contenido

- `catalogo.json` — Todos los productos con campo `categoria` y `linea_tiempo` (import ERP)
- `catalogo.xlsx` — Hojas `productos`, `especificaciones`, `resumen`
- `Receptores_Multimedia/`, `Receptores_de_Audio/`, `Parlantes/`, `Subwoofers/`, `Amplificadores/`
  - `catalogo.json` por categoría
  - `imagenes/<handle>/principal.*` (+ `adicional_XX.*`)
- `pioneer_catalogo_datos.zip` — JSON + XLSX + README
- `README.md` — Este archivo

Imágenes locales: ~301 archivos (92.6 MB).

## Campos destacados (ERP)

| Campo | Descripción |
|-------|-------------|
| sku / modelo | Código de modelo Pioneer (p.ej. DMH-ZF8750BT) |
| categoria | Una de las 5 carpetas |
| linea_tiempo | `actual` o `anterior` (modelos anteriores / discontinuados) |
| potencia_rms_por_canal | Potencia RMS por canal si figura; si no, No especificado |
| carplay | yes / no / unknown |
| android_auto | yes / no / unknown |
| conectividad_carplay_android | inalambrico / alambrico / ambos / No especificado |
| uso_car_audio | yes (catálogo car audio) |
| tamano_pantalla | p.ej. 6.8", 9.0" cuando aplica |
| doble_zona | yes / no / No especificado |
| especificaciones | Objeto clave-valor extraído del sitio (sin inventar) |
| imagen_principal | Ruta relativa `Categoria/imagenes/<handle>/principal.*` |

## Notas / gaps

- No se inventan especificaciones: si el sitio no las publica, el valor es `No especificado`.
- El SKU numérico interno de WooCommerce a veces es un hash; se usa el **modelo** visible como `sku`.
- Accesorios / apps (Apple CarPlay landing, ARC, etc.) quedan fuera de este recorte de 5 categorías.
- `doble_zona` rara vez aparece explícito en fichas ES; suele quedar `No especificado` o `no` según categoría.

## Importación ERP

1. Usar el `catalogo.json` plano en la raíz de `catalogos/Pioneer/`.
2. Filtrar por `categoria` y/o `linea_tiempo` según necesidad.
3. Rutas de imagen relativas a `catalogos/Pioneer/`.
