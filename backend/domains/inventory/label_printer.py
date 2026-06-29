from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Any, Dict, Optional, Union

import httpx

DEFAULT_BRIDGE_URL = "http://host.docker.internal:9265"
DEFAULT_PRINTER_NAME = "Xprinter XP-460B"
BRIDGE_TIMEOUT_SECONDS = 4.0
BRIDGE_TOKEN_HEADER = "X-MCLarens-Bridge-Token"


def _bridge_base_url() -> str:
    return str(os.environ.get("LABEL_PRINT_BRIDGE_URL") or DEFAULT_BRIDGE_URL).rstrip("/")


def _configured_printer_name() -> str:
    return str(os.environ.get("LABEL_PRINTER_NAME") or DEFAULT_PRINTER_NAME).strip()


def _bridge_token_file_path() -> Path:
    override = str(os.environ.get("LABEL_BRIDGE_TOKEN_FILE") or "").strip()
    if override:
        return Path(override)
    return Path("/app/backend/data/label-bridge-token.txt")


def _bridge_token() -> str:
    configured = str(os.environ.get("LABEL_BRIDGE_TOKEN") or "").strip()
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


async def fetch_label_printer_status() -> Dict[str, Any]:
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
            "message": "Servicio de impresión local no disponible. Inicia label_print_bridge en este equipo.",
            "error": str(exc),
        }

    ready = bool(payload.get("ready_for_labels"))
    connected = ready if "ready_for_labels" in payload else bool(payload.get("connected"))
    return {
        "connected": connected,
        "available": connected,
        "ready_for_labels": ready,
        "bridge_reachable": True,
        "bridge_url": bridge_url,
        "printer_name": payload.get("printer_name") or printer_name,
        "port_name": payload.get("port_name"),
        "port_issue": payload.get("port_issue"),
        "driver_name": payload.get("driver_name"),
        "printer_status": payload.get("printer_status"),
        "message": payload.get("message")
        or ("Impresora lista para imprimir" if connected else "Impresora no detectada en USB/sistema"),
    }


async def fetch_label_bridge_setup() -> Dict[str, Any]:
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
            "ready_for_labels": False,
            "autostart_configured": False,
            "message": "Puente local no disponible. Ejecuta start-label-print-bridge.ps1 en la PC del almacén.",
            "error": str(exc),
        }

    printer = payload.get("printer") or {}
    startup_task = payload.get("startup_task") or {}
    ready = bool(printer.get("ready_for_labels", payload.get("ready_for_labels")))
    connected = ready if "ready_for_labels" in printer else bool(printer.get("connected"))
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
        "ready_for_labels": ready,
        "autostart_configured": bool(payload.get("autostart_configured")),
        "startup_task": startup_task,
        "message": printer.get("message")
        or ("Listo para imprimir etiquetas" if connected else "Impresora no detectada"),
    }


async def install_label_bridge_startup_task() -> Dict[str, Any]:
    setup = await fetch_label_bridge_setup()
    if not setup.get("bridge_reachable"):
        raise RuntimeError(setup.get("message") or "Puente local no disponible")

    bridge_url = _bridge_base_url()
    async with httpx.AsyncClient(timeout=BRIDGE_TIMEOUT_SECONDS) as client:
        response = await client.post(
            f"{bridge_url}/install-startup-task",
            json={},
            headers=_bridge_headers(include_token=True),
        )
        if response.status_code >= 400:
            detail = response.text
            try:
                body = response.json()
                detail = body.get("message") or body.get("detail") or detail
            except Exception:
                pass
            raise RuntimeError(str(detail))
        result = response.json()

    refreshed = await fetch_label_bridge_setup()
    return {
        **result,
        "setup": refreshed,
    }


async def print_test_label(
    *,
    station_name: str = "PC Bodega",
    branch: Optional[Dict[str, Any]] = None,
    warehouse: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    from backend.domains.inventory.product_labels import (
        build_label_payload,
        render_labels_tspl_bytes,
        resolve_template,
    )

    branch_doc = dict(branch or {})
    warehouse_doc = dict(warehouse or {"name": station_name or "PC Bodega"})
    if not warehouse_doc.get("name"):
        warehouse_doc["name"] = station_name or "PC Bodega"

    label = build_label_payload(
        product={
            "sku": "TEST-ETIQUETA",
            "name": "Etiqueta de prueba MC-LARENS",
            "price": 0,
            "barcode": "TEST-ETIQUETA",
        },
        branch=branch_doc,
        warehouse=warehouse_doc,
        template=resolve_template("col_50x100"),
        quantity=1,
        show_price=False,
    )
    tspl = render_labels_tspl_bytes(label)
    bridge_result = await send_tspl_to_label_printer(tspl, copies=1)
    return {
        "ok": True,
        "message": "Etiqueta de prueba enviada a la impresora",
        "bridge": bridge_result,
    }


async def send_tspl_to_label_printer(
    tspl_payload: Union[str, bytes],
    *,
    printer_name: Optional[str] = None,
    copies: int = 1,
) -> Dict[str, Any]:
    status = await fetch_label_printer_status()
    if not status.get("connected") or not status.get("ready_for_labels", status.get("connected")):
        raise RuntimeError(status.get("message") or "La impresora no está conectada")

    bridge_url = _bridge_base_url()
    payload: Dict[str, Any] = {
        "printer_name": printer_name or status.get("printer_name") or _configured_printer_name(),
        "language": "TSPL",
        "copies": max(1, int(copies or 1)),
    }
    if isinstance(tspl_payload, bytes):
        payload["data_base64"] = base64.b64encode(tspl_payload).decode("ascii")
    else:
        payload["data"] = tspl_payload

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