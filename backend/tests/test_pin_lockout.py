import os
import random

import requests

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8001")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://mongodb:27017")
DB_NAME = os.environ.get("DB_NAME", "mc-larens2_mundo_accesorios_erp")


def admin_headers():
    r = requests.post(f"{BASE_URL}/api/test/create-session")
    r.raise_for_status()
    return {"Cookie": f"session_token={r.cookies.get('session_token')}"}


def _clear_pin_guards():
    try:
        from pymongo import MongoClient

        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=3000)
        db = client[DB_NAME]
        db["pin_login_ip_lockouts"].delete_many({})
        db["pin_login_ip_attempts"].delete_many({})
        client.close()
    except Exception:
        pass


def test_pin_lockout_after_max_attempts():
    """Progressive/policy lockout: default max_attempts=3 → 403 on 3rd failure."""
    _clear_pin_guards()
    hdrs = admin_headers()

    attendance_pin = f"{random.randint(10**3, 10**4 - 1)}"
    login_pin = f"{random.randint(10**7, 10**8 - 1)}"
    payload = {
        "name": "lockout_user",
        "last_name": "lockout",
        "phone": "5555-2222",
        "role": "ventas",
        "pin": attendance_pin,
        "login_pin": login_pin,
        "branch_id": "branch_test",
    }
    r = requests.post(f"{BASE_URL}/api/users/pin", json=payload, headers=hdrs)
    r.raise_for_status()
    user = r.json()
    user_id = user.get("user_id")
    assert user_id

    _clear_pin_guards()
    try:
        from pymongo import MongoClient

        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=3000)
        client[DB_NAME]["users"].update_one(
            {"user_id": user_id},
            {"$set": {"failed_pin_attempts": 0, "pin_lockout_until": None}},
        )
        client.close()
    except Exception:
        pass

    wrong_pin = "00000000"
    LOCKOUT_STEP = 3

    for i in range(1, LOCKOUT_STEP):
        r = requests.post(
            f"{BASE_URL}/api/auth/pin/login",
            json={"user_id": user_id, "pin": wrong_pin},
        )
        assert r.status_code == 401, f"attempt {i}: expected 401, got {r.status_code} {r.text}"
        body = r.json()
        detail = body.get("detail") if isinstance(body, dict) else None
        assert isinstance(detail, dict), f"expected structured detail, got: {body}"
        remaining = detail.get("remaining_attempts")
        assert isinstance(remaining, int)
        assert remaining == LOCKOUT_STEP - i

    r = requests.post(
        f"{BASE_URL}/api/auth/pin/login",
        json={"user_id": user_id, "pin": wrong_pin},
    )
    assert r.status_code == 403, f"expected 403 lockout, got {r.status_code} {r.text}"
    body = r.json()
    detail = body.get("detail") if isinstance(body, dict) else None
    assert isinstance(detail, dict), f"expected structured detail in 403, got: {body}"
    assert detail.get("remaining_attempts") == 0
    assert detail.get("lockout_until") is not None

    r2 = requests.post(
        f"{BASE_URL}/api/auth/pin/login",
        json={"user_id": user_id, "pin": wrong_pin},
    )
    assert r2.status_code == 403

    _clear_pin_guards()
    requests.delete(f"{BASE_URL}/api/users/pin/{user_id}", headers=hdrs)


def test_anonymous_pin_fail_is_fast_and_locks():
    """Public keypad must fail fast and lock after 3 wrong PINs."""
    _clear_pin_guards()
    wrong_pin = "00000000"
    import time

    for i in range(1, 3):
        t0 = time.perf_counter()
        r = requests.post(f"{BASE_URL}/api/auth/pin/login", json={"pin": wrong_pin}, timeout=5)
        ms = (time.perf_counter() - t0) * 1000
        assert r.status_code == 401, r.text
        assert ms < 2000, f"too slow: {ms:.0f}ms"
        detail = r.json().get("detail")
        assert isinstance(detail, dict)
        assert detail.get("remaining_attempts") == 3 - i

    t0 = time.perf_counter()
    r = requests.post(f"{BASE_URL}/api/auth/pin/login", json={"pin": wrong_pin}, timeout=5)
    ms = (time.perf_counter() - t0) * 1000
    assert r.status_code == 403, r.text
    assert ms < 2000
    detail = r.json().get("detail")
    assert isinstance(detail, dict)
    assert detail.get("lockout_until")
    _clear_pin_guards()
