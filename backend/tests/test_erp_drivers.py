"""Tests for unified erp_drivers domain."""
from __future__ import annotations

import pytest

from backend.domains.hr.drivers import (
    build_job_id,
    normalize_driver_status,
    normalize_driver_type,
    normalize_phone,
    _parse_job_id,
    _slug_driver_id,
)


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