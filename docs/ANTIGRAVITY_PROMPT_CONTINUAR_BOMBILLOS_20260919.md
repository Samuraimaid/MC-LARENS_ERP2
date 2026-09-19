# PROMPT PEGABLE — Continuar bombillos / buscador (Case handoff 2026-09-19)

Copia TODO este bloque a Antigravity o Grok.

---

LEE ESTO PRIMERO

Repo: Samuraimaid/MC-LARENS_ERP2 · branch master · NO force-push · Windows: `python` no `py`.

Contexto: Xinon (McLarens ERP). Case dejó PR #37 (vehicleCatalog bombillos + FBT DLAA→DS18). Deploy: `cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh`. Live PIN login 01011990.

Terminología: **bombillo** (incandescente vs LED). FBT solo halógeno DLAA → LED. Alias H11↔H8/H9/H16. Sin xenón.

### Ejemplo before → after (buscador)

**Before:** Cliente con Hilux seleccionado; vendedor busca “bombillo LED”; lista sin orden ni color; pregunta “¿qué tipo lleva?”.

**After:** Kits compatibles con los `bombillos` del modelo Hilux en vehicleCatalog aparecen **primero** con chip/borde **verde** “Compatible”; otros bombillos LED **gris** atenuados (sigue pudiendo venderlos); productos no-bombillo sin ese tratamiento. Si el vehículo no tiene ficha bombillos: aviso suave, no grisar todo.

### P0 (hacer ahora)

1. Localizar SaleForm / búsqueda de productos / selección de vehículo del cliente.
2. Helper: leer `bombillos` del entry en `frontend/src/data/vehicleCatalog.json` (todas las posiciones); expandir aliases (`productRecommendations.js`).
3. Detectar productos bombillo (DS18 VIXH/VTLH, campo bombillo, o query tipo bombillo/LED kit).
4. Sort + UI verde/gris como arriba.
5. PR pequeño + smoke: Hilux + search LED; vehículo sin bombillos; sin vehículo seleccionado.

### P1 (después)

- Enrich ~59 DLAA elegibles sin bombillo (no inventar).
- Más posiciones en vehicleCatalog (no inventar).
- Import Auxbeam LED piloto (CSV en docs/handoff si Case lo subió; si no, scrape auxbeam.com by bulb size, excluir D1–D4).

### Fuera de alcance

- Force-push, wipe productos, Lordicon de pago, xenón, reescritura SaleForm completa, P0 seguridad TARS 2026-09-11.

### Smoke

- [ ] Deploy master actual
- [ ] MB433 QV → LED DS18 en Se venden juntos (0/N)
- [ ] Buscador con vehículo: verde/gris
- [ ] Hard refresh móvil QV OK

### Deploy

```bash
cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh
```

---
