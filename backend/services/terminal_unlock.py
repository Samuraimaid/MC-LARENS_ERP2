"""Daily terminal unlock notification helpers for PIN lockout policy.

This module was referenced by server.py in origin/master but missing from the
repository tree. Provides a safe no-op-capable implementation so startup and
notification listing keep working.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
import logging
import uuid

logger = logging.getLogger("erp.terminal_unlock")


def _today_key(now: Optional[datetime] = None) -> str:
    current = now or datetime.now(timezone.utc)
    return current.date().isoformat()


async def ensure_daily_terminal_unlock_notification(db: Any) -> Optional[dict]:
    """Ensure a once-per-day informational notification about terminal PIN unlock policy.

    Safe to call frequently: upserts a single notification document per day.
    Returns the notification document when available, otherwise None.
    """
    try:
        day_key = _today_key()
        notification_id = f"terminal_unlock_{day_key}"
        existing = await db.notifications.find_one(
            {"notification_id": notification_id},
            {"_id": 0},
        )
        if existing:
            return existing

        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "notification_id": notification_id,
            "type": "terminal_unlock",
            "title": "Política de desbloqueo de terminal",
            "message": (
                "Tras 3 intentos de PIN fallidos la terminal se bloquea de forma "
                "progresiva. Un login correcto reinicia el contador."
            ),
            "created_at": now,
            "read": False,
            "recipient_id": None,
            "target_roles": ["gerencia", "programador", "supervisor"],
            "meta": {"day_key": day_key, "source": "terminal_unlock"},
            "dedupe_key": notification_id,
        }
        await db.notifications.update_one(
            {"notification_id": notification_id},
            {
                "$setOnInsert": doc,
                "$set": {"updated_at": now},
            },
            upsert=True,
        )
        return doc
    except Exception:
        logger.exception("ensure_daily_terminal_unlock_notification failed")
        return None
