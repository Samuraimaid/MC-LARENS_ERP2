#!/usr/bin/env python3
"""Puente local de impresión de etiquetas (Windows).

Expone HTTP en el puerto 9265 para que el ERP envíe TSPL directo a la
impresora USB instalada (Xprinter XP-460B).

Uso:
  python scripts/label_print_bridge.py

Requisitos en Windows:
  pip install pywin32
"""

from __future__ import annotations

import base64
import json
import os
import secrets
import subprocess
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 9265
DEFAULT_PRINTER = "Xprinter XP-460B"
STARTUP_TASK_NAME = "MCLarens-LabelPrintBridge"
BRIDGE_TOKEN_HEADER = "X-MCLarens-Bridge-Token"


def _candidate_printer_names() -> list[str]:
    configured = str(os.environ.get("LABEL_PRINTER_NAME") or DEFAULT_PRINTER).strip()
    return [name for name in [configured, DEFAULT_PRINTER, "Xprinter XP-460B"] if name]


def _is_virtual_printer_port(port_name: str) -> bool:
    port = str(port_name or "").strip().upper()
    if not port:
        return True
    virtual_prefixes = ("FILE", "PORTPROMPT", "NUL", "REDIRECTED")
    return any(port.startswith(prefix) for prefix in virtual_prefixes)


def _is_usb_printer_port(port_name: str) -> bool:
    return str(port_name or "").strip().upper().startswith("USB")


def _printer_sort_key(match: Dict[str, Any]) -> tuple[int, int, str]:
    port = str(match.get("port_name") or "")
    virtual = 1 if _is_virtual_printer_port(port) else 0
    usb = 0 if _is_usb_printer_port(port) else 1
    return (virtual, usb, str(match.get("printer_name") or ""))


def _finalize_printer_status(match: Dict[str, Any]) -> Dict[str, Any]:
    port_name = str(match.get("port_name") or "")
    offline = bool(int(match.get("printer_status") or 0) & 0x00000080)
    if _is_virtual_printer_port(port_name):
        return {
            **match,
            "connected": False,
            "available": False,
            "ready_for_labels": False,
            "port_issue": "virtual_file_port",
            "message": (
                f'La impresora "{match.get("printer_name")}" usa el puerto {port_name or "FILE"} '
                "(imprimir a archivo). Windows abrirá un cuadro para guardar archivo en lugar de imprimir. "
                "Ve a Configuracion > Impresoras > Xprinter XP-460B > Propiedades > pestana Puertos "
                "y marca el puerto USB (USB001, USB002…). Desconecta la opción 'FILE:'."
            ),
        }
    if offline:
        return {
            **match,
            "connected": False,
            "available": False,
            "ready_for_labels": False,
            "port_issue": "offline",
            "message": "Impresora desconectada u offline. Revisa cable USB y encendido.",
        }
    return {
        **match,
        "connected": True,
        "available": True,
        "ready_for_labels": True,
        "port_issue": None,
        "message": f"Impresora lista en puerto {port_name}" if port_name else "Impresora lista para imprimir",
    }


