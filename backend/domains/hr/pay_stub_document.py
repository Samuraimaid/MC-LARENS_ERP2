"""Pay stub display context, thermal ESC/POS and mobile PDF layout."""
from __future__ import annotations

import unicodedata
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.domains.hr.payroll_periods import BRANCH_MAIN, BRANCH_NORTH, BRANCH_SOUTH

PAY_STUB_WIDTH = 48
IR_LABORAL_RATE = 0.00

MONTHS_ES = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)

ROLE_LABELS_ES = {
    "instalaciones": "Técnico de Instalaciones",
    "tecnico": "Técnico",
    "electrico": "Técnico Eléctrico",
    "polarizador": "Polarizador",
    "ventas": "Vendedor",
    "bodegas": "Bodeguero",
    "supervisor": "Supervisor",
    "gerencia": "Gerencia",
    "recursos_humanos": "Recursos Humanos",
    "cajero": "Cajero",
}

BRANCH_COMPANY: Dict[str, Dict[str, str]] = {
    BRANCH_MAIN: {"name": "MUNDO DE ACCESORIOS", "ruc": "7772007540000"},
    BRANCH_NORTH: {"name": "TOP CAR NORTH", "ruc": "J0310000374320"},
    BRANCH_SOUTH: {"name": "TOP CAR SOUTH", "ruc": "J0310000374320"},
}


def _ascii_safe(text: Any) -> str:
    raw = str(text or "")
    normalized = unicodedata.normalize("NFKD", raw)
    return normalized.encode("ascii", "ignore").decode("ascii")


def format_money(value: Any) -> str:
    amount = float(value or 0.0)
    return f"C$ {amount:,.2f}"


def _month_name_es(d: date) -> str:
    return MONTHS_ES[max(0, min(11, d.month - 1))]


def _quincena_title(period_start: date, period_end: date) -> str:
    midpoint = (period_start.day + period_end.day) / 2.0
    ordinal = "1ra" if midpoint <= 15 else "2da"
    month_ref = period_end if period_end.month == period_start.month else period_end
    return f"{ordinal} Quincena del mes de { _month_name_es(month_ref).capitalize() } {month_ref.year}"


def _period_range_text(period_start: date, period_end: date) -> str:
    if period_start.month == period_end.month:
        return (
            f"Del {period_start.day} al {period_end.day} de "
            f"{_month_name_es(period_start)} {period_start.year}"
        )
    return (
        f"Del {period_start.day} de {_month_name_es(period_start)} al "
        f"{period_end.day} de {_month_name_es(period_end)} {period_end.year}"
    )


def _count_weekdays(start: date, end: date) -> int:
    total = 0
    cursor = start
    while cursor <= end:
        if cursor.weekday() != 6:
            total += 1
        cursor += timedelta(days=1)
    return total


def _count_sundays(start: date, end: date) -> int:
    total = 0
    cursor = start
    while cursor <= end:
        if cursor.weekday() == 6:
            total += 1
        cursor += timedelta(days=1)
    return total


def _clip(text: str, width: int) -> str:
    value = _ascii_safe(text).strip()
    if len(value) <= width:
        return value
    return value[: max(0, width - 3)] + "..."


def _line_label_amount(label: str, amount: Any, *, width: int = PAY_STUB_WIDTH) -> str:
    money = format_money(amount)
    label_part = _clip(label, max(8, width - len(money) - 1))
    spaces = max(1, width - len(label_part) - len(money))
    return f"{label_part}{' ' * spaces}{money}"


def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)[:10]).date()
    except ValueError:
        return None


def _categorize_deductions(deductions: List[Dict[str, Any]]) -> Dict[str, float]:
    buckets = {
        "inss": 0.0,
        "ir_laboral": 0.0,
        "prestamos": 0.0,
        "adelantos": 0.0,
        "otras": 0.0,
        "ausencias": 0.0,
    }
    for row in deductions or []:
        amount = float(row.get("amount") or 0)
        if amount <= 0:
            continue
        dtype = str(row.get("type") or "").strip().lower()
        if dtype in {"inss_laboral", "inss"}:
            buckets["inss"] += amount
        elif dtype in {"ir_laboral", "ir"}:
            buckets["ir_laboral"] += amount
        elif dtype in {"prestamo", "prestamos", "loan", "cuota_prestamo"}:
            buckets["prestamos"] += amount
        elif dtype in {"adelanto_salario", "petty_cash_advance"}:
            buckets["adelantos"] += amount
        elif dtype in {"absence_deduction", "ausencia", "ausencias"}:
            buckets["ausencias"] += amount
        else:
            buckets["otras"] += amount
    return {key: round(value, 2) for key, value in buckets.items()}


