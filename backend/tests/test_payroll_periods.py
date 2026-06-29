from datetime import date

from backend.domains.hr.payroll_periods import (
    SCHEME_PAYROLL_9_24,
    format_quincena_label,
    get_quincena_bounds,
)


def test_quincena_9_24_mid_first_period():
    start, end = get_quincena_bounds(date(2026, 6, 15), scheme=SCHEME_PAYROLL_9_24)
    assert start == date(2026, 6, 9)
    assert end == date(2026, 6, 24)


def test_quincena_9_24_second_period_wrap():
    start, end = get_quincena_bounds(date(2026, 6, 28), scheme=SCHEME_PAYROLL_9_24)
    assert start == date(2026, 6, 25)
    assert end == date(2026, 7, 8)


def test_quincena_9_24_early_month_in_second_period():
    start, end = get_quincena_bounds(date(2026, 6, 5), scheme=SCHEME_PAYROLL_9_24)
    assert start == date(2026, 5, 25)
    assert end == date(2026, 6, 8)


def test_previous_quincena_from_first_period():
    start, end = get_quincena_bounds(date(2026, 6, 15), scheme=SCHEME_PAYROLL_9_24, offset=-1)
    assert start == date(2026, 5, 25)
    assert end == date(2026, 6, 8)


def test_previous_quincena_from_second_period():
    start, end = get_quincena_bounds(date(2026, 6, 28), scheme=SCHEME_PAYROLL_9_24, offset=-1)
    assert start == date(2026, 6, 9)
    assert end == date(2026, 6, 24)


def test_format_quincena_label_same_month():
    label = format_quincena_label(date(2026, 6, 9), date(2026, 6, 24))
    assert "9-24" in label
    assert "Jun" in label