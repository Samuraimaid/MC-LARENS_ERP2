from backend.domains.sales.settlement_token import (
    build_money_snapshot,
    issue_settlement_token,
    verify_settlement_token,
)


def test_settlement_token_roundtrip():
    token = issue_settlement_token(
        {
            "customer_id": "cust_1",
            "net_to_collect": 1234.56,
            "currency": "NIO",
        },
        ttl_seconds=120,
    )
    ok, payload, reason = verify_settlement_token(token)
    assert ok is True
    assert reason == "ok"
    assert payload is not None
    assert payload["customer_id"] == "cust_1"
    assert abs(float(payload["net_to_collect"]) - 1234.56) < 0.001


def test_settlement_token_rejects_tamper():
    token = issue_settlement_token({"net_to_collect": 10.0})
    bad = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
    ok, payload, reason = verify_settlement_token(bad)
    assert ok is False
    assert payload is None
    assert reason in {"token_signature", "token_malformed", "token_payload"}


def test_money_snapshot_shape():
    snap = build_money_snapshot(
        amount=100.5,
        currency="NIO",
        exchange_rate=36.5,
        catalog_amount_usd=2.75,
    )
    assert snap["amount"] == 100.5
    assert snap["currency"] == "NIO"
    assert snap["catalog_currency"] == "USD"
    assert snap["catalog_amount_usd"] == 2.75
