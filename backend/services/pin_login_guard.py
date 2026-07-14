"""PIN login brute-force protection using PinPolicyService settings."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, Mapping, Optional

from fastapi import HTTPException, Request

IP_ATTEMPTS_COLLECTION = "pin_login_ip_attempts"


def client_ip(request: Request) -> str:
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    return request.client.host if request.client else "unknown"


def lockout_duration_seconds(policy: Mapping[str, Any]) -> int:
    minutes = int(policy.get("lockout_minutes") or 0)
    seconds = int(policy.get("lockout_seconds") or 0)
    if minutes > 0:
        return minutes * 60
    return max(0, seconds)


def remaining_attempts_for_failed_count(failed: int, max_attempts: int) -> int:
    return max(0, int(max_attempts) - int(failed))


def parse_lockout_until(lockout_until: Any, now: datetime) -> Optional[datetime]:
    if not lockout_until:
        return None
    try:
        lockout_dt = datetime.fromisoformat(str(lockout_until).replace("Z", "+00:00"))
    except ValueError:
        return None
    if lockout_dt.tzinfo is None:
        lockout_dt = lockout_dt.replace(tzinfo=timezone.utc)
    return lockout_dt if lockout_dt > now else None


def build_active_lockout_detail(
    user_doc: Mapping[str, Any],
    lockout_until: str,
    *,
    now: datetime,
    policy: Mapping[str, Any],
) -> Dict[str, Any]:
    lockout_dt = parse_lockout_until(lockout_until, now)
    policy_seconds = int(max(0, (lockout_dt - now).total_seconds())) if lockout_dt else 0
    max_attempts = int(policy.get("max_attempts") or 1)
    failed = int(user_doc.get("failed_pin_attempts") or 0)
    return {
        "message": "PIN bloqueado. Intente más tarde",
        "remaining_attempts": 0,
        "failed_attempts": failed,
        "max_attempts": max_attempts,
        "lockout_until": lockout_until,
        "lockout_seconds": policy_seconds,
    }


class PinLoginGuard:
    def __init__(self, db, policy_service, audit_service):
        self.db = db
        self.policy_service = policy_service
        self.audit_service = audit_service

    def _ip_attempts_collection(self):
        return getattr(self.db, IP_ATTEMPTS_COLLECTION)

    async def enforce_ip_rate_limit(self, request: Request, policy: Mapping[str, Any]) -> None:
        ip = client_ip(request)
        window_seconds = int(policy.get("ip_window_seconds") or 60)
        max_attempts = int(policy.get("ip_max_attempts") or 20)
        now = datetime.now(timezone.utc)
        cutoff = (now - timedelta(seconds=window_seconds)).isoformat()
        count = await self._ip_attempts_collection().count_documents(
            {"ip": ip, "attempted_at": {"$gte": cutoff}},
        )
        if count >= max_attempts:
            detail = {
                "message": "Demasiados intentos desde esta ubicación. Intente más tarde.",
                "remaining_attempts": 0,
                "retry_after_seconds": window_seconds,
                "ip_blocked": True,
            }
            raise HTTPException(status_code=429, detail=detail)

    async def record_ip_failure(
        self,
        request: Request,
        *,
        user_id: Optional[str] = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._ip_attempts_collection().insert_one(
            {
                "ip": client_ip(request),
                "user_id": user_id,
                "attempted_at": now,
            },
        )

    async def validate_for_user(
        self,
        user_doc: Dict[str, Any],
        pin: str,
        request: Request,
        *,
        verify_pin: Callable[[str, str], bool],
        get_pin_hash: Callable[[Mapping[str, Any]], str],
    ) -> None:
        policy = await self.policy_service.load()
        now = datetime.now(timezone.utc)
        user_id = str(user_doc.get("user_id") or "")
        max_attempts = int(policy.get("max_attempts") or 1)

        active_lockout = parse_lockout_until(user_doc.get("pin_lockout_until"), now)
        if active_lockout:
            detail = build_active_lockout_detail(
                user_doc,
                str(user_doc.get("pin_lockout_until")),
                now=now,
                policy=policy,
            )
            raise HTTPException(status_code=403, detail=detail)

        if verify_pin(pin, get_pin_hash(user_doc)):
            await self.db.users.update_one(
                {"user_id": user_id},
                {"$set": {"failed_pin_attempts": 0, "pin_lockout_until": None}},
            )
            await self.audit_service.log_pin_auth_attempt(
                user_id,
                client_ip(request),
                True,
            )
            return

        failed = int(user_doc.get("failed_pin_attempts") or 0) + 1
        update: Dict[str, Any] = {"failed_pin_attempts": failed}
        lockout_seconds = 0
        lockout_until_value: Optional[str] = None

        if failed >= max_attempts:
            lockout_seconds = lockout_duration_seconds(policy)
            if lockout_seconds > 0:
                lockout_until_value = (now + timedelta(seconds=lockout_seconds)).isoformat()
                update["pin_lockout_until"] = lockout_until_value

        await self.db.users.update_one({"user_id": user_id}, {"$set": update})
        await self.record_ip_failure(request, user_id=user_id or None)
        await self.audit_service.log_pin_auth_attempt(user_id, client_ip(request), False)

        remaining = 0 if lockout_until_value else remaining_attempts_for_failed_count(failed, max_attempts)
        detail = {
            "message": "PIN incorrecto",
            "remaining_attempts": remaining,
            "failed_attempts": failed,
            "max_attempts": max_attempts,
            "lockout_until": lockout_until_value,
            "lockout_seconds": lockout_seconds,
        }
        if lockout_until_value:
            raise HTTPException(status_code=403, detail=detail)
        raise HTTPException(status_code=401, detail=detail)