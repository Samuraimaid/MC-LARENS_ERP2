"""Sale delivery logistics — messenger assignment, settlement and print helpers."""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

DESTINATION_HOME = "domicilio"
DESTINATION_BUS_TERMINAL = "terminal_buses"

DESTINATION_LABELS_ES = {
    DESTINATION_HOME: "A domicilio",
    DESTINATION_BUS_TERMINAL: "A terminal de buses",
}

VALID_DESTINATION_TYPES = frozenset({DESTINATION_HOME, DESTINATION_BUS_TERMINAL})


def normalize_destination_type(value: Any) -> str:
    raw = str(value or "").strip().lower()
    aliases = {
        "home": DESTINATION_HOME,
        "a_domicilio": DESTINATION_HOME,
        "domicilio": DESTINATION_HOME,
        "bus_terminal": DESTINATION_BUS_TERMINAL,
        "terminal": DESTINATION_BUS_TERMINAL,
        "terminal_buses": DESTINATION_BUS_TERMINAL,
        "a_terminal_de_buses": DESTINATION_BUS_TERMINAL,
    }
    return aliases.get(raw, raw if raw in VALID_DESTINATION_TYPES else DESTINATION_HOME)


def destination_label_es(destination_type: str) -> str:
    return DESTINATION_LABELS_ES.get(normalize_destination_type(destination_type), destination_type)


def parse_delivery_info(raw: Any, *, branch_id: str = "") -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raw = {}
    is_delivery = bool(raw.get("is_delivery"))
    destination_type = normalize_destination_type(raw.get("destination_type"))
    try:
        delivery_cost = round(max(float(raw.get("delivery_cost") or 0), 0.0), 2)
    except (TypeError, ValueError):
        delivery_cost = 0.0
    messenger_id = str(raw.get("messenger_id") or "").strip() or None
    messenger_name = str(raw.get("messenger_name") or "").strip()
    return {
        "is_delivery": is_delivery,
        "destination_type": destination_type,
        "destination_label": destination_label_es(destination_type),
        "delivery_cost": delivery_cost,
        "delivery_cost_nio": delivery_cost,
        "messenger_id": messenger_id,
        "messenger_name": messenger_name,
        "delivery_status": str(raw.get("delivery_status") or ("pendiente" if is_delivery else "")).strip() or None,
        "branch_id": str(raw.get("branch_id") or branch_id or "").strip() or None,
    }


def validate_delivery_info(
    info: Dict[str, Any],
    *,
    branch_id: str,
    messenger_doc: Optional[Dict[str, Any]] = None,
) -> None:
    from fastapi import HTTPException

    if not info.get("is_delivery"):
        return
    if info.get("delivery_cost", 0) <= 0:
        raise HTTPException(status_code=400, detail="El costo de envío debe ser mayor a cero")
    if not info.get("messenger_id"):
        raise HTTPException(status_code=400, detail="Debe asignar un mensajero para el delivery")
    if messenger_doc is None:
        raise HTTPException(status_code=400, detail="Mensajero no encontrado")
    if str(messenger_doc.get("branch_id") or "") != str(branch_id or ""):
        raise HTTPException(status_code=400, detail="El mensajero no pertenece a la sucursal de la venta")
    if str(messenger_doc.get("status") or "") not in {"disponible", "en_ruta"}:
        raise HTTPException(status_code=409, detail="El mensajero seleccionado no está disponible para ruta")


def delivery_cost_nio_for_settlement(
    info: Dict[str, Any],
    *,
    sale_currency: str,
    exchange_rate: float,
    buy_rate: float,
) -> float:
    if not info.get("is_delivery"):
        return 0.0
    cost = float(info.get("delivery_cost") or 0)
    currency = str(sale_currency or "NIO").upper()
    if currency == "USD":
        return round(cost * float(buy_rate or exchange_rate or 36.62), 2)
    return round(cost, 2)


def build_delivery_print_lines(sale: Dict[str, Any]) -> List[str]:
    info = sale.get("delivery_info") or {}
    if not info.get("is_delivery"):
        return []
    destination = info.get("destination_label") or destination_label_es(info.get("destination_type"))
    messenger = str(info.get("messenger_name") or "").strip() or "Sin asignar"
    short_dest = "Domicilio" if normalize_destination_type(info.get("destination_type")) == DESTINATION_HOME else "Terminal"
    return [
        f"TIPO DE ENVIO: {short_dest} | MENSAJERO: {messenger}",
        f"Costo envio: C$ {float(info.get('delivery_cost') or 0):,.2f}",
    ]


async def resolve_messenger_for_sale(db, messenger_id: str, branch_id: str) -> Optional[Dict[str, Any]]:
    from backend.domains.hr.delivery_messengers import ensure_delivery_messengers

    await ensure_delivery_messengers(db)
    row = await db.hr_delivery_messengers.find_one(
        {"messenger_id": messenger_id, "branch_id": branch_id},
        {"_id": 0},
    )
    return row


async def activate_delivery_after_payment(db, sale: Dict[str, Any]) -> Dict[str, Any]:
    from backend.domains.hr.delivery_messengers import set_messenger_status

    info = dict(sale.get("delivery_info") or {})
    if not info.get("is_delivery"):
        return {"activated": False}
    messenger_id = str(info.get("messenger_id") or "")
    sale_id = str(sale.get("sale_id") or "")
    if messenger_id:
        await set_messenger_status(
            db,
            messenger_id,
            "en_ruta",
            active_sale_id=sale_id,
            active_delivery_id=sale_id,
        )
    await db.sales.update_one(
        {"sale_id": sale_id},
        {
            "$set": {
                "delivery_info.delivery_status": "en_ruta",
                "delivery_status": "en_ruta",
                "delivery_required": True,
            }
        },
    )
    return {"activated": True, "messenger_id": messenger_id, "sale_id": sale_id}