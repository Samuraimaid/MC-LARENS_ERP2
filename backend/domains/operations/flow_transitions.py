"""Audit log for operational state transitions (WO, tint, dispatch, sale)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def log_flow_transition(
    db: Any,
    *,
    entity_type: str,
    entity_id: str,
    from_status: Optional[str],
    to_status: str,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    actor_role: Optional[str] = None,
    sale_id: Optional[str] = None,
    reason: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Persist a single state transition for later audit / flow-health."""
    from_norm = str(from_status or "").strip().lower() or None
    to_norm = str(to_status or "").strip().lower()
    if from_norm == to_norm:
        return {"skipped": True, "reason": "unchanged"}

    doc: Dict[str, Any] = {
        "transition_id": f"tr_{uuid.uuid4().hex[:12]}",
        "entity_type": str(entity_type or "").strip().lower(),
        "entity_id": str(entity_id or "").strip(),
        "from_status": from_norm,
        "to_status": to_norm,
        "actor_id": actor_id,
        "actor_name": actor_name,
        "actor_role": actor_role,
        "sale_id": sale_id,
        "reason": reason,
        "metadata": metadata or {},
        "created_at": _now_iso(),
    }
    await db.flow_state_transitions.insert_one(doc)
    doc.pop("_id", None)
    return doc
