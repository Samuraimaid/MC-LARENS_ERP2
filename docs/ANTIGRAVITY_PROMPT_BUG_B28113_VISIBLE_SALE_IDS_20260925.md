# Antigravity — Lote BUG B-28113 (Workbench / Ventas) · 2026-09-25

**Repo:** `Samuraimaid/MC-LARENS_ERP2` · **Branch base:** `master` (≥ `8426759e`)  
**Live:** `https://mclarens-erp-836176703716.us-central1.run.app`  
**Ticket:** `B-28113-25/SEP/2026 16:10:13`  
**URL crash:** `/workbench` (SalesPage lazy dentro de Workbench)  
**Telemetría:** `docs/crash_reports/B-28113-25_SEP_2026_16-10-13.json`  
**GET live:** `/api/telemetry/crash-report/B-28113-25%2FSEP%2F2026%2016%3A10%3A13`

**Modo:** un solo PR pequeño de fix → `npm run build` verde → merge → Xinon/Case deploy Cloud Run.  
**NO** rehacer el stack UX U1–U15 ni tocar `.gcloudignore` `uploads/` otra vez (ya corregido en #97–#99).

---

## Diagnóstico (ya hecho por Case)

| Campo | Valor |
|-------|--------|
| Error | `ReferenceError: visibleSaleIds is not defined` |
| Categoría ErrorBoundary | Identificador o Componente no Definido |
| Chunk | `SalesPage-*.js` (componente minificado `Lo`) |
| Causa raíz | En `frontend/src/pages/SalesPage.jsx`, el bloque U3/list-selection (`visibleSaleIds`, `selectedSales`, `exportSelectedSalesCsv`, `copySelectedSaleIds`) fue **insertado por error dentro** del callback de `filteredSales = sales.filter(sale => { ... })`, **antes** de `matchesSearch` / `return`. Quedó en scope del filter, no del componente → el JSX del `return` no ve `visibleSaleIds`. |
| Origen probable | Merge stack list multi-select / UX U3 (#81 / #84) sobre `SalesPage.jsx` monolítico |

---

## Antes → Después (obligatorio)

### ANTES (roto — ~líneas 2382–2412 actuales)

```jsx
  const filteredSales = (Array.isArray(sales) ? sales : []).filter(sale => {
    if (!sale) return false;

  const visibleSaleIds = (Array.isArray(filteredSales) ? filteredSales : []).map((s) => s.sale_id).filter(Boolean);
  const selectedSales = (Array.isArray(filteredSales) ? filteredSales : []).filter((s) => selection.isSelected(s.sale_id));
  const exportSelectedSalesCsv = () => { /* ... */ };
  const copySelectedSaleIds = async () => { /* ... */ };

    const matchesSearch = (sale.invoice_number || "")?.toLowerCase().includes(search.toLowerCase()) ||
                         (sale.customer_name || "")?.toLowerCase().includes(search.toLowerCase());
    const matchesPayment = filterPayment === "all" || sale.payment_type === filterPayment;
    const matchesStatus = filterStatus === "all" || sale.status === filterStatus;
    const matchesSeller = filterSeller === "all" || sale.seller_id === filterSeller || sale.created_by === filterSeller;
    const matchesBranch = filterBranch === "all" || sale.branch_id === filterBranch;
    return matchesSearch && matchesPayment && matchesStatus && matchesSeller && matchesBranch;
  });
```

Problemas extra del ANTES:
1. `visibleSaleIds` / helpers **dentro** del `.filter` (scope incorrecto).
2. Referencia a `filteredSales` **mientras se define** (TDZ / nonsense).
3. El cuerpo del filter quedó contaminado; el `return` del JSX (~2901) usa `visibleSaleIds` → crash al abrir Workbench/Ventas.

### DESPUÉS (correcto)

```jsx
  const filteredSales = (Array.isArray(sales) ? sales : []).filter((sale) => {
    if (!sale) return false;
    const matchesSearch =
      (sale.invoice_number || "")?.toLowerCase().includes(search.toLowerCase()) ||
      (sale.customer_name || "")?.toLowerCase().includes(search.toLowerCase());
    const matchesPayment = filterPayment === "all" || sale.payment_type === filterPayment;
    const matchesStatus = filterStatus === "all" || sale.status === filterStatus;
    const matchesSeller =
      filterSeller === "all" || sale.seller_id === filterSeller || sale.created_by === filterSeller;
    const matchesBranch = filterBranch === "all" || sale.branch_id === filterBranch;
    return matchesSearch && matchesPayment && matchesStatus && matchesSeller && matchesBranch;
  });

  const visibleSaleIds = (Array.isArray(filteredSales) ? filteredSales : [])
    .map((s) => s.sale_id)
    .filter(Boolean);
  const selectedSales = (Array.isArray(filteredSales) ? filteredSales : []).filter((s) =>
    selection.isSelected(s.sale_id)
  );
  const exportSelectedSalesCsv = () => {
    const rowsSrc = selectedSales.length
      ? selectedSales
      : Array.isArray(filteredSales)
        ? filteredSales
        : [];
    if (!rowsSrc.length) {
      toast.error("No hay ventas");
      return;
    }
    downloadCsv(
      `ventas_${new Date().toISOString().slice(0, 10)}.csv`,
      ["sale_id", "factura", "cliente", "total", "estado", "fecha"],
      rowsSrc.map((s) => [
        s.sale_id,
        s.invoice_number,
        s.customer_name,
        s.total,
        s.status,
        s.created_at || s.date,
      ])
    );
    toast.success(`CSV exportado (${rowsSrc.length})`);
  };
  const copySelectedSaleIds = async () => {
    if (!selectedSales.length) {
      toast.error("Selecciona ventas");
      return;
    }
    try {
      await copyTextToClipboard(selectedSales.map((s) => s.sale_id).join(", "));
      toast.success("IDs copiados");
    } catch {
      toast.error("No se pudo copiar");
    }
  };
```

**Archivo único a tocar (preferido):** `frontend/src/pages/SalesPage.jsx`  
No inventar endpoints. No tocar SaleForm submission / caja / auth.

Commit sugerido: `fix(sales): move visibleSaleIds out of filteredSales filter (B-28113)`

---

## Checklist smoke (obligatorio)

1. `cd frontend && npm run build` — **verde**
2. Abrir `/workbench` logueado → **no** aparece modal "Incidencia Técnica Registrada"
3. Pestaña/lista Ventas: barra de selección + buscar + select-all visible funciona
4. CSV / Copiar IDs con 0 y ≥1 seleccionados (toasts OK)
5. Crear/abrir venta existente no regresa el crash
6. (Opcional) GET telemetría del ticket sigue archivado; nuevo crash no debe aparecer al recargar workbench

---

## Bloque pegable (copiar entero a Antigravity)

```
LOTE: BUG B-28113 Workbench/Ventas — visibleSaleIds scope
REPO: Samuraimaid/MC-LARENS_ERP2 @ master
TICKET: B-28113-25/SEP/2026 16:10:13
CRASH: ReferenceError visibleSaleIds is not defined en SalesPage dentro de /workbench
CAUSA: en frontend/src/pages/SalesPage.jsx, visibleSaleIds/selectedSales/exportSelectedSalesCsv/copySelectedSaleIds quedaron DENTRO del callback de filteredSales = sales.filter(...). Sácalos FUERA, justo DESPUÉS de cerrar el filter. El filter solo debe hacer matchesSearch/Payment/Status/Seller/Branch y return.
ANTES/DESPUÉS: ver docs/ANTIGRAVITY_PROMPT_BUG_B28113_VISIBLE_SALE_IDS_20260925.md
TELEMETRÍA: docs/crash_reports/B-28113-25_SEP_2026_16-10-13.json
NO TOCAR: SaleForm payload, caja, auth, .gcloudignore uploads (ya fijo #99)
PR: un solo fix PR → npm run build verde
SMOKE: /workbench sin ErrorBoundary; selección ventas + CSV/IDs OK
```

---

## Contexto stack ya en master (NO reimplementar)

Ver `docs/CASE_CHAT_HISTORY_UX_STACK_20260925.md`.

Resumen: PRs **#77–#96** + fixes deploy **#97–#99** mergeados. Live build al momento del crash: `0.2.0-20260925_220058` (rev `mclarens-erp-00182-psh`). Deploy Case path: `gcloud builds submit --tag …` + `gcloud run deploy --update-env-vars` (nunca cleanup destructivo de `deploy.sh` en la box).
