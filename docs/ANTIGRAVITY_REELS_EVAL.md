# Antigravity — Inbox de reels / ideas (evaluación Case)

**Repo:** Samuraimaid/MC-LARENS_ERP2  
**Quién evalúa:** Case (Grok Bot) — Xinon comparte reels; Case clasifica impacto antes de que Antigravity implemente.  
**Actualizado:** 2026-09-11

## Cómo usar este archivo

1. Xinon pega un link de reel (Facebook/IG/TikTok/YouTube) en el chat de Case.
2. Case resume la idea, la cruza con el estado real del ERP (QA, issues, handoff) y asigna un veredicto.
3. Antigravity **solo actúa** sobre ítems `APLICAR` (o `APARCAR` cuando el handoff diga que toca esa fase). Ignora `OBVIAR`.

### Veredictos

| Código | Significado | Qué hace Antigravity |
|--------|-------------|----------------------|
| **APLICAR** | Encaja ahora; beneficio > riesgo | Implementar en PR pequeño ligado a P0–P3 del handoff |
| **APARCAR** | Idea válida, mal timing o demasiado amplia | No implementar aún; dejar nota / issue; retomar cuando Case/Xinon lo promueva |
| **OBVIAR** | Ruido, clickbait, o dañino en el estado actual del ERP | No tocar código; no abrir PRs “por curiosidad” |

### Reglas duras (igual que el handoff)

- No reescribir el monolito ni partir a microservicios “porque un reel lo dijo”.
- No tocar CRITICAL_ZONES / SaleForm / PIN / drafts / totales sin gap de seguridad demostrable.
- Preferir PRs chicos. Si el reel contradice `POLITICAS_CAMBIOS_CODIGO.md` o `SAFE_FIRST_REFACTORS.md` → **OBVIAR** o **APARCAR**.

---

## Registro (más reciente arriba)

### R-001 — Event-driven vs llamadas síncronas en cadena
- **Fecha evaluación:** 2026-09-11
- **Fuente:** Facebook Reel — Phạm Tùng  
  https://www.facebook.com/share/r/1abMHNkg73/  
  (reel `2080027619297742`)
- **Idea (resumen):** Si un servicio muere y otros lo llaman en cadena (síncrono), se congelan en cascada. Con event-driven, se publica un hecho y los consumidores reaccionan desacoplados.
- **Veredicto:** **APARCAR**
- **Impacto en McLarens ERP:** Medio-alto *a futuro*, bajo *ahora*. El ERP es FastAPI+React+Mongo en Cloud Run (monolito / semi-monolito). El dolor real de QA (cargas >15s, inventario lento, venta↔stock↔técnicos) sí sugiere **desacoplar algunos side-effects**, no microservicios.
- **Si se retoma (fase sugerida: post P1, junto a P2 perf / approvals):**
  - Eventos *internos* selectivos: p.ej. `SaleCompleted`, `ManagerPinApproved`, notificaciones/reportes en cola.
  - No partir caja/ventas/login en servicios separados.
  - Exigir: idempotencia, reintentos con backoff, DLQ/observabilidad antes de fan-out amplio.
- **Por qué no APLICAR ya:** Issues abiertos #4–#7 (crash `/my-completed-jobs`, permisos coordinador, GPS entregador, sucursal) y P0 seguridad del handoff tienen prioridad. EDA prematura aumenta complejidad de debug.
- **Acción Antigravity ahora:** ninguna. No abrir PR de “migración event-driven”.
- **Relacionado handoff:** P1.1 (approvals/WS), P2 (perf/caché lecturas), fuera de alcance §6 “reescritura total”.

---

## Plantilla para Case (copiar al agregar)

```
### R-XXX — <título corto>
- **Fecha evaluación:** YYYY-MM-DD
- **Fuente:** <url>
- **Idea (resumen):** …
- **Veredicto:** APLICAR | APARCAR | OBVIAR
- **Impacto en McLarens ERP:** …
- **Si APLICAR:** tareas concretas + tests + PR sugerido
- **Si APARCAR:** cuándo retomar / dependencias
- **Si OBVIAR:** por qué (1–3 líneas)
- **Acción Antigravity ahora:** …
- **Relacionado handoff / issues:** …
```
