# Iconos animados ERP — Lucide Animated (2026-09-19)

**Pedido:** reel Facebook (IconSax / Lordicon / Lucide Animated / Potlab…).  
**Elección:** **Lucide Animated** — gratis (MIT), compatible con `lucide-react`.

## Mecánica
- Plugin Vite `frontend/plugins/lucideAnimatedBridge.js` reescribe cada
  `import { Icon } from "lucide-react"` a `lucide-react-raw` + `lucide-animated`
  (solo los iconos de ese archivo) + wrapper hover.
- Mapa: `frontend/plugins/lucideAnimatedMap.cjs` (~410 iconos animados).
- Sin versión animada → Lucide estático (ej. `ShoppingCart`, `Package`).
- `prefers-reduced-motion: reduce` → siempre estático.
- Deps: `lucide-animated`, `motion`.

## UX
Animación **al hover** (no loop continuo) — pensado para caja/POS.

## Revertir
Quitar el plugin de `vite.config.js` y las deps nuevas.
