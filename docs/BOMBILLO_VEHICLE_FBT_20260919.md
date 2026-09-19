# Bombillos vehículo + FBT DLAA→DS18 (2026-09-19)

## A) Catálogo de vehículos

- Archivo: `frontend/src/data/vehicleCatalog.json`
- Overlay: 280 modelos vectoriales enriquecidos con `bombillos` (posición principal: `luz_antiniebla`) + `bombillos_meta`
- Fuente: reverse-index ERP (productos con `bombillo` + `compatibility.erp_matches`); sin inventar posiciones; xenón excluido
- Meta raíz: `bombillos_enrichment.enriched_count = 280`

## B) Quick View — Se venden juntos

- Regla en `frontend/src/lib/productRecommendations.js`
- Si el producto es **DLAA** con `led_upsell_eligible` (o heurística: no LED housing / no DRL) y tiene `bombillo` / `specs.Bombillo`:
  - Se agregan kits **DS18** `VIXH*` / `VTLH*` cuyo tamaño coincide tras expandir alias
  - Alias: H11↔H8/H9/H16; H4↔9003; 9005↔HB3; 9006↔HB4; H13↔9008
  - Solo dirección **halógeno → LED** (nunca LED → carcasas DLAA)
  - Selección por defecto **0/N** (sin auto-check)
- Resolución de SKU: sufijo del SKU (`VTLH11`→`H11`, `VIXH4`→`H4`) ∩ aliases del bombillo DLAA; se busca en `allProducts` ya cargados en QV

## C) Deploy (Xinon)

```bash
cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh
```

## Notas

- No incluye import masivo Auxbeam
- PRs #34–#36 (QV 2-col/scroll/FBT 0-N, mobile QV, sin flechas header carrusel) ya estaban en `master` al armar este lote
