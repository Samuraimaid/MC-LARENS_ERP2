"""IVA defaults and enforcement by customer type."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import HTTPException


def is_company_customer(customer: Optional[Dict[str, Any]]) -> bool:
    if not customer:
        return False
    ctype = str(customer.get("customer_type") or "").lower()
    return ctype in {"company", "empresa", "juridico", "jurídica", "juridica"}


def resolve_apply_iva_for_sale(
    customer: Optional[Dict[str, Any]],
    apply_iva_override: Optional[bool],
) -> bool:
    """Natural clients default to no IVA; company clients always require IVA."""
    if is_company_customer(customer):
        if apply_iva_override is False:
            raise HTTPException(
                status_code=400,
                detail="IVA obligatorio para clientes empresa/jurídicos",
            )
        return True
    if apply_iva_override is None:
        return False
    return bool(apply_iva_override)