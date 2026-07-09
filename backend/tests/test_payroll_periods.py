from datetime import date

from backend.domains.hr.payroll_periods import (
    BRANCH_MAIN,
    BRANCH_NORTH,
    SCHEME_CALENDAR,
    SCHEME_PAYROLL_9_24,
    format_quincena_label,
    get_branch_payroll_scheme,
    get_period_bounds_for_branch,
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


def test_branch_main_uses_payroll_9_24_scheme():
    assert get_branch_payroll_scheme(BRANCH_MAIN) == SCHEME_PAYROLL_9_24


def test_topcar_uses_calendar_scheme():
    assert get_branch_payroll_scheme(BRANCH_NORTH) == SCHEME_CALENDAR


def test_period_bounds_for_branch_main():
    start, end = get_period_bounds_for_branch(BRANCH_MAIN, date(2026, 6, 20))
    assert start == date(2026, 6, 9)
    assert end == date(2026, 6, 24)


def test_period_bounds_for_topcar():
    start, end = get_period_bounds_for_branch(BRANCH_NORTH, date(2026, 6, 20))
    assert start == date(2026, 6, 16)
    assert end == date(2026, 6, 30)