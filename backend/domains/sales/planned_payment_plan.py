"""Mandatory seller payment plan validation with rounding tolerance."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

PLAN_ROUNDING_TOLERANCE_NIO = 0.01
PLAN_AMOUNT_DECIMALS = 2


def _round2(value: Any) -> float:
    try:
        return round(float(value or 0.0), 2)
    except (TypeError, ValueError):
        return 0.0


def _round4(value: Any) -> float:
    try:
        return round(float(value or 0.0), 4)
    except (TypeError, ValueError):
        return 0.0


def _normalize_method(method: Any) -> str:
    key = str(method or "cash").strip().lower()
    aliases = {
        "efectivo": "cash",
        "transferencia": "transfer",
        "tarjeta": "card",
        "credito": "credit",
        "crédito": "credit",
    }
    return aliases.get(key, key)


def _is_card_method(method: Any) -> bool:
    return _normalize_method(method) == "card"


def _normalize_currency(currency: Any) -> str:
    code = str(currency or "NIO").strip().upper()
    return "USD" if code == "USD" else "NIO"


def _is_plan_within_tolerance(
    planned: float,
    target: float,
    tolerance: float = PLAN_ROUNDING_TOLERANCE_NIO,
) -> bool:
    return abs(_round2(planned) - _round2(target)) <= tolerance + 1e-9


def _line_has_amount(line: Dict[str, Any]) -> bool:
    return _round2(line.get("monto_origen")) > 0


def _compute_plan_rounding_tolerance(
    lines: List[Dict[str, Any]],
    exchange_rate: float,
) -> float:
    rate = _round2(exchange_rate) or 36.5
    has_usd = any(
        _normalize_currency(line.get("moneda")) == "USD" and _line_has_amount(line)
        for line in lines
    )
    if not has_usd:
        return PLAN_ROUNDING_TOLERANCE_NIO
    return _round2(PLAN_ROUNDING_TOLERANCE_NIO * rate)


def _absorb_plan_rounding_difference(
    lines: List[Dict[str, Any]],
    *,
    exchange_rate: float,
    target_total: float,
    tolerance: float = PLAN_ROUNDING_TOLERANCE_NIO,
) -> List[Dict[str, Any]]:
    rows = [dict(line) for line in lines]
    target = _round2(target_total)
    planned = _round2(sum(line["monto_cordobas"] for line in rows))
    delta = _round2(target - planned)

    if abs(delta) <= 1e-9:
        return rows
    if abs(delta) > tolerance:
        return rows

    adjust_index = -1
    for index in range(len(rows) - 1, -1, -1):
        if _line_has_amount(rows[index]):
            adjust_index = index
            break
    if adjust_index < 0:
        return rows

    line = rows[adjust_index]
    currency = _normalize_currency(line.get("moneda"))
    rate = _round4(line.get("tasa_cambio") or exchange_rate)
    next_nio = _round2(line["monto_cordobas"] + delta)
    if next_nio <= 0:
        return rows

    next_monto = _round2(next_nio / rate) if currency == "USD" else _round2(next_nio)
    rows[adjust_index] = {
        **line,
        "monto_origen": next_monto,
        "monto_cordobas": next_nio,
    }
    return rows


def line_amount_nio(line: Dict[str, Any], exchange_rate: float) -> float:
    currency = _normalize_currency(line.get("moneda"))
    source_amount = _round2(line.get("monto_origen"))
    if source_amount <= 0:
        return 0.0
    if line.get("monto_cordobas") is not None:
        return _round2(line.get("monto_cordobas"))
    rate = _round4(line.get("tasa_cambio") or exchange_rate or 36.5)
    if currency == "NIO":
        return _round2(source_amount)
    return _round2(source_amount * rate)


def normalize_plan_line(line: Dict[str, Any], *, exchange_rate: float, line_no: int) -> Dict[str, Any]:
    method = _normalize_method(line.get("metodo"))
    currency = _normalize_currency(line.get("moneda"))
    source_amount = _round2(line.get("monto_origen"))
    if source_amount <= 0:
        raise HTTPException(status_code=400, detail=f"Monto inválido en línea de plan #{line_no}")
    rate = _round4(line.get("tasa_cambio") or (1.0 if currency == "NIO" else exchange_rate))
    amount_nio = line_amount_nio(
        {"moneda": currency, "monto_origen": source_amount, "tasa_cambio": rate},
        exchange_rate,
    )
    return {
        "line_no": line_no,
        "metodo": method,
        "moneda": currency,
        "monto_origen": _round2(source_amount),
        "tasa_cambio": rate,
        "monto_cordobas": amount_nio,
    }


def normalize_planned_payment_plan(
    raw_plan: Any,
    *,
    payment_method: str,
    mixed_methods: Optional[List[str]],
    net_to_collect: float,
    exchange_rate: float,
    currency: str = "NIO",
) -> Dict[str, Any]:
    if not isinstance(raw_plan, dict):
        raise HTTPException(status_code=400, detail="planned_payment_plan es obligatorio")

    mode = str(raw_plan.get("mode") or payment_method or "cash").strip().lower()
    if mode != "mixed":
        mode = _normalize_method(mode)

    lines_raw = raw_plan.get("lines")
    if not isinstance(lines_raw, list) or not lines_raw:
        raise HTTPException(status_code=400, detail="El plan de pago debe incluir al menos una línea")

    normalized_lines = [
        normalize_plan_line(cast_line, exchange_rate=exchange_rate, line_no=idx + 1)
        for idx, cast_line in enumerate(lines_raw)
        if isinstance(cast_line, dict)
    ]
    if not normalized_lines:
        raise HTTPException(status_code=400, detail="El plan de pago no contiene líneas válidas")

    if mode == "mixed":
        selected = [_normalize_method(item) for item in (mixed_methods or []) if item]
        if not selected:
            raise HTTPException(status_code=400, detail="Pago mixto requiere métodos seleccionados")
        plan_methods = sorted({line["metodo"] for line in normalized_lines})
        if sorted(set(selected)) != plan_methods:
            raise HTTPException(
                status_code=400,
                detail="Las líneas del plan deben coincidir exactamente con los métodos del pago mixto",
            )

    plan_total = _round2(sum(line["monto_cordobas"] for line in normalized_lines))
    target = _round2(net_to_collect)
    tolerance = _compute_plan_rounding_tolerance(normalized_lines, exchange_rate)
    if not _is_plan_within_tolerance(plan_total, target, tolerance):
        raise HTTPException(
            status_code=409,
            detail={
                "error": "PAYMENT_PLAN_MISMATCH",
                "message": (
                    f"El plan de pago no cuadra con el total a cobrar "
                    f"(tolerancia ±C${tolerance:.2f})"
                ),
                "expected_total": target,
                "planned_total": plan_total,
            },
        )

    if plan_total != target:
        normalized_lines = _absorb_plan_rounding_difference(
            normalized_lines,
            exchange_rate=exchange_rate,
            target_total=target,
            tolerance=tolerance,
        )
        plan_total = _round2(sum(line["monto_cordobas"] for line in normalized_lines))
        if plan_total != target:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "PAYMENT_PLAN_MISMATCH",
                    "message": "No se pudo ajustar el plan de pago al total a cobrar",
                    "expected_total": target,
                    "planned_total": plan_total,
                },
            )

    return {
        "mode": mode,
        "currency": _normalize_currency(currency),
        "exchange_rate": _round4(exchange_rate),
        "net_to_collect": target,
        "planned_total_nio": plan_total,
        "lines": normalized_lines,
        "locked": True,
    }


def _signature(lines: List[Dict[str, Any]]) -> List[Tuple[str, str, float]]:
    sig = [
        (_normalize_method(line.get("metodo")), _normalize_currency(line.get("moneda")), _round2(line.get("monto_origen")))
        for line in lines
    ]
    return sorted(sig)


def _lines_nio_total(lines: List[Dict[str, Any]], exchange_rate: float) -> float:
    return _round2(sum(line_amount_nio(line, exchange_rate) for line in lines))


def _cash_lines(lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [line for line in lines if _normalize_method(line.get("metodo")) == "cash"]


def _non_cash_lines(lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [line for line in lines if _normalize_method(line.get("metodo")) != "cash"]


def _validate_mixed_collect_lines(
    plan_lines: List[Dict[str, Any]],
    collect_lines: List[Dict[str, Any]],
    *,
    exchange_rate: float,
    submitted_amount: float,
    pending_amount: Optional[float] = None,
) -> None:
    rate = _round4(exchange_rate or 36.62)
    tolerance = _compute_plan_rounding_tolerance(plan_lines, rate)

    plan_non_cash = _non_cash_lines(plan_lines)
    collect_non_cash = _non_cash_lines(collect_lines)
    if _signature(plan_non_cash) != _signature(collect_non_cash):
        raise HTTPException(
            status_code=409,
            detail={
                "error": "PAYMENT_PLAN_MISMATCH",
                "message": "Los pagos con tarjeta/transferencia deben coincidir con el plan acordado por ventas.",
            },
        )

    plan_methods = sorted({_normalize_method(line.get("metodo")) for line in plan_lines})
    collect_methods = sorted({_normalize_method(line.get("metodo")) for line in collect_lines})
    if plan_methods != collect_methods:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "PAYMENT_PLAN_MISMATCH",
                "message": "Los métodos de cobro no coinciden con el plan acordado por ventas.",
            },
        )

    plan_total_nio = _lines_nio_total(plan_lines, rate)
    collect_total_nio = _lines_nio_total(collect_lines, rate)
    expected_total = _round2(pending_amount) if pending_amount is not None else plan_total_nio

    if abs(_round2(submitted_amount) - collect_total_nio) > tolerance + 1e-9:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "PAYMENT_PLAN_MISMATCH",
                "message": "El monto enviado no coincide con el desglose de pagos recibido.",
                "expected_amount": collect_total_nio,
                "submitted_amount": _round2(submitted_amount),
            },
        )

    if abs(collect_total_nio - expected_total) > tolerance + 1e-9:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "PAYMENT_PLAN_MISMATCH",
                "message": "El total cobrado no coincide con el pendiente/plan acordado por ventas.",
                "expected_amount": expected_total,
                "submitted_amount": collect_total_nio,
            },
        )

    plan_cash_nio = _lines_nio_total(_cash_lines(plan_lines), rate)
    collect_cash_nio = _lines_nio_total(_cash_lines(collect_lines), rate)
    if abs(plan_cash_nio - collect_cash_nio) > tolerance + 1e-9:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "PAYMENT_PLAN_MISMATCH",
                "message": "El total en efectivo no cuadra con el plan (se permite reasignar NIO/USD si el total en córdobas coincide).",
                "expected_cash_nio": plan_cash_nio,
                "submitted_cash_nio": collect_cash_nio,
            },
        )


def normalize_collect_pagos_for_plan(
    plan: Dict[str, Any],
    pagos: List[Dict[str, Any]],
    *,
    exchange_rate: float,
) -> List[Dict[str, Any]]:
    """Reasigna líneas de efectivo al desglose físico recibido cuando el total en NIO cuadra."""
    if not plan or not plan.get("locked"):
        return pagos

    plan_lines = plan.get("lines") if isinstance(plan.get("lines"), list) else []
    if not plan_lines:
        return pagos

    rate = _round4(exchange_rate or plan.get("exchange_rate") or 36.62)
    tolerance = _compute_plan_rounding_tolerance(plan_lines, rate)

    collect_lines: List[Dict[str, Any]] = []
    for row in pagos or []:
        if hasattr(row, "model_dump"):
            row_dict = row.model_dump()
        elif isinstance(row, dict):
            row_dict = dict(row)
        else:
            continue
        amount_origin = _round2(row_dict.get("monto_origen"))
        if amount_origin <= 0:
            continue
        currency = _normalize_currency(row_dict.get("moneda"))
        row_rate = _round4(row_dict.get("tasa_cambio") or (1.0 if currency == "NIO" else rate))
        collect_lines.append(
            {
                "metodo": _normalize_method(row_dict.get("metodo")),
                "moneda": currency,
                "monto_origen": amount_origin,
                "tasa_cambio": row_rate,
                "monto_cordobas": line_amount_nio(
                    {
                        "moneda": currency,
                        "monto_origen": amount_origin,
                        "tasa_cambio": row_rate,
                    },
                    rate,
                ),
            }
        )

    if _signature(plan_lines) == _signature(collect_lines):
        return pagos

    plan_total = _lines_nio_total(plan_lines, rate)
    collect_total = _lines_nio_total(collect_lines, rate)
    if abs(plan_total - collect_total) > tolerance + 1e-9:
        return pagos

    normalized: List[Dict[str, Any]] = []
    for row in collect_lines:
        if _normalize_method(row.get("metodo")) != "cash":
            normalized.append(row)
    cash_rows = _cash_lines(collect_lines)
    if cash_rows:
        normalized.extend(cash_rows)
    return normalized or pagos


def _is_partial_collect(
    amount: float,
    pending_amount: Optional[float],
    tolerance: float = PLAN_ROUNDING_TOLERANCE_NIO,
) -> bool:
    if pending_amount is None:
        return False
    submitted = _round2(amount)
    pending = _round2(pending_amount)
    remaining_after = _round2(pending - submitted)
    return submitted > 0 and remaining_after > tolerance + 1e-9


def _validate_partial_collect_methods(
    plan_lines: List[Dict[str, Any]],
    *,
    pagos: Optional[List[Any]] = None,
    payment_method: Optional[str] = None,
) -> None:
    allowed = {
        (_normalize_method(line.get("metodo")), _normalize_currency(line.get("moneda")))
        for line in plan_lines
    }
    if pagos:
        for row in pagos:
            if hasattr(row, "model_dump"):
                row_dict = row.model_dump()
            elif isinstance(row, dict):
                row_dict = row
            else:
                continue
            if _round2(row_dict.get("monto_origen")) <= 0:
                continue
            key = (
                _normalize_method(row_dict.get("metodo")),
                _normalize_currency(row_dict.get("moneda")),
            )
            if key not in allowed:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": "PAYMENT_PLAN_MISMATCH",
                        "message": "El método/moneda del abono no está en el plan acordado por ventas.",
                    },
                )
        return

    if len(plan_lines) != 1:
        raise HTTPException(status_code=409, detail="Abono parcial en plan mixto requiere desglose de pagos")
    planned = plan_lines[0]
    if _normalize_method(payment_method) != _normalize_method(planned.get("metodo")):
        raise HTTPException(
            status_code=409,
            detail={
                "error": "PAYMENT_PLAN_MISMATCH",
                "message": "El método de cobro no coincide con el plan acordado por ventas.",
            },
        )


def validate_collect_against_plan(
    plan: Dict[str, Any],
    *,
    pagos: Optional[List[Any]] = None,
    amount: float = 0.0,
    payment_method: Optional[str] = None,
    pending_amount: Optional[float] = None,
    allow_card_override: bool = False,
) -> None:
    if not plan or not plan.get("locked"):
        return

    plan_lines = plan.get("lines") if isinstance(plan.get("lines"), list) else []
    if not plan_lines:
        return

    submitted_amount = _round2(amount)
    tolerance = _compute_plan_rounding_tolerance(plan_lines, plan.get("exchange_rate") or 36.5)
    mode = str(plan.get("mode") or "cash").lower()
    has_mixed_pagos = bool(pagos and len(pagos) > 0)
    use_partial_rules = (
        _is_partial_collect(submitted_amount, pending_amount, tolerance)
        and mode != "mixed"
        and not has_mixed_pagos
    )
    if use_partial_rules:
        _validate_partial_collect_methods(
            plan_lines,
            pagos=pagos,
            payment_method=payment_method,
        )
        return
    if mode == "mixed" or has_mixed_pagos:
        collect_lines: List[Dict[str, Any]] = []
        for idx, row in enumerate(pagos or []):
            if hasattr(row, "model_dump"):
                row_dict = row.model_dump()
            elif isinstance(row, dict):
                row_dict = row
            else:
                continue
            amount_origin = _round2(row_dict.get("monto_origen"))
            if amount_origin <= 0:
                continue
            collect_lines.append(
                {
                    "metodo": _normalize_method(row_dict.get("metodo")),
                    "moneda": _normalize_currency(row_dict.get("moneda")),
                    "monto_origen": amount_origin,
                }
            )
        if _signature(plan_lines) == _signature(collect_lines):
            return
        _validate_mixed_collect_lines(
            plan_lines,
            collect_lines,
            exchange_rate=plan.get("exchange_rate") or 36.62,
            submitted_amount=submitted_amount,
            pending_amount=pending_amount,
        )
        return

    if len(plan_lines) != 1:
        raise HTTPException(status_code=409, detail="Plan de cobro simple inválido en factura")

    planned = plan_lines[0]
    planned_method = _normalize_method(planned.get("metodo"))
    collect_method = _normalize_method(payment_method)
    if collect_method != planned_method:
        card_override_ok = (
            allow_card_override
            and _is_card_method(collect_method)
            and planned_method == "cash"
        )
        if not card_override_ok:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "PAYMENT_PLAN_MISMATCH",
                    "message": "El método de cobro no coincide con el plan acordado por ventas.",
                },
            )
    planned_amount = _round2(planned.get("monto_cordobas"))
    expected_amount = _round2(pending_amount) if pending_amount is not None else planned_amount
    tolerance = _compute_plan_rounding_tolerance(plan_lines, plan.get("exchange_rate") or 36.5)
    if abs(submitted_amount - expected_amount) > tolerance + 1e-9:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "PAYMENT_PLAN_MISMATCH",
                "message": "El monto de cobro no coincide con el plan acordado por ventas.",
                "expected_amount": expected_amount,
                "submitted_amount": submitted_amount,
            },
        )


def resolve_customer_credit_days(customer: Dict[str, Any], submitted_days: Optional[int] = None) -> int:
    profile_days = customer.get("credit_days")
    if profile_days is None and isinstance(customer.get("credit_terms"), dict):
        profile_days = customer["credit_terms"].get("days")
    try:
        resolved = int(profile_days if profile_days is not None else (submitted_days or 0))
    except (TypeError, ValueError):
        resolved = 0
    if resolved <= 0:
        raise HTTPException(
            status_code=400,
            detail="Cliente sin plazo de crédito aprobado. Gerencia/supervisor debe configurar el perfil de crédito.",
        )
    return resolved