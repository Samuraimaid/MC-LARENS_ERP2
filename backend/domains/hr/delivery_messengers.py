"""HR delivery messengers — one rigid assignment per branch with live status."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.domains.hr.payroll_periods import BRANCH_MAIN, BRANCH_NORTH, BRANCH_SOUTH

COLLECTION = "hr_delivery_messengers"

VALID_STATUSES = frozenset({"disponible", "en_ruta", "libre"})

STATUS_LABELS_ES = {
    "disponible": "Disponible para ruta",
    "en_ruta": "En ruta (delivery activo)",
    "libre": "Fuera de turno",
}

BRANCH_LABELS = {
    BRANCH_MAIN: "Mundo de Accesorios",
    BRANCH_NORTH: "TopCar El Calvario",
    BRANCH_SOUTH: "TopCar La Tigre",
}

DEFAULT_MESSENGERS: List[Dict[str, Any]] = [
    {
        "messenger_id": "msg_mundo_oscar_membreno",
        "name": "Oscar Javier",
        "last_name": "Membreño",
        "branch_id": BRANCH_MAIN,
        "phone": "8888-1201",
        "vehicle_plate": "M 123456",
        "status": "disponible",
    },
    {
        "messenger_id": "msg_topcar_north_erick_gutierrez",
        "name": "Erick",
        "last_name": "Gutiérrez",
        "branch_id": BRANCH_NORTH,
        "phone": "8888-2201",
        "vehicle_plate": "M 234567",
        "status": "disponible",
    },
    {
        "messenger_id": "msg_topcar_south_denis_altamirano",
        "name": "Denis",
        "last_name": "Altamirano",
        "branch_id": BRANCH_SOUTH,
        "phone": "8888-3301",
        "vehicle_plate": "M 345678",
        "status": "disponible",
    },
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_messenger_status(value: Any) -> str:
    status = str(value or "disponible").strip().lower()
    if status not in VALID_STATUSES:
        return "disponible"
    return status


async def ensure_delivery_messengers(db) -> List[Dict[str, Any]]:
    """Upsert the three branch messengers if missing."""
    collection = db[COLLECTION]
    seeded: List[Dict[str, Any]] = []
    for template in DEFAULT_MESSENGERS:
        messenger_id = str(template["messenger_id"])
        existing = await collection.find_one({"messenger_id": messenger_id}, {"_id": 0})
        if existing:
            seeded.append(existing)
            continue
        doc = {
            **template,
            "status": normalize_messenger_status(template.get("status")),
            "active_delivery_id": None,
            "active_sale_id": None,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        await collection.update_one({"messenger_id": messenger_id}, {"$set": doc}, upsert=True)
        seeded.append(doc)
    return seeded


async def list_messengers(db, *, branch_id: Optional[str] = None) -> List[Dict[str, Any]]:
    await ensure_delivery_messengers(db)
    query: Dict[str, Any] = {}
    if branch_id:
        query["branch_id"] = branch_id
    rows = await db[COLLECTION].find(query, {"_id": 0}).sort("branch_id", 1).to_list(20)
    for row in rows:
        row["status"] = normalize_messenger_status(row.get("status"))
        row["status_label"] = STATUS_LABELS_ES.get(row["status"], row["status"])
    return rows


async def get_available_messenger_for_branch(db, branch_id: str) -> Optional[Dict[str, Any]]:
    await ensure_delivery_messengers(db)
    row = await db[COLLECTION].find_one(
        {"branch_id": str(branch_id), "status": "disponible"},
        {"_id": 0},
        sort=[("updated_at", 1)],
    )
    return row


async def set_messenger_status(
    db,
    messenger_id: str,
    status: str,
    *,
    active_sale_id: Optional[str] = None,
    active_delivery_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    normalized = normalize_messenger_status(status)
    patch: Dict[str, Any] = {
        "status": normalized,
        "updated_at": _now_iso(),
    }
    if active_sale_id is not None:
        patch["active_sale_id"] = active_sale_id
    if active_delivery_id is not None:
        patch["active_delivery_id"] = active_delivery_id
    if normalized == "disponible":
        patch["active_sale_id"] = None
        patch["active_delivery_id"] = None
    result = await db[COLLECTION].update_one(
        {"messenger_id": messenger_id},
        {"$set": patch},
    )
    if result.matched_count == 0:
        return None
    return await db[COLLECTION].find_one({"messenger_id": messenger_id}, {"_id": 0})


async def build_messenger_status_summary(db, *, branch_id: Optional[str] = None) -> Dict[str, Any]:
    rows = await list_messengers(db, branch_id=branch_id)
    by_branch: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        bid = str(row.get("branch_id") or "")
        by_branch.setdefault(bid, []).append(row)

    branches_payload: List[Dict[str, Any]] = []
    summary = {"disponible": 0, "en_ruta": 0, "libre": 0}
    for bid in (BRANCH_MAIN, BRANCH_NORTH, BRANCH_SOUTH):
        if branch_id and bid != branch_id:
            continue
        messengers = by_branch.get(bid, [])
        counts = {"disponible": 0, "en_ruta": 0, "libre": 0}
        for messenger in messengers:
            status = normalize_messenger_status(messenger.get("status"))
            counts[status] = counts.get(status, 0) + 1
            summary[status] = summary.get(status, 0) + 1
        branches_payload.append(
            {
                "branch_id": bid,
                "branch_name": BRANCH_LABELS.get(bid, bid),
                "messengers": messengers,
                "available_count": counts.get("disponible", 0),
                "on_route_count": counts.get("en_ruta", 0),
                "off_duty_count": counts.get("libre", 0),
            }
        )

    return {
        "branches": branches_payload,
        "summary": summary,
        "total_messengers": len(rows),
        "checked_at": _now_iso(),
    }