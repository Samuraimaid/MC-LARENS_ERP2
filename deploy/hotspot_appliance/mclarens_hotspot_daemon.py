#!/usr/bin/env python3
"""
MC-LARENS WiFi Hotspot Daemon for HP Mini PC Appliance.
Acts as a Captive Portal & Network Controller for Customer WiFi.
Synchronizes connected clients, bandwidth usage, and expiration policies with the MC-LARENS ERP.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import platform
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

try:
    import urllib.request
    import urllib.error
except ImportError:
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("mclarens_hotspot")

BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIR / "hotspot_config.json"
TEMPLATES_DIR = BASE_DIR / "templates"


DEFAULT_CONFIG = {
    "erp_api_base": "http://192.168.1.100:8001/api",  # Central ERP server IP or cloud URL
    "branch_id": "branch_main",
    "wifi_interface": "wlan0",
    "hotspot_ip": "10.50.0.1",
    "portal_port": 8080,
    "expiration_mode": "closing_time",
    "closing_time_str": "19:00",
    "duration_hours": 24,
    "welcome_message": "¡Bienvenido a MC-LARENS! Disfrute de conexión WiFi de alta velocidad mientras atendemos su vehículo.",
    "sync_interval_seconds": 10,
    "dry_run": False,  # True when running in dev / non-root environment
}


class SessionManager:
    def __init__(self, config: dict):
        self.config = config
        self.sessions: dict[str, dict] = {}  # mac -> session data
        self.is_linux = platform.system().lower() == "linux" and os.geteuid() == 0 if hasattr(os, "geteuid") else False

    def get_client_mac(self, ip_address: str) -> str:
        """Resolves client MAC address from kernel ARP cache."""
        if not ip_address:
            return "00:00:00:00:00:00"
        if not self.is_linux:
            # Fallback hash for dev testing
            clean_ip = ip_address.replace(".", "")[-6:].zfill(6)
            return f"50:EC:50:{clean_ip[:2]}:{clean_ip[2:4]}:{clean_ip[4:6]}"

        try:
            with open("/proc/net/arp", "r") as f:
                for line in f.readlines()[1:]:
                    parts = line.split()
                    if len(parts) >= 4 and parts[0] == ip_address:
                        return parts[3].upper()
        except Exception as e:
            logger.warning("Could not read /proc/net/arp: %s", e)

        return "00:00:00:00:00:00"

    def authorize_mac(self, mac: str, ip: str, customer_name: str = "", invoice: str = "", expires_at: str = ""):
        mac = mac.upper()
        session = {
            "mac_address": mac,
            "ip_address": ip,
            "customer_name": customer_name or "Cliente en Sala",
            "invoice_number": invoice,
            "authorized": True,
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at,
            "bytes_in": 0,
            "bytes_out": 0,
        }
        self.sessions[mac] = session
        logger.info("CLIENT AUTHORIZED: MAC=%s IP=%s Customer=%s Expires=%s", mac, ip, customer_name, expires_at)

        # Apply iptables whitelist rule on Linux
        if self.is_linux and not self.config.get("dry_run"):
            try:
                subprocess.run(
                    ["iptables", "-I", "FORWARD", "-m", "mac", "--mac-source", mac, "-j", "ACCEPT"],
                    check=False,
                )
                subprocess.run(
                    ["iptables", "-t", "nat", "-I", "PREROUTING", "-m", "mac", "--mac-source", mac, "-j", "ACCEPT"],
                    check=False,
                )
            except Exception as exc:
                logger.error("Error setting iptables for %s: %s", mac, exc)

    def revoke_mac(self, mac: str):
        mac = mac.upper()
        if mac in self.sessions:
            del self.sessions[mac]
        logger.info("CLIENT DISCONNECTED/EXPIRED: MAC=%s", mac)

        if self.is_linux and not self.config.get("dry_run"):
            try:
                subprocess.run(
                    ["iptables", "-D", "FORWARD", "-m", "mac", "--mac-source", mac, "-j", "ACCEPT"],
                    check=False,
                )
                subprocess.run(
                    ["iptables", "-t", "nat", "-D", "PREROUTING", "-m", "mac", "--mac-source", mac, "-j", "ACCEPT"],
                    check=False,
                )
            except Exception as exc:
                pass

    def check_expirations(self):
        """Disconnect sessions that have exceeded closing time or duration."""
        now = datetime.now(timezone.utc)
        expired_macs = []
        for mac, sess in list(self.sessions.items()):
            exp_str = sess.get("expires_at")
            if exp_str:
                try:
                    exp_dt = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
                    if now >= exp_dt:
                        expired_macs.append(mac)
                except Exception:
                    pass

        for mac in expired_macs:
            self.revoke_mac(mac)


session_mgr = None


class CaptivePortalHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Mute noisy access logs
        pass

    def do_GET(self):
        client_ip = self.client_address[0]
        client_mac = session_mgr.get_client_mac(client_ip)

        template_path = TEMPLATES_DIR / "captive_portal.html"
        if not template_path.exists():
            self.send_response(200)
            self.send_header("Content-type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Portal Cautivo MC-LARENS Clientes")
            return

        with open(template_path, "r", encoding="utf-8") as f:
            html = f.read()

        mode = session_mgr.config.get("expiration_mode", "closing_time")
        closing_time = session_mgr.config.get("closing_time_str", "19:00")
        notice = f"Acceso valido hasta las {closing_time} hrs (cierre de sucursal)." if mode == "closing_time" else "Acceso valido por 24 horas continuas."

        html = html.replace("{{ welcome_message }}", session_mgr.config.get("welcome_message", ""))
        html = html.replace("{{ client_mac }}", client_mac)
        html = html.replace("{{ client_ip }}", client_ip)
        html = html.replace("{{ expiration_notice }}", notice)

        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length).decode("utf-8")
        params = parse_qs(post_data)

        client_ip = self.client_address[0]
        client_mac = (params.get("mac") or [session_mgr.get_client_mac(client_ip)])[0]
        customer_name = (params.get("customer_name") or [""])[0].strip()
        invoice_number = (params.get("invoice_number") or [""])[0].strip()

        # Call ERP API to authorize
        erp_api = session_mgr.config.get("erp_api_base", "http://127.0.0.1:8001/api").rstrip("/")
        auth_url = f"{erp_api}/hotspot/appliance/authorize"
        req_payload = {
            "branch_id": session_mgr.config.get("branch_id", "branch_main"),
            "mac_address": client_mac,
            "ip_address": client_ip,
            "customer_name": customer_name,
            "invoice_number": invoice_number,
        }

        expires_at = ""
        try:
            req = urllib.request.Request(
                auth_url,
                data=json.dumps(req_payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                expires_at = res_data.get("expires_at", "")
        except Exception as e:
            logger.warning("Could not contact ERP API for auth, using local fallback: %s", e)
            expires_at = (datetime.now(timezone.utc)).isoformat()

        session_mgr.authorize_mac(client_mac, client_ip, customer_name, invoice_number, expires_at)

        # Redirect user to confirmation or google to trigger OS connection success
        self.send_response(302)
        self.send_header("Location", "https://mclarens.app")
        self.end_headers()


def run_portal_server(port: int):
    server = HTTPServer(("0.0.0.0", port), CaptivePortalHandler)
    logger.info("Captive Portal Web Server listening on port %d...", port)
    server.serve_forever()


async def sync_with_erp_loop(config: dict, mgr: SessionManager):
    """Periodically syncs client list and handles remote disconnect commands from ERP."""
    erp_api = config.get("erp_api_base", "http://127.0.0.1:8001/api").rstrip("/")
    heartbeat_url = f"{erp_api}/hotspot/appliance/heartbeat"
    interval = int(config.get("sync_interval_seconds", 10))

    while True:
        try:
            mgr.check_expirations()

            payload = {
                "branch_id": config.get("branch_id", "branch_main"),
                "clients": list(mgr.sessions.values()),
            }

            req = urllib.request.Request(
                heartbeat_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                res = json.loads(response.read().decode("utf-8"))
                disconnect_macs = res.get("disconnect_macs") or []
                for mac in disconnect_macs:
                    logger.info("Remote disconnect received for MAC: %s", mac)
                    mgr.revoke_mac(mac)

        except Exception as exc:
            logger.debug("ERP Heartbeat ping error: %s", exc)

        await asyncio.sleep(interval)


def main():
    global session_mgr

    parser = argparse.ArgumentParser(description="MC-LARENS Hotspot Controller Daemon")
    parser.add_argument("--config", default=str(CONFIG_FILE), help="Path to config json file")
    parser.add_argument("--port", type=int, default=8080, help="Captive portal port")
    args = parser.parse_args()

    config = {**DEFAULT_CONFIG}
    if os.path.exists(args.config):
        try:
            with open(args.config, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                config.update(loaded)
        except Exception as e:
            logger.error("Error reading config %s: %s", args.config, e)

    session_mgr = SessionManager(config)

    import threading
    portal_thread = threading.Thread(target=run_portal_server, args=(args.port,), daemon=True)
    portal_thread.start()

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        logger.info("MC-LARENS Hotspot Daemon running on branch '%s'", config.get("branch_id"))
        loop.run_until_complete(sync_with_erp_loop(config, session_mgr))
    except KeyboardInterrupt:
        logger.info("Hotspot Daemon shutting down.")


if __name__ == "__main__":
    main()
