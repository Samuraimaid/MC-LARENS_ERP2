#!/usr/bin/env python3
"""
Detecta si ya existe Casa Matriz consultando, en orden:
  1. Perfil publico HTTP (MATRIZ_PROFILE_URL)
  2. MongoDB Atlas (erp_server_nodes, fallback branches)
  3. Barrido LAN local (detect_lan_casa_matriz.ps1)

Salida (una linea):
  MATRIZ|fuente|detalle|node_id|node_type|suc_count|bod_count
  NONE|ninguna|0|0|0|suc_count|bod_count
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_MATRIZ_URL = "https://mclarenerp.com/api/server-appliance/profile"
DEFAULT_DB_NAME = "mc-larens2_mundo_accesorios_erp"
SCRIPT_DIR = Path(__file__).resolve().parent


def _parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return values
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key:
            values[key] = val
    return values


def _usb_central_env_paths() -> list[Path]:
    paths: list[Path] = []
    if os.name != "nt":
        return paths
    try:
        proc = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } | ForEach-Object { $_.DeviceID }",
            ],
            capture_output=True,
            text=True,
            timeout=12,
        )
        for line in (proc.stdout or "").splitlines():
            drive = line.strip().rstrip("\\")
            if drive:
                paths.append(Path(f"{drive}\\.mclarens_central.env"))
    except Exception:
        pass
    return paths


def load_central_config() -> tuple[str, str, str]:
    """Retorna (mongodb_central_uri, matriz_profile_url, central_db_name)."""
    uri = (
        os.environ.get("MONGODB_CENTRAL_URI")
        or os.environ.get("MCLARENS_CENTRAL_URI")
        or ""
    ).strip()
    profile_url = (os.environ.get("MATRIZ_PROFILE_URL") or DEFAULT_MATRIZ_URL).strip()
    db_name = (os.environ.get("MONGODB_CENTRAL_DB") or DEFAULT_DB_NAME).strip()

    candidates: list[Path] = []
    program_data = os.environ.get("ProgramData", r"C:\ProgramData")
    candidates.append(Path(program_data) / "MCLarensERP" / "central.env")
    candidates.append(SCRIPT_DIR / ".mclarens_central.env")
    candidates.extend(_usb_central_env_paths())

    for path in candidates:
        if not path.exists():
            continue
        parsed = _parse_env_file(path)
        if not uri:
            uri = (parsed.get("MONGODB_CENTRAL_URI") or parsed.get("MCLARENS_CENTRAL_URI") or "").strip()
        if parsed.get("MATRIZ_PROFILE_URL"):
            profile_url = parsed["MATRIZ_PROFILE_URL"].strip()
        if parsed.get("MONGODB_CENTRAL_DB"):
            db_name = parsed["MONGODB_CENTRAL_DB"].strip()

    return uri, profile_url, db_name


def _is_matriz_profile(node_type: str, node_id: str) -> bool:
    nt = str(node_type or "").strip().upper()
    nid = str(node_id or "").strip()
    return nt == "CASA_MATRIZ" or nid == "branch_main"


def check_http_profile(profile_url: str) -> tuple[bool, str, str, str, str]:
    try:
        req = urllib.request.Request(
            profile_url,
            headers={"User-Agent": "MCLarensTopology/1.0", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8", errors="replace"))
        node_type = str(payload.get("node_type") or "")
        node_id = str(payload.get("node_id") or "")
        if _is_matriz_profile(node_type, node_id):
            detail = str(payload.get("lan_ip") or payload.get("access_url") or profile_url)
            return True, "central_http", detail, node_id or "branch_main", node_type or "CASA_MATRIZ"
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, OSError):
        pass
    return False, "", "", "", ""


def check_atlas(
    central_uri: str,
    db_name: str,
) -> tuple[bool, str, str, str, str, int, int]:
    suc_count = 0
    bod_count = 0
    try:
        from pymongo import MongoClient
    except ImportError:
        return False, "", "", "", "", suc_count, bod_count

    try:
        client = MongoClient(central_uri, serverSelectionTimeoutMS=12000)
        db = client[db_name]
        client.admin.command("ping")

        node = db.erp_server_nodes.find_one(
            {
                "$or": [
                    {"node_type": "CASA_MATRIZ"},
                    {"node_id": "branch_main"},
                    {"branch_id": "branch_main"},
                ],
                "status": {"$ne": "retired"},
            },
            {"_id": 0},
        )
        suc_count = db.erp_server_nodes.count_documents({"node_type": "SUCURSAL", "status": {"$ne": "retired"}})
        bod_count = db.erp_server_nodes.count_documents({"node_type": "BODEGA_PURA", "status": {"$ne": "retired"}})

        if node:
            node_id = str(node.get("node_id") or node.get("branch_id") or "branch_main")
            node_type = str(node.get("node_type") or "CASA_MATRIZ")
            detail = str(node.get("lan_ip") or node.get("public_url") or "atlas")
            return True, "central_atlas", detail, node_id, node_type, suc_count, bod_count

        branch = db.branches.find_one({"branch_id": "branch_main"}, {"_id": 0})
        if branch:
            detail = str(branch.get("lan_ip") or branch.get("name") or "branch_main")
            return True, "central_atlas", detail, "branch_main", "CASA_MATRIZ", suc_count, bod_count
    except Exception:
        pass
    return False, "", "", "", "", suc_count, bod_count


def check_lan(net_prefix: str, self_ip: str) -> tuple[bool, str, str, str, str, int, int]:
    ps_script = SCRIPT_DIR / "detect_lan_casa_matriz.ps1"
    if not ps_script.exists():
        return False, "", "", "", "", 0, 0
    try:
        proc = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(ps_script),
                "-NetPrefix",
                net_prefix,
                "-SelfIp",
                self_ip,
            ],
            capture_output=True,
            text=True,
            timeout=180,
        )
        line = ""
        for raw in (proc.stdout or "").splitlines():
            raw = raw.strip()
            if raw:
                line = raw
        if not line:
            return False, "", "", "", "", 0, 0
        parts = line.split("|")
        while len(parts) < 6:
            parts.append("0")
        result, detail, node_id, node_type, suc, bod = parts[:6]
        suc_count = int(re.sub(r"\D", "", suc) or "0")
        bod_count = int(re.sub(r"\D", "", bod) or "0")
        if result.upper() == "MATRIZ":
            return True, "lan", detail, node_id, node_type, suc_count, bod_count
        return False, "", "", "", "", suc_count, bod_count
    except Exception:
        return False, "", "", "", "", 0, 0


def emit(
    found: bool,
    source: str,
    detail: str,
    node_id: str,
    node_type: str,
    suc_count: int,
    bod_count: int,
) -> None:
    if found:
        print(f"MATRIZ|{source}|{detail}|{node_id}|{node_type}|{suc_count}|{bod_count}")
    else:
        print(f"NONE|ninguna|0|0|0|{suc_count}|{bod_count}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Detecta topologia Casa Matriz (central + LAN)")
    parser.add_argument("--net-prefix", default="192.168.1")
    parser.add_argument("--self-ip", default="")
    args = parser.parse_args()

    central_uri, profile_url, db_name = load_central_config()
    suc_count = 0
    bod_count = 0

    found, source, detail, node_id, node_type = check_http_profile(profile_url)
    if found:
        emit(True, source, detail, node_id, node_type, suc_count, bod_count)
        return 0

    if central_uri:
        found, source, detail, node_id, node_type, suc_count, bod_count = check_atlas(central_uri, db_name)
        if found:
            emit(True, source, detail, node_id, node_type, suc_count, bod_count)
            return 0

    found, source, detail, node_id, node_type, lan_suc, lan_bod = check_lan(args.net_prefix, args.self_ip)
    suc_count = max(suc_count, lan_suc)
    bod_count = max(bod_count, lan_bod)
    emit(found, source, detail, node_id, node_type, suc_count, bod_count)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())