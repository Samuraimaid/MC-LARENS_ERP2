# Design Motion — barrido nocturno (candidatos ERP)

**Fuente:** https://www.facebook.com/p/Design-Motion-61588326206046/ · https://www.designmotionhq.com/patterns (76 patterns)  
**Inicio:** 2026-09-12 ~00:50 UTC · **Entrega objetivo:** antes 8:00 GMT-6  
**Ya evaluados (no reabrir):** R-001…R-010

## Índice útil para McLarens (triage)

| Pattern | Veredicto | Por qué / dónde en ERP |
|---------|-----------|-------------------------|
| Hover Trap | **APLICAR** (R-011) | Acciones solo-hover mueren en tablet/piso; junto R-010 |
| Empty States | **APLICAR** (R-012) | Inventario vacío #9, listas sin CTA |
| Loading States System | **APLICAR** (R-013) | Rutas >15s #8; no spinner eterno |
| Skeleton Loading | **APLICAR** (con R-013) | Skeleton alineado al layout final |
| Destructive Actions | **APLICAR** (R-014) | Delete/anular: overflow + confirm; no al lado de Edit |
| Error States | **APLICAR** (R-015) | #4 crash, #7 GPS: recovery claro en ES |
| Bottom Sheets | **APLICAR** (ya en R-010) | Menú thumb-friendly |
| File Upload UX | **APLICAR** (ya R-009) | Publicidad + taller |
| Context Menu | **APLICAR** (ya R-010) | #10 |
| Data Table | APARCAR (R-006) | Post P0 |
| Toast Notifications | APARCAR | Reglas toast; hay P3 toast duplicado |
| Bulk Actions | APARCAR | Inventario/bodega más adelante |
| Swipe Actions | APARCAR | Móvil técnicos |
| Form Validation Timing | APARCAR | Forms cliente/vehículo |
| Undo UX | APARCAR | Cuidado con ventas CRITICAL |
| Autosave | APARCAR | Drafts = zona CRITICAL; no tocar a la ligera |
| Search Experience | APARCAR | Catálogo/ventas |
| Disabled Buttons | APARCAR | Caja/pago |
| Optimistic UI | APARCAR | Nunca en cobros/caja sin criterio |
| Command Palette | OBVIAR | No prioridad POS |
| De-AI Landing / Charts That Lie / Live Cursors / Star Rating / OTP / Password / Color Picker | OBVIAR | Fuera de alcance o no aplica (PIN, no SaaS marketing) |
| Motion/Easing/Golden Ratio/Gradients | OBVIAR | Estética pura |

## Takeaways cortos (páginas leídas)

- **Hover Trap:** hover ≠ mobile; exponer acciones con tap/⋯/sheet.
- **Empty States:** primera impresión; CTA (“cargar inventario”, “crear…”) no filas en blanco.
- **Loading system:** no un solo skeleton para todo; estados de carga como sistema.
- **Destructive:** lenguaje de diseño (separar, confirmar), no solo botón rojo.
- **Error states:** mismo error, mejor recuperación.
- **Skeleton:** spinner alarga la percepción de espera; skeleton del layout final.
- **Toasts:** 5 reglas — informar sin bloquear.
- **Bottom sheets:** el pulgar no alcanza menús de escritorio.

## Plugin UX Engine ($79)

**OBVIAR compra** (igual R-008). Sí copiar *principios gratis* de /patterns al brief de Antigravity.

---
Generado por Case; el routine 7:00 GMT-6 consolidará en ANTIGRAVITY_APLICAR_TODO.md.
