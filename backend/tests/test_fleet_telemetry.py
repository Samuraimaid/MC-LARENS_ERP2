"""Tests for branch fleet vehicle resolution in server dashboard telemetry."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.domains.vehicles.fleet_telemetry import (
    _format_fleet_display,
    _pick_active_driver,
    _resolve_vehicle_slug,
    resolve_branch_fleet_vehicle,
)


def test_pick_active_driver_prefers_en_ruta():
    drivers = [
        {"driver_id": "a", "driver_type": "delivery_last_mile", "status": "disponible"},
        {"driver_id": "b", "driver_type": "delivery_last_mile", "status": "en_ruta", "vehicle_plate": "M 100"},
    ]
    picked = _pick_active_driver(drivers)
    assert picked["driver_id"] == "b"


def test_resolve_vehicle_slug_from_catalog_fields():
    info = _resolve_vehicle_slug({
        "brand": "SUZUKI",
        "descriptor": "Swift (ZC33S) [2017-Presente]",
        "model": "Swift",
    })
    assert info["vehicle_type_slug"] == "hatchback"


def test_format_fleet_display():
    assert _format_fleet_display("Toyota", "Hilux", "M 123456") == "Toyota Hilux - Placa: M 123456"


def test_resolve_branch_fleet_vehicle_by_plate():
    import asyncio

    async def _run():
        vehicle_doc = {
            "vehicle_id": "veh_1",
            "brand": "Toyota",
            "model": "Hilux",
            "plate": "M 123456",
            "descriptor": "Hilux (AN120) [2015-Presente]",
            "vehicle_type_slug": "camioneta-cabina-y-media",
        }

        async def fake_aiter(_cursor):
            yield vehicle_doc

        cursor = MagicMock()
        cursor.limit.return_value = cursor
        cursor.__aiter__ = lambda self: fake_aiter(cursor)

        db = MagicMock()
        db.vehicles.find.return_value = cursor

        drivers = [{
            "driver_id": "drv_1",
            "branch_id": "branch_main",
            "driver_type": "delivery_last_mile",
            "status": "en_ruta",
            "vehicle_plate": "M 123456",
            "name": "Oscar",
            "last_name": "Membreño",
        }]

        result = await resolve_branch_fleet_vehicle(db, branch_id="branch_main", drivers=drivers)
        assert result["resolved"] is True
        assert result["brand"] == "Toyota"
        assert result["model"] == "Hilux"
        assert result["vehicle_type_slug"] == "camioneta-cabina-y-media"
        assert "Placa: M 123456" in (result["fleet_display"] or "")

    asyncio.run(_run())