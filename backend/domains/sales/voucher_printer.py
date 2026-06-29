from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

DEFAULT_BRIDGE_URL = "http://host.docker.internal:9266"
DEFAULT_PRINTER_NAME = "POS-80 Voucher"
BRIDGE_TIMEOUT_SECONDS = 4.0
BRIDGE_TOKEN_HEADER = "X-MCLarens-Bridge-Token"


def _bridge_base_url() -> str:
    return str(os.environ.get("POS_VOUCHER_BRIDGE_URL") or DEFAULT_BRIDGE_URL).rstrip("/")


def _configured_printer_name() -> str:
    return str(os.environ.get("POS_VOUCHER_PRINTER_NAME") or DEFAULT_PRINTER_NAME).strip()


def _bridge_token_file_path() -> Path:
    override = str(os.environ.get("POS_BRIDGE_TOKEN_FILE") or "").strip()
    if override:
        return Path(override)
    return Path("/app/backend/data/pos-voucher-bridge-token.txt")


def _bridge_token() -> str:
    configured = str(os.environ.get("POS_BRIDGE_TOKEN") or "").strip()
    if configured:
        return configured
    token_file = _bridge_token_file_path()
    if token_file.exists():
        return token_file.read_text(encoding="utf-8").strip()
    return ""


def _bridge_headers(*, include_token: bool = False) -> Dict[str, str]:
    headers: Dict[str, str] = {}
    if include_token:
        token = _bridge_token()
        if token:
            headers[BRIDGE_TOKEN_HEADER] = token
    return headers


async def fetch_pos_voucher_printer_status() -> Dict[str, Any]:
    bridge_url = _bridge_base_url()
    printer_name = _configured_printer_name()
    try:
        async with httpx.AsyncClient(timeout=BRIDGE_TIMEOUT_SECONDS) as client:
            response = await client.get(f"{bridge_url}/status")
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        return {
            "connected": False,
            "available": False,
            "bridge_reachable": False,
            "bridge_url": bridge_url,
            "printer_name": printer_name,
            "message": "Puente POS no disponible. Inicia pos_voucher_print_bridge en la PC de ventas/caja.",
            "error": str(exc),
        }

    ready = bool(payload.get("ready_for_vouchers", payload.get("connected")))
    return {
        "connected": ready,
        "available": ready,
        "ready_for_vouchers": ready,
        "bridge_reachable": True,
        "bridge_url": bridge_url,
        "printer_name": payload.get("printer_name") or printer_name,
        "port_name": payload.get("port_name"),
        "port_issue": payload.get("port_issue"),
        "driver_name": payload.get("driver_name"),
        "printer_status": payload.get("printer_status"),
        "message": payload.get("message")
        or ("Impresora POS lista" if ready else "Impresora POS no detectada"),
    }


async def fetch_pos_voucher_bridge_setup() -> Dict[str, Any]:
    bridge_url = _bridge_base_url()
    printer_name = _configured_printer_name()
    try:
        async with httpx.AsyncClient(timeout=BRIDGE_TIMEOUT_SECONDS) as client:
            response = await client.get(f"{bridge_url}/setup")
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        return {
            "bridge_reachable": False,
            "bridge_url": bridge_url,
            "printer_name": printer_name,
            "ready_for_vouchers": False,
            "autostart_configured": False,
            "message": "Puente POS no disponible.",
            "error": str(exc),
        }

    printer = payload.get("printer") or {}
    startup_task = payload.get("startup_task") or {}
    ready = bool(printer.get("ready_for_vouchers", payload.get("ready_for_vouchers")))
    connected = ready if "ready_for_vouchers" in printer else bool(printer.get("connected"))
    return {
        "bridge_reachable": True,
        "bridge_url": bridge_url,
        "bridge_version": payload.get("bridge_version"),
        "bridge_host": payload.get("bridge_host"),
        "auth_enabled": bool(payload.get("auth_enabled")),
        "printer_name": printer.get("printer_name") or printer_name,
        "port_name": printer.get("port_name"),
        "port_issue": printer.get("port_issue"),
        "driver_name": printer.get("driver_name"),
        "printer_status": printer.get("printer_status"),
        "connected": connected,
        "available": connected,
        "ready_for_vouchers": ready,
        "autostart_configured": bool(payload.get("autostart_configured")),
        "startup_task": startup_task,
        "message": printer.get("message")
        or ("Listo para vouchers POS" if connected else "Impresora POS no detectada"),
    }


async def send_escpos_to_pos_voucher_printer(
    escpos_payload: bytes,
    *,
    printer_name: Optional[str] = None,
) -> Dict[str, Any]:
    status = await fetch_pos_voucher_printer_status()
    if not status.get("connected"):
        raise RuntimeError(status.get("message") or "La impresora POS no está disponible")

    bridge_url = _bridge_base_url()
    payload: Dict[str, Any] = {
        "printer_name": printer_name or status.get("printer_name") or _configured_printer_name(),
        "data_base64": base64.b64encode(escpos_payload).decode("ascii"),
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{bridge_url}/print",
            json=payload,
            headers=_bridge_headers(include_token=True),
        )
        if response.status_code >= 400:
            detail = response.text
            try:
                detail = response.json().get("detail") or response.json().get("message") or detail
            except Exception:
                pass
            raise RuntimeError(str(detail))
        return response.json()


async def print_test_pos_voucher() -> Dict[str, Any]:
    from backend.domains.sales.seller_voucher_escpos import build_seller_voucher_escpos

    sample = {
        "invoice_number": "INV-TEST-0001",
        "customer_name": "Cliente de prueba",
        "total": 100.0,
        "currency": "NIO",
    }
    escpos = build_seller_voucher_escpos(sample, text_lines=[
        "Factura: INV-TEST-0001",
        "Cliente: Cliente de prueba",
        "Total: 100.00 NIO",
        "PRUEBA DE IMPRESORA POS",
    ])
    bridge_result = await send_escpos_to_pos_voucher_printer(escpos)
    return {
        "ok": True,
        "message": "Voucher de prueba enviado a impresora POS",
        "bridge": bridge_result,
    }