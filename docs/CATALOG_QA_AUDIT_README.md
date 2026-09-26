# Catalog QA Audit Tool (`scripts/catalog_qa_audit.py`)

Herramienta de auditoría de solo lectura para el catálogo de productos de **McLarens ERP**.  
Analiza productos y genera un reporte CSV categorizando problemas de higiene de datos: imágenes faltantes, texto OCR corrupto, nombres excesivamente cortos y nombres sin referencia de marca o SKU.

---

## 1. Endpoints de Referencia

### Frontend (`CatalogPage.jsx`)
- **Ubicación:** `frontend/src/pages/CatalogPage.jsx` (línea ~366)
- **Llamada:**
  ```javascript
  axios.get(`${API}/products?limit=10000`, { withCredentials: true })
  ```
- **Base URL:** `${API}` corresponde a `window.__ENV__?.VITE_API_BASE_URL || "/api"`.

### Backend (`server.py`)
- **Ubicación:** `backend/server.py` (línea ~7038)
- **Ruta:** `@api_router.get("/products")` (`/api/products`)
- **Autenticación requerida:** `await require_auth(request)`
  - Acepta cookie: `session_token=<TOKEN>`
  - O header HTTP: `Authorization: Bearer <TOKEN>`

---

## 2. Formato de Salida (CSV)

Columnas generadas:
```csv
sku,name,brand,has_image,name_len,flags
```

### Flags Detectados:
| Flag | Condición |
|---|---|
| `no_image` | Sin imagen, `image_url` nula/vacía, o placeholder de Unsplash (`images.unsplash.com`). |
| `name_ocr_garbage` | Nombre excesivamente largo (>95 car., >16 palabras), bucles repetitivos de OCR (ej. `A CON A RE`, `CON A CON`, repeticiones triples), metadatos de importación (`detalles rápidos`, `lugar de origen`, `guangdong china`, `raw=`), proporción anormal de caracteres sueltos o símbolos de ruido de escaneo (`~`, `^`, `\|`). |
| `name_too_short` | Nombre con longitud menor a 4 caracteres o en blanco. |
| `name_unrelated_tokens` | El nombre no contiene ni la marca (`brand`) ni el SKU (`sku`) del producto. |

*Si un producto tiene múltiples observaciones, se combinan con `|` (ej. `no_image|name_ocr_garbage|name_unrelated_tokens`).*

---

## 3. Modos de Uso

### A. Ejecución estándar contra Cloud Run o Local
El script intenta la conexión de forma directa. Si el listado estuviese expuesto públicamente o tras un proxy transparente, corre sin autenticación:
```bash
python scripts/catalog_qa_audit.py --base https://mclarens-erp-836176703716.us-central1.run.app
```

### B. Con autenticación (Cookie o Bearer Token)
Dado que `require_auth` requiere sesión activa, se puede proporcionar el token de sesión (obtenido tras el login en el navegador, **sin hardcodear PINs**):

**Opción con Bearer Token:**
```bash
python scripts/catalog_qa_audit.py \
  --base https://mclarens-erp-836176703716.us-central1.run.app \
  --token "<TU_SESSION_TOKEN>" \
  --out catalog_qa_audit.csv
```

**Opción con Cookie:**
```bash
python scripts/catalog_qa_audit.py \
  --base https://mclarens-erp-836176703716.us-central1.run.app \
  --cookie "session_token=<TU_SESSION_TOKEN>" \
  --out catalog_qa_audit.csv
```

**O mediante variable de entorno:**
```bash
export SESSION_TOKEN="<TU_SESSION_TOKEN>"
python scripts/catalog_qa_audit.py --out catalog_qa_audit.csv
```

### C. Modo Offline (desde JSON exportado)
Para auditar sin conexión a la red o desde una respuesta guardada de DevTools:
```bash
python scripts/catalog_qa_audit.py --file productos.json --out catalog_qa_audit.csv
```

### D. Salida a consola (stdout)
```bash
python scripts/catalog_qa_audit.py --file productos.json --out -
```

### E. Test suite de heurísticas
Valida el comportamiento determinista de todas las heurísticas de detección:
```bash
python scripts/catalog_qa_audit.py --test
```
