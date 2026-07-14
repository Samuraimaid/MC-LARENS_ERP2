"""Unit tests for PIN login guard policy helpers."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from backend.services.pin_login_guard import (
    PinLoginGuard,
    lockout_duration_seconds,
    remaining_attempts_for_failed_count,
)


def test_lockout_duration_prefers_minutes():
    policy = {"lockout_minutes": 15, "lockout_seconds": 30}
    assert lockout_duration_seconds(policy) == 900


def test_lockout_duration_uses_seconds_when_no_minutes():
    policy = {"lockout_minutes": 0, "lockout_seconds": 45}
    assert lockout_duration_seconds(policy) == 45


def test_remaining_attempts_before_lockout():
    assert remaining_attempts_for_failed_count(1, 5) == 4
    assert remaining_attempts_for_failed_count(4, 5) == 1
    assert remaining_attempts_for_failed_count(5, 5) == 0


def test_validate_locks_user_after_max_attempts():
    db = MagicMock()
    db.users.update_one = AsyncMock()
    policy_service = MagicMock()
    policy_service.load = AsyncMock(
        return_value={
            "max_attempts": 3,
            "lockout_minutes": 15,
            "lockout_seconds": 30,
            "ip_window_seconds": 60,
            "ip_max_attempts": 20,
        },
    )
    audit_service = MagicMock()
    audit_service.log_pin_auth_attempt = AsyncMock()
    db.pin_login_ip_attempts = MagicMock()
    db.pin_login_ip_attempts.insert_one = AsyncMock()

    guard = PinLoginGuard(db, policy_service, audit_service)
    request = MagicMock()
    request.client = MagicMock(host="127.0.0.1")
    request.headers = {}

    user_doc = {
        "user_id": "user_test",
        "failed_pin_attempts": 2,
        "pin_lockout_until": None,
    }

    async def run():
        with pytest.raises(HTTPException) as exc:
            await guard.validate_for_user(
                user_doc,
                "00000000",
                request,
                verify_pin=lambda _pin, _hash: False,
                get_pin_hash=lambda _doc: "hash",
            )
        assert exc.value.status_code == 403
        detail = exc.value.detail
        assert detail["remaining_attempts"] == 0
        assert detail["failed_attempts"] == 3
        assert detail["lockout_until"] is not None
        assert detail["lockout_seconds"] == 900

    asyncio.run(run())


def test_validate_returns_401_with_remaining_before_lockout():
    db = MagicMock()
    db.users.update_one = AsyncMock()
    policy_service = MagicMock()
    policy_service.load = AsyncMock(
        return_value={
            "max_attempts": 5,
            "lockout_minutes": 15,
            "lockout_seconds": 30,
            "ip_window_seconds": 60,
            "ip_max_attempts": 20,
        },
    )
    audit_service = MagicMock()
    audit_service.log_pin_auth_attempt = AsyncMock()
    db.pin_login_ip_attempts = MagicMock()
    db.pin_login_ip_attempts.insert_one = AsyncMock()

    guard = PinLoginGuard(db, policy_service, audit_service)
    request = MagicMock()
    request.client = MagicMock(host="127.0.0.1")
    request.headers = {}

    user_doc = {
        "user_id": "user_test",
        "failed_pin_attempts": 0,
        "pin_lockout_until": None,
    }

    async def run():
        with pytest.raises(HTTPException) as exc:
            await guard.validate_for_user(
                user_doc,
                "00000000",
                request,
                verify_pin=lambda _pin, _hash: False,
                get_pin_hash=lambda _doc: "hash",
            )
        assert exc.value.status_code == 401
        assert exc.value.detail["remaining_attempts"] == 4

    asyncio.run(run())


def test_enforce_ip_rate_limit_blocks_hot_ip():
    db = MagicMock()
    db.pin_login_ip_attempts = MagicMock()
    db.pin_login_ip_attempts.count_documents = AsyncMock(return_value=20)

    guard = PinLoginGuard(db, MagicMock(), MagicMock())
    request = MagicMock()
    request.client = MagicMock(host="10.0.0.9")
    request.headers = {}

    policy = {"ip_window_seconds": 60, "ip_max_attempts": 20}

    async def run():
        with pytest.raises(HTTPException) as exc:
            await guard.enforce_ip_rate_limit(request, policy)
        assert exc.value.status_code == 429
        assert exc.value.detail.get("ip_blocked") is True

    asyncio.run(run())