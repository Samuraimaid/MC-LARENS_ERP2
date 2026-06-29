"""Payroll quincena boundaries for technician commissions and HR reports."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Literal, Tuple

QuincenaScheme = Literal["payroll_9_24", "calendar"]

SCHEME_PAYROLL_9_24 = "payroll_9_24"
SCHEME_CALENDAR = "calendar"


def _add_months(year: int, month: int, delta: int) -> Tuple[int, int]:
    month += delta
    while month > 12:
        month -= 12
        year += 1
    while month < 1:
        month += 12
        year -= 1
    return year, month


def _bounds_payroll_9_24(reference: date) -> Tuple[date, date]:
    """Quincena técnica: 9-24 y 25-8 (corte en días 9 y 24)."""
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
    """Quincena calendario HR legacy: 1-15 y 16-fin de mes."""
    day = reference.day
    year, month = reference.year, reference.month
    if day <= 15:
        return date(year, month, 1), date(year, month, 15)
    if month == 12:
        last_day = 31
    else:
        last_day = (date(year, month + 1, 1) - timedelta(days=1)).day
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


def format_quincena_label(start: date, end: date) -> str:
    if start.month == end.month:
        return f"{start.day}-{end.day} {start.strftime('%b %Y')}"
    return f"{start.day} {start.strftime('%b')} - {end.day} {end.strftime('%b %Y')}"