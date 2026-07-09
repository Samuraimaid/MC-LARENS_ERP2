"""Payroll quincena boundaries for technician commissions and HR reports."""
from __future__ import annotations

from datetime import date, timedelta
from typing import List, Literal, Optional, Tuple

QuincenaScheme = Literal["payroll_9_24", "calendar"]

SCHEME_PAYROLL_9_24 = "payroll_9_24"
SCHEME_CALENDAR = "calendar"

BRANCH_MAIN = "branch_main"
BRANCH_NORTH = "branch_north"
BRANCH_SOUTH = "branch_south"
TOPCAR_BRANCHES = frozenset({BRANCH_NORTH, BRANCH_SOUTH})

PAY_DAYS_MAIN = (10, 25)
PAY_DAYS_TOPCAR = (15, 30)


def _add_months(year: int, month: int, delta: int) -> Tuple[int, int]:
    month += delta
    while month > 12:
        month -= 12
        year += 1
    while month < 1:
        month += 12
        year -= 1
    return year, month


def _last_day_of_month(year: int, month: int) -> int:
    if month == 12:
        return 31
    return (date(year, month + 1, 1) - timedelta(days=1)).day


def _bounds_payroll_9_24(reference: date) -> Tuple[date, date]:
    """Quincena técnica Mundo de Accesorios: 9-24 y 25-8 (corte comisiones días 9 y 24)."""
    day = reference.day
    year, month = reference.year, reference.month

    if 9 <= day <= 24:
        return date(year, month, 9), date(year, month, 24)
    if day >= 25:
        ny, nm = _add_months(year, month, 1)
        return date(year, month, 25), date(ny, nm, 8)
    py, pm = _add_months(year, month, -1)
    return date(py, pm, 25), date(year, month, 8)


def _bounds_calendar(reference: date) -> Tuple[date, date]:
    """Quincena calendario TopCar: 1-15 y 16-fin de mes."""
    day = reference.day
    year, month = reference.year, reference.month
    if day <= 15:
        return date(year, month, 1), date(year, month, 15)
    last_day = _last_day_of_month(year, month)
    return date(year, month, 16), date(year, month, last_day)


def _shift_reference_for_offset(reference: date, offset: int, scheme: QuincenaScheme) -> date:
    if offset == 0:
        return reference
    start, end = get_quincena_bounds(reference, scheme=scheme, offset=0)
    if offset < 0:
        return start - timedelta(days=1)
    return end + timedelta(days=1)


def get_quincena_bounds(
    reference: date | None = None,
    *,
    scheme: QuincenaScheme = SCHEME_PAYROLL_9_24,
    offset: int = 0,
) -> Tuple[date, date]:
    """
    Return inclusive [start, end] for the quincena containing `reference`.
    offset=0 current, -1 previous, +1 next.
    """
    ref = reference or date.today()
    if offset != 0:
        ref = _shift_reference_for_offset(ref, offset, scheme)
    if scheme == SCHEME_CALENDAR:
        return _bounds_calendar(ref)
    return _bounds_payroll_9_24(ref)


def get_branch_payroll_scheme(branch_id: Optional[str]) -> QuincenaScheme:
    """Mundo de Accesorios usa corte 9-24; TopCar usa calendario 1-15 / 16-fin."""
    if str(branch_id or "").strip() == BRANCH_MAIN:
        return SCHEME_PAYROLL_9_24
    return SCHEME_CALENDAR


def get_pay_days(branch_id: Optional[str]) -> Tuple[int, int]:
    """Días de pago: Mundo 10 y 25; TopCar 15 y 30 (último día si el mes no tiene 30)."""
    if str(branch_id or "").strip() == BRANCH_MAIN:
        return PAY_DAYS_MAIN
    return PAY_DAYS_TOPCAR


def resolve_pay_day_for_period_end(period_end: date, branch_id: Optional[str]) -> date:
    """Fecha de pago asociada al cierre del periodo."""
    first_pay, second_pay = get_pay_days(branch_id)
    scheme = get_branch_payroll_scheme(branch_id)
    _, end = get_quincena_bounds(period_end, scheme=scheme, offset=0)
    if end == period_end:
        if scheme == SCHEME_PAYROLL_9_24:
            return date(period_end.year, period_end.month, second_pay if period_end.day >= 9 else first_pay)
        if period_end.day <= 15:
            return date(period_end.year, period_end.month, first_pay)
        last_day = _last_day_of_month(period_end.year, period_end.month)
        pay_day = min(second_pay, last_day)
        return date(period_end.year, period_end.month, pay_day)
    return period_end


def get_period_bounds_for_branch(
    branch_id: Optional[str],
    reference: date | None = None,
    *,
    offset: int = 0,
) -> Tuple[date, date]:
    scheme = get_branch_payroll_scheme(branch_id)
    return get_quincena_bounds(reference, scheme=scheme, offset=offset)


def format_quincena_label(start: date, end: date) -> str:
    if start.month == end.month:
        return f"{start.day}-{end.day} {start.strftime('%b %Y')}"
    return f"{start.day} {start.strftime('%b')} - {end.day} {end.strftime('%b %Y')}"


def format_pay_schedule_label(branch_id: Optional[str]) -> str:
    first_pay, second_pay = get_pay_days(branch_id)
    scheme = get_branch_payroll_scheme(branch_id)
    if scheme == SCHEME_PAYROLL_9_24:
        return f"Corte asistencia/comisiones 9-24 y 25-8 · Pago días {first_pay} y {second_pay}"
    return f"Corte asistencia 1-15 y 16-fin · Pago días {first_pay} y {second_pay}"