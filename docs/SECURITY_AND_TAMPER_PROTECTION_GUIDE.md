# MC-LARENS ERP 2.0 - Guía de Seguridad, Blindaje Anti-DevTools y Menú Contextual Seguro

**Fecha de Actualización:** 7 de Septiembre de 2026  
**Módulos Afectados:**
- [`frontend/src/lib/antiDevtools.js`](file:///c:/ANTIGRAVITY/MC-LARENS_ERP2/frontend/src/lib/antiDevtools.js)
- [`frontend/src/components/security/AntiTamperGuard.jsx`](file:///c:/ANTIGRAVITY/MC-LARENS_ERP2/frontend/src/components/security/AntiTamperGuard.jsx)
- [`frontend/index.html`](file:///c:/ANTIGRAVITY/MC-LARENS_ERP2/frontend/index.html)
- [`frontend/src/index.js`](file:///c:/ANTIGRAVITY/MC-LARENS_ERP2/frontend/src/index.js)
- [`backend/server.py`](file:///c:/ANTIGRAVITY/MC-LARENS_ERP2/backend/server.py)
- [`deploy.sh`](file:///c:/ANTIGRAVITY/MC-LARENS_ERP2/deploy.sh)

---

## 1. Contexto y Objetivos de Seguridad

En terminales de mostrador, cajas de cobro y puntos de venta de las sucursales, existía el riesgo potencial de que operadores abrieran herramientas de inspección del navegador (DevTools / F12 / Clic Derecho) para:
1. Modificar variables de sesión, roles o precios en tiempo de ejecución.
2. Inspeccionar peticiones de red y respuestas del backend.
3. Extraer estructura interna o código fuente de la aplicación.

### Políticas de Seguridad MC-LARENS:
- **Tolerancia Cero a la Manipulación:** El intento deliberado de abrir herramientas de desarrollo por parte de roles no autorizados constituye una infracción operativa grave.
- **Auditoría Inmutable:** Todo intento de apertura de DevTools registra IP, usuario activo, sucursal, fecha/hora y métricas de pantalla en la base de datos HyperVisor.
- **Continuidad de Productividad:** Los operadores no deben perder atajos útiles del ratón (Copiar, Pegar, Cortar, Calculadora, Recargar, Pantalla Completa, Capturas).

---

## 2. Fallos Diagnosticados y Soluciones Aplicadas

### Fallo A: Acceso a Herramientas de Desarrollo (DevTools / F12)
* **Causa Raíz:** Los navegadores Chromium habilitan por defecto `F12`, `Ctrl+Shift+I`, `Ctrl+Shift+J`, `Ctrl+Shift+C`, `Ctrl+U` y el menú contextual nativo. Si la aplicación no los intercepta desde la primera capa antes de la carga de React, existía una ventana de vulnerabilidad.
* **Solución Aplicada:**
  1. **Bloqueo Temprano Inline en [`frontend/index.html`](file:///c:/ANTIGRAVITY/MC-LARENS_ERP2/frontend/index.html):** Se inyectaron listeners con captura `useCapture: true` antes de cualquier script.
  2. **Módulo Central [`frontend/src/lib/antiDevtools.js`](file:///c:/ANTIGRAVITY/MC-LARENS_ERP2/frontend/src/lib/antiDevtools.js):**
     - Detección activa mediante trampa de perfilado de tiempos (`Timing Profiling Trap`).
     - Detección por redimensionamiento de viewport (`window.outerWidth - window.innerWidth`).
     - Sanitización total de `console.log`, `console.info`, `console.debug`, `console.table` en producción.
     - Bloqueo visual inmediato (`#mclarens-security-lockout-overlay`) con llamada asíncrona a `/api/hypervisor/tamper-alert`.

---

### Fallo B: Falla Silenciosa en la "Captura de Pantalla" del Menú Contextual
* **Causa Raíz:**
  1. **Lienzo Contaminado (Tainted Canvas):** La implementación previa usaba `allowTaint: true` con `html2canvas` sobre `document.body`. Al renderizar imágenes o fuentes sin cabeceras CORS explícitas, la API del navegador marca el canvas como no seguro y arroja una excepción `SecurityError: Tainted canvases may not be exported` al invocar `canvas.toDataURL()`.
  2. **Dependencia Externa Frágil (Single CDN):** Se cargaba dinámicamente desde un único enlace CDN (`cdnjs.cloudflare.com`). Bloqueadores de publicidad o fallos de red impedían su descarga.
  3. **Superposición de Modal:** El modal de carga se abría antes de finalizar el renderizado, capturando el overlay semitransparente oscuro en lugar de la pantalla limpia.
* **Solución Aplicada en [`AntiTamperGuard.jsx`](file:///c:/ANTIGRAVITY/MC-LARENS_ERP2/frontend/src/components/security/AntiTamperGuard.jsx):**
  1. **Configuración de Canvas Limpia:** `allowTaint: false` y `useCORS: true` con exclusión de overlays mediante selectores `data-screenshot-ignore="true"`.
  2. **Carga en Cascada Multi-CDN:** JSDelivr ➔ Cloudflare ➔ UNPKG ➔ Fallback Nativo a `MediaDevices / DisplayMedia`.
  3. **Empaquetado Nativo:** Se agregó `"html2canvas": "^1.4.1"` a `frontend/package.json` para empaquetado en el bundle de producción por Vite.
  4. **Experiencia de Usuario Mejorada:** Modal de previsualización con botones para **Copiar Imagen** al portapapeles, **Descargar PNG** en alta resolución y **Compartir en WhatsApp**.

---

### Fallo C: Desconexión de Herramientas Rápidas (Calculadora / Buscador)
* **Causa Raíz:** Las opciones "Calculadora / USD" y "Buscar Producto / Stock" del menú contextual emitían eventos que no estaban conectados globalmente en todas las páginas (especialmente fuera del Layout principal o en el Login).
* **Solución Aplicada:**
  1. **Calculadora Flotante Integrada:** Se incorporó un widget directo en `AntiTamperGuard.jsx` con conversor de divisas USD ➔ NIO en tiempo real, soporte decimal, actualización automática de tasa y cálculo de cambio.
  2. **Navegación al Buscador:** La opción "Buscar Producto / Stock" (`Ctrl+K`) redirige de inmediato a `/workbench?tab=search` para usuarios autenticados.

---

### Fallo D: Compartir en WhatsApp sin Imagen Adjunta y Falta de Discreción Comercial
* **Causa Raíz:**
  1. **Limitación de Protocolo Web:** El esquema estándar `api.whatsapp.com/send?text=...` de Meta únicamente acepta cadenas de texto URL y no permite adjuntar archivos binarios (imágenes) por restricciones de seguridad del navegador.
  2. **Riesgo de Fuga de Márgenes Comerciales:** Al compartir capturas de pantalla con clientes o terceros, existía el riesgo de exponer información confidencial como **Precios 2, Precios VIP, Precios Casa Comercial, Costos y existencias exactas en bodegas**.
* **Solución Aplicada:**
  1. **Modo Discreción Comercial Inteligente:**
     - Previo al renderizado del canvas, el sistema aplica un filtro de desenfoque (`blur(7px)`) sobre todos los niveles de precio mayoristas/VIP/Casa comercial y cantidades desglosadas por bodega.
     - **Solo el Precio 1 (Precio Público / Lista)** y la información relevante del producto permanecen 100% nítidos.
     - Incluye selector/badge en el modal para alternar la discreción según la necesidad operativa.
  2. **Generador de Mensajes Contextuales Inteligentes:**
     - Detecta la pantalla activa (Catálogo, Búsqueda, Ventas, Cotizaciones, Caja, Taller, Configuración) y genera automáticamente un saludo y descripción comercial profesional.
     - El mensaje es **100% editable** por el vendedor antes de enviar.
  3. **Flujo de Compartición Híbrido (Web Share API + Auto-Clipboard):**
     - En dispositivos móviles o compatibles, adjunta el archivo de imagen directamente mediante `navigator.share({ files: [file] })`.
     - En WhatsApp Web de escritorio, copia automáticamente la imagen al portapapeles y muestra una guía visual para que el operador presione `Ctrl + V` en el chat, enviando la imagen y el texto en segundos.

---

## 3. Matriz de Menú Contextual Seguro

| Opción | Atajo | Alcance / Acción |
| :--- | :---: | :--- |
| **Copiar** | `Ctrl + C` | Copia el texto o celda seleccionada al portapapeles. |
| **Cortar** | `Ctrl + X` | Disponible en campos editables de texto. |
| **Pegar** | `Ctrl + V` | Pega contenido en campos de texto activos. |
| **Recargar Fuerte** | `Ctrl + F5` | Purga caché del navegador y recarga la versión activa del sistema. |
| **Captura y Compartir** | — | Genera captura de alta resolución con previsualización, copia, descarga y WhatsApp. |
| **Pantalla Completa** | `F11` | Alterna modo Kiosko para pantallas táctiles de mostrador. |
| **Buscar Producto / Stock** | `Ctrl + K` | Acceso directo al catálogo global y existencias. |
| **Calculadora / USD** | — | Despliega widget flotante de cálculo y conversión cambiaria. |
| **Modo Oscuro / Claro** | — | Alterna el tema visual general en tiempo real. |
| **Cerrar Sesión** | — | Cierre de sesión inmediato y seguro. |

---

## 4. Instrucciones de Redespliegue en Servidor

Para aplicar todas las modificaciones de backend, frontend, seguridad y empaquetado en Google Cloud Run:

```bash
cd ~/MC-LARENS_ERP2 && git pull origin master && ./deploy.sh
```

El script `./deploy.sh`:
1. Construye la imagen Docker con las dependencias actualizadas (`html2canvas`, Vite, FastAPI).
2. Asigna 2 vCPUs y 2 GiB de memoria con autoescalado dinámico hasta 20 instancias.
3. Despliega la versión en Cloud Run sin tiempo de inactividad.
