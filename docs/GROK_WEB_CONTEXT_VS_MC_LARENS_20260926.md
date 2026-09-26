# Contexto Case → Grok Web → VS Grok · MC-LARENS ERP2 · 2026-09-26

Pega este archivo en **Grok Web**. Guía a VS Grok con prompts cortos. No reinventar U1–U15.

**Repo:** https://github.com/Samuraimaid/MC-LARENS_ERP2 · **master**  
**Live:** https://mclarens-erp-836176703716.us-central1.run.app  
**Workspace Xinon:** `D:\MC-LARENS_ERP2`  
**Cloud Shell clone:** `~/MC-LARENS_ERP2` · cuenta `dayavar18@gmail.com`  
**Project GCP:** `gen-lang-client-0971793042` · region `us-central1` · service `mclarens-erp`

Historial largo: `docs/CASE_CHAT_HISTORY_UX_STACK_20260926.md`

---

## Roles

| Quién | Hace |
|--------|------|
| Grok Web | Director, prompts, smoke PC |
| VS Grok | Código + PR. Sin gcloud |
| Xinon Cloud Shell | `gh pr merge` + build + Cloud Run |
| Contabilidad / otros repos ERP | NO |

---

## Ya en master (no rehacer)

#77–#96 producto/UX · #97–#99 docker/gcloudignore uploads · #100–#101 docs  
#102 B-28113 visibleSaleIds · #103 B-58261 isQueued · #104 inventario Cómoda  
#105 sales móvil · #106 taglines hidden md:block · #107 tap imagen = detalle (sin ojito)

---

## Deploy (solo Cloud Shell)

Ver plantilla en el historial 20260926. Siempre `--project`. Comprobar `git log -1` **incluye el PR** antes de celebrar.

Rollback #105: imagen `20260926_024502`.

Nunca `gcloud` desde `D:\` (venv 2.9 GB + tags viejos).

---

## Errores vistos (resumen)

B-28113 filter scope · B-58261 isQueued · deploy sin merge · auth/project gcloud · HyperVisor viewport · VS deploy sucio · HEAD git tras corte de luz.

---

## Prompt tipo VS (siguiente lote)

```
Workspace D:\MC-LARENS_ERP2 @ master. git pull --ff-only origin master.
No gcloud. No Contabilidad. No .gcloudignore uploads. No U1–U15.
[tarea concreta]
npm run build verde. gh pr create contra master. No mergees salvo que el prompt lo pida.
```

## Prompt tipo Cloud Shell

```
PR=NNN
# bloque merge+pull+builds submit && run deploy del historial 20260926
```

Grok Web **no** recibe tokens. `gh auth login` en la máquina del usuario.
