"""Technician attendance state from hr_timeclock_events."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

try:
    from zoneinfo import ZoneInfo

    ATTENDANCE_TZ = ZoneInfo("America/Managua")
except Exception:
    ATTENDANCE_TZ = timezone(timedelta(hours=-6), name="America/Managua")

ATTENDANCE_LABELS = {
    "absent": "Ausente",
    "present": "Disponible",
    "lunch": "En almuerzo",
    "clocked_out": "Salió",
}


async def fetch_user_clock_events_for_local_day(
    db: Any,
    user_id: str,
    local_dt: datetime,
) -> List[Dict[str, Any]]:
    local_start = local_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    local_end = local_start + timedelta(days=1)
    utc_start = local_start.astimezone(timezone.utc).isoformat()
    utc_end = local_end.astimezone(timezone.utc).isoformat()
    return await db.hr_timeclock_events.find(
        {
            "user_id": user_id,
            "created_at": {"$gte": utc_start, "$lt": utc_end},
        },
        {"_id": 0, "event_type": 1, "created_at": 1},
    ).sort("created_at", 1).to_list(20)


def resolve_attendance_state_from_events(events: List[Dict[str, Any]]) -> str:
    if not events:
        return "absent"
    last_type = str((events[-1] or {}).get("event_type") or "").strip().lower()
    if last_type == "clock_out":
        return "clocked_out"
    if last_type == "lunch_out":
        return "lunch"
    if last_type in {"clock_in", "lunch_in"}:
        return "present"
    return "absent"


def resolve_availability_level(
    attendance_state: str,
    active_jobs: int,
) -> Tuple[str, bool]:
    """
    Returns (level, assignable).
    Green = libre, Yellow = trabajando, Red = no disponible o sobrecarga.
    """
    jobs = max(0, int(active_jobs or 0))
    state = str(attendance_state or "absent").lower()

    if state in {"absent", "lunch", "clocked_out"}:
        return "red", False

    if jobs >= 2:
        return "red", True
    if jobs == 1:
        return "yellow", True
    return "green", True


async def build_technician_attendance_snapshot(
    db: Any,
    user_id: str,
    *,
    reference: Optional[datetime] = None,
    active_jobs: int = 0,
) -> Dict[str, Any]:
    ref = reference or datetime.now(ATTENDANCE_TZ)
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=ATTENDANCE_TZ)
    else:
        ref = ref.astimezone(ATTENDANCE_TZ)

    events = await fetch_user_clock_events_for_local_day(db, user_id, ref)
    attendance_state = resolve_attendance_state_from_events(events)
    level, assignable = resolve_availability_level(attendance_state, active_jobs)
    last_event = events[-1] if events else None

    return {
        "attendance_state": attendance_state,
        "attendance_label": ATTENDANCE_LABELS.get(attendance_state, attendance_state),
        "availability_level": level,
        "availability_assignable": assignable,
        "active_jobs": max(0, int(active_jobs or 0)),
        "last_clock_event": (last_event or {}).get("event_type"),
        "last_clock_at": (last_event or {}).get("created_at"),
    }