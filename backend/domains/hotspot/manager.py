"""
MC-LARENS WiFi Hotspot Management Domain.
Handles branch hotspot settings, active client sessions, expiration policies
(closing time e.g. 7:00 PM vs 24-hour validity), and captive portal authorization.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional

try:
    from pydantic import BaseModel, Field
except ImportError:
    class BaseModel:  # type: ignore
        def __init__(self, **data: Any):
            for k, v in data.items():
                setattr(self, k, v)

    def Field(*args: Any, **kwargs: Any) -> Any:  # type: ignore
        return None


DEFAULT_HOTSPOT_SETTINGS = {
    "enabled": True,
    "ssid_name": "MC-LARENS Clientes VIP",
    "expiration_mode": "closing_time",  # "closing_time" | "duration_hours"
    "closing_time_str": "19:00",  # 7:00 PM cutoff
    "duration_hours": 24,
    "require_invoice": False,
    "welcome_message": "¡Bienvenido a MC-LARENS Taller & Accesorios! Disfrute de nuestra red de alta velocidad mientras atendemos su vehículo.",
    "download_speed_limit_mbps": 15,
    "upload_speed_limit_mbps": 5,
    "allowed_walled_garden_domains": [
        "mclarens.app",
        "wa.me",
        "api.whatsapp.com",
    ],
}


def calculate_session_expiration(settings: Dict[str, Any], now: Optional[datetime] = None) -> datetime:
    """
    Computes when a client WiFi session expires based on policy:
    1. 'closing_time': expires at the branch closing time (e.g. 7:00 PM today, or tomorrow 7 PM if after closing).
    2. 'duration_hours': expires in N hours (e.g. 24 hours from now).
    """
    current = now or datetime.now(timezone.utc)
    mode = str(settings.get("expiration_mode") or "closing_time").lower()

    if mode == "duration_hours":
        hours = max(1, int(settings.get("duration_hours") or 24))
        return current + timedelta(hours=hours)

    # Closing time mode (e.g. 19:00 / 7:00 PM local time)
    closing_str = str(settings.get("closing_time_str") or "19:00").strip()
    try:
        parts = closing_str.split(":")
        target_hour = int(parts[0])
        target_min = int(parts[1]) if len(parts) > 1 else 0
    except (ValueError, IndexError):
        target_hour = 19
        target_min = 0

    # Local today closing datetime
    closing_today = current.replace(hour=target_hour, minute=target_min, second=0, microsecond=0)
    if current >= closing_today:
        # If already past closing time, expire in 1 hour or tomorrow at closing time
        return closing_today + timedelta(days=1)

    return closing_today


def sanitize_mac(mac: str) -> str:
    """Normalize MAC address to uppercase colon-separated format."""
    clean = "".join(c for c in str(mac or "").upper() if c in "0123456789ABCDEF")
    if len(clean) == 12:
        return ":".join(clean[i : i + 2] for i in range(0, 12, 2))
    return str(mac or "").strip().upper()
