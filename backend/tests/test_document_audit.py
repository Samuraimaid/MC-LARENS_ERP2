from backend.domains.pricing.document_audit import (
    build_tier_change_event,
    merge_audit_events,
    sanitize_document_for_print,
)


def test_sanitize_document_for_print_strips_audit():
    doc = {
        "sale_id": "sale_1",
        "invoice_number": "INV-1",
        "audit_events": [{"event_type": "tier_change"}],
        "items": [{"product_id": "p1", "price_edit_history": [100, 90]}],
    }
    clean = sanitize_document_for_print(doc)
    assert "audit_events" not in clean
    assert "price_edit_history" not in clean["items"][0]


def test_merge_audit_events_dedupes():
    events = [
        {"event_id": "evt_1", "event_type": "tier_change"},
        {"event_id": "evt_1", "event_type": "tier_change"},
        {"event_id": "evt_2", "event_type": "line_price_edit"},
    ]
    merged = merge_audit_events([], events)
    assert len(merged) == 2


def test_build_tier_change_event():
    event = build_tier_change_event(
        actor={"user_id": "u1", "name": "Patricia", "role": "supervisor"},
        from_tier="precio1",
        to_tier="precio_vip",
        from_label="Precio 1",
        to_label="Precio VIP",
    )
    assert event["event_type"] == "tier_change"
    assert event["visible_on_print"] is False
    assert event["details"]["to_tier"] == "precio_vip"