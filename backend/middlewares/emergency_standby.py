"""Emergency standby — host store serves fallen branch via Atlas."""
from __future__ import annotations

import os
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


def resolve_emergency_host_for() -> Optional[str]:
    value = (os.environ.get("EMERGENCY_HOST_FOR") or "").strip()
    return value or None


class EmergencyStandbyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        emergency_branch = resolve_emergency_host_for()
        if emergency_branch:
            request.state.emergency_host_for = emergency_branch
            request.state.emergency_mode = True
        else:
            request.state.emergency_host_for = None
            request.state.emergency_mode = False
        response = await call_next(request)
        if emergency_branch:
            response.headers["X-ERP-Emergency-Host-For"] = emergency_branch
            response.headers["X-ERP-Emergency-Mode"] = "active"
        return response