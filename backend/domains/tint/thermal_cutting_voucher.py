"""
MC-LARENS ERP: Generador de Voucher Térmico de Corte con Croquis Vehicular (80mm)
================================================================================
Produce el formato de impresión térmica en ESC/POS, texto plano y HTML
con el croquis estructurado del auto, metrajes en múltiplos de 0.5m y código de barras.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

CHAR_WIDTH_80MM = 44  # Ancho estándar para papel de 80mm


def _center(text: str, width: int = CHAR_WIDTH_80MM) -> str:
    return text.center(width)[:width]


def _divider(char: str = "-", width: int = CHAR_WIDTH_80MM) -> str:
    return char * width


def build_thermal_cutting_voucher_text_lines(cutting_order: Dict[str, Any]) -> List[str]:
    """
    Genera las líneas de texto formateadas para impresora térmica de 80mm.
    """
    lines: List[str] = []

    cut_id = cutting_order.get("cut_order_id", "CUT-N/A")
    invoice = cutting_order.get("invoice_number", "S/F")
    created_at = cutting_order.get("created_at", "")
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        date_str = dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        date_str = created_at[:16] if created_at else ""

    customer = cutting_order.get("customer_name", "Cliente Mostrador")
    phone = cutting_order.get("customer_phone", "")
    veh = cutting_order.get("vehicle_info") or {}
    veh_name = f"{veh.get('brand', '')} {veh.get('model', '')} {veh.get('year', '')}".strip() or "Vehículo"
    plate = veh.get("plate") or "S/P"
    color = veh.get("color") or ""
    tech_name = cutting_order.get("assigned_technician_name") or "Por Asignar"

    # Encabezado
    lines.append(_divider("="))
    lines.append(_center("MC-LARENS AUTOMOTRIZ"))
    lines.append(_center("ORDEN DE CORTE DE POLARIZADO"))
    lines.append(_divider("="))
    lines.append(f"ORDEN: #{cut_id}   FACTURA: #{invoice}")
    lines.append(f"FECHA: {date_str}")
    lines.append(f"CLIENTE: {customer[:28]}")
    if phone:
        lines.append(f"TEL: {phone}")
    lines.append(_divider("-"))
    lines.append(f"VEHICULO: {veh_name[:32]}")
    lines.append(f"PLACA: {plate.upper()}  COLOR: {color.upper()}")
    lines.append(_divider("="))
    lines.append(_center("CROQUIS DE CRISTALES Y TONALIDADES"))
    lines.append(_divider("-"))

    # Extraer cortes por zona para el croquis
    cuts = cutting_order.get("cuts", [])
    cut_map = {c.get("zone"): c for c in cuts}

    w_cut = cut_map.get("windshield")
    sides_all = cut_map.get("sides_all")
    fs_cut = cut_map.get("front_sides") or sides_all
    rs_cut = cut_map.get("rear_sides") or sides_all
    r_cut = cut_map.get("rear")
    top_strip = cut_map.get("windshield_top")

    # 1. Banda Frontal
    if top_strip:
        lines.append("        +---------------------------+")
        lines.append(f"        | [ BANDA FRONTAL: {top_strip.get('material_name', '')[:10]} ] |")
        lines.append(f"        | Corte: {top_strip.get('meters', 0.5):.2f}m x 20\"        |")
        lines.append("        +---------------------------+")

    # 2. Parabrisas
    if w_cut:
        lines.append("        +---------------------------+")
        lines.append("        | [ PARABRISAS DELANTERO ]  |")
        lines.append(f"        | {w_cut.get('material_name', '')[:25]} |")
        lines.append(f"        | Corte: {w_cut.get('meters', 1.5):.2f}m x {w_cut.get('roll_width_inches', 40)}\"        |")
        lines.append("        +---------------------------+")
    else:
        lines.append("        | Parabrisas: NO CONTRATADO |")

    # 3. Laterales
    lines.append("+--------------------+----------------------+")
    fs_label = fs_cut.get("material_name", "Sin polarizar")[:18] if fs_cut else "No contratado"
    rs_label = rs_cut.get("material_name", "Sin polarizar")[:18] if rs_cut else "No contratado"
    fs_m = f"{fs_cut.get('meters', 1.0):.2f}m x 20\"" if fs_cut else "--"
    rs_m = f"{rs_cut.get('meters', 1.0):.2f}m x 20\"" if rs_cut else "--"
    lines.append("| DELANTEROS:        | TRASEROS:            |")
    lines.append(f"| {fs_label:<18} | {rs_label:<20} |")
    lines.append(f"| Corte: {fs_m:<11} | Corte: {rs_m:<13} |")
    lines.append("+--------------------+----------------------+")

    # 4. Vidrio Trasero (Luneta)
    if r_cut:
        lines.append("        +---------------------------+")
        emp_note = " (Empalme 2x20\")" if r_cut.get("is_empalme") else ""
        lines.append(f"        | [ VIDRIO TRASERO{emp_note} ] |")
        lines.append(f"        | {r_cut.get('material_name', '')[:25]} |")
        lines.append(f"        | Corte: {r_cut.get('meters', 1.5):.2f}m x {r_cut.get('roll_width_inches', 40)}\"        |")
        lines.append("        +---------------------------+")
    else:
        lines.append("        | Vidrio Trasero: NO CONTRATADO |")

    lines.append(_divider("-"))
    lines.append(_center("RESUMEN DE ROLLOS A DESPACHAR"))
    lines.append(_divider("-"))

    # Resumen agrupado de rollos
    roll_summary = cutting_order.get("roll_summary", [])
    for idx, r in enumerate(roll_summary, 1):
        lines.append(f"{idx}. {r.get('roll_width_label', 'Rollo')} | {r.get('material_name', '')[:24]}")
        lines.append(f"   -> {r.get('total_meters', 0.0):.2f} Metros ({', '.join(r.get('zones', []))[:30]})")

    # Ajustes adicionales si existen
    adjustments = cutting_order.get("adjustments", [])
    if adjustments:
        lines.append(_divider("."))
        lines.append("ADICIONES / MERMA AUTORIZADA:")
        for adj in adjustments:
            lines.append(f" + {adj.get('meters', 0.5):.2f}m : {adj.get('reason', '')[:26]}")

    total_m = float(cutting_order.get("total_meters", 0.0)) + float(cutting_order.get("additional_meters_total", 0.0))
    lines.append(_divider("="))
    lines.append(f"TOTAL METRAJE A DESPACHAR: {total_m:.2f} METROS")
    lines.append(_divider("="))
    lines.append(f"POLARIZADOR ASIGNADO: {tech_name}")
    if cutting_order.get("notes"):
        lines.append(f"OBS: {cutting_order.get('notes')[:40]}")
    lines.append("")
    lines.append(_center(f"||||||||||||||||||||||||||||"))
    lines.append(_center(f"*{cut_id}*"))
    lines.append(_divider("="))
    lines.append(_center("COMPROBANTE OPERATIVO DE TALLER"))
    lines.append("")
    lines.append("")

    return lines


def build_thermal_cutting_voucher_escpos(cutting_order: Dict[str, Any]) -> bytes:
    """
    Genera el payload binario ESC/POS estándar listo para enviar a puerto de impresora de 80mm.
    """
    lines = build_thermal_cutting_voucher_text_lines(cutting_order)
    raw = bytearray()

    # Inicializar impresora
    raw.extend(b"\x1b@")  # ESC @ (Init)
    raw.extend(b"\x1b!\x00")  # ESC ! 0 (Normal font)

    for line in lines:
        if "MC-LARENS AUTOMOTRIZ" in line or "ORDEN DE CORTE" in line:
            raw.extend(b"\x1b!\x08")  # Bold
            raw.extend(line.encode("latin-1", errors="replace") + b"\n")
            raw.extend(b"\x1b!\x00")
        elif "TOTAL METRAJE A DESPACHAR" in line:
            raw.extend(b"\x1b!\x08")  # Bold
            raw.extend(line.encode("latin-1", errors="replace") + b"\n")
            raw.extend(b"\x1b!\x00")
        else:
            raw.extend(line.encode("latin-1", errors="replace") + b"\n")

    # Avance de papel y corte automático
    raw.extend(b"\n\n\n\n")
    raw.extend(b"\x1dV\x00")  # GS V 0 (Cut paper)

    return bytes(raw)


def build_thermal_cutting_voucher_html(cutting_order: Dict[str, Any]) -> str:
    """
    Genera el HTML listo para imprimir directamente desde el navegador en formato ticket (80mm).
    """
    lines = build_thermal_cutting_voucher_text_lines(cutting_order)
    text_content = "\n".join(lines)

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Orden de Corte #{cutting_order.get('cut_order_id', '')}</title>
    <style>
        @page {{
            size: 80mm auto;
            margin: 0;
        }}
        body {{
            font-family: 'Courier New', Courier, monospace;
            font-size: 11.5px;
            line-height: 1.25;
            width: 76mm;
            margin: 2mm auto;
            padding: 0;
            color: #000;
            background: #fff;
        }}
        pre {{
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
            font-family: inherit;
        }}
        .no-print {{
            text-align: center;
            margin-bottom: 12px;
        }}
        @media print {{
            .no-print {{ display: none; }}
        }}
        .btn {{
            background: #2563eb;
            color: #fff;
            padding: 6px 14px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            border: none;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div class="no-print">
        <button class="btn" onclick="window.print()">🖨️ Imprimir Ticket de Corte (80mm)</button>
    </div>
    <pre>{text_content}</pre>
    <script>
        window.addEventListener('load', () => {{
            if (window.location.search.includes('autoprint=true')) {{
                window.print();
            }}
        }});
    </script>
</body>
</html>"""
