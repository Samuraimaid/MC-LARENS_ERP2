# Antigravity — Inbox de reels / ideas (evaluación Case)

**Repo:** Samuraimaid/MC-LARENS_ERP2  
**Quién evalúa:** Case (Grok Bot) — Xinon comparte reels; Case clasifica impacto antes de que Antigravity implemente.  
**Actualizado:** 2026-09-12 (R-006)

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


### R-006 — UX de data tables (“A table is six decisions”)
- **Fecha evaluación:** 2026-09-12
- **Fuente:** Facebook Reel — Design Motion (@designmotionhq)  
  https://www.facebook.com/share/r/1C6RVzTzJd/  
  (reel `1268917731967815`)
- **Idea (resumen):** Una tabla de datos es un sistema; seis decisiones de UX: **Align**, **Density**, **Cells**, **Rows**, **Sticky**, **Actions** (más búsqueda/filtros/paginación en el ejemplo).
- **Veredicto:** **APARCAR**
- **Impacto en McLarens ERP:** Medio a futuro. El ERP está lleno de grillas (inventario, usuarios, ventas, reportes, vehículos, créditos…). Mejorar alineación numérica, densidad, badges de estado, sticky header y menú de acciones por fila mejoraría operación en tienda — pero **no** arregla P0/#4–#7 ni latencias de API.
- **Si se retoma (post P1, FE polish / FRONTEND_MODERNIZATION):**
  - Inventario, Users, Sales/Quotations lists, Cashier queues: sticky header, align montos a la derecha, densidad compacta para POS, acciones claras (no esconder en hover-only en touch).
  - Un PR de diseño de tabla compartida > retocar pantalla por pantalla sin sistema.
- **Acción Antigravity ahora:** ninguna. No abrir PR de rediseño de tablas.
- **Relacionado:** handoff §6 “Rebrand / rediseño UX” fuera de alcance inmediato; R-003 (no reescritura grande).


### R-005 — 10 algoritmos de load balancing
- **Fecha evaluación:** 2026-09-11
- **Fuente:** Facebook Reel — VikStack  
  https://www.facebook.com/share/r/1DG3NrnVja/  
  (reel `1752114135821720`)
- **Idea (resumen):** Catálogo visual de algoritmos de balanceo: round robin, weighted, least connections, least response, IP hash, consistent hashing, random, sticky sessions, least bandwidth, failover.
- **Veredicto:** **OBVIAR**
- **Impacto en McLarens ERP:** Nulo como trabajo de repo. El tráfico ya lo reparte **Cloud Run / balanceador de Google**; no se implementan estos algoritmos en FastAPI. Sticky sessions solo importarían si la sesión viviera solo en memoria de una instancia (ustedes usan cookie + backend/Mongo).
- **Acción Antigravity ahora:** ninguna. No abrir PR de load balancer.
- **Relacionado:** R-003 (un solo servicio Cloud Run); escala horizontal la gestiona la plataforma.


### R-004 — Database failover (HA primario → backup)
- **Fecha evaluación:** 2026-09-11
- **Fuente:** Facebook Reel — Afzal Web Solutions  
  https://www.facebook.com/share/r/1GwvQDFsoE/  
  (reel `1380542970859531`)
- **Idea (resumen):** Database failover = cambiar automáticamente a una DB de respaldo cuando cae la primaria, en un setup de alta disponibilidad.
- **Veredicto:** **OBVIAR** (para código/Antigravity)
- **Impacto en McLarens ERP:** Bajo como tarea nueva. El ERP ya usa **MongoDB Atlas** (`mongodb+srv://…?retryWrites=true&w=majority`) según `deploy/GUIA_DESPLIEGUE_GOOGLE_CLOUD.md`, más backups diarios a Google Drive. Atlas con replica set ya hace failover automático del primario; no hace falta reimplementar failover en FastAPI.
- **Si algún día duele (ops, no feature):**
  - Verificar tier/cluster Atlas (réplicas, región GCP alineada a Cloud Run).
  - Ensayo controlado de failover / alertas Atlas.
  - No escribir lógica casera “si primary down, conectar a secondary” en `server.py`.
