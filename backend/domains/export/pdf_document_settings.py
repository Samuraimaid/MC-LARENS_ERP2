"""Per-document PDF section toggles (facturas, cotizaciones, abonos, caja chica)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, Tuple

PDF_DOCUMENT_TYPES: Tuple[str, ...] = (
    "invoice",
    "quotation",
    "payment_receipt",
    "petty_cash",
)

DEFAULT_INVOICE_SECTIONS: Dict[str, bool] = {
    "header_logo": True,
    "company_name": True,
    "company_tagline": True,
    "status_badge": True,
    "salesperson": True,
    "document_number": True,
    "date": True,
    "customer": True,
    "customer_tax_id": True,
    "customer_phone": True,
    "customer_email": True,
    "customer_address": True,
    "vehicle": True,
    "plate": True,
    "vin": True,
    "vehicle_color": True,
    "items": True,
    "items_installed_group": True,
    "items_carry_group": True,
    "breakdown": True,
    "breakdown_gross_subtotal": True,
    "breakdown_line_discount": True,
    "breakdown_global_discount": True,
    "breakdown_subtotal": True,
    "breakdown_iva": True,
    "breakdown_retention": True,
    "breakdown_total": True,
    "payment_details": True,
    "notes": True,
    "company_footer": True,
    "watermark": True,
}

DEFAULT_QUOTATION_SECTIONS: Dict[str, bool] = {
    "header_logo": True,
    "company_name": True,
    "status_badge": True,
    "document_number": True,
    "date": True,
    "customer": True,
    "customer_phone": True,
    "vehicle": True,
    "plate": True,
    "items": True,
    "breakdown": True,
    "breakdown_gross_subtotal": True,
    "breakdown_line_discount": True,
    "breakdown_global_discount": True,
    "breakdown_subtotal": True,
    "breakdown_iva": True,
    "breakdown_total": True,
    "notes": True,
    "company_footer": True,
    "watermark": True,
}

DEFAULT_PAYMENT_RECEIPT_SECTIONS: Dict[str, bool] = {
    "header_logo": True,
    "company_name": True,
    "status_badge": True,
    "document_title": True,
    "invoice_number": True,
    "customer": True,
    "payment_date": True,
    "payment_method": True,
    "amount_this_payment": True,
    "amount_paid_total": True,
    "amount_pending": True,
    "invoice_total": True,
    "disclaimer": True,
    "company_footer": True,
    "watermark": True,
}

DEFAULT_PETTY_CASH_SECTIONS: Dict[str, bool] = {
    "header_logo": True,
    "company_name": True,
    "status_badge": True,
    "voucher_number": True,
    "date": True,
    "branch": True,
    "beneficiary": True,
    "category": True,
    "description": True,
    "amount": True,
    "payment_method": True,
    "authorized_by": True,
    "received_by": True,
    "notes": True,
    "company_footer": True,
    "watermark": True,
}

DEFAULT_PDF_DOCUMENT_SECTIONS: Dict[str, Dict[str, bool]] = {
    "invoice": deepcopy(DEFAULT_INVOICE_SECTIONS),
    "quotation": deepcopy(DEFAULT_QUOTATION_SECTIONS),
    "payment_receipt": deepcopy(DEFAULT_PAYMENT_RECEIPT_SECTIONS),
    "petty_cash": deepcopy(DEFAULT_PETTY_CASH_SECTIONS),
}

PETTY_CASH_CATEGORY_LABELS: Dict[str, str] = {
    "insumos_limpieza": "Insumos de limpieza",
    "viaticos": "Viáticos",
    "adelanto_salario": "Adelanto de salario",
    "bono_transporte": "Bono de transporte",
    "alimentacion": "Alimentación",
    "otros": "Otros gastos",
}

_DOCUMENT_DEFAULTS = {
    "invoice": DEFAULT_INVOICE_SECTIONS,
    "quotation": DEFAULT_QUOTATION_SECTIONS,
    "payment_receipt": DEFAULT_PAYMENT_RECEIPT_SECTIONS,
    "petty_cash": DEFAULT_PETTY_CASH_SECTIONS,
}


def normalize_pdf_document_sections(raw: Any = None) -> Dict[str, Dict[str, bool]]:
    source = raw if isinstance(raw, dict) else {}
    normalized: Dict[str, Dict[str, bool]] = {}
    for doc_type in PDF_DOCUMENT_TYPES:
        defaults = _DOCUMENT_DEFAULTS[doc_type]
        incoming = source.get(doc_type) if isinstance(source.get(doc_type), dict) else {}
        normalized[doc_type] = {
            key: bool(incoming.get(key, defaults[key]))
            for key in defaults
        }
    return normalized


def merge_pdf_document_sections(
    current: Dict[str, Dict[str, bool]],
    payload: Dict[str, Any] | None,
) -> Dict[str, Dict[str, bool]]:
    base = normalize_pdf_document_sections(current)
    if not isinstance(payload, dict):
        return base
    merged = deepcopy(base)
    for doc_type in PDF_DOCUMENT_TYPES:
        incoming = payload.get(doc_type)
        if not isinstance(incoming, dict):
            continue
        defaults = _DOCUMENT_DEFAULTS[doc_type]
        for key, value in incoming.items():
            if key in defaults and value is not None:
                merged[doc_type][key] = bool(value)
    return normalize_pdf_document_sections(merged)


def pdf_section_enabled(
    settings: Dict[str, Any],
    doc_type: str,
    section_key: str,
    *,
    fallback: bool = True,
) -> bool:
    sections_root = settings.get("sections") if isinstance(settings.get("sections"), dict) else {}
    doc_sections = sections_root.get(doc_type) if isinstance(sections_root.get(doc_type), dict) else {}
    defaults = _DOCUMENT_DEFAULTS.get(doc_type, {})
    if section_key.startswith("breakdown_") and section_key != "breakdown":
        if not bool(doc_sections.get("breakdown", defaults.get("breakdown", True))):
            return False
    if section_key in doc_sections:
        return bool(doc_sections[section_key])
    if section_key in defaults:
        return bool(defaults[section_key])
    return fallback