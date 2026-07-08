"""Blind product intake contract: quantity-only items, no supplier/cost fields."""

from __future__ import annotations

from pydantic import BaseModel, Field
from typing import List


class BlindReceiptItem(BaseModel):
    product_id: str
    quantity: int


class BlindReceiptPayload(BaseModel):
    warehouse_id: str
    items: List[BlindReceiptItem] = Field(default_factory=list)


def test_blind_receipt_payload_accepts_quantity_only():
    payload = BlindReceiptPayload(
        warehouse_id="wh_main",
        items=[
            BlindReceiptItem(product_id="prod_def_001", quantity=5),
            BlindReceiptItem(product_id="prod_bar_001", quantity=3),
        ],
    )
    dumped = payload.model_dump()
    assert dumped["warehouse_id"] == "wh_main"
    assert len(dumped["items"]) == 2
    assert "supplier_name" not in dumped
    assert "cost_usd" not in dumped["items"][0]