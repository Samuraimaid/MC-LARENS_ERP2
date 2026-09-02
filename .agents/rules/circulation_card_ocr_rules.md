# Regla: Extracción y Validación de Tarjetas de Circulación (Nicaragua)

Esta regla define el comportamiento obligatorio para cualquier módulo, componente frontend o endpoint de backend relacionado con el OCR de Tarjetas de Circulación de Nicaragua en **MC-LARENS ERP 2.0**.

---

## 1. Reglas del Documento de Circulación
1. **Cara Frontal (Captura Principal y Obligatoria):**
   - Contiene únicamente: `Placa`, `Chasis/VIN`, `Número de Motor`, `Color`, `Tipo de Vehículo/Carrocería`, `Marca` y `Modelo`.
   - **PROHIBICIÓN ESTRICTA:** La fecha identificada como **"Emisión"** (`DD/MM/YYYY`) en el frente es la fecha administrativa del trámite. **NUNCA debe asignarse ni interpretarse como el año de fabricación del vehículo**.

2. **Año de Fabricación (Inferencia y Entrada Directa del Operador):**
   - **Inferencia por VIN (ISO 3779):** Si el chasis tiene 17 caracteres y el 10mo dígito corresponde a un año válido según el estándar internacional (ej. `D`=2013, `G`=2016, `N`=2022), el sistema lo asigna automáticamente con origen `inferido_vin`.
   - **REGLA DE SOLICITUD DIRECTA AL OPERADOR:** Si el Chasis **NO codifica el año** (por ejemplo, chasis de Toyota, Isuzu o Nissan con `0` en la 10ma posición, chasis cortos o no estándar):
     1. El sistema **NUNCA debe obligar, forzar ni requerir al operador** que tome una segunda captura del reverso.
     2. El sistema debe **solicitar directamente el año al operador en pantalla**, enfocando y resaltando de inmediato el campo `Año de Fabricación`.
     3. El operador puede escribir el año inmediatamente en 1 segundo y presionar **"Aplicar al Vehículo"** sin pasos adicionales.
     4. La captura de foto del reverso permanece únicamente como una opción secundaria y voluntaria.

---

## 2. Experiencia de Usuario (UI / Frontend)
- El formulario extraído debe permitir la edición inmediata de cualquier campo.
- Si el año falta, el campo de Año debe tener foco automático (`autoFocus`) o un indicador visual claro para agilizar el ingreso.
- El operador siempre tiene el control final: ningún dato se guarda en base de datos sin la confirmación explícita del usuario (`onApply`).
