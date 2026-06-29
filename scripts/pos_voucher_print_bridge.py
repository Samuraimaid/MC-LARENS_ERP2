#!/usr/bin/env python3
"""Puente local de impresión de vouchers POS 80mm (Windows, red o USB).

Expone HTTP en el puerto 9266 para que el ERP envíe ESC/POS a la impresora
compartida de ventas (típicamente impresora térmica 80mm en red).

Uso:
  python scripts/pos_voucher_print_bridge.py
"""

from __future__ import annotations

import base64
import json
import os
import secrets
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 9266
DEFAULT_PRINTER = "POS-80 Voucher"
STARTUP_TASK_NAME = "MCLarens-PosVoucherPrintBridge"
BRIDGE_TOKEN_HEADER = "X-MCLarens-Bridge-Token"


def _candidate_printer_names() -> list[str]:
    configured = str(os.environ.get("POS_VOUCHER_PRINTER_NAME") or DEFAULT_PRINTER).strip()
    return [name for name in [configured, DEFAULT_PRINTER, "POS-80 Voucher", "POS80"] if name]


def _is_virtual_printer_port(port_name: str) -> bool:
    port = str(port_name or "").strip().upper()
    if not port:
        return True
    virtual_prefixes = ("FILE", "PORTPROMPT", "NUL", "REDIRECTED")
    return any(port.startswith(prefix) for prefix in virtual_prefixes)


def _printer_sort_key(match: Dict[str, Any]) -> tuple[int, str]:
    port = str(match.get("port_name") or "")
    virtual = 1 if _is_virtual_printer_port(port) else 0
    return (virtual, str(match.get("printer_name") or ""))


def _finalize_printer_status(match: Dict[str, Any]) -> Dict[str, Any]:
    port_name = str(match.get("port_name") or "")
    offline = bool(int(match.get("printer_status") or 0) & 0x00000080)
    if _is_virtual_printer_port(port_name):
        return {
            **match,
            "connected": False,
            "available": False,
            "ready_for_vouchers": False,
            "port_issue": "virtual_file_port",
            "message": (
                f'La impresora "{match.get("printer_name")}" usa puerto virtual {port_name or "FILE"}. '
                "Configura un puerto de red (IP/TCP/WSD) o USB en Windows."
            ),
        }
    if offline:
        return {
            **match,
            "connected": False,
            "available": False,
            "ready_for_vouchers": False,
            "port_issue": "offline",
            "message": "Impresora POS desconectada u offline.",
        }
    return {
        **match,
        "connected": True,
        "available": True,
        "ready_for_vouchers": True,
        "port_issue": None,
        "message": f"Impresora POS lista en puerto {port_name}" if port_name else "Impresora POS lista",
    }


def _detect_printer() -> Dict[str, Any]:
    try:
        import win32print
    except ImportError:
        return {
            "connected": False,
            "available": False,
            "ready_for_vouchers": False,
            "message": "Instala pywin32: pip install pywin32",
        }

    matches: list[Dict[str, Any]] = []
    for candidate in _candidate_printer_names():
        try:
            handle = win32print.OpenPrinter(candidate)
        except Exception:
            continue
        try:
            info = win32print.GetPrinter(handle, 2)
            port_name = str(info.get("pPortName") or "")
            status = int(info.get("Status") or 0)
            matches.append(
                {
                    "printer_name": candidate,
                    "port_name": port_name,
                    "driver_name": str(info.get("pDriverName") or ""),
                    "printer_status": status,
                }
            )
        finally:
            win32print.ClosePrinter(handle)

    if not matches:
        return {
            "connected": False,
            "available": False,
            "ready_for_vouchers": False,
            "message": (
                "No se encontró la impresora POS configurada. "
                f"Instala en Windows una impresora con nombre similar a: {', '.join(_candidate_printer_names())}"
            ),
        }

    best = sorted(matches, key=_printer_sort_key)[0]
    return _finalize_printer_status(best)


def _token_file_path() -> Path:
    override = str(os.environ.get("POS_BRIDGE_TOKEN_FILE") or "").strip()
    if override:
        return Path(override)
    return Path(__file__).resolve().parent.parent / "backend" / "data" / "pos-voucher-bridge-token.txt"


def _read_bridge_token() -> str:
    env_token = str(os.environ.get("POS_BRIDGE_TOKEN") or "").strip()
    if env_token:
        return env_token
    token_file = _token_file_path()
    if token_file.exists():
        return token_file.read_text(encoding="utf-8").strip()
    return ""