def _detect_printer() -> Dict[str, Any]:
    try:
        import win32print
    except ImportError:
        return {
            "connected": False,
            "message": "Falta pywin32. Ejecuta: pip install pywin32",
            "error": "pywin32_missing",
        }

    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    printers = win32print.EnumPrinters(flags)
    indexed: Dict[str, Dict[str, Any]] = {}
    for entry in printers:
        printer_name = str(entry[2] if len(entry) > 2 else entry[-1])
        port_name = ""
        driver_name = str(entry[3] if len(entry) > 3 else "")
        printer_status = 0
        try:
            handle = win32print.OpenPrinter(printer_name)
            try:
                info = win32print.GetPrinter(handle, 2) or {}
                port_name = str(info.get("pPortName") or "")
                driver_name = str(info.get("pDriverName") or driver_name)
                printer_status = int(info.get("Status") or 0)
            finally:
                win32print.ClosePrinter(handle)
        except Exception:
            pass
        indexed[printer_name] = {
            "printer_name": printer_name,
            "port_name": port_name,
            "driver_name": driver_name,
            "printer_status": printer_status,
        }

    candidates: list[Dict[str, Any]] = []
    seen_names: set[str] = set()
    for name in _candidate_printer_names():
        match = indexed.get(name)
        if match and match["printer_name"] not in seen_names:
            candidates.append(match)
            seen_names.add(match["printer_name"])

    for data in indexed.values():
        printer_name = str(data.get("printer_name") or "")
        lowered = printer_name.lower()
        if printer_name in seen_names:
            continue
        if "xprinter" in lowered or "xp-460" in lowered:
            candidates.append(data)
            seen_names.add(printer_name)

    if candidates:
        candidates.sort(key=_printer_sort_key)
        return _finalize_printer_status(candidates[0])

    return {
        "connected": False,
        "available": False,
        "ready_for_labels": False,
        "port_issue": "not_found",
        "message": "No se encontró Xprinter XP-460B. Verifica cable USB y drivers.",
        "installed_printers": sorted(indexed.keys()),
    }


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _starter_script_path() -> Path:
    return _repo_root() / "scripts" / "start-label-print-bridge.ps1"


def _token_file_path() -> Path:
    override = str(os.environ.get("LABEL_BRIDGE_TOKEN_FILE") or "").strip()
    if override:
        return Path(override)
    return _repo_root() / "backend" / "data" / "label-bridge-token.txt"


def _read_bridge_token() -> str:
    configured = str(os.environ.get("LABEL_BRIDGE_TOKEN") or "").strip()
    if configured:
        return configured
    token_file = _token_file_path()
    if not token_file.exists():
        return ""
    return token_file.read_text(encoding="utf-8").strip()


def _ensure_bridge_token() -> str:
    existing = _read_bridge_token()
    if existing:
        return existing

    token = secrets.token_urlsafe(32)
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
    return {
        "installed": installed,
        "task_name": STARTUP_TASK_NAME,
        "task_status": status,
        "starter_script": str(_starter_script_path()),
    }


def _install_startup_task() -> Dict[str, Any]:
    starter = _starter_script_path()
    if not starter.exists():
        return {
            "ok": False,
            "message": f"No se encontró el script de inicio: {starter}",
        }

    bridge_token = _ensure_bridge_token()

    ps_command = (
        f"$action = New-ScheduledTaskAction -Execute 'powershell.exe' "
        f"-Argument '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"{starter}\"'; "
        f"$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME; "
        f"$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable; "
        f"Register-ScheduledTask -TaskName '{STARTUP_TASK_NAME}' -Action $action -Trigger $trigger "
        f"-Settings $settings -Description 'Puente USB etiquetas MC-LARENS ERP' -Force"
    )
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_command],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "Error desconocido").strip()
        return {
            "ok": False,
            "message": f"No se pudo registrar la tarea: {detail}",
            "hint": "Ejecuta PowerShell como administrador o usa install-label-print-bridge-task.ps1 una vez.",
        }

    task = _startup_task_status()
    return {
        "ok": True,
        "message": "Tarea de inicio automático registrada en Windows",
        "task_name": STARTUP_TASK_NAME,
        "task_status": task.get("task_status"),
        "starter_script": str(starter),
        "bridge_token_configured": bool(bridge_token),
        "bridge_token_file": str(_token_file_path()),
    }


def _bridge_setup_payload() -> Dict[str, Any]:
    printer = _detect_printer()
    task = _startup_task_status()
    return {
        "bridge_version": "1.2",
        "bridge_port": int(os.environ.get("LABEL_BRIDGE_PORT") or DEFAULT_PORT),
        "bridge_host": str(os.environ.get("LABEL_BRIDGE_HOST") or DEFAULT_HOST),
        "auth_enabled": bool(_read_bridge_token()),
        "startup_task": task,
        "printer": printer,
        "ready_for_labels": bool(printer.get("ready_for_labels")),
        "autostart_configured": bool(task.get("installed")),
    }


