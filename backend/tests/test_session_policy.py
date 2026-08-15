"""Unit tests for session idle/TTL and reauth policy helpers."""
from datetime import datetime, timedelta, timezone

from backend.domains.auth.session_policy import (
    DEFAULT_IDLE_MINUTES,
    action_requires_reauth,
    default_session_policy,
    idle_minutes_for_role,
    normalize_session_policy,
    session_expiry_iso,
    ttl_hours_for_role,
    validate_session_freshness,
)


def test_defaults_ventas_5_others_60():
    policy = default_session_policy()
    assert idle_minutes_for_role(policy, "ventas") == 5
    assert idle_minutes_for_role(policy, "cajero") == 60
    assert idle_minutes_for_role(policy, "gerencia") == 60
    assert idle_minutes_for_role(policy, "bodegas") == 60
    assert idle_minutes_for_role(policy, "instalaciones") == 60
    # VIP sellers share role=ventas
    assert idle_minutes_for_role(policy, "ventas") == DEFAULT_IDLE_MINUTES["ventas"]


def test_ttl_by_role():
    policy = default_session_policy()
    assert ttl_hours_for_role(policy, "gerencia") == 4
    assert ttl_hours_for_role(policy, "programador") == 4
    assert ttl_hours_for_role(policy, "ventas") == 12
    assert ttl_hours_for_role(policy, "unknown_role") == 12


def test_normalize_merges_overrides():
    raw = {
        "idle_minutes": {"ventas": 8, "cajero": 30},
        "ttl_hours": {"gerencia": 2},
        "reauth_actions": {"caja.anular": False, "custom.action": True},
        "reauth_ttl_seconds": 60,
        "single_session": False,
    }
    pol = normalize_session_policy(raw)
    assert pol["idle_minutes"]["ventas"] == 8
    assert pol["idle_minutes"]["cajero"] == 30
    assert pol["idle_minutes"]["default"] == 60
    assert pol["ttl_hours"]["gerencia"] == 2
    assert pol["reauth_actions"]["caja.anular"] is False
    assert pol["reauth_actions"]["custom.action"] is True
    assert pol["reauth_ttl_seconds"] == 60
    assert pol["single_session"] is False


def test_idle_clamp():
    pol = normalize_session_policy({"idle_minutes": {"ventas": 0, "default": 99999}})
    assert pol["idle_minutes"]["ventas"] == 1
    assert pol["idle_minutes"]["default"] == 24 * 60


def test_validate_session_expired():
    policy = default_session_policy()
    now = datetime.now(timezone.utc)
    sess = {
        "expires_at": (now - timedelta(minutes=1)).isoformat(),
        "last_seen_at": now.isoformat(),
    }
    ok, code, msg = validate_session_freshness(sess, role="ventas", policy=policy, now=now)
    assert ok is False
    assert code == "SESSION_EXPIRED"
    assert "expir" in (msg or "").lower()


def test_validate_session_idle_ventas_5_min():
    policy = default_session_policy()
    now = datetime.now(timezone.utc)
    sess = {
        "expires_at": (now + timedelta(hours=8)).isoformat(),
        "last_seen_at": (now - timedelta(minutes=6)).isoformat(),
    }
    ok, code, msg = validate_session_freshness(sess, role="ventas", policy=policy, now=now)
    assert ok is False
    assert code == "SESSION_IDLE_TIMEOUT"
    assert "5" in (msg or "")


def test_validate_session_idle_others_60_min():
    policy = default_session_policy()
    now = datetime.now(timezone.utc)
    # 30 min idle OK for gerencia
    sess = {
        "expires_at": (now + timedelta(hours=2)).isoformat(),
        "last_seen_at": (now - timedelta(minutes=30)).isoformat(),
    }
    ok, code, _ = validate_session_freshness(sess, role="gerencia", policy=policy, now=now)
    assert ok is True
    assert code is None

    sess2 = {
        "expires_at": (now + timedelta(hours=2)).isoformat(),
        "last_seen_at": (now - timedelta(minutes=61)).isoformat(),
    }
    ok2, code2, _ = validate_session_freshness(sess2, role="gerencia", policy=policy, now=now)
    assert ok2 is False
    assert code2 == "SESSION_IDLE_TIMEOUT"


def test_session_expiry_iso():
    policy = default_session_policy()
    now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    exp = session_expiry_iso(policy, "gerencia", now=now)
    assert exp.startswith("2026-01-01T16:00:00")


def test_reauth_actions_defaults():
    policy = default_session_policy()
    assert action_requires_reauth(policy, "users.create") is True
    assert action_requires_reauth(policy, "settings.session_policy") is True
    assert action_requires_reauth(policy, "sales.request_cancel") is False
    assert action_requires_reauth(policy, "unknown.thing") is False
