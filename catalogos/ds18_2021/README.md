# Catálogo DS18 — 2021

Catálogo generado a partir del PDF oficial **Catalogue-2021-WEB.pdf** (DS18, 172 páginas, marzo 2021).
Productos extraídos: **820** SKUs distintos.

## Contenido
- `catalogo.json` — Array JSON con productos y campos para importación ERP
- `catalogo.xlsx` — Excel con hoja `productos` y hoja `especificaciones`
- `imagenes/` — Carpetas por SKU/handle con `principal.jpg` (+ `adicional_XX.jpg` cuando hay)
- `README.md` — Este archivo
- `ds18_catalogo_datos.zip` — JSON + XLSX + README (rutas de imagen incluidas)

Imágenes locales: ~1689 archivos (119.8 MB).

## Campos principales
| Campo | Descripción |
|-------|-------------|
| sku / modelo | Código de producto DS18 (se conserva en latín) |
| handle | Slug de carpeta de imágenes |
| nombre | Nombre descriptivo en español |
| nombre_original | Título/descripción original en inglés del PDF |
| categoria | Sección del índice (TOC) del catálogo |
| descripcion | Texto descriptivo traducido EN→ES |
| especificaciones | Objeto clave-valor (potencia, impedancia, sensibilidad, etc.) |
| potencia | RMS y/o MAX si aparece en la ficha |
| impedancia | Impedancia si aparece |
| tension | Tensión de trabajo si aparece |
| contenido_caja | Lo incluido si se indica; si no, "No especificado" |
| pagina_pdf | Número de página impreso del catálogo |
| imagen_principal | Ruta relativa local |
| imagenes_adicionales | Lista de rutas relativas |
| vendor | DS18 |
| fuente | DS18 Catalogue 2021 WEB PDF |

Si un dato no figura de forma fiable en el PDF, el campo es **"No especificado"** (no se inventa).

Potencia no especificada: 580/820. Impedancia no especificada: 565/820. Es habitual en accesorios, cables, reconos, diafragmas y merchandise.

## Categorías (36)
- Pro Audio: 91
- Torres: 69
- Amplificadores: 59
- Cables: 55
- Subwoofers: 53
- Diafragmas: 43
- Kits de recono: 40
- Kits LED: 37
- Tweeters: 30
- Drivers: 30
- Trompetas y difusores: 28
- Altavoces (Hydro): 27
- Accesorios / Instalación / Cables: 27
- Rejillas y anillos: 24
- Coaxiales: 23
- Audio Jeep: 23
- Cajas exclusivas: 21
- Procesadores: 20
- Baterías AGM Infinite: 19
- Subwoofers (Hydro): 14
- Amplificadores (Hydro): 12
- Woofers: 8
- Cabezales (Hydro): 8
- Accesorios de instalación: 7
- Cámaras y seguridad: 7
- Bloques de distribución: 6
- Kits de instalación: 6
- Fuentes de alimentación: 6
- Zumba Loud: 6
- Multimedia: 5
- Dimensiones: 5
- Juegos de componentes: 3
- Barras de sonido: 3
- Accesorios: 2
- Accesorios (Hydro): 2
- Lifestyle: 1

## Cómo importar
1. Descomprimir manteniendo la estructura de carpetas.
2. Usar `catalogo.json` o `catalogo.xlsx` según el conector ERP.
3. Mapear SKU, nombre, categoría, specs, potencia, impedancia e imágenes.
4. Las rutas de imagen son relativas a la raíz del catálogo (`imagenes/<handle>/principal.jpg`).

## Notas
- Traducción automática EN→ES con Argos Translate (offline) + glosario técnico de audio.
- Revisar descripciones técnicas si se requiere precisión editorial.
- Códigos de serie/modelo (PRO-M6.2NEO, DX2, EXL-SQ6.5, etc.), unidades (W, Ohm, dB, Hz) y SKUs se conservan.
- Algunas fichas del PDF son multi-columna; la extracción prioriza cobertura de SKUs y specs clave.
- Páginas del TOC sin SKU vendible (p. ej. 23, 71, 149 merchandising genérico) o dobles de arte se omiten.
- Imágenes: fotos embebidas del PDF cuando es posible; si no, render de la página del catálogo.
- Fuente: Catalogue-2021-WEB.pdf (Adobe InDesign), marca DS18.
