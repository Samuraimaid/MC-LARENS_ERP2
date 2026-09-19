# Patch rápido: no reescribir PINs en startup

En `backend/server.py`, función `bootstrap_canonical_pin_users`, reemplazar el cuerpo para que `sync_canonical_user_pins()` solo corra si:

`ENABLE_CANONICAL_PIN_SYNC=1` (o true/yes/on)

Por defecto (Cloud Run sin esa env): **skip** y loguear.

El endpoint manual `POST /api/auth/pin/sync-all` puede quedar para gerencia/programador cuando sí quieran sincronizar.

**No** dejar `await sync_canonical_user_pins()` incondicional en `@app.on_event("startup")`.
