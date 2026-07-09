from backend.domains.hr.pay_stub_document import build_pay_stub_thermal_escpos
from backend.domains.hr.pay_stub_pdf import draw_pay_stub_pdf_mobile
from backend.domains.export.dependencies import get_reportlab_symbols as get_symbols

stub = {
    "stub_id": "ps_test",
    "branch_id": "branch_main",
    "user_name": "Juan Perez",
    "period_start": "2026-02-11",
    "period_end": "2026-02-25",
    "base_salary_proportional": 5000,
    "commissions": 750,
    "gross_earnings": 5750,
    "inss_amount": 402.5,
    "has_social_security": True,
    "deductions_breakdown": [{"type": "inss_laboral", "amount": 402.5}],
    "total_deductions": 402.5,
    "net_pay": 5347.5,
}

_, _, _, canvas = get_symbols()
pdf = draw_pay_stub_pdf_mobile(stub, canvas=canvas)
text = pdf.decode("latin-1", errors="ignore").upper()
print("pdf_len", len(pdf))
for key in ("MUNDO DE ACCESORIOS", "INSS", "NETO A PAGAR"):
    print("pdf", key, key in text)

esc = build_pay_stub_thermal_escpos(stub)
text2 = esc.decode("latin-1", errors="ignore").upper()
print("thermal_len", len(esc))
for key in ("MUNDO DE ACCESORIOS", "INSS", "NETO A PAGAR"):
    print("thermal", key, key in text2)