- **Acción Antigravity ahora:** ninguna. No abrir PR de failover.
- **Relacionado:** guía deploy Atlas + backups Drive; P0 seguridad del handoff tiene prioridad.


### R-003 — Monolito vs microservicios (Amazon “back to monolith”)
- **Fecha evaluación:** 2026-09-11
- **Fuente:** Facebook Reel — Coding Chops  
  https://www.facebook.com/share/r/19dxtNisUA/  
  (reel `1721221349207912`)
- **Idea (resumen):** Amazon habría vuelto a un monolito y bajado costos ~90%. Mensaje: **los microservicios no siempre son la respuesta**.
- **Veredicto:** **APLICAR (solo guardrail / sin PR de feature)**
- **Impacto en McLarens ERP:** Alto como *criterio de arquitectura*, nulo como tarea de código nueva. Refuerza R-001 (EDA/microservicios aparcado), el handoff §6 (“no reescritura total del monolito”) y `SAFE_FIRST_REFACTORS.md` / `MONOLITH_DECOMPOSITION_PLAN.md` (helpers y módulos *dentro* del mismo deploy).
- **Matiz factual:** el caso famoso suele ser **Prime Video** (monitoreo AV) consolidando servicios, no “todo Amazon”. La lección para un ERP Cloud Run de una PyME sí aplica: ops y costo de red/latencia entre N servicios suelen ser peores que un monolito modular bien acotado.
- **Acción Antigravity ahora:**
  1. **No** proponer ni abrir PRs de “partir en microservicios”.
  2. Seguir P0–P3 del handoff: seguridad, contratos, perf de lecturas, extracción de helpers **en el mismo artefacto Cloud Run**.
  3. Si alguien pide split: citar este R-003 + handoff §6 y escalar a Xinon/Case.
- **Por qué no OBVIAR:** sí aporta utilidad — alinea decisiones y evita trabajo caro. No es un feature; es política.
- **Relacionado:** R-001 APARCAR; handoff §6; P3 descomposición incremental interna.


### R-002 — Cron jobs / crontab (tareas programadas)
- **Fecha evaluación:** 2026-09-11
- **Fuente:** Facebook Reel — Afzal Web Solutions  
  https://www.facebook.com/share/r/1C8MvafK84/  
  (reel `28104495745874142`)
- **Idea (resumen):** Explica qué es un cron job y la sintaxis de 5 campos del crontab (minuto, hora, día…) para correr código en el servidor sin que alguien esté presente.
- **Veredicto:** **OBVIAR** (confirmado por Xinon 2026-09-11: no aplica). Tutorial de crontab; no aporta diseño útil para Cloud Run.
- **Impacto en McLarens ERP:** Bajo-medio. El ERP **ya** tiene programación interna: `backend/services/weekly_business_sentinel.py` (APScheduler + resumen ejecutivo Telegram) y la guía de deploy menciona `crontab -e` para sync nocturno. En **Cloud Run** el contenedor es efímero (scale-to-zero / multi-instancia): un crontab clásico o un APScheduler solo en proceso es frágil (jobs duplicados o que no corren).
- **Si se retoma (post P1 / higiene deploy):**
  - Preferir **Cloud Scheduler → HTTP autenticado** (OIDC / `SCHEDULER_TOKEN`) a endpoints internos, no `crontab` dentro del Dockerfile.
  - Auditar que `weekly_business_sentinel` no dependa de `localhost:8001` frágil en producción.
  - Candidatos de schedule: resumen semanal, limpieza de drafts/sesiones, reconciliación inventario, alertas de locks PIN — uno por uno.
- **Por qué no APLICAR ya:** El reel es tutorial básico; no aporta diseño nuevo. Meter crontab en la imagen Cloud Run empeoraría ops. Prioridad sigue en P0 seguridad + issues #4–#7.
- **Acción Antigravity ahora:** ninguna. **OBVIAR** — no abrir PR ni ticket.
- **Relacionado handoff / código:** P4 higiene deploy; `weekly_business_sentinel.py`; `deploy/GUIA_DESPLIEGUE_GOOGLE_CLOUD.md` (sección crontab).

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
