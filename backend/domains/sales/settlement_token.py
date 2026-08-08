"""Short-lived signed settlement tokens so clients use server totals for payment plans."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any, Dict, Optional, Tuple


DEFAULT_TTL_SECONDS = 15 * 60


def _secret() -> bytes:
    raw = (
        os.environ.get("SETTLEMENT_TOKEN_SECRET")
        or os.environ.get("JWT_SECRET")
        or os.environ.get("SECRET_KEY")
        or "mc-larens-settlement-dev-secret"
    )
    return str(raw).encode("utf-8")


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(raw: str) -> bytes:
    pad = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(raw + pad)


def issue_settlement_token(
    payload: Dict[str, Any],
    *,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> str:
    body = dict(payload or {})
    now = int(time.time())
    body["iat"] = now
    body["exp"] = now + max(30, int(ttl_seconds or DEFAULT_TTL_SECONDS))
    raw = json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = hmac.new(_secret(), raw, hashlib.sha256).digest()
    return f"{_b64url_encode(raw)}.{_b64url_encode(sig)}"


def verify_settlement_token(token: str) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    text = str(token or "").strip()
    if not text or "." not in text:
        return False, None, "token_invalid"
    try:
        raw_b64, sig_b64 = text.split(".", 1)
        raw = _b64url_decode(raw_b64)
        sig = _b64url_decode(sig_b64)
    except Exception:
        return False, None, "token_malformed"

    expected = hmac.new(_secret(), raw, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        return False, None, "token_signature"

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        return False, None, "token_payload"

    if not isinstance(payload, dict):
        return False, None, "token_payload"

    exp = int(payload.get("exp") or 0)
    if exp < int(time.time()):
        return False, None, "token_expired"

    return True, payload, "ok"


def build_money_snapshot(
    *,
    amount: float,
    currency: str,
    exchange_rate: Optional[float] = None,
    catalog_amount_usd: Optional[float] = None,
) -> Dict[str, Any]:
    code = str(currency or "NIO").strip().upper() or "NIO"
    rate = float(exchange_rate or 0) or None
    snap: Dict[str, Any] = {
        "amount": round(float(amount or 0), 2),
        "currency": code,
        "exchange_rate": rate,
        "catalog_currency": "USD",
    }
    if catalog_amount_usd is not None:
        snap["catalog_amount_usd"] = round(float(catalog_amount_usd or 0), 2)
    return snap