def build_pay_stub_display(stub: Dict[str, Any], user_doc: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Normalize stub + user into printable document context."""
    user_doc = user_doc or {}
    branch_id = str(stub.get("branch_id") or user_doc.get("branch_id") or BRANCH_MAIN)
    company = dict(BRANCH_COMPANY.get(branch_id) or BRANCH_COMPANY[BRANCH_MAIN])

    period_start = _parse_date(stub.get("period_start")) or date.today()
    period_end = _parse_date(stub.get("period_end")) or period_start

    full_name = str(stub.get("user_name") or "").strip()
    if not full_name:
        full_name = " ".join(
            part for part in [user_doc.get("name"), user_doc.get("last_name")] if part
        ).strip()

    role_key = str(user_doc.get("role") or stub.get("role") or "").strip().lower()
    role_label = ROLE_LABELS_ES.get(role_key, role_key.replace("_", " ").title() or "Colaborador")
    cedula = str(
        stub.get("employee_cedula")
        or user_doc.get("cedula")
        or user_doc.get("dni")
        or user_doc.get("national_id")
        or "N/D"
    ).strip()

    attendance = stub.get("attendance_metrics") or {}
    absences = int(attendance.get("absences") or stub.get("absences_count") or 0)
    business_days = _count_weekdays(period_start, period_end)
    days_worked = max(0, int(stub.get("days_worked") or (business_days - absences)))
    seventh_days = int(stub.get("seventh_days") or _count_sundays(period_start, period_end))

    income_lines: List[Dict[str, Any]] = [
        {
            "key": "base_salary",
            "label": "Salario Basico Quincenal",
            "amount": float(stub.get("base_salary_proportional") or 0),
        },
    ]
    bonus = float(stub.get("attendance_bonus") or 0)
    if bonus > 0:
        income_lines.append({"key": "attendance_bonus", "label": "Bono por puntualidad", "amount": bonus})
    production = float(stub.get("commissions") or 0)
    if production > 0:
        income_lines.append(
            {"key": "production_commissions", "label": "Comisiones por produccion", "amount": production}
        )
    total_income = round(
        float(stub.get("gross_earnings") or sum(float(row["amount"]) for row in income_lines)),
        2,
    )

    cat = _categorize_deductions(stub.get("deductions_breakdown") or [])
    if float(stub.get("absence_deduction") or 0) > 0:
        cat["ausencias"] = round(cat["ausencias"] + float(stub.get("absence_deduction")), 2)
    if float(stub.get("inss_amount") or 0) > 0 and cat["inss"] <= 0:
        cat["inss"] = float(stub.get("inss_amount") or 0)
    if float(stub.get("ir_laboral_amount") or 0) > 0:
        cat["ir_laboral"] = float(stub.get("ir_laboral_amount") or 0)

    deduction_lines: List[Dict[str, Any]] = []
    matrix = [
        ("inss", "Inss"),
        ("ir_laboral", "IR Laboral"),
        ("prestamos", "Prestamos"),
        ("adelantos", "Adelantos de salarios"),
        ("otras", "Otras deducciones"),
        ("ausencias", "Ausencias"),
    ]
    for key, label in matrix:
        amount = float(cat.get(key) or 0)
        if amount > 0:
            deduction_lines.append({"key": key, "label": label, "amount": amount})

    total_deductions = round(
        float(stub.get("total_deductions") or sum(float(row["amount"]) for row in deduction_lines)),
        2,
    )
    net_pay = round(float(stub.get("net_pay") or max(0.0, total_income - total_deductions)), 2)

    return {
        "company_name": company["name"],
        "company_ruc": company["ruc"],
        "company_header_line": f"{company['name']} (RUC: {company['ruc']})",
        "document_title": "COMPROBANTE DE PAGO",
        "quincena_title": _quincena_title(period_start, period_end),
        "employee_name": full_name,
        "employee_cedula": cedula,
        "employee_role": role_label,
        "period_range_text": _period_range_text(period_start, period_end),
        "loan_balance": float(stub.get("loan_balance") or user_doc.get("loan_balance") or 0),
        "time_block": {
            "days_worked": days_worked,
            "seventh_days": seventh_days,
            "holidays_worked": int(stub.get("holidays_worked") or 0),
            "seventh_worked": int(stub.get("seventh_worked") or 0),
            "vacation_accrued": int(stub.get("vacation_accrued") or 0),
            "vacation_taken": int(stub.get("vacation_taken") or 0),
        },
        "income_lines": income_lines,
        "deduction_lines": deduction_lines,
        "total_income": total_income,
        "total_deductions": total_deductions,
        "net_pay": net_pay,
        "stub_id": stub.get("stub_id"),
        "branch_id": branch_id,
    }


def build_pay_stub_text_lines(display: Dict[str, Any], *, width: int = PAY_STUB_WIDTH) -> List[str]:
    lines: List[str] = []
    sep = "-" * width

    def center(text: str) -> str:
        raw = _clip(text, width)
        if len(raw) >= width:
            return raw
        pad = (width - len(raw)) // 2
        return (" " * pad) + raw

    lines.append(center(display.get("company_header_line") or ""))
    lines.append(center(display.get("document_title") or "COMPROBANTE DE PAGO"))
    lines.append(center(display.get("quincena_title") or ""))
    lines.append(sep)
    lines.append(f"Nombre: {_clip(display.get('employee_name') or '-', width - 8)}")
    lines.append(f"Cedula: {display.get('employee_cedula') or 'N/D'}")
    lines.append(f"Cargo: {_clip(display.get('employee_role') or '-', width - 7)}")
    lines.append(f"Periodo de pago: {_clip(display.get('period_range_text') or '-', width - 17)}")
    lines.append(f"Saldo de prestamo: {format_money(display.get('loan_balance'))}")
    lines.append(sep)
    tb = display.get("time_block") or {}
    lines.append(
        f"Dias trabajados: {tb.get('days_worked', 0)} | Septimo: {tb.get('seventh_days', 0)}"
    )
    lines.append(
        f"Feriados Trabajados: {tb.get('holidays_worked', 0)} | "
        f"Septimo trabajados: {tb.get('seventh_worked', 0)}"
    )
    lines.append(
        f"Vacaciones acumuladas: {tb.get('vacation_accrued', 0)} | "
        f"Vacaciones Gozadas: {tb.get('vacation_taken', 0)}"
    )
    lines.append(sep)
    lines.append("INGRESOS")
    for row in display.get("income_lines") or []:
        lines.append(_line_label_amount(str(row.get("label") or ""), row.get("amount"), width=width))
    lines.append(_line_label_amount("TOTAL INGRESOS", display.get("total_income"), width=width))
    lines.append(sep)
    lines.append("DEDUCCIONES")
    for row in display.get("deduction_lines") or []:
        lines.append(_line_label_amount(str(row.get("label") or ""), row.get("amount"), width=width))
    if not display.get("deduction_lines"):
        lines.append(_line_label_amount("Sin deducciones", 0, width=width))
    lines.append(_line_label_amount("TOTAL DEDUCCIONES", display.get("total_deductions"), width=width))
    lines.append(sep)
    lines.append(_line_label_amount("NETO A PAGAR", display.get("net_pay"), width=width))
    lines.append(sep)
    return [line for line in lines if line is not None]


def _escpos_align(mode: int) -> bytes:
    return bytes([0x1B, 0x61, mode & 0x03])


def _escpos_bold(enabled: bool) -> bytes:
    return bytes([0x1B, 0x45, 1 if enabled else 0])


def _escpos_font_b() -> bytes:
    return bytes([0x1B, 0x4D, 0x01])


def _escpos_feed(lines: int = 1) -> bytes:
    return bytes([0x1B, 0x64, max(0, min(255, int(lines)))])


def _escpos_cut() -> bytes:
    return b"\x1d\x56\x00"


def build_pay_stub_thermal_escpos(stub: Dict[str, Any], user_doc: Optional[Dict[str, Any]] = None) -> bytes:
    display = build_pay_stub_display(stub, user_doc)
    text_lines = build_pay_stub_text_lines(display)
    chunks: List[bytes] = [b"\x1b\x40", _escpos_font_b()]

    for idx, line in enumerate(text_lines):
        upper = line.upper()
        if idx <= 2 or "COMPROBANTE" in upper or "QUINCENA" in upper:
            chunks.append(_escpos_align(1))
        elif "NETO A PAGAR" in upper:
            chunks.append(_escpos_align(0))
            chunks.append(_escpos_bold(True))
        else:
            chunks.append(_escpos_align(0))
            chunks.append(_escpos_bold(False))

        chunks.append(_ascii_safe(line).encode("ascii", "replace") + b"\n")

    chunks.extend([_escpos_bold(False), _escpos_align(0), _escpos_feed(4), _escpos_cut()])
    return b"".join(chunks)


