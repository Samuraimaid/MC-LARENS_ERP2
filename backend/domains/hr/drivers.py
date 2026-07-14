"""Unified ERP drivers — delivery last mile and inter-branch haul."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

DRIVER_COLLECTION = "erp_drivers"
TOKEN_COLLECTION = "erp_driver_auth_tokens"

DRIVER_TYPES = frozenset({"delivery_last_mile", "inter_branch_haul"})
DRIVER_STATUSES = frozenset({"disponible", "en_ruta", "fuera_turno"})
TRANSPORT_USER_ROLES = frozenset({"transporte", "entregador"})

JOB_TYPES = frozenset({"delivery_sale", "transfer_request"})

STATUS_LABELS_ES = {
    "disponible": "Disponible",
    "en_ruta": "En ruta",
    "fuera_turno": "Fuera de turno",
}

DEFAULT_DRIVERS: List[Dict[str, Any]] = [
    {
        "driver_id": "drv_mundo_delivery_oscar",
        "driver_type": "delivery_last_mile",
        "name": "Oscar Javier",
        "last_name": "Membreño",
        "branch_id": "branch_main",
        "phone": "+50588881201",
        "vehicle_plate": "M 123456",
        "status": "disponible",
        "legacy_messenger_id": "msg_mundo_oscar_membreno",
    },
    {
        "driver_id": "drv_north_delivery_erick",
        "driver_type": "delivery_last_mile",
        "name": "Erick",
        "last_name": "Gutiérrez",
        "branch_id": "branch_north",
        "phone": "+50588882201",
        "vehicle_plate": "M 234567",
        "status": "disponible",
        "legacy_messenger_id": "msg_topcar_north_erick_gutierrez",
    },
    {
        "driver_id": "drv_south_delivery_denis",
        "driver_type": "delivery_last_mile",
        "name": "Denis",
        "last_name": "Altamirano",
        "branch_id": "branch_south",
        "phone": "+50588883301",
        "vehicle_plate": "M 345678",
        "status": "disponible",
        "legacy_messenger_id": "msg_topcar_south_denis_altamirano",
    },
    {
        "driver_id": "drv_main_haul_truck",
        "driver_type": "inter_branch_haul",
        "name": "Camión",
        "last_name": "Traslados Matriz",
        "branch_id": "branch_main",
        "phone": "+50588881000",
        "vehicle_plate": "M 900001",
        "status": "disponible",
    },
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_driver_type(value: Any) -> str:
    raw = str(value or "delivery_last_mile").strip().lower()
    return raw if raw in DRIVER_TYPES else "delivery_last_mile"


def normalize_driver_status(value: Any) -> str:
    raw = str(value or "disponible").strip().lower()
    aliases = {"libre": "fuera_turno", "off_duty": "fuera_turno", "on_route": "en_ruta"}
    raw = aliases.get(raw, raw)
    return raw if raw in DRIVER_STATUSES else "disponible"


def normalize_phone(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if raw.startswith("+") and digits:
        return f"+{digits}"
    if digits.startswith("505"):
        return f"+{digits}"
    if len(digits) == 8:
        return f"+505{digits}"
    return raw


async def ensure_erp_drivers(db) -> List[Dict[str, Any]]:
    collection = db[DRIVER_COLLECTION]
    seeded: List[Dict[str, Any]] = []
    for template in DEFAULT_DRIVERS:
        driver_id = str(template["driver_id"])
        existing = await collection.find_one({"driver_id": driver_id}, {"_id": 0})
        if existing:
            seeded.append(existing)
            continue
        doc = {
            **template,
            "driver_type": normalize_driver_type(template.get("driver_type")),
            "status": normalize_driver_status(template.get("status")),
            "user_id": template.get("user_id"),
            "phone": normalize_phone(template.get("phone")),
            "active_job_id": None,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        await collection.update_one({"driver_id": driver_id}, {"$set": doc}, upsert=True)
        seeded.append(doc)
    return seeded


async def list_drivers(
    db,
    *,
    branch_id: Optional[str] = None,
    driver_type: Optional[str] = None,
    status: Optional[str] = None,
) -> List[Dict[str, Any]]:
    await ensure_erp_drivers(db)
    query: Dict[str, Any] = {}
    if branch_id:
        query["branch_id"] = branch_id
    if driver_type:
        query["driver_type"] = normalize_driver_type(driver_type)
    if status:
        query["status"] = normalize_driver_status(status)
    rows = await db[DRIVER_COLLECTION].find(query, {"_id": 0}).sort("driver_id", 1).to_list(100)
    for row in rows:
        row["status_label"] = STATUS_LABELS_ES.get(normalize_driver_status(row.get("status")), row.get("status"))
    return rows


async def get_driver(db, driver_id: str) -> Optional[Dict[str, Any]]:
    await ensure_erp_drivers(db)
    return await db[DRIVER_COLLECTION].find_one({"driver_id": driver_id}, {"_id": 0})


async def get_driver_by_user_id(db, user_id: str) -> Optional[Dict[str, Any]]:
    if not user_id:
        return None
    await ensure_erp_drivers(db)
    return await db[DRIVER_COLLECTION].find_one({"user_id": user_id}, {"_id": 0})


class DriverValidationError(ValueError):
    """Raised when driver create/update payload fails validation."""


def _slug_driver_id(user_id: str) -> str:
    raw = str(user_id or "").strip().lower()
    if raw.startswith("user_"):
        return f"drv_{raw[5:]}"
    safe = "".join(ch if ch.isalnum() or ch in {"_", "-"} else "_" for ch in raw)
    return f"drv_{safe or 'conductor'}"


async def _validate_transport_user(db, user_id: str) -> Dict[str, Any]:
    uid = str(user_id or "").strip()
    if not uid:
        raise DriverValidationError("user_id requerido")
    user = await db.users.find_one({"user_id": uid}, {"_id": 0, "user_id": 1, "role": 1, "name": 1, "last_name": 1, "branch_id": 1})
    if not user:
        raise DriverValidationError("Usuario no encontrado")
    role = str(user.get("role") or "").strip().lower()
    if role not in TRANSPORT_USER_ROLES:
        raise DriverValidationError("El usuario debe tener rol transporte o entregador")
    return user


async def _ensure_user_not_linked(db, user_id: str, *, exclude_driver_id: Optional[str] = None) -> None:
    existing = await get_driver_by_user_id(db, user_id)
    if existing and str(existing.get("driver_id")) != str(exclude_driver_id or ""):
        raise DriverValidationError("El usuario ya está vinculado a otro conductor")


async def create_driver(db, payload: Dict[str, Any]) -> Dict[str, Any]:
    await ensure_erp_drivers(db)
    data = payload or {}
    user = await _validate_transport_user(db, data.get("user_id"))
    user_id = str(user["user_id"])
    await _ensure_user_not_linked(db, user_id)

    driver_type = normalize_driver_type(data.get("driver_type"))
    branch_id = str(data.get("branch_id") or user.get("branch_id") or "").strip()
    if not branch_id:
        raise DriverValidationError("branch_id requerido")

    phone = normalize_phone(data.get("phone"))
    if not phone:
        raise DriverValidationError("Teléfono celular requerido (+505...)")

    vehicle_plate = str(data.get("vehicle_plate") or "").strip()
    if not vehicle_plate:
        raise DriverValidationError("Placa del vehículo requerida")
    vehicle_id = str(data.get("vehicle_id") or "").strip() or None

    driver_id = str(data.get("driver_id") or "").strip() or _slug_driver_id(user_id)
    if await get_driver(db, driver_id):
        raise DriverValidationError("Ya existe un conductor con ese identificador")

    name = str(data.get("name") or user.get("name") or "").strip()
    last_name = str(data.get("last_name") or user.get("last_name") or "").strip()
    doc = {
        "driver_id": driver_id,
        "driver_type": driver_type,
        "name": name,
        "last_name": last_name,
        "branch_id": branch_id,
        "phone": phone,
        "vehicle_plate": vehicle_plate,
        "vehicle_id": vehicle_id,
        "status": normalize_driver_status(data.get("status")),
        "user_id": user_id,
        "active_job_id": None,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db[DRIVER_COLLECTION].insert_one(doc)
    doc["status_label"] = STATUS_LABELS_ES.get(doc["status"], doc["status"])
    return doc


async def update_driver(db, driver_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    await ensure_erp_drivers(db)
    existing = await get_driver(db, driver_id)
    if not existing:
        return None

    data = payload or {}
    patch: Dict[str, Any] = {"updated_at": _now_iso()}

    if "user_id" in data:
        user_id = str(data.get("user_id") or "").strip()
        if user_id:
            await _validate_transport_user(db, user_id)
            await _ensure_user_not_linked(db, user_id, exclude_driver_id=driver_id)
            patch["user_id"] = user_id
        else:
            patch["user_id"] = None

    if "driver_type" in data:
        patch["driver_type"] = normalize_driver_type(data.get("driver_type"))

    if "branch_id" in data:
        branch_id = str(data.get("branch_id") or "").strip()
        if not branch_id:
            raise DriverValidationError("branch_id requerido")
        patch["branch_id"] = branch_id

    if "phone" in data:
        phone = normalize_phone(data.get("phone"))
        if not phone:
            raise DriverValidationError("Teléfono celular requerido (+505...)")
        patch["phone"] = phone

    if "vehicle_plate" in data:
        vehicle_plate = str(data.get("vehicle_plate") or "").strip()
        if not vehicle_plate:
            raise DriverValidationError("Placa del vehículo requerida")
        patch["vehicle_plate"] = vehicle_plate

    if "vehicle_id" in data:
        vehicle_id = str(data.get("vehicle_id") or "").strip()
        patch["vehicle_id"] = vehicle_id or None

    if "status" in data:
        patch["status"] = normalize_driver_status(data.get("status"))

    if "name" in data:
        patch["name"] = str(data.get("name") or "").strip()
    if "last_name" in data:
        patch["last_name"] = str(data.get("last_name") or "").strip()

    await db[DRIVER_COLLECTION].update_one({"driver_id": driver_id}, {"$set": patch})
    updated = await get_driver(db, driver_id)
    if updated:
        updated["status_label"] = STATUS_LABELS_ES.get(
            normalize_driver_status(updated.get("status")),
            updated.get("status"),
        )
    return updated


async def assign_driver_user(db, driver_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    result = await db[DRIVER_COLLECTION].update_one(
        {"driver_id": driver_id},
        {"$set": {"user_id": user_id, "updated_at": _now_iso()}},
    )
    if result.matched_count == 0:
        return None
    return await get_driver(db, driver_id)


async def set_driver_status(
    db,
    driver_id: str,
    status: str,
    *,
    active_job_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    normalized = normalize_driver_status(status)
    patch: Dict[str, Any] = {"status": normalized, "updated_at": _now_iso()}
    if active_job_id is not None:
        patch["active_job_id"] = active_job_id
    if normalized == "disponible":
        patch["active_job_id"] = None
    result = await db[DRIVER_COLLECTION].update_one({"driver_id": driver_id}, {"$set": patch})
    if result.matched_count == 0:
        return None
    return await get_driver(db, driver_id)


def _parse_job_id(job_id: str) -> tuple[str, str]:
    raw = str(job_id or "").strip()
    if raw.startswith("sale:"):
        return "delivery_sale", raw.split(":", 1)[1]
    if raw.startswith("transfer:"):
        return "transfer_request", raw.split(":", 1)[1]
    if raw.startswith("TR-"):
        return "transfer_request", raw
    return "delivery_sale", raw


def build_job_id(job_type: str, entity_id: str) -> str:
    jt = str(job_type or "").strip().lower()
    eid = str(entity_id or "").strip()
    if jt == "transfer_request":
        return f"transfer:{eid}"
    return f"sale:{eid}"


async def create_driver_auth_token(
    db,
    job_id: str,
    *,
    created_by: Optional[str] = None,
    ttl_minutes: int = 30,
) -> Dict[str, Any]:
    job_type, entity_id = _parse_job_id(job_id)
    token = secrets.token_urlsafe(24)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(minutes=ttl_minutes)).isoformat()
    doc = {
        "token_hash": token_hash,
        "job_id": build_job_id(job_type, entity_id),
        "job_type": job_type,
        "entity_id": entity_id,
        "created_by": created_by,
        "created_at": now.isoformat(),
        "expires_at": expires_at,
        "consumed_at": None,
        "consumed_by_user_id": None,
    }
    await db[TOKEN_COLLECTION].insert_one(doc)
    return {
        "token": token,
        "job_id": doc["job_id"],
        "job_type": job_type,
        "entity_id": entity_id,
        "expires_at": expires_at,
        "deep_link_path": f"/driver?token={token}",
    }


async def resolve_driver_auth_token(db, token: str) -> Optional[Dict[str, Any]]:
    if not token:
        return None
    token_hash = hashlib.sha256(token.strip().encode("utf-8")).hexdigest()
    row = await db[TOKEN_COLLECTION].find_one({"token_hash": token_hash}, {"_id": 0})
    if not row:
        return None
    if row.get("consumed_at"):
        return None
    expires_raw = row.get("expires_at")
    if expires_raw:
        try:
            expires_dt = datetime.fromisoformat(str(expires_raw).replace("Z", "+00:00"))
            if expires_dt.tzinfo is None:
                expires_dt = expires_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expires_dt:
                return None
        except ValueError:
            pass
    return row


async def consume_driver_auth_token(db, token: str, user_id: str) -> Optional[Dict[str, Any]]:
    row = await resolve_driver_auth_token(db, token)
    if not row:
        return None
    token_hash = row["token_hash"]
    await db[TOKEN_COLLECTION].update_one(
        {"token_hash": token_hash},
        {"$set": {"consumed_at": _now_iso(), "consumed_by_user_id": user_id}},
    )
    return row


async def _load_delivery_job(db, sale_id: str) -> Optional[Dict[str, Any]]:
    sale = await db.sales.find_one({"sale_id": sale_id}, {"_id": 0})
    if not sale:
        return None
    info = sale.get("delivery_info") or {}
    if not info.get("is_delivery") and not sale.get("delivery_required"):
        return None
    dest_type = str(info.get("destination_type") or "domicilio")
    dest_label = "Domicilio" if dest_type == "domicilio" else "Terminal de buses"
    return {
        "job_id": build_job_id("delivery_sale", sale_id),
        "job_type": "delivery_sale",
        "entity_id": sale_id,
        "title": f"Entrega {sale.get('invoice_number') or sale_id}",
        "status": str(info.get("delivery_status") or sale.get("delivery_status") or "pendiente"),
        "customer_name": sale.get("customer_name"),
        "destination_label": dest_label,
        "destination_type": dest_type,
        "delivery_address": sale.get("delivery_address") or info.get("delivery_address"),
        "total": sale.get("total"),
        "assigned_driver_id": info.get("driver_id") or sale.get("assigned_driver_id"),
        "branch_id": sale.get("branch_id"),
        "created_at": sale.get("created_at"),
        "notes": sale.get("delivery_notes"),
    }


async def _load_transfer_job(db, request_id: str) -> Optional[Dict[str, Any]]:
    row = await db.transfer_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not row:
        return None
    return {
        "job_id": build_job_id("transfer_request", request_id),
        "job_type": "transfer_request",
        "entity_id": request_id,
        "title": f"Traslado {request_id}",
        "status": row.get("status"),
        "product_id": row.get("product_id"),
        "quantity": row.get("quantity"),
        "from_warehouse_id": row.get("from_warehouse_id"),
        "to_warehouse_id": row.get("to_warehouse_id"),
        "assigned_driver_id": row.get("assigned_driver_id"),
        "branch_id": row.get("branch_id"),
        "created_at": row.get("created_at"),
        "notes": row.get("notes"),
    }


async def load_job_detail(db, job_id: str) -> Optional[Dict[str, Any]]:
    job_type, entity_id = _parse_job_id(job_id)
    if job_type == "transfer_request":
        return await _load_transfer_job(db, entity_id)
    return await _load_delivery_job(db, entity_id)


async def list_driver_jobs(
    db,
    driver: Dict[str, Any],
    *,
    include_completed: bool = True,
) -> Dict[str, Any]:
    driver_id = str(driver.get("driver_id") or "")
    user_id = str(driver.get("user_id") or "")
    driver_type = normalize_driver_type(driver.get("driver_type"))
    branch_id = str(driver.get("branch_id") or "")

    pending: List[Dict[str, Any]] = []
    active: List[Dict[str, Any]] = []
    completed: List[Dict[str, Any]] = []

    if driver_type == "delivery_last_mile":
        query: Dict[str, Any] = {
            "$or": [
                {"delivery_info.is_delivery": True},
                {"delivery_required": True},
            ],
        }
        if branch_id:
            query["branch_id"] = branch_id
        sales = await db.sales.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
        for sale in sales:
            info = sale.get("delivery_info") or {}
            assigned = info.get("driver_id") or sale.get("assigned_driver_id") or info.get("messenger_id")
            if assigned and assigned not in {driver_id, user_id, info.get("messenger_id")}:
                continue
            job = await _load_delivery_job(db, sale["sale_id"])
            if not job:
                continue
            status = str(job.get("status") or "").lower()
            if status in {"entregado", "delivered", "completado"}:
                if include_completed:
                    completed.append(job)
            elif status in {"en_ruta", "in_transit", "assigned", "asignado"}:
                active.append(job)
            else:
                pending.append(job)
    else:
        transfer_query: Dict[str, Any] = {
            "status": {"$in": ["approved", "shipped", "received"]},
        }
        if branch_id:
            transfer_query["$or"] = [
                {"branch_id": branch_id},
                {"assigned_driver_id": driver_id},
            ]
        transfers = await db.transfer_requests.find(transfer_query, {"_id": 0}).sort("created_at", -1).to_list(200)
        for row in transfers:
            assigned = row.get("assigned_driver_id")
            if assigned and assigned != driver_id:
                continue
            job = await _load_transfer_job(db, row["request_id"])
            if not job:
                continue
            status = str(job.get("status") or "").lower()
            if status == "received":
                if include_completed:
                    completed.append(job)
            elif status == "shipped":
                active.append(job)
            else:
                pending.append(job)

    return {
        "driver_id": driver_id,
        "driver_type": driver_type,
        "pending": pending,
        "active": active,
        "completed": completed[:50],
    }


async def update_delivery_job_status(
    db,
    sale_id: str,
    status: str,
    *,
    notes: Optional[str] = None,
    driver_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    sale = await db.sales.find_one({"sale_id": sale_id}, {"_id": 0})
    if not sale:
        return None
    now = _now_iso()
    normalized = str(status or "").strip().lower()
    patch: Dict[str, Any] = {
        "delivery_status": normalized,
        "delivery_info.delivery_status": normalized,
        "updated_at": now,
    }
    if notes:
        patch["delivery_notes"] = notes
    if driver_id:
        patch["assigned_driver_id"] = driver_id
        patch["delivery_info.driver_id"] = driver_id
    if normalized in {"entregado", "delivered"}:
        patch["delivery_completed_at"] = now
    await db.sales.update_one({"sale_id": sale_id}, {"$set": patch})
    if driver_id:
        await set_driver_status(db, driver_id, "disponible" if normalized in {"entregado", "delivered"} else "en_ruta", active_job_id=None if normalized in {"entregado", "delivered"} else build_job_id("delivery_sale", sale_id))
    return await _load_delivery_job(db, sale_id)


async def update_transfer_job_status(
    db,
    request_id: str,
    action: str,
    *,
    driver_id: Optional[str] = None,
    background_sync=None,
) -> Optional[Dict[str, Any]]:
    action_norm = str(action or "").strip().lower()
    row = await db.transfer_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not row:
        return None
    now = _now_iso()
    current = str(row.get("status") or "")

    if action_norm in {"salida_origen", "ship", "shipped"} and current == "approved":
        await db.transfer_requests.update_one(
            {"request_id": request_id},
            {"$set": {"status": "shipped", "shipped_at": now, "assigned_driver_id": driver_id or row.get("assigned_driver_id")}},
        )
        if driver_id:
            await set_driver_status(db, driver_id, "en_ruta", active_job_id=build_job_id("transfer_request", request_id))
    elif action_norm in {"en_transito", "in_transit"} and current in {"approved", "shipped"}:
        await db.transfer_requests.update_one(
            {"request_id": request_id},
            {"$set": {"status": "shipped", "in_transit_at": now}},
        )
        if driver_id:
            await set_driver_status(db, driver_id, "en_ruta", active_job_id=build_job_id("transfer_request", request_id))
    elif action_norm in {"recibido", "receive", "received"} and current == "shipped":
        await db.transfer_requests.update_one(
            {"request_id": request_id},
            {"$set": {"status": "received", "received_at": now}},
        )
        if driver_id:
            await set_driver_status(db, driver_id, "disponible", active_job_id=None)
        if background_sync:
            background_sync(product_id=row.get("product_id"), warehouse_id=row.get("to_warehouse_id"))
    else:
        return None
    return await _load_transfer_job(db, request_id)