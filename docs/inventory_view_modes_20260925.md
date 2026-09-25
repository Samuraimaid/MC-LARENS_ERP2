# Inventario — modos de vista (Lot C amend) 2026-09-25

**PR:** https://github.com/Samuraimaid/MC-LARENS_ERP2/pull/79  
**Branch:** `feat/lot-c-inventory-transfer-whatsapp-20260925`  
**Hold:** no merge / no deploy

## WhatsApp fila
Confirmado: `data-testid="whatsapp-row-btn"` en **cada fila/tarjeta** de Inventario (todas las vistas). Truck = traslado bodegas. Post-traslado WA queda **opcional** (Omitir = primary).

## Tres vistas (localStorage `mclarens_inventory_view_mode`)

| Modo | Valor | UX |
|---|---|---|
| **Delgada** (default) | `delgada` | Tabla densa actual — más filas en pantalla |
| **Intermedia** | `intermedia` | Tarjetas Liquid Glass con imagen ~112px + detalle |
| **2 columnas** | `columnas` | Grid 2 cols, imagen ancha |

Toggle segmentado (iconos List / LayoutGrid / Columns2) + labels ES en md+.

