# Antigravity — Quick View: galería pegada / scroll / vacía · 2026-09-19

Repo: `Samuraimaid/MC-LARENS_ERP2`  
ERP live: `https://mclarens-erp-836176703716.us-central1.run.app` (build `20260919-1646` / v0.2.1)  
Windows: **no usar `py`**.

## Síntomas (Xinon, capturas adjuntas)

Al abrir **Ver detalles / Quick View** en catálogo:

1. Contenedor de imagen **muy grande**, casi vacío.
2. Cuando sí hay foto (ej. `A-CTK-52633` Ambientador Líquido LITTLE TREES), la imagen queda **abajo a la derecha**, recortada, con **scrollbar** vertical dentro del stage.
3. Flecha de carrusel visible aunque el stage se vea vacío o roto.
4. Caso pinitos (`No-especificado`): antes “Sin imagen disponible” — **Case ya restauró la URL live** (`.png`→`.jpg`). El bug de layout **sigue** independiente de eso.

Capturas de referencia en este PR / carpeta `docs/qv_layout_bug_20260919/` (o adjuntas al agente).

## Archivo principal

`frontend/src/components/erp/ProductQuickViewDialog.jsx`  
(revisar también lightbox fullscreen en el mismo archivo y cualquier `ProductThumb` / carrusel relacionado).

## Hipótesis (no vinculante — verificar)

El stage usa `aspect-[4/3]` + `flex` + `img` con `max-h-full max-w-full w-auto h-auto`. Si la cadena de altura % se rompe (p.ej. dentro de `ScrollArea`), `max-h-full` no limita y la foto nativa desborda; el usuario ve scroll y la imagen “abajo a la derecha”.

## Fix requerido (UX)

1. **Stage principal**
   - Contenedor fijo `relative aspect-[4/3] w-full overflow-hidden`.
   - Capa interna `absolute inset-0 flex items-center justify-center p-3` (o equivalente robusto).
   - `<img>` centrada con `max-h-full max-w-full object-contain object-center` **o** `h-full w-full object-contain`.
   - **Sin scrollbar** en el stage (ni en el viewport interno del stage).
   - Nada de imagen pegada a una esquina.

2. **Controles**
   - Flechas prev/next solo si hay **≥2 imágenes válidas** (no fallidas).
   - Placeholder “Sin imagen disponible” centrado cuando no hay URL usable.

3. **Lightbox fullscreen**
   - Fondo **blanco** (ya pedido en prompt promo Bloque C) para productos oscuros.
   - Misma regla: imagen centrada, `object-contain`, sin franja/esquina.

4. **No romper**
   - Dual USD/NIO, Universal badge, Related/FBT carousels, WhatsApp / Cotización / Venta.

## Criterio de done

- Abrir Quick View de `A-CTK-52633` y de `Pinitos, ambientadores LITTLE TREES` (`No-especificado`): foto **centrada**, llena el área sin overflow/scroll del stage.
- Recargar hard (Ctrl+Shift+R) post-deploy; confirmar `__BUILD_ID__` nuevo.
- Commit + push + PR (o master si el flujo del workshop es directo) + nota corta en `memory/chat-log.md`.
- Case no necesita más prompts para este bug si el layout queda limpio en esas 2 SKUs + 1 FOX oscuro en lightbox.

## Fuera de alcance

- Re-sync masivo de imágenes (Case ya corrigió extensiones LITTLE TREES).
- Inventory search / Ctrl+K (siguen en Bloque D del prompt promo si no cerrados).