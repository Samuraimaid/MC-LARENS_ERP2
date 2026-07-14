"""Tests for sale price policy validation."""
from __future__ import annotations

import asyncio

import pytest

from backend.domains.pricing.price_tiers import APPROVAL_TYPE_PRECIO2, TIER_PRECIO2
from backend.domains.pricing.sale_price_policy import (
    SalePricePolicyError,
    validate_precio2_approval,
    validate_sale_items_pricing,
)


class FakeCollection:
    def __init__(self, docs):
        self._docs = list(docs)

    async def find_one(self, query, projection=None):
        for key, value in query.items():
            if key == "_id":
                continue
            for doc in self._docs:
                if doc.get(key) == value:
                    return dict(doc)
        return None


class FakeDB:
    def __init__(self, products=None, approvals=None):
        self.products = FakeCollection(products or [])
        self.approvals = FakeCollection(approvals or [])


PRODUCT = {
    "product_id": "prod_test",
    "name": "Test Product",
    "price": 100.0,
    "precio1": 100.0,
    "precio2": 95.0,
    "precio_vip": 88.0,
    "precio_casa_comercial": 82.0,
    "precio3": 82.0,
}


def test_validate_sale_blocks_casa_comercial_for_piso_seller():
    db = FakeDB(products=[PRODUCT])
    user = {"user_id": "user_1", "role": "ventas", "seller_type": "piso"}
    customer = {"customer_id": "cust_1", "pricing_profile": "casa_comercial"}

    async def run():
        with pytest.raises(SalePricePolicyError) as exc:
            await validate_sale_items_pricing(
                db,
                user=user,
                customer=customer,
                items=[{"product_id": "prod_test", "unit_price": 82.0, "quantity": 1}],
            )
        assert exc.value.status_code == 403

    asyncio.run(run())


def test_precio2_requires_approval_for_ventas():
    db = FakeDB(products=[PRODUCT])
    user = {"user_id": "user_1", "role": "ventas", "seller_type": "piso"}
    customer = {"customer_id": "cust_1", "pricing_profile": "standard"}

    async def run():
        with pytest.raises(SalePricePolicyError) as exc:
            await validate_sale_items_pricing(
                db,
                user=user,
                customer=customer,
                items=[{"product_id": "prod_test", "unit_price": 95.0, "quantity": 1}],
            )
        assert "Precio 2" in str(exc.value)

    asyncio.run(run())


def test_precio2_with_valid_approval_passes():
    db = FakeDB(
        products=[PRODUCT],
        approvals=[{
            "approval_id": "appr_1",
            "type": APPROVAL_TYPE_PRECIO2,
            "status": "approved",
            "requester_id": "user_1",
            "payload": {
                "customer_id": "cust_1",
                "items": [{"product_id": "prod_test", "unit_price": 95.0}],
            },
        }],
    )
    user = {"user_id": "user_1", "role": "ventas", "seller_type": "piso"}
    customer = {"customer_id": "cust_1", "pricing_profile": "standard"}

    async def run():
        result = await validate_sale_items_pricing(
            db,
            user=user,
            customer=customer,
            items=[{"product_id": "prod_test", "unit_price": 95.0, "quantity": 1}],
            precio2_approval_id="appr_1",
        )
        assert result[0]["price_tier"] == TIER_PRECIO2

    asyncio.run(run())


def test_validate_precio2_approval_rejects_mismatched_price():
    db = FakeDB(
        approvals=[{
            "approval_id": "appr_1",
            "type": APPROVAL_TYPE_PRECIO2,
            "status": "approved",
            "requester_id": "user_1",
            "payload": {
                "customer_id": "cust_1",
                "items": [{"product_id": "prod_test", "unit_price": 95.0}],
            },
        }],
    )

    async def run():
        with pytest.raises(SalePricePolicyError):
            await validate_precio2_approval(
                db,
                approval_id="appr_1",
                requester_id="user_1",
                customer_id="cust_1",
                items=[{"product_id": "prod_test", "unit_price": 90.0}],
            )

    asyncio.run(run())