def _ensure_bridge_token() -> str:
    existing = _read_bridge_token()
    if existing:
        return existing
    token = secrets.token_urlsafe(24)
    token_file = _token_file_path()
    token_file.parent.mkdir(parents=True, exist_ok=True)
    token_file.write_text(token, encoding="utf-8")
    return token


def _authorize_request(handler: BaseHTTPRequestHandler, *, require_token: bool) -> bool:
    if not require_token:
        return True
    expected = _read_bridge_token()
    if not expected:
        return True
    provided = str(handler.headers.get(BRIDGE_TOKEN_HEADER) or "").strip()
    return provided == expected


def _startup_task_status() -> Dict[str, Any]:
    result = subprocess.run(
        ["schtasks", "/Query", "/TN", STARTUP_TASK_NAME, "/FO", "LIST"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    installed = result.returncode == 0
    status = "unknown"
    if installed and result.stdout:
        for line in result.stdout.splitlines():
            if line.lower().startswith("status:"):
                status = line.split(":", 1)[1].strip().lower()
                break
    return {"installed": installed, "task_name": STARTUP_TASK_NAME, "task_status": status}


def _bridge_setup_payload() -> Dict[str, Any]:
    printer = _detect_printer()
    task = _startup_task_status()
    return {
        "bridge_version": "1.0",
        "bridge_port": int(os.environ.get("POS_BRIDGE_PORT") or DEFAULT_PORT),
        "bridge_host": str(os.environ.get("POS_BRIDGE_HOST") or DEFAULT_HOST),
        "auth_enabled": bool(_read_bridge_token()),
        "startup_task": task,
        "printer": printer,
        "ready_for_vouchers": bool(printer.get("ready_for_vouchers")),
        "autostart_configured": bool(task.get("installed")),
    }


def _print_raw_escpos(printer_name: str, payload: bytes) -> None:
    import win32print

    handle = win32print.OpenPrinter(printer_name)
    try:
        job = win32print.StartDocPrinter(handle, 1, ("MC-LARENS POS Voucher", None, "RAW"))
        try:
            win32print.StartPagePrinter(handle)
            win32print.WritePrinter(handle, payload)
            win32print.EndPagePrinter(handle)
        finally:
            win32print.EndDocPrinter(handle)
    finally:
        win32print.ClosePrinter(handle)


class PosVoucherBridgeHandler(BaseHTTPRequestHandler):
    server_version = "MCLarensPosVoucherBridge/1.0"

    def _send_json(self, status: int, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", f"Content-Type, {BRIDGE_TOKEN_HEADER}")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", f"Content-Type, {BRIDGE_TOKEN_HEADER}")
        self.end_headers()

    def do_GET(self) -> None:
        route = self.path.rstrip("/")
        if route == "/setup":
            self._send_json(200, _bridge_setup_payload())
            return
        if route in {"/status", "/health"}:
            self._send_json(200, _detect_printer())
            return
        self._send_json(404, {"detail": "Not found"})

    def do_POST(self) -> None:
        route = self.path.rstrip("/")
        if route != "/print":
            self._send_json(404, {"detail": "Not found"})
            return
        if not _authorize_request(self, require_token=True):
            self._send_json(401, {"detail": "Token de puente inválido"})
            return

        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            data = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json(400, {"detail": "JSON inválido"})
            return

        printer_name = str(data.get("printer_name") or "").strip()
        data_base64 = str(data.get("data_base64") or "").strip()
        if not data_base64:
            self._send_json(400, {"detail": "data_base64 requerido"})
            return
        try:
            payload = base64.b64decode(data_base64)
        except Exception:
            self._send_json(400, {"detail": "data_base64 inválido"})
            return

        status = _detect_printer()
        if not status.get("ready_for_vouchers"):
            self._send_json(503, {"detail": status.get("message") or "Impresora POS no disponible", **status})
            return

        target_printer = printer_name or str(status.get("printer_name") or DEFAULT_PRINTER)
        try:
            _print_raw_escpos(target_printer, payload)
        except Exception as exc:
            self._send_json(500, {"detail": f"No se pudo imprimir: {exc}", "printer_name": target_printer})
            return

        self._send_json(
            200,
            {
                "ok": True,
                "printer_name": target_printer,
                "bytes_sent": len(payload),
                "message": "Voucher enviado a impresora POS",
            },
        )

    def log_message(self, format: str, *args) -> None:
        return


def main() -> int:
    host = str(os.environ.get("POS_BRIDGE_HOST") or DEFAULT_HOST)
    port = int(os.environ.get("POS_BRIDGE_PORT") or DEFAULT_PORT)
    _ensure_bridge_token()
    server = ThreadingHTTPServer((host, port), PosVoucherBridgeHandler)
    print(f"POS voucher bridge listening on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Bridge detenido")
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())