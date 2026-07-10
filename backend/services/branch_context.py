from __future__ import annotations

from typing import Any, Dict, Optional


async def resolve_branch_labels(
    db,
    branch_id: Optional[str],
    *,
    branch_name: Optional[str] = None,
) -> Dict[str, str]:
    bid = str(branch_id or "").strip()
    if branch_name:
        return {"branch_id": bid, "branch_name": str(branch_name).strip() or bid}

    if not bid:
        return {"branch_id": "", "branch_name": ""}

    branch_doc = await db.branches.find_one(
        {"branch_id": bid},
        {"_id": 0, "name": 1},
    )
    resolved_name = str((branch_doc or {}).get("name") or bid)
    return {"branch_id": bid, "branch_name": resolved_name}


def attach_branch_labels(
    document: Dict[str, Any],
    *,
    branch_id: Optional[str],
    branch_name: Optional[str],
) -> Dict[str, Any]:
    bid = str(branch_id or "").strip()
    bname = str(branch_name or bid or "").strip()
    if bid:
        document["branch_id"] = bid
    if bname:
        document["branch_name"] = bname
    return document