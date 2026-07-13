"""Resolve the appliance LAN IPv4 for QR codes, kiosk URLs and dashboard access."""
from __future__ import annotations

import os
import platform
import socket
import subprocess
from pathlib import Path
from typing import Optional, Tuple

FACTORY_DEFAULT_LAN_IP = "192.168.1.26"


def _is_valid_ipv4(ip: str) -> bool:
    parts = str(ip or "").strip().split(".")
    if len(parts) != 4:
        return False
    try:
        return all(0 <= int(part) <= 255 for part in parts)
    except ValueError:
        return False


def _is_private_ipv4(ip: str) -> bool:
    if not _is_valid_ipv4(ip):
        return False
    parts = [int(part) for part in ip.split(".")]
    if parts[0] == 10:
        return True
    if parts[0] == 172 and 16 <= parts[1] <= 31:
        return True
    if parts[0] == 192 and parts[1] == 168:
        return True
    return False


def _is_docker_bridge_ipv4(ip: str) -> bool:
    if not _is_valid_ipv4(ip):
        return False
    parts = [int(part) for part in ip.split(".")]
    return parts[0] == 172 and 17 <= parts[1] <= 31


def _host_lan_ip_file_candidates() -> list[Path]:
    custom = str(os.environ.get("HOST_LAN_IP_FILE") or "").strip()
    paths: list[Path] = []
    if custom:
        paths.append(Path(custom))
    paths.extend([
        Path("/app/backend/data/host_lan_ip.txt"),
        Path(__file__).resolve().parents[2] / "data" / "host_lan_ip.txt",
    ])
    unique: list[Path] = []
    seen: set[str] = set()
    for path in paths:
        key = str(path)
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return unique


def read_host_lan_ip_file() -> Optional[str]:
    for path in _host_lan_ip_file_candidates():
        try:
            if not path.exists():
                continue
            for line in path.read_text(encoding="utf-8").splitlines():
                ip = line.strip()
                if ip and _is_valid_ipv4(ip) and _is_private_ipv4(ip):
                    return ip
        except Exception:
            continue
    return None


def _detect_via_windows_powershell() -> Optional[str]:
    if platform.system().lower() != "windows":
        return None
    ps_cmd = (
        "Get-NetIPAddress -AddressFamily IPv4 | "
        "Where-Object { $_.IPAddress -match '^192\\.168\\.' -and $_.PrefixOrigin -ne 'WellKnown' } | "
        "Sort-Object InterfaceMetric | "
        "Select-Object -First 1 -ExpandProperty IPAddress"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=8,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        ip = (result.stdout or "").strip()
        if ip and _is_private_ipv4(ip):
            return ip
    except Exception:
        pass
    return None


def _detect_via_psutil() -> Optional[str]:
    try:
        import psutil  # type: ignore

        candidates: list[tuple[int, str]] = []
        stats = psutil.net_if_stats()
        for iface, addrs in psutil.net_if_addrs().items():
            iface_stats = stats.get(iface)
            if not iface_stats or not iface_stats.isup:
                continue
            iface_lower = iface.lower()
            if iface_lower in {"lo", "loopback"} or "loopback" in iface_lower:
                continue
            for addr in addrs:
                if addr.family != socket.AF_INET:
                    continue
                ip = str(addr.address or "").strip()
                if not ip or ip.startswith("127.") or ip.startswith("169.254."):
                    continue
                if not _is_private_ipv4(ip) or _is_docker_bridge_ipv4(ip):
                    continue
                score = 0
                if any(token in iface_lower for token in ("wi-fi", "wifi", "wlan", "wireless")):
                    score += 12
                if any(token in iface_lower for token in ("ethernet", "eth", "en")):
                    score += 10
                if ip.startswith("192.168."):
                    score += 6
                candidates.append((score, ip))
        if candidates:
            candidates.sort(reverse=True)
            return candidates[0][1]
    except Exception:
        pass
    return None


def _detect_via_udp_socket() -> Optional[str]:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.settimeout(1.0)
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            if ip and _is_private_ipv4(ip) and not _is_docker_bridge_ipv4(ip):
                return ip
            if ip and ip.startswith("192.168."):
                return ip
    except Exception:
        pass
    return None


def detect_primary_lan_ipv4() -> Optional[str]:
    for detector in (_detect_via_windows_powershell, _detect_via_psutil, _detect_via_udp_socket):
        ip = detector()
        if ip:
            return ip
    return None


def resolve_lan_ip() -> Tuple[str, str]:
    """
    Returns (ip, source) where source is one of:
    env, host_file, detected, factory_default
    """
    explicit = str(
        os.environ.get("SERVER_LAN_IP")
        or os.environ.get("HOST_LAN_IP")
        or ""
    ).strip()
    host_file_ip = read_host_lan_ip_file()
    detected_ip = detect_primary_lan_ipv4()

    if explicit and explicit != FACTORY_DEFAULT_LAN_IP:
        return explicit, "env"

    if host_file_ip:
        return host_file_ip, "host_file"

    if detected_ip:
        return detected_ip, "detected"

    if explicit:
        return explicit, "env"

    return FACTORY_DEFAULT_LAN_IP, "factory_default"