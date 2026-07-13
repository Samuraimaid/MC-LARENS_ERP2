"""Tests for unified erp_drivers domain, delivery proof watermark and seller notifications."""
from __future__ import annotations

import asyncio
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock

import pytest
from PIL import Image

from backend.domains.hr.delivery_proof import (
    MANAGUA_LAT,
    MANAGUA_LON,
    build_delivery_proof_url,
    complete_delivery_with_proof,
    create_seller_delivery_notification,
    save_delivery_proof_bytes,
)
from backend.domains.hr.drivers import (
    build_job_id,
    normalize_driver_status,
    normalize_driver_type,
    normalize_phone,
    _parse_job_id,
    _slug_driver_id,
)
from backend.domains.media.watermark import apply_delivery_watermark, build_watermark_text
from backend.services.terabox_overview_service import build_terabox_overview


def _fake_jpeg_bytes() -> bytes:
    image = Image.new("RGB", (640, 480), color=(32, 64, 128))
    buf = BytesIO()
    image.save(buf, format="JPEG")
    return buf.getvalue()


def test_normalize_driver_type():
    assert normalize_driver_type("inter_branch_haul") == "inter_branch_haul"
    assert normalize_driver_type("invalid") == "delivery_last_mile"


def test_normalize_driver_status_aliases():
    assert normalize_driver_status("libre") == "fuera_turno"
    assert normalize_driver_status("en_ruta") == "en_ruta"


def test_normalize_phone_nicaragua():
    assert normalize_phone("8888-1201") == "+50588881201"
    assert normalize_phone("+50588881201") == "+50588881201"


def test_slug_driver_id_from_user():
    assert _slug_driver_id("user_oscar_membreno") == "drv_oscar_membreno"
    assert _slug_driver_id("transporte_norte").startswith("drv_")


def test_build_and_parse_job_id():
    assert build_job_id("delivery_sale", "sale_123") == "sale:sale_123"
    assert build_job_id("transfer_request", "TR-001") == "transfer:TR-001"
    assert _parse_job_id("sale:sale_123") == ("delivery_sale", "sale_123")
    assert _parse_job_id("transfer:TR-001") == ("transfer_request", "TR-001")


def test_watermark_text_managua_coordinates():
    text = build_watermark_text(latitude=MANAGUA_LAT, longitude=MANAGUA_LON)
    assert "MC-LARENS ERP" in text
    assert f"LAT {MANAGUA_LAT:.4f}" in text
    assert f"LON {MANAGUA_LON:.4f}" in text


def test_apply_delivery_watermark_changes_image_bytes(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCAL_UPLOAD_ROOT", str(tmp_path / "uploads"))
    raw = _fake_jpeg_bytes()
    stamped = apply_delivery_watermark(raw, latitude=MANAGUA_LAT, longitude=MANAGUA_LON)
    assert stamped
    assert len(stamped) > 1000
    assert stamped != raw


def test_save_delivery_proof_bytes_persists_file(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCAL_UPLOAD_ROOT", str(tmp_path / "uploads"))
    saved = save_delivery_proof_bytes(
        _fake_jpeg_bytes(),
        sale_id="sale_test_001",
        latitude=MANAGUA_LAT,
        longitude=MANAGUA_LON,
    )
    assert saved["image_id"].startswith("dlv_")
    assert (tmp_path / "uploads" / "deliveries" / f"{saved['image_id']}.jpg").exists()


def test_build_delivery_proof_url():
    url = build_delivery_proof_url("dlv_abc123", branch_id="branch_main")
    assert "/api/deliveries/media/dlv_abc123" in url


def test_create_seller_delivery_notification():
    db = MagicMock()
    db.hr_notifications = MagicMock()
    db.hr_notifications.insert_one = AsyncMock()

    sale = {
        "sale_id": "sale_test_001",
        "invoice_number": "FAC-9001",
        "seller_id": "user_ventas_01",
        "customer_name": "Cliente Demo",
    }
    driver = {"driver_id": "drv_demo", "name": "Oscar", "last_name": "Membreño"}
    doc = asyncio.run(create_seller_delivery_notification(
        db,
        sale=sale,
        driver=driver,
        proof_image_id="dlv_test123",
        proof_url="https://mclarenerp.com/api/deliveries/media/dlv_test123",
    ))

    assert doc is not None
    assert doc["user_id"] == "user_ventas_01"
    assert doc["category"] == "delivery"
    assert "FAC-9001" in doc["message"]
    db.hr_notifications.insert_one.assert_awaited_once()


def test_complete_delivery_with_proof_returns_200_payload(tmp_path, monkeypatch):
    upload_root = tmp_path / "uploads"
    monkeypatch.setenv("LOCAL_UPLOAD_ROOT", str(upload_root))

    sale = {
        "sale_id": "sale_test_001",
        "invoice_number": "FAC-9001",
        "seller_id": "user_ventas_01",
        "branch_id": "branch_main",
    }
    driver = {
        "driver_id": "drv_demo",
        "name": "Oscar",
        "last_name": "Membreño",
        "user_id": "user_transporte_01",
    }

    db = MagicMock()
    db.sales = MagicMock()
    db.sales.find_one = AsyncMock(return_value=sale)
    db.sales.update_one = AsyncMock()
    db.delivery_proofs = MagicMock()
    db.delivery_proofs.insert_one = AsyncMock()
    db.hr_notifications = MagicMock()
    db.hr_notifications.insert_one = AsyncMock()
    db.__getitem__ = MagicMock()

    async def _get_driver(db_conn, driver_id):
        return driver if driver_id == "drv_demo" else None

    async def _update_status(db_conn, sale_id, status, *, notes=None, driver_id=None):
        return {"job_id": f"sale:{sale_id}", "status": status, "entity_id": sale_id}

    monkeypatch.setattr("backend.domains.hr.delivery_proof.get_driver", _get_driver)
    monkeypatch.setattr("backend.domains.hr.delivery_proof.update_delivery_job_status", _update_status)

    result = asyncio.run(complete_delivery_with_proof(
        db,
        "sale_test_001",
        driver_id="drv_demo",
        image_bytes=_fake_jpeg_bytes(),
        latitude=MANAGUA_LAT,
        longitude=MANAGUA_LON,
        notes="Entrega en terminal",
    ))

    assert result["proof_image_id"].startswith("dlv_")
    assert result["notification"]["user_id"] == "user_ventas_01"
    assert result["job"]["status"] == "entregado"
    db.hr_notifications.insert_one.assert_awaited_once()


def test_terabox_overview_structure(monkeypatch):
    monkeypatch.delenv("TERABOX_USERNAME", raising=False)
    monkeypatch.delenv("TERABOX_PASSWORD", raising=False)
    overview = build_terabox_overview()
    assert overview["total_space_bytes"] == 1_099_511_627_776
    assert "used_space_bytes" in overview
    assert "available_space_bytes" in overview
    assert "used_percentage" in overview
    assert len(overview["folders"]) == 3
    names = {row["name"] for row in overview["folders"]}
    assert "/productos" in names
    assert "/evidencias_taller" in names
    assert "/backups_sistema" in names