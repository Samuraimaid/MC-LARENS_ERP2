"""PIN login brute-force protection using PinPolicyService settings."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, Mapping, Optional

from fastapi import HTTPException, Request

IP_ATTEMPTS_COLLECTION = "pin_login_ip_attempts"
IP_LOCKOUTS_COLLECTION = "pin_login_ip_lockouts"


def client_ip(request: Request) -> str:
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    return request.client.host if request.client else "unknown"


def lockout_duration_seconds(policy: Mapping[str, Any], *, failed_attempts: int = 0) -> int:
    """Base lockout window, optionally progressive every max_attempts batch."""
    minutes = int(policy.get("lockout_minutes") or 0)
    seconds = int(policy.get("lockout_seconds") or 0)
    base = minutes * 60 if minutes > 0 else max(0, seconds)
    if base <= 0:
        return 0

    progressive = bool(policy.get("progressive_lockout", True))
    max_attempts = max(1, int(policy.get("max_attempts") or 3))
    if progressive and failed_attempts > 0:
        # 1st lock: base, 2nd lock: 2*base, 3rd: 4*base, ...
        step = max(1, (int(failed_attempts) + max_attempts - 1) // max_attempts)
        duration = base * (2 ** (step - 1))
    else:
        duration = base

    cap = int(policy.get("lockout_max_seconds") or 0)
    if cap > 0:
        duration = min(duration, cap)
    return int(duration)


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

    def _ip_lockouts_collection(self):
        return getattr(self.db, IP_LOCKOUTS_COLLECTION)

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

    async def _get_ip_lockout_doc(self, ip: str) -> Dict[str, Any]:
        doc = await self._ip_lockouts_collection().find_one({"ip": ip}, {"_id": 0})
        return doc or {"ip": ip, "failed_attempts": 0, "lockout_until": None}

    async def enforce_anonymous_lockout(self, request: Request, policy: Mapping[str, Any]) -> None:
        """Block public keypad (no user_id) while the terminal/IP is locked."""
        ip = client_ip(request)
        now = datetime.now(timezone.utc)
        guard = await self._get_ip_lockout_doc(ip)
        lockout_dt = parse_lockout_until(guard.get("lockout_until"), now)
        if not lockout_dt:
            return
        seconds = int(max(0, (lockout_dt - now).total_seconds()))
        raise HTTPException(
            status_code=403,
            detail={
                "message": "Demasiados intentos fallidos. Terminal bloqueada temporalmente.",
                "remaining_attempts": 0,
                "failed_attempts": int(guard.get("failed_attempts") or 0),
                "max_attempts": int(policy.get("max_attempts") or 3),
                "lockout_until": str(guard.get("lockout_until")),
                "lockout_seconds": seconds,
                "terminal_locked": True,
            },
        )

    async def record_anonymous_failure(self, request: Request, policy: Mapping[str, Any]) -> None:
        """Record wrong PIN on public keypad and raise structured 401/403."""
        ip = client_ip(request)
        now = datetime.now(timezone.utc)
        guard = await self._get_ip_lockout_doc(ip)
        failed = int(guard.get("failed_attempts") or 0) + 1
        max_attempts = max(1, int(policy.get("max_attempts") or 3))
        lockout_seconds = 0
        lockout_until: Optional[str] = None
        if failed >= max_attempts and failed % max_attempts == 0:
            lockout_seconds = lockout_duration_seconds(policy, failed_attempts=failed)
            if lockout_seconds > 0:
                lockout_until = (now + timedelta(seconds=lockout_seconds)).isoformat()

        update = {
            "ip": ip,
            "failed_attempts": failed,
            "lockout_until": lockout_until if lockout_until else guard.get("lockout_until"),
            "updated_at": now.isoformat(),
        }
        # Clear expired prior lockouts when not locking now.
        if not lockout_until:
            prior = parse_lockout_until(guard.get("lockout_until"), now)
            if not prior:
                update["lockout_until"] = None

        await self._ip_lockouts_collection().update_one({"ip": ip}, {"$set": update}, upsert=True)
        await self.record_ip_failure(request)
        await self.audit_service.log_pin_auth_attempt(None, ip, False)

        if lockout_until:
            raise HTTPException(
                status_code=403,
                detail={
                    "message": "Demasiados intentos fallidos. Terminal bloqueada temporalmente.",
                    "remaining_attempts": 0,
                    "failed_attempts": failed,
                    "max_attempts": max_attempts,
                    "lockout_until": lockout_until,
                    "lockout_seconds": lockout_seconds,
                    "terminal_locked": True,
                },
            )

        remaining = remaining_attempts_for_failed_count(failed % max_attempts or failed, max_attempts)
        # When failed is mid-cycle: remaining until next lockout threshold.
        if failed % max_attempts == 0:
            remaining = 0
        else:
            remaining = max_attempts - (failed % max_attempts)

        raise HTTPException(
            status_code=401,
            detail={
                "message": "PIN incorrecto",
                "remaining_attempts": remaining,
                "failed_attempts": failed,
                "max_attempts": max_attempts,
                "lockout_until": None,
                "lockout_seconds": 0,
            },
        )

    async def clear_anonymous_lockout(self, request: Request) -> None:
        ip = client_ip(request)
        now = datetime.now(timezone.utc).isoformat()
        await self._ip_lockouts_collection().update_one(
            {"ip": ip},
            {"$set": {"failed_attempts": 0, "lockout_until": None, "updated_at": now}},
            upsert=True,
        )

    async def get_terminal_status(self, request: Request, policy: Mapping[str, Any]) -> Dict[str, Any]:
        ip = client_ip(request)
        now = datetime.now(timezone.utc)
        guard = await self._get_ip_lockout_doc(ip)
        lockout_dt = parse_lockout_until(guard.get("lockout_until"), now)
        max_attempts = max(1, int(policy.get("max_attempts") or 3))
        failed = int(guard.get("failed_attempts") or 0)
        if lockout_dt:
            return {
                "locked": True,
                "remaining_attempts": 0,
                "failed_attempts": failed,
                "max_attempts": max_attempts,
                "lockout_until": str(guard.get("lockout_until")),
                "lockout_seconds": int(max(0, (lockout_dt - now).total_seconds())),
            }
        if failed > 0 and failed % max_attempts != 0:
            remaining = max_attempts - (failed % max_attempts)
        else:
            remaining = max_attempts
        return {
            "locked": False,
            "remaining_attempts": remaining,
            "failed_attempts": failed,
            "max_attempts": max_attempts,
            "lockout_until": None,
            "lockout_seconds": 0,
        }

    async def supervisor_unlock_terminal(self, request: Request, unlock_pin: str) -> Dict[str, Any]:
        """Clear terminal/IP lockout after verifying a gerencia (or programador/supervisor) login PIN.

        Used when a floor terminal is locked for a long progressive timeout and
        management needs the station usable again without waiting the full countdown.
        """
        pin = str(unlock_pin or "").strip()
        if not (pin.isdigit() and len(pin) == 8):
            raise HTTPException(status_code=400, detail="PIN de desbloqueo inválido (8 dígitos)")

        # Lazy import to avoid circular imports with server helpers.
        from backend.server import compute_pin_index, get_login_pin_hash, verify_pin_hash

        login_index = compute_pin_index(pin)
        user_doc = await self.db.users.find_one(
            {
                "is_pin_user": True,
                "is_active": True,
                "login_pin_index": login_index,
                "role": {"$in": ["gerencia", "programador", "supervisor"]},
            },
            {"_id": 0, "user_id": 1, "role": 1, "name": 1, "login_pin_hash": 1},
        )
        if not user_doc or not verify_pin_hash(pin, get_login_pin_hash(user_doc)):
            raise HTTPException(
                status_code=403,
                detail={
                    "message": "PIN de gerencia/supervisor inválido",
                    "code": "SUPERVISOR_UNLOCK_DENIED",
                },
            )

        ip = client_ip(request)
        await self.clear_anonymous_lockout(request)
        # Also clear short-window IP attempt counters so unlock is immediately usable
        try:
            await self._ip_attempts_collection().delete_many({"ip": ip})
        except Exception:
            pass

        try:
            await self.audit_service.log_pin_auth_attempt(
                user_doc.get("user_id"),
                ip,
                True,
            )
        except Exception:
            pass
        try:
            await self.db.pin_auth_logs.insert_one(
                {
                    "action": "terminal.supervisor_unlock",
                    "user_id": user_doc.get("user_id"),
                    "role": user_doc.get("role"),
                    "name": user_doc.get("name"),
                    "ip": ip,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
        except Exception:
            pass

        return {
            "message": "Terminal desbloqueada por gerencia/supervisor",
            "unlocked_by": user_doc.get("user_id"),
            "unlocked_by_name": user_doc.get("name"),
            "role": user_doc.get("role"),
            "ip": ip,
        }

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
        policy: Optional[Mapping[str, Any]] = None,
    ) -> None:
        resolved_policy: Mapping[str, Any] = policy or await self.policy_service.load()
        now = datetime.now(timezone.utc)
        user_id = str(user_doc.get("user_id") or "")
        max_attempts = int(resolved_policy.get("max_attempts") or 1)

        active_lockout = parse_lockout_until(user_doc.get("pin_lockout_until"), now)
        if active_lockout:
            detail = build_active_lockout_detail(
                user_doc,
                str(user_doc.get("pin_lockout_until")),
                now=now,
                policy=resolved_policy,
            )
            raise HTTPException(status_code=403, detail=detail)

        if verify_pin(pin, get_pin_hash(user_doc)):
            await self.db.users.update_one(
                {"user_id": user_id},
                {"$set": {"failed_pin_attempts": 0, "pin_lockout_until": None}},
            )
            await self.clear_anonymous_lockout(request)
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
            lockout_seconds = lockout_duration_seconds(resolved_policy, failed_attempts=failed)
            if lockout_seconds > 0:
                lockout_until_value = (now + timedelta(seconds=lockout_seconds)).isoformat()
                update["pin_lockout_until"] = lockout_until_value

        await self.db.users.update_one({"user_id": user_id}, {"$set": update})
        await self.record_ip_failure(request, user_id=user_id or None)
        # Mirror failures on terminal/IP guard for public-keypad protection.
        try:
            await self._ip_lockouts_collection().update_one(
                {"ip": client_ip(request)},
                {
                    "$set": {
                        "ip": client_ip(request),
                        "failed_attempts": failed,
                        "lockout_until": lockout_until_value,
                        "updated_at": now.isoformat(),
                    }
                },
                upsert=True,
            )
        except Exception:
            pass
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
