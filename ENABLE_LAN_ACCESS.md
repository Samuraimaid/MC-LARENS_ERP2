# 🔧 Cómo Habilitar Acceso LAN a MC-Larens ERP

## Método: PortProxy (Windows 10/11)

### Paso 1: Ejecutar el Script como Administrador

1. **Ubica el archivo**: `enable-lan-access.bat` en la raíz del proyecto
2. **Click derecho** sobre el archivo
3. Selecciona **"Ejecutar como administrador"**
4. Lee el mensaje y presiona una tecla para ejecutar

### Paso 2: Verificar que Funcionó

Después de ejecutar el script, deberías ver algo como:

```
Listen on ipv4:   Connect to ipv4:
Address         Port        Address         Port
--------------- ----------  --------------- ----------
0.0.0.0         3000        127.0.0.1       3000
0.0.0.0         8001        127.0.0.1       8001
```

### Paso 3: Probar desde Otro Dispositivo

Desde **otro dispositivo en la misma red** (smartphone, laptop, etc.):

```
Frontend:  http://192.168.1.12:3000
Backend:   http://192.168.1.12:8001
```

---

## ¿Qué es PortProxy?

PortProxy es una característica nativa de Windows que redirige el tráfico de red:

```
Otro dispositivo (192.168.1.5)
    ↓
    → http://192.168.1.12:3000 [PortProxy listening]
    ↓
    → Redirect a 127.0.0.1:3000 [Docker localhost]
    ↓
Nginx Container responde ✓
```

---

## Si el Script Falla

Si obtienes error de permisos, ejecuta manualmente en PowerShell (como Admin):

```powershell
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=127.0.0.1

netsh interface portproxy add v4tov4 listenport=8001 listenaddress=0.0.0.0 connectport=8001 connectaddress=127.0.0.1

netsh interface portproxy show all
```

---

## Para Deshacer los Cambios

Si quieres remover las reglas de PortProxy:

```powershell
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=8001 listenaddress=0.0.0.0
```

---

## Alternativa: SSH Tunneling (Sin Admin)

Si no puedes ejecutar como administrador, usa SSH:

```bash
ssh usuario@192.168.1.12 -L 3000:localhost:3000 -N
```

Luego desde el otro dispositivo: `http://localhost:3000`
