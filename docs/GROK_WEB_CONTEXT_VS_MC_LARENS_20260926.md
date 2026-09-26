# Contexto Case → Grok Web → VS Grok · MC-LARENS ERP2 · 2026-09-26

Pega este archivo en **Grok Web**. Guía a VS Grok con prompts cortos. No reinventar U1–U15.

**Repo:** https://github.com/Samuraimaid/MC-LARENS_ERP2 · **master**  
**HEAD:** `0a39cc8f` (merge #113). Más nuevo que el live citado abajo.  
**Live:** https://mclarens-erp-836176703716.us-central1.run.app  
**Live conocido:** rev `mclarens-erp-00199-qwv` · imagen `20260926_184244` · BUILD `20260926-1845`  
**Workspace Xinon:** `D:\MC-LARENS_ERP2`  
**Cloud Shell clone:** `~/MC-LARENS_ERP2` · cuenta `dayavar18@gmail.com`  
**Project GCP:** `gen-lang-client-0971793042` · region `us-central1` · service `mclarens-erp`

Historial largo: `docs/CASE_CHAT_HISTORY_UX_STACK_20260926.md`

`env.js` local es `0.2.1 | dev`. No es el sello de Cloud Run.

---

## Roles

| Quién | Hace |
|--------|------|
| Grok Web | Director, prompts, smoke PC |
| VS / Antigravity | Código + PR. Sin gcloud |
| Xinon Cloud Shell | Merge con el botón verde de GitHub + build + Cloud Run |
| Contabilidad / otros repos ERP | NO |

`gh` en Cloud Shell suele no estar logueado. No pegar PIN ni token. Merge = botón verde, no `gh pr merge` hasta que haya `gh auth`.

---

## Ya en master (no rehacer)

#77–#96 producto/UX · #97–#99 docker/gcloudignore uploads · #100–#101 docs  
#102 B-28113 visibleSaleIds · #103 B-58261 isQueued · #104 inventario Cómoda  
#105 sales móvil · #106 taglines hidden md:block · #107 tap foto = detalle, sin ojito  
#110 stay catalog, no leave-site, sin badge Guardado, carrito USD/C$  
#111 cabecera de carrito, vehículo/entrega, sin H1 Catálogo+Actualizar, basura = brand+SKU  
#112 toasts Sonner + ocultar buscar/CSV/vistas con formulario abierto  
#113 un Toaster top-right + contraste glass claro

**No están en master:** #108 (docs; este archivo lo sustituye). #109 (draft sync + carrito; lo cubre #110).

---

## Deploy (solo Cloud Shell, después del merge verde)

```bash
cd ~/MC-LARENS_ERP2
gcloud config set project gen-lang-client-0971793042
gcloud config set run/region us-central1
git fetch origin && git checkout master && git pull --ff-only origin master
git log -1 --oneline
TAG=$(date +%Y%m%d_%H%M%S)
echo TAG=$TAG
gcloud builds submit --project gen-lang-client-0971793042 \
  --tag gcr.io/gen-lang-client-0971793042/mclarens-erp:$TAG . && \
gcloud run deploy mclarens-erp \
  --project gen-lang-client-0971793042 \
  --region us-central1 \
  --image gcr.io/gen-lang-client-0971793042/mclarens-erp:$TAG \
  --update-env-vars BUILD_VERSION=0.2.0-$TAG
```

Siempre `--project`. `git log -1` tiene que citar el PR antes de celebrar.

Rollback #105: imagen `20260926_024502`.

Nunca `gcloud` desde `D:\`. Nunca regla suelta `uploads` en `.gcloudignore`.

---

## Errores vistos (resumen)

B-28113 filter scope · B-58261 isQueued · deploy sin merge · auth/project gcloud · HyperVisor viewport · VS deploy sucio (2.9 GB, tag `214103`) · Cloud Shell en `~` · `gh auth` cancelado · merge local “not something we can merge” · builds de master sin #109/#110 · Toaster centro + derecha · HEAD git tras corte de luz.

---

## Pendiente

- Deploy de `master` `0a39cc8f` (#113) si el live sigue en BUILD `20260926-1845`.
- QA datos catálogo (nombres OCR). Display ya es brand+SKU (#111). Sin PATCH masivo.
- Banner “Modo Selección Venta” compacto.
- `gh pr merge` solo cuando Cloud Shell tenga login.

---

## Prompt tipo VS (siguiente lote)

```
Workspace D:\MC-LARENS_ERP2 @ master. git pull --ff-only origin master.
No gcloud. No Contabilidad. No .gcloudignore uploads. No U1–U15. No FE de producto.
[tarea concreta]
npm run build verde. gh pr create contra master. No mergees salvo que el prompt lo pida.
```

## Prompt tipo Cloud Shell

```
cd ~/MC-LARENS_ERP2
gcloud config set project gen-lang-client-0971793042
gcloud config set run/region us-central1
git fetch origin && git checkout master && git pull --ff-only origin master
git log -1 --oneline
TAG=$(date +%Y%m%d_%H%M%S)
gcloud builds submit --project gen-lang-client-0971793042 \
  --tag gcr.io/gen-lang-client-0971793042/mclarens-erp:$TAG . && \
gcloud run deploy mclarens-erp \
  --project gen-lang-client-0971793042 \
  --region us-central1 \
  --image gcr.io/gen-lang-client-0971793042/mclarens-erp:$TAG \
  --update-env-vars BUILD_VERSION=0.2.0-$TAG
```

Grok Web **no** recibe tokens. El merge verde es en GitHub. `gh auth login` solo en la máquina del usuario.
