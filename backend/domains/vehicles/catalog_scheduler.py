"""Background scheduling for periodic catalog sync."""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

from backend.domains.vehicles.catalog_paths import resolve_backend_data_dir

SCHEDULE_PATH = resolve_backend_data_dir() / "vehicle-catalog-schedule.json"
DEFAULT_INTERVAL_DAYS = 30


def _load_schedule() -> dict[str, Any]:
    if not SCHEDULE_PATH.exists():
        return {
            "enabled": True,
            "interval_days": DEFAULT_INTERVAL_DAYS,
            "last_auto_sync_at": None,
            "last_auto_sync_status": None,
        }
    return json.loads(SCHEDULE_PATH.read_text(encoding="utf-8"))


def _save_schedule(state: dict[str, Any]) -> None:
    SCHEDULE_PATH.parent.mkdir(parents=True, exist_ok=True)
    SCHEDULE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def get_schedule_state() -> dict[str, Any]:
    return _load_schedule()


def should_run_auto_sync(now: datetime | None = None) -> bool:
    state = _load_schedule()
    if not state.get("enabled", True):
        return False
    last_raw = state.get("last_auto_sync_at")
    if not last_raw:
        return True
    try:
        last = datetime.fromisoformat(str(last_raw).replace("Z", "+00:00"))
    except Exception:
        return True
    interval = int(state.get("interval_days") or DEFAULT_INTERVAL_DAYS)
    now = now or datetime.now(timezone.utc)
    return now - last >= timedelta(days=max(1, interval))


async def run_scheduled_catalog_sync(*, max_brands: int = 5) -> dict[str, Any]:
    from backend.domains.vehicles.catalog_sync import sync_catalog_from_web

    state = _load_schedule()
    try:
        result = await sync_catalog_from_web(None, max_brands=max(1, min(max_brands, 10)))
        state["last_auto_sync_at"] = datetime.now(timezone.utc).isoformat()
        state["last_auto_sync_status"] = "ok"
        state["last_auto_sync_proposals"] = result.get("proposal_count", 0)
        _save_schedule(state)
        logger.info("Auto catalog sync completed: %s proposals", result.get("proposal_count", 0))
        return {"status": "ok", **result}
    except Exception as exc:
        state["last_auto_sync_at"] = datetime.now(timezone.utc).isoformat()
        state["last_auto_sync_status"] = f"error: {exc}"
        _save_schedule(state)
        logger.exception("Auto catalog sync failed")
        return {"status": "error", "detail": str(exc)}


async def catalog_sync_scheduler_loop() -> None:
    await asyncio.sleep(120)
    while True:
        try:
            if should_run_auto_sync():
                await run_scheduled_catalog_sync()
        except Exception:
            logger.exception("Catalog scheduler iteration failed")
        await asyncio.sleep(24 * 60 * 60)