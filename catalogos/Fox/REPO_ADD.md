# Propuesta de alta en repositorio ERP

## Ruta Git sugerida
`catalogos/Fox/`

Espejo de las carpetas de marca ya presentes en el repo (p. ej. `catalogos/KEKO/`, `catalogos/AFN/`), usando **Fox** en title case (alineado al theme skin `fox` del ERP Mc-Larens).

## Destino
Repositorio: `Samuraimaid/MC-LARENS_ERP2`  
Ruta relativa propuesta al raíz del repo:

```
catalogos/Fox/
├── README.md
├── REPO_ADD.md
├── catalogo.json
├── catalogo_matched.json
├── catalogo_universal.json
├── catalogo_unmatched.json
├── catalogo.xlsx
├── matching_report.json
├── stats.json
├── image_sources.json
├── fox_catalogo_datos.zip
└── imagenes/<handle>/principal.jpg
```

## Notas para el commit
- Incluir JSON/XLSX/README/stats y el zip de datos.
- Las imágenes son una muestra (~30); el JSON conserva todas las URLs CDN.
- No sustituye catálogos KEKO/AFN/DLAA; es un brand folder adicional.
- Vendor / brand key: `FOX` / carpeta `Fox`.
