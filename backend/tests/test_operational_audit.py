import asyncio

from backend.domains.sales.operational_audit import (
    _empty_operational_audit,
    _minutes_between,
    _sale_total_nio,
    build_operational_audit,
)


class _FakeCursor:
    def __init__(self, rows):
        self._rows = list(rows)

    async def to_list(self, _length=None):
        return list(self._rows)


class _FakeCollection:
    def __init__(self, rows=None, one=None, lookup=None):
        self._rows = rows or []
        self._one = one
        self._lookup = lookup or {}

    def find(self, _query, _projection=None):
        return _FakeCursor(self._rows)

    async def find_one(self, query, _projection=None):
        if isinstance(query, dict) and query.get("user_id"):
            return self._lookup.get(query.get("user_id")) or self._one
        if isinstance(query, dict) and "$or" in query:
            for clause in query["$or"]:
                name = clause.get("name")
                if name and name in self._lookup:
                    return self._lookup[name]
        return None if self._lookup else self._one


class _FakeDB:
    def __init__(self, **collections):
        for name, coll in collections.items():
            setattr(self, name, coll)


def test_empty_operational_audit_carryout_shape():
    audit = _empty_operational_audit("cust_1")
    assert audit["vehiculo"] is None
    assert audit["instalado_por"] is None
    assert audit["tiempo_espera_instalacion"] is None
    assert audit["has_workshop_flow"] is False
    assert audit["timeline"] == []


def test_sale_total_nio_usd_conversion():
    sale = {
        "currency": "USD",
        "exchange_rate": 36.5,
        "total": 100,
        "net_to_collect": 100,
    }
    assert _sale_total_nio(sale) == 3650.0


def test_minutes_between_iso_strings():
    assert _minutes_between("2026-07-16T10:00:00+00:00", "2026-07-16T10:14:00+00:00") == 14


def test_build_operational_audit_carryout_null_safe():
    db = _FakeDB(
        work_orders=_FakeCollection(),
        tint_orders=_FakeCollection(),
        dispatch_orders=_FakeCollection(one=None),
        vehicles=_FakeCollection(one=None),
        sales=_FakeCollection(
            rows=[
                {
                    "sale_id": "sale_carry",
                    "payment_status": "paid",
                    "total": 500,
                    "currency": "NIO",
                    "items": [{"product_name": "Cable USB", "quantity": 1}],
                }
            ]
        ),
    )
    sale = {
        "sale_id": "sale_carry",
        "customer_id": "cust_carry",
        "payment_status": "paid",
        "paid_at": "2026-07-16T10:00:00+00:00",
        "total": 500,
        "currency": "NIO",
        "items": [{"product_name": "Cable USB", "quantity": 1}],
    }
    audit = asyncio.run(build_operational_audit(db, sale))
    assert audit["has_workshop_flow"] is False
    assert audit["instalado_por"] is None
    assert audit["tiempo_ejecucion_taller"] is None
    assert audit["total_visitas_historicas"] == 1
    assert audit["ticket_promedio_nio"] == 500.0


def test_build_operational_audit_with_workshop_flow():
    db = _FakeDB(
        work_orders=_FakeCollection(
            rows=[
                {
                    "work_order_id": "wo_1",
                    "sale_id": "sale_ws",
                    "department": "instalaciones",
                    "technician_id": "tech_1",
                    "technician_name": "Carlos",
                    "vehicle_info": {
                        "brand": "Toyota",
                        "model": "Hilux",
                        "year": 2022,
                        "plate": "M123456",
                    },
                    "start_time": "2026-07-16T10:30:00+00:00",
                    "end_time": "2026-07-16T11:15:00+00:00",
                    "qc_approved_by_name": "Roberto",
                    "qc_approved_at": "2026-07-16T11:20:00+00:00",
                    "created_at": "2026-07-16T10:05:00+00:00",
                }
            ]
        ),
        tint_orders=_FakeCollection(),
        dispatch_orders=_FakeCollection(
            one={
                "sale_id": "sale_ws",
                "dispatchers": ["Juan"],
                "completed_at": "2026-07-16T10:20:00+00:00",
                "items": [{"delivered_by": "Juan", "delivered": True}],
            }
        ),
        vehicles=_FakeCollection(one=None),
        quality_controls=_FakeCollection(one=None),
        users=_FakeCollection(
            lookup={
                "tech_1": {"user_id": "tech_1", "name": "Carlos", "last_name": "Pérez"},
                "Carlos": {"user_id": "tech_1", "name": "Carlos", "last_name": "Pérez"},
            }
        ),
        sales=_FakeCollection(
            rows=[
                {
                    "sale_id": "sale_ws",
                    "payment_status": "paid",
                    "total": 2450,
                    "currency": "NIO",
                    "items": [{"product_name": "Polarizado 3M", "quantity": 1, "category": "tint"}],
                }
            ]
        ),
    )
    sale = {
        "sale_id": "sale_ws",
        "customer_id": "cust_ws",
        "payment_status": "paid",
        "paid_at": "2026-07-16T10:00:00+00:00",
        "total": 2450,
        "currency": "NIO",
    }
    audit = asyncio.run(build_operational_audit(db, sale))
    assert audit["has_workshop_flow"] is True
    assert audit["vehiculo"]["marca"] == "Toyota"
    assert audit["vehiculo"]["placa"] == "M123456"
    assert audit["tiempo_espera_instalacion"] == 30
    assert audit["tiempo_ejecucion_taller"] == 45
    assert audit["despachado_por_bodega"]["display_name"] == "Juan"
    assert audit["instalado_por"]["nombre"] == "Carlos"
    assert audit["control_calidad_por"]["display_name"] == "Roberto"
    assert len(audit["timeline"]) >= 3