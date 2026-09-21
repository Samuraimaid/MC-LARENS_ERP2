# Liquid Glass Fase 1 (2026-09-19)

**Aproximación CSS** al estilo Apple Liquid Glass (no motor nativo Metal/SwiftUI).

## Activación
- Toggle **Liquid Glass** en Ajustes → Apariencia (`data-testid="settings-liquid-glass"`).
- Persistencia: `localStorage.liquid_glass` + atributo `html[data-liquid-glass="true|false"]`.
- Default: **activado**.

## Alcance Fase 1
- Cards (`.card-dark-contrast`)
- Dialogs (`.erp-liquid-panel`)
- Header / Sidebar / main shell
- **Login**: PIN pad, paneles flotantes, FAB + manchón de color del skin
- Manchón de color (`--primary` / `--accent`) detrás del contenido

## Fuera de alcance (Fase 2+)
- Filas de tablas individuales, SaleForm CRITICAL, KDS denso
- Refracción/lente dinámica real de Apple

## Apagar en caja/POS
Desactivar el toggle en Apariencia (o `localStorage.liquid_glass=false`).

## Accesibilidad
`prefers-reduced-transparency: reduce` desactiva blur y usa fondos casi opacos.

## Hotfix 2026-09-19 (mismo deploy)
- **LoginPage** restaurado: el commit de Fase 1 había corrompido el archivo (import duplicado). Rebuild limpio + hooks liquid glass.
- Boot temprano en `frontend/index.html` para `data-liquid-glass` / skin / modo (menos FOUC).
- ThemeContext: `useLayoutEffect` para atributos DOM.
- Catálogo: pegar SKU aplica el texto de inmediato; autocomplete no queda “abierto” al limpiar.
- Wash de login como capa `erp-login-color-wash` sobre el video (z-index 1), sin `::before` conflictivo.

## Mejora contraste + opacidad (2026-09-20)
- **Texto (modo claro)**: en superficies glass (cards, sidebar, header, dialogs) el texto primario/body se fuerza hacia near-black (`#0a0a0a` / `neutral-950`); muted también más oscuro. El tema oscuro no se fuerza a negro.
- **Slider Transparencia del vidrio** en Ajustes → Apariencia (junto al toggle Liquid Glass): rango **25%–70%** alpha (`0.25–0.70`).
- Default: **40%** (`0.40`) — un poco más transparente que el fill Fase 1 (~48%).
- Persistencia: `localStorage.mclarens-liquid-glass-opacity` + CSS var `--liquid-glass-alpha` en `html`.
- Cards / sidebar / header / dialogs / login panels usan `hsl(... / var(--liquid-glass-alpha))`.
