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


def write_host_lan_ip_file(ip: str) -> Optional[Path]:
    """Persist LAN IP so Docker containers can read the host address."""
    if not ip or not _is_private_ipv4(ip) or _is_docker_bridge_ipv4(ip):
        return None
    written: Optional[Path] = None
    for path in _host_lan_ip_file_candidates():
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f"{ip.strip()}\n", encoding="utf-8")
            written = path
            # Prefer writing the repo/data path first; continue to mirror into /app if present.
            if "host_lan_ip.txt" in str(path) and not str(path).startswith("/app"):
                break
        except Exception:
            continue
    return written


def _detect_via_windows_powershell() -> Optional[str]:
    if platform.system().lower() != "windows":
        return None
    # Prefer Wi-Fi / Ethernet operational 192.168.* addresses (skip APIPA / loopback).
    ps_cmd = r"""
$addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' -and
    $_.IPAddress -notmatch '^169\.254\.' -and
    $_.PrefixOrigin -ne 'WellKnown'
  }
$ifaces = Get-NetIPInterface -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.ConnectionState -eq 'Connected' }
$joined = foreach ($a in $addrs) {
  $iface = $ifaces | Where-Object { $_.InterfaceIndex -eq $a.InterfaceIndex } | Select-Object -First 1
  [PSCustomObject]@{
    IP = $a.IPAddress
    Metric = if ($iface) { [int]$iface.InterfaceMetric } else { 9999 }
    Alias = if ($iface) { [string]$iface.InterfaceAlias } else { '' }
  }
}
$joined |
  Sort-Object @{
    Expression = {
      if ($_.Alias -match 'Wi-?Fi|WLAN|Wireless') { 0 }
      elseif ($_.Alias -match 'Ethernet|eth') { 1 }
      else { 2 }
    }
  }, Metric |
  Select-Object -First 1 -ExpandProperty IP
"""
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=12,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        ip = (result.stdout or "").strip().splitlines()
        ip = (ip[0] if ip else "").strip()
        if ip and _is_private_ipv4(ip) and not _is_docker_bridge_ipv4(ip):
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


def _detect_via_hostname() -> Optional[str]:
    """Last-resort: resolve local hostname to a private IPv4 (skip docker bridges)."""
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_STREAM):
            ip = str(info[4][0] or "").strip()
            if ip and _is_private_ipv4(ip) and not _is_docker_bridge_ipv4(ip) and not ip.startswith("127."):
                return ip
    except Exception:
        pass
    return None


def detect_primary_lan_ipv4() -> Optional[str]:
    for detector in (
        _detect_via_windows_powershell,
        _detect_via_psutil,
        _detect_via_udp_socket,
        _detect_via_hostname,
    ):
        ip = detector()
        if ip:
            return ip
    return None


def resolve_lan_ip(*, persist_detected: bool = True) -> Tuple[str, str]:
    """
    Returns (ip, source) where source is one of:
    env_force, detected, host_file, env, factory_default

    Priority:
    1) SERVER_LAN_IP / HOST_LAN_IP only when SERVER_LAN_IP_FORCE=true
       (avoids stale fixed IPs hiding the real Wi-Fi/Ethernet address)
    2) Live detection on the host (PowerShell / psutil / UDP)
    3) host_lan_ip.txt (for Docker containers that cannot see host NICs)
    4) Non-forced env value
    5) Factory default
    """
    explicit = str(
        os.environ.get("SERVER_LAN_IP")
        or os.environ.get("HOST_LAN_IP")
        or ""
    ).strip()
    force_env = str(os.environ.get("SERVER_LAN_IP_FORCE") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    host_file_ip = read_host_lan_ip_file()
    detected_ip = detect_primary_lan_ipv4()

    if force_env and explicit and _is_private_ipv4(explicit) and not _is_docker_bridge_ipv4(explicit):
        return explicit, "env_force"

    if detected_ip:
        # Keep Docker appliances in sync when host IP changes (DHCP / new Wi-Fi).
        if persist_detected and host_file_ip != detected_ip:
            try:
                write_host_lan_ip_file(detected_ip)
            except Exception:
                pass
        return detected_ip, "detected"

    if host_file_ip:
        return host_file_ip, "host_file"

    if explicit and _is_private_ipv4(explicit) and not _is_docker_bridge_ipv4(explicit):
        return explicit, "env"

    return FACTORY_DEFAULT_LAN_IP, "factory_default"


def refresh_host_lan_ip() -> Tuple[str, str]:
    """Force re-detect and persist into host_lan_ip.txt. Returns (ip, source)."""
    detected = detect_primary_lan_ipv4()
    if detected:
        write_host_lan_ip_file(detected)
        return detected, "detected"
    ip, source = resolve_lan_ip(persist_detected=False)
    if source != "factory_default":
        write_host_lan_ip_file(ip)
    return ip, source