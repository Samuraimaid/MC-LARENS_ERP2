"""Multi-role tutorial curriculum: defaults + Mongo overrides.

Tracks are keyed by role. Gerencia/programador can edit all tracks.
Images: /tutorials/* (frontend) or /api/tutorials/assets/* (uploaded).
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

TUTORIALS_VERSION = "2026.08.multi-role-v2"
TUTORIAL_EDITOR_ROLES = frozenset({"gerencia", "programador"})

# Roles that have a dedicated training track
TRACK_ROLES: List[str] = [
    "ventas",
    "cajero",
    "supervisor",
    "bodegas",
    "coordinador_instalaciones",
    "coordinador_polarizados",
    "instalaciones",
    "electrico",
    "polarizador",
    "jefe_tienda",
    "jefe_vendedores",
    "gerencia",
]

TRACK_LABELS: Dict[str, str] = {
    "ventas": "Vendedor",
    "cajero": "Cajero",
    "supervisor": "Supervisor",
    "bodegas": "Despacho / Bodega",
    "coordinador_instalaciones": "Coord. Instalaciones",
    "coordinador_polarizados": "Coord. Polarizados",
    "instalaciones": "Instalador",
    "electrico": "Tecnico electrico",
    "polarizador": "Polarizador",
    "jefe_tienda": "Jefe de tienda",
    "jefe_vendedores": "Jefe de vendedores",
    "gerencia": "Gerencia",
}


def _mod(
    mid: str,
    order: int,
    level: str,
    mins: int,
    title: str,
    summary: str,
    image: str,
    steps: List[Dict[str, str]],
    *,
    dos: Optional[List[str]] = None,
    donts: Optional[List[str]] = None,
    scenarios: Optional[List[Dict[str, str]]] = None,
    objectives: Optional[List[str]] = None,
    related_routes: Optional[List[str]] = None,
    shortcuts: Optional[List[Dict[str, str]]] = None,
    image_alt: str = "",
) -> Dict[str, Any]:
    return {
        "id": mid,
        "order": order,
        "level": level,
        "duration_min": mins,
        "title": title,
        "summary": summary,
        "image": image,
        "image_alt": image_alt or title,
        "objectives": objectives or [s["title"] for s in steps[:3]],
        "steps": steps,
        "dos": dos or [],
        "donts": donts or [],
        "scenarios": scenarios or [],
        "related_routes": related_routes or [],
        "shortcuts": shortcuts or [],
    }


def _shared_login() -> Dict[str, Any]:
    return _mod(
        "login-pin",
        1,
        "basico",
        4,
        "Iniciar sesion con PIN",
        "Entrar al ERP de forma segura y manejar bloqueos.",
        "/api/tutorials/assets/real/login.png",
        [
            {"title": "Abre la URL de tu sucursal", "detail": "HTTP :3000 en PC o HTTPS :3443 para camara movil."},
            {"title": "Ingresa tu PIN de login (8 digitos)", "detail": "No es el PIN de marcacion de 4 digitos."},
            {"title": "Confirma Entrar", "detail": "Se crea sesion con cookie. Si fallas, veras intentos restantes y posible bloqueo."},
        ],
        dos=["Cierra sesion al terminar el turno", "Bloquea la terminal si te alejas"],
        donts=["No compartas tu PIN", "No uses el PIN de otra persona"],
        scenarios=[
            {
                "name": "PIN bloqueado",
                "procedure": "Espera el contador o pide desbloqueo a gerencia/RRHH. No sigas intentando.",
            }
        ],
        related_routes=["/login"],
        image_alt="Captura real: pantalla de login PIN",
    )


def _build_default_tracks() -> Dict[str, Dict[str, Any]]:
    ventas = [
        _shared_login(),
        _mod(
            "ventas-menu",
            2,
            "basico",
            5,
            "Menu del vendedor",
            "Donde trabajar a diario y que modulos no te corresponden.",
            "/api/tutorials/assets/real/ventas-home.png",
            [
                {"title": "Entra a Ventas / Centro Unificado", "detail": "Ahi estan borradores y carrito."},
                {"title": "Clientes y vehiculos", "detail": "Alta y busqueda antes de facturar con instalacion."},
                {"title": "Cotizaciones, creditos, devoluciones", "detail": "Usa solo lo permitido a tu rol."},
            ],
            donts=["No entres a Caja ni Despacho", "No listes usuarios PIN de personal"],
            related_routes=["/sales", "/customers", "/vehicles", "/quotations"],
        ),
        _mod(
            "ventas-cliente-vehiculo",
            3,
            "basico",
            8,
            "Cliente y vehiculo",
            "Datos correctos evitan fallos en taller y entrega.",
            "/api/tutorials/assets/real/ventas-clientes.png",
            [
                {"title": "Busca o crea el cliente (Alt+C)", "detail": "Nombre, telefono 0000-0000, tipo natural/empresa."},
                {"title": "Asocia o registra el vehiculo", "detail": "Marca, modelo, anio, color y placa real."},
                {"title": "Credito solo si hay limite", "detail": "Sin limite aprobado no uses pago a credito."},
            ],
            related_routes=["/customers", "/vehicles", "/sales"],
        ),
        _mod(
            "ventas-borrador",
            4,
            "basico",
            10,
            "Borrador y carrito",
            "El borrador guarda; no cobra. Usa Ctrl+S y varias pestanas.",
            "/api/tutorials/assets/real/ventas-sales.png",
            [
                {"title": "Nueva venta / borrador", "detail": "Un borrador por cliente activo."},
                {"title": "Agrega productos (Alt+P)", "detail": "Enter agrega linea; marca instalacion si aplica."},
                {"title": "Guarda con Ctrl+S", "detail": "Hay autoguardado; confirma antes de pausar."},
            ],
            shortcuts=[
                {"keys": "Alt + C", "action": "Cliente"},
                {"keys": "Alt + P", "action": "Producto"},
                {"keys": "Ctrl + S", "action": "Guardar borrador"},
            ],
            related_routes=["/sales"],
        ),
        _mod(
            "ventas-precios",
            5,
            "intermedio",
            12,
            "Precios y Precio 2",
            "Precio 1 base; Precio 2 requiere aprobacion de supervision.",
            "/api/tutorials/assets/real/ventas-sales.png",
            [
                {"title": "Trabaja en Precio 1", "detail": "Tarifa estandar de piso."},
                {"title": "Si usas Precio 2", "detail": "Solicita aprobacion con motivo y espera estado aprobado."},
                {"title": "No envies a caja en pendiente", "detail": "El servidor bloquea facturacion sin aprobacion."},
            ],
            donts=["No pongas precio <= 0", "No inventes descuentos fuera de tope"],
            scenarios=[
                {
                    "name": "Cliente pide descuento fuerte",
                    "procedure": "Pide a supervision watch del borrador, ajuste y release.",
                }
            ],
            related_routes=["/sales", "/approvals"],
        ),
        _mod(
            "ventas-caja",
            6,
            "intermedio",
            12,
            "Envio a caja",
            "El vendedor no cobra: confirma total y envia factura a caja.",
            "/api/tutorials/assets/real/ventas-sales.png",
            [
                {"title": "Elige metodo de pago", "detail": "Efectivo, tarjeta, transferencia, credito o mixto."},
                {"title": "Revisa neto en C$", "detail": "IVA y tipo de cambio los calcula el servidor."},
                {"title": "Confirma 'Enviar a caja'", "detail": "Dialogo de confirmacion (no es el voucher termico)."},
                {"title": "Da el numero de factura", "detail": "El cajero cobra; luego se crean despacho y OT."},
            ],
            scenarios=[
                {
                    "name": "TOTAL_MISMATCH / plan de pago",
                    "procedure": "Reenvia con totales del servidor; no pelees a mano.",
                },
                {
                    "name": "Factura pagada: editar?",
                    "procedure": "No se edita por vendedor. Anulacion solo con gerencia.",
                },
            ],
            related_routes=["/sales"],
        ),
        _mod(
            "ventas-post-cobro",
            7,
            "avanzado",
            6,
            "Despues del cobro",
            "Explica al cliente: despacho -> OT -> QC -> entrega.",
            "/api/tutorials/assets/real/ventas-sales.png",
            [
                {"title": "Caja cobra y corre fulfillment", "detail": "Despacho de fisicos + OT por departamento."},
                {"title": "Taller y polarizados", "detail": "Cada depto avanza y pasa QC antes de entregar."},
            ],
            donts=["No digas 'ya esta listo' solo porque pago"],
            related_routes=["/sales"],
        ),
    ]

    cajero = [
        _shared_login(),
        _mod(
            "caja-menu",
            2,
            "basico",
            5,
            "Modulo de caja",
            "Sesion de caja, facturas abiertas y cobro.",
            "/api/tutorials/assets/real/cajero-cashier.png",
            [
                {"title": "Abre sesion de caja", "detail": "Sin sesion activa no cobras. Verifica tipo de cambio."},
                {"title": "Lista facturas abiertas", "detail": "Pestaña abiertas / credito segun el caso."},
                {"title": "Cobra con el metodo acordado", "detail": "Efectivo, tarjeta, transferencia o mixto. Usa sesion_id correcto."},
            ],
            donts=["No cobres dos veces la misma factura", "No anules facturas sin autorizacion"],
            related_routes=["/cashier"],
        ),
        _mod(
            "caja-cobro",
            3,
            "intermedio",
            10,
            "Cobro e idempotencia",
            "Evita dobles cobros y cierra el ciclo hacia despacho/OT.",
            "/api/tutorials/assets/real/cajero-cashier.png",
            [
                {"title": "Selecciona la factura", "detail": "Por numero o busqueda de cliente."},
                {"title": "Confirma monto y metodo", "detail": "El neto debe coincidir con el plan de pago."},
                {"title": "Tras cobrar", "detail": "Se dispara fulfillment: despacho y OT de instalacion/polarizado."},
            ],
            scenarios=[
                {
                    "name": "Factura ya pagada",
                    "procedure": "El sistema responde 409. No reintentes cobro.",
                }
            ],
            related_routes=["/cashier"],
        ),
        _mod(
            "caja-cola",
            4,
            "avanzado",
            5,
            "Cola y limpieza",
            "Solo supervision/gerencia limpia colas masivas.",
            "/api/tutorials/assets/real/cajero-cashier.png",
            [
                {"title": "Facturas huerfanas", "detail": "Reporta a gerencia; no borres datos por tu cuenta."},
            ],
            related_routes=["/cashier"],
        ),
    ]

    supervisor = [
        _shared_login(),
        _mod(
            "sup-borradores",
            2,
            "basico",
            8,
            "Revisar borradores (watch/release)",
            "Entra al borrador del vendedor, ajusta y libera.",
            "/api/tutorials/assets/real/supervisor-home.png",
            [
                {"title": "Watch del borrador", "detail": "Solo supervision puede revisar borradores ajenos."},
                {"title": "Aplica descuentos autorizados", "detail": "Linea o global; documenta el motivo."},
                {"title": "Release al vendedor", "detail": "El vendedor no puede liberarse a si mismo."},
            ],
            related_routes=["/sales"],
        ),
        _mod(
            "sup-aprobaciones",
            3,
            "intermedio",
            8,
            "Aprobaciones Precio 2 y solicitudes",
            "Aprueba o rechaza con criterio de impacto.",
            "/api/tutorials/assets/real/supervisor-approvals.png",
            [
                {"title": "Revisa solicitudes pendientes", "detail": "Precio 2, edicion, descuentos POS."},
                {"title": "Valida motivo e impacto", "detail": "No apruebes sin justificacion."},
            ],
            related_routes=["/approvals"],
        ),
        _mod(
            "sup-salud",
            4,
            "intermedio",
            5,
            "Salud del flujo",
            "Monitorea colas de caja, despacho, OT y QC.",
            "/api/tutorials/assets/real/supervisor-flow-health.png",
            [
                {"title": "Abre Salud del Flujo", "detail": "Cuellos de botella y alertas."},
                {"title": "Escala backlog", "detail": "OT sin asignar, QC pendiente, caja abierta."},
            ],
            related_routes=["/ops/flow-health"],
        ),
    ]

    bodegas = [
        _shared_login(),
        _mod(
            "bodega-despacho",
            2,
            "basico",
            8,
            "Cola de despacho",
            "Inicia y entrega items de facturas cobradas.",
            "/api/tutorials/assets/real/bodegas-dispatch.png",
            [
                {"title": "Abre Despacho o KDS Bodega", "detail": "Solo ves tu bodega asignada."},
                {"title": "Start del despacho", "detail": "Luego entrega item por item."},
                {"title": "Confirma surtido", "detail": "Estado completed cuando todo salio."},
            ],
            scenarios=[
                {
                    "name": "403 otra bodega",
                    "procedure": "Tu usuario no tiene warehouse_id de esa orden. Pide a gerencia reasignar bodega.",
                }
            ],
            related_routes=["/dispatch", "/kds/bodega"],
        ),
        _mod(
            "bodega-kds",
            3,
            "intermedio",
            5,
            "KDS de bodega",
            "Pantalla de cocina para priorizar pedidos.",
            "/api/tutorials/assets/real/bodegas-kds.png",
            [
                {"title": "Prioriza por antigüedad/prioridad", "detail": "No dejes despachos pending sin atender."},
            ],
            related_routes=["/kds/bodega"],
        ),
    ]

    coord_inst = [
        _shared_login(),
        _mod(
            "coord-inst-cola",
            2,
            "basico",
            8,
            "Cola de asignacion",
            "Asigna OT de instalaciones y electrico a tecnicos disponibles.",
            "/api/tutorials/assets/real/coord-inst.png",
            [
                {"title": "Abre Coord. Instalaciones", "detail": "Veras OT pending_assignment."},
                {"title": "Revisa semaforo de tecnicos", "detail": "Asistencia (clock-in) y carga de trabajos."},
                {"title": "Asigna tecnico", "detail": "No asignes a ausentes o sobrecargados."},
            ],
            related_routes=["/coordinator/instalaciones"],
        ),
        _mod(
            "coord-inst-qc",
            3,
            "intermedio",
            8,
            "Control de calidad",
            "Inspecciona OT en quality_check y aprueba o devuelve.",
            "/api/tutorials/assets/real/coord-inst-qc.png",
            [
                {"title": "OT en quality_check", "detail": "El tecnico envio el trabajo a QC."},
                {"title": "Registra QC aprobado/rechazado", "detail": "Sin QC no hay completed/delivered."},
            ],
            related_routes=["/quality-control", "/work-orders"],
        ),
    ]

    coord_pol = [
        _shared_login(),
        _mod(
            "coord-pol-ot",
            2,
            "basico",
            8,
            "OT de polarizados",
            "Polarizado genera OT + detalle de ventanas (tint).",
            "/api/tutorials/assets/real/coord-pol.png",
            [
                {"title": "Cola polarizados", "detail": "Asigna polarizador a la OT department=polarizados."},
                {"title": "Tint detail", "detail": "Ventanas y materiales en la orden de polarizado."},
            ],
            related_routes=["/coordinator/polarizados", "/tint-orders"],
        ),
        _mod(
            "coord-pol-qc",
            3,
            "intermedio",
            6,
            "QC polarizados",
            "Aprueba calidad y cierra la OT/tint.",
            "/api/tutorials/assets/real/coord-pol.png",
            [
                {"title": "Inspeccion visual", "detail": "Burbujas, bordes, visibilidad."},
                {"title": "Completa QC", "detail": "OT a delivered / tint completed."},
            ],
            related_routes=["/coordinator/polarizados", "/quality-control"],
        ),
    ]

    tech_inst = [
        _shared_login(),
        _mod(
            "tech-marcacion",
            2,
            "basico",
            4,
            "Marcacion y disponibilidad",
            "Sin clock-in no te asignan trabajos.",
            "/api/tutorials/assets/real/tech-home.png",
            [
                {"title": "Marca entrada (asistencia)", "detail": "Kiosko o flujo RRHH segun sucursal."},
                {"title": "Revisa trabajos asignados", "detail": "Kiosko tecnico u OT pendientes."},
            ],
            related_routes=["/technician", "/work-orders", "/attendance-clock"],
        ),
        _mod(
            "tech-flujo-ot",
            3,
            "intermedio",
            10,
            "Flujo de la OT",
            "pending -> in_progress -> quality_check. No marques completed tu mismo.",
            "/api/tutorials/assets/real/tech-wo.png",
            [
                {"title": "Inicia trabajo (in_progress)", "detail": "Solo cuando tengas material y vehiculo."},
                {"title": "Envia a quality_check", "detail": "Coordinacion hace QC; tu no apruebas solo."},
            ],
            donts=["No marques completed/delivered como tecnico de piso"],
            related_routes=["/technician", "/work-orders"],
        ),
    ]

    tech_elec = [
        _shared_login(),
        _mod(
            "elec-ot",
            2,
            "basico",
            8,
            "OT electricas",
            "Trabajos de audio/seguridad/electronica.",
            "/api/tutorials/assets/real/electrico-home.png",
            [
                {"title": "Solo OT department=electrico", "detail": "Asignadas por coord. instalaciones."},
                {"title": "Mismo flujo de estados", "detail": "in_progress -> quality_check."},
            ],
            related_routes=["/work-orders", "/technician"],
        ),
    ]

    tech_pol = [
        _shared_login(),
        _mod(
            "pol-ot-tint",
            2,
            "basico",
            10,
            "OT y ventanas de polarizado",
            "Trabaja la OT y completa ventanas del tint.",
            "/api/tutorials/assets/real/polarizador-home.png",
            [
                {"title": "Acepta OT polarizados", "detail": "Asignada por coord. polarizados."},
                {"title": "Start y ventanas", "detail": "Marca cada ventana completada."},
                {"title": "Envia a QC", "detail": "No entregues sin aprobacion."},
            ],
            related_routes=["/tint-orders", "/kds/polarizados", "/work-orders"],
        ),
    ]

    jefe = [
        _shared_login(),
        _mod(
            "jefe-supervision",
            2,
            "basico",
            8,
            "Supervision de piso",
            "Apoya vendedores, stock y colas operativas.",
            "/api/tutorials/assets/real/jefe-home.png",
            [
                {"title": "Apoya ventas y aprobaciones", "detail": "Segun permisos de jefe_tienda / jefe_vendedores."},
                {"title": "Revisa inventario y despacho", "detail": "Jefe de tienda ve mas operacion de bodega."},
            ],
            related_routes=["/sales", "/inventory", "/dispatch"],
        ),
    ]

    gerencia = [
        _shared_login(),
        _mod(
            "ger-dashboard",
            2,
            "basico",
            6,
            "Dashboard y salud del flujo",
            "Vision global de colas y KPIs.",
            "/api/tutorials/assets/real/gerencia-dashboard.png",
            [
                {"title": "Dashboard", "detail": "KPI del dia y alertas."},
                {"title": "Salud del Flujo", "detail": "Caja, despacho, OT, QC, polarizados."},
            ],
            related_routes=["/dashboard", "/ops/flow-health"],
        ),
        _mod(
            "ger-tutoriales",
            3,
            "intermedio",
            8,
            "Editar tutoriales multi-rol",
            "Gerencia y programador editan todos los tracks.",
            "/api/tutorials/assets/real/gerencia-tutorials-edit.png",
            [
                {"title": "Abre Tutoriales", "detail": "Selector de rol para revisar cada track."},
                {"title": "Modo edicion", "detail": "Agrega modulos, pasos, imagenes y guarda."},
                {"title": "Sube capturas reales", "detail": "Adjunta PNG/JPG del ERP actualizado."},
            ],
            related_routes=["/help/tutorials"],
        ),
        _mod(
            "ger-usuarios-politicas",
            4,
            "avanzado",
            8,
            "Usuarios, permisos y politicas",
            "PIN, roles, descuentos y precios.",
            "/api/tutorials/assets/real/gerencia-users.png",
            [
                {"title": "Usuarios PIN", "detail": "Alta, rol, sucursal, bodega."},
                {"title": "Politicas comerciales", "detail": "Descuentos y precio 2 se reflejan en tutoriales: mantenlos alineados."},
            ],
            related_routes=["/users", "/settings"],
        ),
    ]

    return {
        "ventas": {"role": "ventas", "label": TRACK_LABELS["ventas"], "modules": ventas},
        "cajero": {"role": "cajero", "label": TRACK_LABELS["cajero"], "modules": cajero},
        "supervisor": {"role": "supervisor", "label": TRACK_LABELS["supervisor"], "modules": supervisor},
        "bodegas": {"role": "bodegas", "label": TRACK_LABELS["bodegas"], "modules": bodegas},
        "coordinador_instalaciones": {
            "role": "coordinador_instalaciones",
            "label": TRACK_LABELS["coordinador_instalaciones"],
            "modules": coord_inst,
        },
        "coordinador_polarizados": {
            "role": "coordinador_polarizados",
            "label": TRACK_LABELS["coordinador_polarizados"],
            "modules": coord_pol,
        },
        "instalaciones": {
            "role": "instalaciones",
            "label": TRACK_LABELS["instalaciones"],
            "modules": tech_inst,
        },
        "electrico": {"role": "electrico", "label": TRACK_LABELS["electrico"], "modules": tech_elec},
        "polarizador": {
            "role": "polarizador",
            "label": TRACK_LABELS["polarizador"],
            "modules": tech_pol,
        },
        "jefe_tienda": {"role": "jefe_tienda", "label": TRACK_LABELS["jefe_tienda"], "modules": jefe},
        "jefe_vendedores": {
            "role": "jefe_vendedores",
            "label": TRACK_LABELS["jefe_vendedores"],
            "modules": jefe,
        },
        "gerencia": {"role": "gerencia", "label": TRACK_LABELS["gerencia"], "modules": gerencia},
    }


def default_curriculum() -> Dict[str, Any]:
    tracks = _build_default_tracks()
    return {
        "version": TUTORIALS_VERSION,
        "tracks": tracks,
        "track_roles": list(TRACK_ROLES),
        "track_labels": dict(TRACK_LABELS),
        "golden_rules": [
            "PIN personal: no se comparte.",
            "Vendedor no cobra: envia a caja.",
            "Precio 2 y descuentos fuera de tope = supervision.",
            "OT: tecnico envia a QC; no se auto-aprueba completed.",
            "Factura pagada no se edita por piso.",
        ],
        "opinion": {
            "headline": "Opinion de arquitectura (tutoriales multi-rol)",
            "points": [
                "Un track por rol evita que el vendedor aprenda botones con 403.",
                "Gerencia/programador deben ver y editar todos los tracks (auditoria de procedimientos).",
                "Capturas reales del ERP > mockups: se desactualizan menos si hay pipeline Playwright.",
                "Persistir overrides en Mongo permite corregir sin redeploy del frontend.",
                "Imagenes subidas deben servirse por API (/tutorials/assets) con nombres estables.",
            ],
            "recommendation": (
                "Mantener defaults en codigo + overrides Mongo; regenerar capturas reales "
                "con el script capture_tutorial_screenshots al cambiar UI critica."
            ),
        },
    }


def can_edit_tutorials(role: Optional[str]) -> bool:
    return str(role or "").strip().lower() in TUTORIAL_EDITOR_ROLES


def can_view_all_tracks(role: Optional[str]) -> bool:
    return can_edit_tutorials(role)


def normalize_module(raw: Any, *, fallback_order: int = 1) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    mid = str(raw.get("id") or "").strip()
    title = str(raw.get("title") or "").strip()
    if not mid or not title:
        return None
    steps_in = raw.get("steps") if isinstance(raw.get("steps"), list) else []
    steps: List[Dict[str, str]] = []
    for s in steps_in:
        if not isinstance(s, dict):
            continue
        st = str(s.get("title") or "").strip()
        if not st:
            continue
        steps.append({"title": st, "detail": str(s.get("detail") or "").strip()})
    scenarios_in = raw.get("scenarios") if isinstance(raw.get("scenarios"), list) else []
    scenarios: List[Dict[str, str]] = []
    for sc in scenarios_in:
        if not isinstance(sc, dict):
            continue
        name = str(sc.get("name") or "").strip()
        if not name:
            continue
        scenarios.append(
            {"name": name, "procedure": str(sc.get("procedure") or "").strip()}
        )
    try:
        order = int(raw.get("order") or fallback_order)
    except (TypeError, ValueError):
        order = fallback_order
    try:
        duration = int(raw.get("duration_min") or 5)
    except (TypeError, ValueError):
        duration = 5
    level = str(raw.get("level") or "basico").strip().lower()
    if level not in {"basico", "intermedio", "avanzado"}:
        level = "basico"

    def _str_list(key: str) -> List[str]:
        val = raw.get(key)
        if not isinstance(val, list):
            return []
        return [str(x).strip() for x in val if str(x).strip()]

    shortcuts = []
    for sh in raw.get("shortcuts") or []:
        if isinstance(sh, dict) and sh.get("keys"):
            shortcuts.append(
                {"keys": str(sh.get("keys")), "action": str(sh.get("action") or "")}
            )

    return {
        "id": mid,
        "order": order,
        "level": level,
        "duration_min": max(1, duration),
        "title": title,
        "summary": str(raw.get("summary") or "").strip(),
        "image": str(raw.get("image") or "").strip(),
        "image_alt": str(raw.get("image_alt") or title).strip(),
        "objectives": _str_list("objectives"),
        "steps": steps,
        "dos": _str_list("dos"),
        "donts": _str_list("donts"),
        "scenarios": scenarios,
        "related_routes": _str_list("related_routes"),
        "shortcuts": shortcuts,
    }


def merge_curriculum(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    base = default_curriculum()
    if not overrides or not isinstance(overrides, dict):
        return base
    # version note
    if overrides.get("version"):
        base["version"] = f"{base['version']}+custom"
    if isinstance(overrides.get("golden_rules"), list):
        base["golden_rules"] = [str(x) for x in overrides["golden_rules"] if str(x).strip()]
    ov_tracks = overrides.get("tracks")
    if not isinstance(ov_tracks, dict):
        return base
    for role, track in ov_tracks.items():
        role_key = str(role or "").strip().lower()
        if not role_key:
            continue
        if not isinstance(track, dict):
            continue
        modules_raw = track.get("modules")
        if not isinstance(modules_raw, list):
            continue
        modules: List[Dict[str, Any]] = []
        for idx, raw in enumerate(modules_raw, start=1):
            norm = normalize_module(raw, fallback_order=idx)
            if norm:
                modules.append(norm)
        modules.sort(key=lambda m: int(m.get("order") or 0))
        base["tracks"][role_key] = {
            "role": role_key,
            "label": track.get("label") or TRACK_LABELS.get(role_key, role_key),
            "modules": modules,
        }
        if role_key not in base["track_roles"]:
            base["track_roles"].append(role_key)
            base["track_labels"][role_key] = base["tracks"][role_key]["label"]
    return base


def catalog_for_role(
    curriculum: Dict[str, Any],
    *,
    viewer_role: str,
    track_role: Optional[str] = None,
    full: bool = False,
) -> Dict[str, Any]:
    viewer = str(viewer_role or "").strip().lower()
    can_all = can_view_all_tracks(viewer)
    available = list(curriculum.get("track_roles") or TRACK_ROLES)
    labels = curriculum.get("track_labels") or TRACK_LABELS

    if can_all:
        selected = str(track_role or viewer or "ventas").strip().lower()
        visible_roles = available
    else:
        selected = viewer if viewer in (curriculum.get("tracks") or {}) else "ventas"
        if selected not in (curriculum.get("tracks") or {}):
            # fallback: first available
            selected = available[0] if available else "ventas"
        visible_roles = [selected]

    tracks = curriculum.get("tracks") or {}
    track = tracks.get(selected) or {"role": selected, "label": labels.get(selected, selected), "modules": []}
    modules = track.get("modules") or []
    modules_sorted = sorted(modules, key=lambda m: int(m.get("order") or 0))

    payload: Dict[str, Any] = {
        "version": curriculum.get("version"),
        "title": f"Academia {track.get('label') or selected} - ERP Mundo de Accesorios",
        "subtitle": "Procedimientos correctos con capturas reales del sistema.",
        "audience_default": selected,
        "viewer_role": viewer,
        "can_edit": can_edit_tutorials(viewer),
        "can_view_all_tracks": can_all,
        "selected_track": selected,
        "available_tracks": [
            {"role": r, "label": labels.get(r, r)} for r in visible_roles
        ],
        "locale": "es-NI",
        "total_modules": len(modules_sorted),
        "estimated_minutes": sum(int(m.get("duration_min") or 0) for m in modules_sorted),
        "levels": ["basico", "intermedio", "avanzado"],
        "modules": [
            {
                "id": m.get("id"),
                "order": m.get("order"),
                "level": m.get("level"),
                "duration_min": m.get("duration_min"),
                "title": m.get("title"),
                "summary": m.get("summary"),
                "image": m.get("image"),
                "image_alt": m.get("image_alt"),
            }
            for m in modules_sorted
        ],
        "golden_rules": curriculum.get("golden_rules") or [],
        "opinion": curriculum.get("opinion") or {},
    }
    if full:
        payload["modules_full"] = modules_sorted
    return payload


def get_module_from_curriculum(
    curriculum: Dict[str, Any], track_role: str, module_id: str
) -> Optional[Dict[str, Any]]:
    track = (curriculum.get("tracks") or {}).get(str(track_role).strip().lower()) or {}
    for m in track.get("modules") or []:
        if str(m.get("id")) == str(module_id):
            return m
    return None


def curriculum_to_override_doc(
    curriculum: Dict[str, Any],
    *,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "type": "tutorials_curriculum",
        "version": curriculum.get("version") or TUTORIALS_VERSION,
        "tracks": curriculum.get("tracks") or {},
        "golden_rules": curriculum.get("golden_rules") or [],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": actor_id,
        "updated_by_name": actor_name,
    }
