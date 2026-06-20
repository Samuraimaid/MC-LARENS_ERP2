from __future__ import annotations

from typing import Any, Tuple

from fastapi import HTTPException


def get_stripe_checkout_symbols() -> Tuple[Any, Any]:
    try:
        from emergentintegrations.payments.stripe.checkout import (  # type: ignore[import]
            CheckoutSessionRequest,
            StripeCheckout,
        )
    except Exception as exc:
        raise HTTPException(status_code=501, detail="Stripe integration not available") from exc
    return CheckoutSessionRequest, StripeCheckout


def create_stripe_checkout(api_key: str, webhook_url: str) -> Any:
    _, stripe_checkout_cls = get_stripe_checkout_symbols()
    return stripe_checkout_cls(api_key=api_key, webhook_url=webhook_url)
