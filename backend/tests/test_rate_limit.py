"""
Pruebas Unitarias para S2 (Rate Limiting en PIN y Mutaciones Sensibles).
MC-LARENS ERP2 - Suite de Verificación Automática.
"""
from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.middlewares.rate_limit import (
    SlidingWindowRateLimiter,
    get_client_identifier,
    PIN_BURST_MAX,
    PIN_BURST_WINDOW_SECONDS,
)


class MockHeaders:
    def __init__(self, d):
        self._d = d

    def get(self, k, default=None):
        return self._d.get(k, default)


class MockClient:
    def __init__(self, host):
        self.host = host


class MockRequest:
    def __init__(self, path="/", method="GET", headers=None, client_host="192.168.1.10", cookies=None):
        self.url = type("URL", (), {"path": path})()
        self.method = method
        self.headers = MockHeaders(headers or {})
        self.client = MockClient(client_host)
        self.cookies = cookies or {}


def test_sliding_window_rate_limiter():
    limiter = SlidingWindowRateLimiter()
    key = "test_user_ip_1"
    now = 1000.0

    # 1. 5 requests allowed in a 10s window
    for i in range(5):
        allowed, remaining, retry_after = limiter.is_allowed(key, max_requests=5, window_seconds=10, now=now + i)
        assert allowed is True, f"Request {i+1} should have been allowed"
        assert remaining == (4 - i)
        assert retry_after == 0

    # 2. 6th request at now + 5 should be blocked (burst exceeded)
    allowed, remaining, retry_after = limiter.is_allowed(key, max_requests=5, window_seconds=10, now=now + 5)
    assert allowed is False, "6th request in 10s window must be blocked"
    assert remaining == 0
    assert retry_after > 0

    # 3. After 11 seconds (now + 12), window has expired and requests should be allowed again
    allowed, remaining, _ = limiter.is_allowed(key, max_requests=5, window_seconds=10, now=now + 12)
    assert allowed is True, "Request after window expiry should be allowed"

    # 4. Reset key allows immediate access
    limiter.reset_key(key)
    allowed, remaining, _ = limiter.is_allowed(key, max_requests=5, window_seconds=10, now=now + 12)
    assert allowed is True


def test_client_identifier_resolution():
    # 1. Normal client IP
    req1 = MockRequest(client_host="10.0.0.5")
    assert get_client_identifier(req1) == "10.0.0.5"

    # 2. X-Forwarded-For header with multiple proxies
    req2 = MockRequest(headers={"X-Forwarded-For": "203.0.113.195, 70.41.3.18, 150.172.238.178"})
    assert get_client_identifier(req2) == "203.0.113.195"

    # 3. C6 device / session signature
    req3 = MockRequest(client_host="10.0.0.5", headers={"X-Device-Id": "terminal_caja_central_01"})
    assert get_client_identifier(req3) == "10.0.0.5:terminal_caja_ce"


def test_pin_burst_simulation():
    limiter = SlidingWindowRateLimiter()
    client_key = "pin_burst:190.212.50.12"
    t0 = 2000.0

    # Simulate 5 rapid PIN attempts
    for seq in range(PIN_BURST_MAX):
        allowed, _, _ = limiter.is_allowed(
            client_key,
            max_requests=PIN_BURST_MAX,
            window_seconds=PIN_BURST_WINDOW_SECONDS,
            now=t0 + (seq * 0.5),
        )
        assert allowed is True, f"Attempt {seq+1} must pass"

    # 6th attempt in rapid burst -> HTTP 429 equivalent
    allowed_burst, remaining, retry_after = limiter.is_allowed(
        client_key,
        max_requests=PIN_BURST_MAX,
        window_seconds=PIN_BURST_WINDOW_SECONDS,
        now=t0 + 3.0,
    )
    assert allowed_burst is False
    assert retry_after >= 1
    print(f"PIN burst correctly blocked with 429 retry_after = {retry_after}s")


def run_all():
    print("Running test_sliding_window_rate_limiter...")
    test_sliding_window_rate_limiter()

    print("Running test_client_identifier_resolution...")
    test_client_identifier_resolution()

    print("Running test_pin_burst_simulation...")
    test_pin_burst_simulation()

    print("\nALL S2 RATE LIMIT TESTS PASSED SUCCESSFULLY! (100% OK)")


if __name__ == "__main__":
    run_all()
