from backend.domains.ui.tutorials import (
    get_full_curriculum,
    get_tutorial_module,
    get_tutorials_catalog,
)


def test_catalog_has_seller_modules():
    catalog = get_tutorials_catalog()
    assert catalog["total_modules"] >= 10
    assert catalog["estimated_minutes"] > 30
    assert catalog["modules"][0]["order"] == 1
    assert "opinion" in catalog
    assert catalog["golden_rules"]


def test_module_detail_has_procedure_and_scenarios():
    module = get_tutorial_module("09-pago-y-envio-caja")
    assert module is not None
    assert len(module["steps"]) >= 3
    assert any("caja" in s["title"].lower() or "caja" in s["detail"].lower() for s in module["steps"])
    assert module["scenarios"]


def test_full_curriculum_includes_steps():
    full = get_full_curriculum()
    assert "modules_full" in full
    first = full["modules_full"][0]
    assert "steps" in first
    assert first["image"].startswith("/tutorials/")


def test_unknown_module_returns_none():
    assert get_tutorial_module("no-existe") is None
