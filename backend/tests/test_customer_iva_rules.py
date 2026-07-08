"""IVA defaults and enforcement by customer type."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.domains.sales.customer_tax_rules import resolve_apply_iva_for_sale


def test_natural_customer_defaults_to_no_iva():
    customer = {"customer_type": "natural"}
    assert resolve_apply_iva_for_sale(customer, None) is False


def test_natural_customer_can_opt_in_to_iva():
    customer = {"customer_type": "natural"}
    assert resolve_apply_iva_for_sale(customer, True) is True


def test_company_customer_always_requires_iva():
    customer = {"customer_type": "empresa"}
    assert resolve_apply_iva_for_sale(customer, None) is True
    assert resolve_apply_iva_for_sale(customer, True) is True


def test_company_customer_cannot_disable_iva():
    customer = {"customer_type": "empresa"}
    with pytest.raises(HTTPException) as exc:
        resolve_apply_iva_for_sale(customer, False)
    assert exc.value.status_code == 400
    assert "obligatorio" in str(exc.value.detail).lower()