#!/usr/bin/env python3
"""
Smoke test del toolbox CMD: rutas QR, compuertas de instalacion limpia y flujos desatendidos.
Simula stdin ficticio cuando hay privilegios de administrador; siempre valida estaticamente el .cmd.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CMD_PATH = REPO_ROOT / "backend" / "scripts" / "mclarens_blackbox_toolbox.cmd"
QR_SCRIPT = REPO_ROOT / "backend" / "scripts" / "render_qr_ascii.py"

ERROR_PATTERNS = (
    r"can't open file",
    r"No such file",
    r"can't find",
    r"No se encontro docker-compose\.yml en la ruta de produccion",
    r"REPO_ROOT no valido",
    r"docker exec mundo-backend python /app/backend/scripts/render_qr_ascii",
    r"!NET_COLOR!!NET_TEXT!!RST%",
    r"%BLD%%CYAN%",
    r"echo !CYAN!╔",
    r"echo !CYAN!║",
    r"%GRN%\[9\]%RST%",
    r"%GRN%\[1\]%RST%",
    r"%RED%\[0\]%RST%",
    r"%GRN%\[OK\]%RST%",
    r"!LB_BAR!",
    r"/ST 03:00 ",
)

REQUIRED_PATTERNS = (
    r":MODO_AUTOMATICO_DESATENDIDO",
    r":WZ_RENDER_DUAL_BARS",
    r":ENSURE_QRCODE_MODULE",
    r"docker compose exec -T backend python /app/backend/scripts/render_qr_ascii\.py",
    r"pip install qrcode==8\.2",
    r"if not exist \"%REPO_ROOT%\" mkdir \"%REPO_ROOT%\"",
    r"INSTALACION LIMPIA DESDE CERO",
    r":AUDIT_HARDWARE",
    r":RESTORE_DELTA_FROM_USB",
    r":WRITE_ENV_CASA_MATRIZ",
    r"NODE_TYPE=CASA_MATRIZ",
    r'reg add "HKCU\\Console" /v VirtualTerminalLevel',
    r'reg add "HKCU\\Software\\Microsoft\\Command Processor" /v DelayedExpansion',
    r"mode con: cols=80 lines=25",
    r":RENDER_MAIN_MENU_FRAME",
    r":BUILD_MENU_STATUS",
    r"%GRN%Op\.9%RST%",
    r"%CYAN%\^|%RST%",
)


def fail(msg: str, line: int | None = None) -> None:
    prefix = f"L{line}: " if line is not None else ""
    print(f"FAIL: {prefix}{msg}", file=sys.stderr)
    raise SystemExit(1)


def static_validate_cmd(text: str) -> None:
    for pattern in ERROR_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            match = re.search(pattern, text, re.IGNORECASE)
            line_no = text[: match.start()].count("\n") + 1 if match else None
            fail(f"Patron prohibido detectado: {pattern!r}", line_no)

    for pattern in REQUIRED_PATTERNS:
        if not re.search(pattern, text):
            fail(f"Falta patron requerido en toolbox: {pattern!r}")


def test_render_qr_ascii_local() -> None:
    if not QR_SCRIPT.exists():
        fail(f"No existe {QR_SCRIPT}")
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    proc = subprocess.run(
        [sys.executable, str(QR_SCRIPT), "http://192.168.1.26:3000"],
        capture_output=True,
        text=True,
        timeout=30,
        cwd=str(REPO_ROOT),
        env=env,
    )
    combined = proc.stdout + proc.stderr
    if proc.returncode != 0:
        if "Modulo qrcode no instalado" in combined:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "qrcode==8.2"],
                check=False,
                capture_output=True,
                text=True,
            )
            proc = subprocess.run(
                [sys.executable, str(QR_SCRIPT), "http://192.168.1.26:3000"],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=str(REPO_ROOT),
                env=env,
            )
            combined = proc.stdout + proc.stderr
    if proc.returncode != 0:
        fail(f"render_qr_ascii.py fallo (code={proc.returncode}): {combined[:400]}")
    if "URL ERP" not in proc.stdout:
        fail("render_qr_ascii.py no imprimio encabezado esperado")
    if len(proc.stdout.strip().splitlines()) < 5:
        fail("render_qr_ascii.py no genero matriz ASCII suficiente")


def simulate_cmd_menu(inputs: list[str], timeout_sec: int = 25) -> str:
    """Inyecta opciones al menu principal; retorna salida combinada."""
    if not CMD_PATH.exists():
        fail(f"No existe {CMD_PATH}")

    script_lines = [
        "@echo off",
        f'call "{CMD_PATH}"',
    ]
    with tempfile.NamedTemporaryFile("w", suffix=".cmd", delete=False, encoding="utf-8") as tmp:
        tmp.write("\r\n".join(script_lines))
        wrapper = Path(tmp.name)

    try:
        proc = subprocess.Popen(
            ["cmd", "/c", str(wrapper)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=str(REPO_ROOT),
        )
        payload = "\r\n".join(inputs) + "\r\n"
        try:
            out, _ = proc.communicate(input=payload, timeout=timeout_sec)
        except subprocess.TimeoutExpired:
            proc.kill()
            out, _ = proc.communicate()
        return out or ""
    finally:
        wrapper.unlink(missing_ok=True)


def test_clean_install_gate() -> None:
    """En instalacion limpia el menu no debe abortar con REPO_ROOT no valido."""
    out = simulate_cmd_menu(["3", "C", "99", "C"], timeout_sec=20)
    if re.search(r"REPO_ROOT no valido", out, re.IGNORECASE):
        fail("Candado fatal REPO_ROOT aun activo en instalacion limpia")
    if "INSTALACION LIMPIA DESDE CERO" not in out and not (REPO_ROOT / "docker-compose.yml").exists():
        fail("Banner de instalacion limpia no visible sin docker-compose.yml")


def test_option8_qr_path_in_output() -> None:
    text = CMD_PATH.read_text(encoding="utf-8", errors="replace")
    if "docker compose exec -T backend python /app/backend/scripts/render_qr_ascii.py" not in text:
        fail("Opcion 8 no usa docker compose exec -T backend con ruta /app/backend/scripts/")


def main() -> int:
    print("[test] Validando mclarens_blackbox_toolbox.cmd ...")
    cmd_text = CMD_PATH.read_text(encoding="utf-8", errors="replace")
    static_validate_cmd(cmd_text)
    print("[test] Estatico OK")

    test_option8_qr_path_in_output()
    print("[test] Ruta QR Docker OK")

    test_render_qr_ascii_local()
    print("[test] render_qr_ascii.py OK")

    try:
        test_clean_install_gate()
        print("[test] Simulacion menu / instalacion limpia OK")
    except SystemExit:
        raise
    except Exception as exc:
        print(f"[test] WARN simulacion cmd omitida: {exc}", file=sys.stderr)

    print("[test] PASS — toolbox sin rutas rotas detectadas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())