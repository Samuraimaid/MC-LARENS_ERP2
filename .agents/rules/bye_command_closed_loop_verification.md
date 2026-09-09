# Regla: Protocolo de Comando BYE y Verificación en Ciclo Cerrado de Guardado

Esta regla define el protocolo estricto y obligatorio a ejecutar cuando el usuario emita el comando **`BYE`** o solicite guardar y apagar el equipo.

---

## 1. Objetivo
Garantizar que **NUNCA** se apague el equipo si existen cambios locales sin confirmar, commits pendientes de sincronizar con GitHub (`origin/master`), o fallos de conexión a la red, evitando que los servidores de producción sirvan compilaciones antiguas.

---

## 2. Protocolo Obligatorio de 4 Pasos en Ciclo Cerrado

Cuando el usuario escriba **`BYE`**, solicite guardar y apagar, o finalizar la sesión con apagado:

### Paso 1: Verificación de Cambios y Validación de Sintaxis
1. Ejecutar `git status`.
2. Si existen archivos modificados o nuevos relevantes, validar sintaxis (ej. `validate_jsx_syntax.py` / pruebas).
3. Ejecutar `git add` y crear el commit correspondiente con un mensaje descriptivo.

### Paso 2: Sincronización Remota con GitHub (`git push origin master`)
1. Ejecutar `git push origin master`.
2. **Comprobación de Ciclo Cerrado:**
   - Ejecutar `git status` y verificar que la rama local esté exactamente sincronizada:
     `Your branch is up to date with 'origin/master'`.
   - **CONDICIÓN DE BLOQUEO DE APAGADO:**
     - Si `git push` falla (por timeout de red, error 443, rechazo de credenciales o pérdida de Wi-Fi):
     - **QUEDA ESTRICTAMENTE PROHIBIDO emitir la orden de apagado (`shutdown`)**.
     - El asistente debe informar inmediatamente al usuario: *"ALERTA: Los cambios se guardaron localmente pero falló el push a GitHub por problemas de red. El apagado fue cancelado para evitar desincronización de producción."*

### Paso 3: Registro en Memoria Persistente (`memory/chat-log.md`)
1. Registrar el hash del commit verificado (`git rev-parse HEAD`).
2. Registrar los puntos clave resueltos en la sesión y el estado de la build.

### Paso 4: Emisión del Apagado Controlado
Únicamente si los Pasos 1, 2 y 3 concluyeron con **ÉXITO CONFIRMADO**:
1. Notificar al usuario con el resumen de confirmación y el hash del commit remoto.
2. Ejecutar el comando de apagado seguro con temporizador de cortesía:
   ```powershell
   shutdown /s /t 20 /c "MC-LARENS ERP: Todo sincronizado con exito en GitHub. Apagando equipo..."
   ```
