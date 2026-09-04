"""OCR circulation normalizer — no invented defaults, NI VIN lengths."""
import asyncio

from backend.domains.vehicles.circulation_ocr import (
    VISION_TIMEOUT_SEC,
    normalize_plate_nicaragua as normalize_plate,
    normalize_vin,
    process_circulation_card_v2,
    resolve_vehicle_type_slug,
    tesseract_binary_available,
)


def test_header_is_not_a_plate():
    plate, conf, review = normalize_plate("REPUBLICA DE NICARAGUA POLICIA NACIONAL")
    assert plate is None
    assert review is True


def test_valid_m_plate():
    plate, conf, review = normalize_plate("M 123456")
    assert plate.replace(" ", "").replace("-", "") == "M123456"
    assert review is False
    assert conf >= 0.9


def test_vin_iso_17():
    vin, conf, review = normalize_vin("3N1AB7AP4HY123456")
    assert vin == "3N1AB7AP4HY123456"
    assert review is False


def test_vin_ni_extended_not_truncated():
    raw = "WBAWX9107G0K0K05752"
    vin, conf, review = normalize_vin(raw)
    assert vin == raw
    assert len(vin) == 19


def test_vin_ioq_on_iso17_needs_review():
    vin, conf, review = normalize_vin("3N1AB7AP4HY12345I")
    assert vin is not None
    assert "I" not in vin
    assert review is True


def test_camioneta_station_is_suv():
    slug, label = resolve_vehicle_type_slug("CAMIONETA ST/WAGON", "RAV4")
    assert slug == "suv"


def test_camioneta_doble_cabina_is_pickup():
    slug, label = resolve_vehicle_type_slug("CAMIONETA D/CABINA", "HILUX")
    assert slug == "pickup"


def test_vision_timeout_budget():
    assert VISION_TIMEOUT_SEC <= 8.0


def test_tesseract_helper_bool():
    assert isinstance(tesseract_binary_available(), bool)


def test_process_header_does_not_invent_color_or_fuel():
    result = asyncio.run(
        process_circulation_card_v2(raw_text="REPUBLICA DE NICARAGUA\nEMISION 12/03/2024")
    )
    assert result.get("color") in (None, "", "No especificado")
    assert result.get("tipo_combustible") in (None, "", "No especificado")
    assert result.get("year") in (None, "", 0)
    assert result.get("color") != "Blanco"
    assert result.get("tipo_combustible") != "Gasolina"
