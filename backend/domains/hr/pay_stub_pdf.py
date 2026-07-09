"""PDF pay stub (colilla de pago) generation."""
from __future__ import annotations

import io
from typing import Any, Dict, Tuple


def draw_pay_stub_pdf(stub: Dict[str, Any], *, letter: Any, canvas: Any) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y = height - 40

    def line(text: str, *, bold: bool = False, size: int = 10) -> None:
        nonlocal y
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        pdf.drawString(40, y, text[:95])
        y -= size + 4

    def money(value: Any) -> str:
        return f"C$ {float(value or 0):,.2f}"

    line("COMPROBANTE DE PAGO", bold=True, size=14)
    line(str(stub.get("branch_name") or stub.get("branch_id") or "Sucursal"), size=11)
    y -= 4
    line(f"Empleado: {stub.get('user_name') or '-'}", bold=True)
    line(f"Periodo: {stub.get('period_label') or '-'} ({stub.get('period_start')} a {stub.get('period_end')})")
    line(f"Fecha de pago: {stub.get('pay_date') or '-'}")
    y -= 6
    line("INGRESOS", bold=True)
    line(f"Salario base proporcional: {money(stub.get('base_salary_proportional'))}")
    line(f"Comisiones aprobadas: {money(stub.get('commissions'))}")
    if float(stub.get("workshop_commissions") or 0) > 0:
        line(f"  · Taller (OT): {money(stub.get('workshop_commissions'))} ({stub.get('workshop_jobs_count') or 0} trabajos)")
    line(f"Bono puntualidad/asistencia: {money(stub.get('attendance_bonus'))}")
    line(f"Total ingresos brutos: {money(stub.get('gross_earnings'))}", bold=True)
    y -= 6
    line("DEDUCCIONES", bold=True)
    deductions = stub.get("deductions_breakdown") or []
    if not deductions:
        line("Sin deducciones")
    else:
        for item in deductions:
            label = str(item.get("label") or item.get("type") or "Deducción")
            line(f"  {label}: {money(item.get('amount'))}")
    line(f"Total deducciones: {money(stub.get('total_deductions'))}", bold=True)
    y -= 8
    line(f"NETO RECIBIDO: {money(stub.get('net_pay'))}", bold=True, size=12)
    if stub.get("has_social_security"):
        line(f"INSS Laboral ({float(stub.get('inss_rate') or 0) * 100:.0f}%): {money(stub.get('inss_amount'))}", size=9)
    line(f"Semáforo asistencia: {stub.get('attendance_compliance') or '-'}", size=9)
    pdf.line(40, y, width - 40, y)
    y -= 14
    line("Documento generado por MC-LARENS ERP · Recursos Humanos", size=8)
    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()