"""Unit tests for editable dialog messages catalog."""
from backend.domains.ui.dialog_messages import (
    DEFAULT_DIALOG_MESSAGES,
    merge_dialog_messages,
    normalize_message_patch,
    serialize_dialog_catalog,
)


def test_defaults_include_send_to_cashier():
    assert "sale.send_to_cashier" in DEFAULT_DIALOG_MESSAGES
    assert DEFAULT_DIALOG_MESSAGES["sale.send_to_cashier"]["title"]


def test_merge_overrides_title_only():
    merged = merge_dialog_messages({
        "sale.send_to_cashier": {"title": "Confirmar envío a caja"},
    })
    assert merged["sale.send_to_cashier"]["title"] == "Confirmar envío a caja"
    # description stays default
    assert "productos" in merged["sale.send_to_cashier"]["description"].lower() or "verificar" in merged["sale.send_to_cashier"]["description"].lower() or len(merged["sale.send_to_cashier"]["description"]) > 10


def test_normalize_patch_checklist_from_string():
    patch = normalize_message_patch({
        "checklist": "Uno\nDos\n\nTres",
        "title": "  Hola  ",
        "bogus": "x",
    })
    assert patch["title"] == "Hola"
    assert patch["checklist"] == ["Uno", "Dos", "Tres"]
    assert "bogus" not in patch


def test_serialize_marks_customized():
    catalog = serialize_dialog_catalog({
        "sale.clear_form": {"title": "Limpiar ahora"},
    })
    row = catalog["by_key"]["sale.clear_form"]
    assert row["is_customized"] is True
    assert catalog["count"] == len(DEFAULT_DIALOG_MESSAGES)