def _print_raw_tspl(printer_name: str, payload: bytes) -> None:
    import win32print

    handle = win32print.OpenPrinter(printer_name)
    try:
        job = win32print.StartDocPrinter(handle, 1, ("MC-LARENS Label", None, "RAW"))
        try:
            win32print.StartPagePrinter(handle)
            win32print.WritePrinter(handle, payload)
            win32print.EndPagePrinter(handle)
        finally:
            win32print.EndDocPrinter(handle)
    finally:
        win32print.ClosePrinter(handle)


class LabelBridgeHandler(BaseHTTPRequestHandler):
    server_version = "MCLarensLabelBridge/1.0"

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
            status = _detect_printer()
            self._send_json(200, status)
            return
        self._send_json(404, {"detail": "Not found"})

    def do_POST(self) -> None:
        route = self.path.rstrip("/")
        if route == "/install-startup-task":
            result = _install_startup_task()
            self._send_json(200 if result.get("ok") else 500, result)
            return
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
        tspl_text = str(data.get("data") or "")
        if data_base64:
            try:
                payload = base64.b64decode(data_base64)
            except Exception:
                self._send_json(400, {"detail": "data_base64 inválido"})
                return
        elif tspl_text.strip():
            payload = tspl_text.encode("utf-8")
        else:
            self._send_json(400, {"detail": "data TSPL requerido"})
            return

        status = _detect_printer()
        if not status.get("ready_for_labels"):
            self._send_json(503, {"detail": status.get("message") or "Impresora no disponible", **status})
            return

        target_printer = printer_name or str(status.get("printer_name") or DEFAULT_PRINTER)
        try:
            _print_raw_tspl(target_printer, payload)
        except Exception as exc:
            self._send_json(500, {"detail": f"No se pudo imprimir: {exc}", "printer_name": target_printer})
            return

        self._send_json(
            200,
            {
                "ok": True,
                "printer_name": target_printer,
                "bytes_sent": len(payload),
                "message": "Etiquetas enviadas a la impresora",
            },
        )

    def log_message(self, format: str, *args: Any) -> None:
        sys.stdout.write("%s - %s\n" % (self.address_string(), format % args))


def _bridge_healthcheck(port: int) -> Dict[str, Any] | None:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/status", timeout=2.0) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None


def main() -> None:
    if os.name != "nt":
        print("label_print_bridge solo soporta Windows con impresora local.", flush=True)
        sys.exit(1)

    host = str(os.environ.get("LABEL_BRIDGE_HOST") or DEFAULT_HOST).strip() or DEFAULT_HOST
    port = int(os.environ.get("LABEL_BRIDGE_PORT") or DEFAULT_PORT)

    existing = _bridge_healthcheck(port)
    if existing is not None:
        print(
            f"Puente ya activo en http://127.0.0.1:{port} "
            f"({existing.get('printer_name') or 'sin impresora'})",
            flush=True,
        )
        sys.exit(0)

    try:
        server = ThreadingHTTPServer((host, port), LabelBridgeHandler)
    except OSError as exc:
        existing_after_error = _bridge_healthcheck(port)
        if existing_after_error is not None:
            print(
                f"Puente ya activo en http://127.0.0.1:{port} "
                f"({existing_after_error.get('printer_name') or 'sin impresora'})",
                flush=True,
            )
            sys.exit(0)
        if getattr(exc, "winerror", None) == 10048 or getattr(exc, "errno", None) in {48, 98, 10048}:
            print(
                f"Puerto {port} ocupado. Si el ERP ya detecta la impresora, no necesitas reiniciar el puente.",
                flush=True,
            )
            sys.exit(0)
        print(f"No se pudo iniciar el puente en puerto {port}: {exc}", flush=True)
        sys.exit(1)

    print(f"Label print bridge escuchando en http://{host}:{port}", flush=True)
    print("Endpoints: GET /status  POST /print", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nBridge detenido.", flush=True)
    except Exception as exc:
        print(f"Bridge detenido por error: {exc}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()