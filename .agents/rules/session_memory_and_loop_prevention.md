# Regla: Memoria Persistente de Sesión y Prevención de Bucles Infinitos

## 1. Memoria Local Persistente (`memory/chat-log.md`)
- Ante cada hito importante, decisión arquitectónica, resolución de errores o antes de tareas complejas, el asistente **debe registrar un resumen conciso en `memory/chat-log.md`**.
- Esto garantiza que si la ventana de contexto del chat se llena, se reinicia o se pierde la conversación, todo el conocimiento previo quede respaldado directamente en el repositorio local.

## 2. Prevención de Bucles Infinitos
- **Límite de Reintentos:** Si una acción o comando falla 2 veces consecutivas con el mismo error, **NO** reintentar automáticamente en bucle. Detenerse, analizar la causa raíz o solicitar clarificación/feedback.
- **Verificación de Salida:** Siempre validar el código de retorno y los mensajes de error antes de proceder con el siguiente paso.
- **Sin Polling Ciego:** Nunca ejecutar comandos en bucle infinito (`while true`) o polling sin límite de tiempo o condición de parada clara.
