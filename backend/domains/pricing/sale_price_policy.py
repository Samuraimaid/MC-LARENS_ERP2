"""Validate sale line prices against tier policy."""
from __future__ import annotations

from typing import Any, Mapping

from backend.domains.pricing.price_tiers import (
    APPROVAL_TYPE_PRECIO2,
    TIER_CASA_COMERCIAL,
    TIER_LABELS_ES,
    TIER_PRECIO2,
    allowed_price_tiers,
    detect_price_tier,
    is_supervisor_role,
    normalize_pricing_profile,
    normalize_product_price_tiers,
    normalize_seller_type,
    tier_requires_supervisor_approval,
    tier_unit_price,
)


class SalePricePolicyError(ValueError):
    def __init__(self, message: str, *, status_code: int = 403):
        super().__init__(message)
        self.status_code = status_code


async def validate_precio2_approval(
    db,
    *,
    approval_id: str,
    requester_id: str,
    customer_id: str,
    items: list[dict[str, Any]],
) -> dict[str, Any]:
    approval = await db.approvals.find_one({"approval_id": approval_id}, {"_id": 0})
    if not approval:
        raise SalePricePolicyError("Aprobación de Precio 2 no encontrada", status_code=404)
    if str(approval.get("type") or "") != APPROVAL_TYPE_PRECIO2:
        raise SalePricePolicyError("La aprobación no corresponde a Precio 2", status_code=400)
    if str(approval.get("status") or "") != "approved":
        raise SalePricePolicyError("La aprobación de Precio 2 aún no está aprobada", status_code=403)
    if str(approval.get("requester_id") or "") != str(requester_id or ""):
        raise SalePricePolicyError("La aprobación de Precio 2 pertenece a otro vendedor", status_code=403)

    payload = approval.get("payload") or {}
    if str(payload.get("customer_id") or "") != str(customer_id or ""):
        raise SalePricePolicyError("La aprobación de Precio 2 es para otro cliente", status_code=403)

    approved_items = {
        str(row.get("product_id") or ""): row
        for row in (payload.get("items") or [])
        if isinstance(row, dict)
    }
    for item in items:
        product_id = str(item.get("product_id") or "")
        approved = approved_items.get(product_id)
        if not approved:
            raise SalePricePolicyError(
                f"El producto {product_id} no está cubierto por la aprobación de Precio 2",
                status_code=403,
            )
        try:
            approved_price = float(approved.get("unit_price") or 0.0)
            actual_price = float(item.get("unit_price") or 0.0)
        except (TypeError, ValueError):
            raise SalePricePolicyError("Precio inválido en aprobación de Precio 2", status_code=400)
        if abs(approved_price - actual_price) > 0.05:
            raise SalePricePolicyError(
                f"El precio del producto {product_id} no coincide con la aprobación de Precio 2",
                status_code=403,
            )
    return approval


async def validate_sale_items_pricing(
    db,
    *,
    user: Mapping[str, Any],
    customer: Mapping[str, Any],
    items: list[dict[str, Any]],
    precio2_approval_id: str | None = None,
) -> list[dict[str, Any]]:
    role = str(user.get("role") or "")
    seller_type = normalize_seller_type(user)
    profile = normalize_pricing_profile(customer)
    allowed = allowed_price_tiers(customer=customer, seller=user, role=role)

    if profile == "casa_comercial" and seller_type != "vip" and not is_supervisor_role(role):
        raise SalePricePolicyError(
            "Los clientes Casa Comercial solo pueden ser atendidos por Vendedores VIP o supervisión",
            status_code=403,
        )

    precio2_items: list[dict[str, Any]] = []
    normalized_items: list[dict[str, Any]] = []

    for raw_item in items or []:
        product_id = str(raw_item.get("product_id") or "")
        product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
        if not product:
            raise SalePricePolicyError(f"Producto no encontrado: {product_id}", status_code=404)

        product = normalize_product_price_tiers(dict(product))
        try:
            unit_price = float(raw_item.get("unit_price") or 0.0)
        except (TypeError, ValueError):
            raise SalePricePolicyError(f"Precio inválido para {product_id}", status_code=400)

        tier = detect_price_tier(product, unit_price)
        if tier not in allowed and not is_supervisor_role(role):
            label = TIER_LABELS_ES.get(tier, tier)
            raise SalePricePolicyError(
                f"No tienes autorización para usar {label} en este cliente",
                status_code=403,
            )

        if tier == TIER_CASA_COMERCIAL and unit_price > tier_unit_price(product, TIER_CASA_COMERCIAL) + 0.05:
            if not is_supervisor_role(role):
                raise SalePricePolicyError(
                    "Precio Casa Comercial no puede superar el tier configurado sin supervisión",
                    status_code=403,
                )

        if tier_requires_supervisor_approval(tier) and not is_supervisor_role(role):
            precio2_items.append(raw_item)

        item_copy = dict(raw_item)
        item_copy["price_tier"] = tier
        item_copy["price_tier_label"] = TIER_LABELS_ES.get(tier, tier)
        normalized_items.append(item_copy)

    if precio2_items and not is_supervisor_role(role):
        if not precio2_approval_id:
            raise SalePricePolicyError(
                "Precio 2 requiere aprobación de supervisor o gerencia con justificación",
                status_code=403,
            )
        await validate_precio2_approval(
            db,
            approval_id=str(precio2_approval_id),
            requester_id=str(user.get("user_id") or ""),
            customer_id=str(customer.get("customer_id") or ""),
            items=precio2_items,
        )

    return normalized_items