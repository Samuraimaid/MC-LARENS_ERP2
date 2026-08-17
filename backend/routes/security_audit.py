"""Security & Anti-Tamper Audit Router.
Logs and tracks any unauthorized developer tools or UI inspection attempts.
"""

from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field


class TamperIncidentPayload(BaseModel):
    trigger_action: str = Field(..., description="Action trigger (e.g. F12_KEY_PRESS, DEVTOOLS_OPENED, CONTEXT_MENU)")
    details: Optional[Dict[str, Any]] = None
    window_metrics: Optional[Dict[str, Any]] = None
    branch_id: Optional[str] = None
    user_hint: Optional[Dict[str, Any]] = None


def get_security_audit_router(
    db: Any,
    require_auth: Any,
    require_roles: Any,
) -> APIRouter:
    router = APIRouter(prefix="/security", tags=["Security Audit"])

    @router.post("/tamper-incident")
    async def report_tamper_incident(
        payload: TamperIncidentPayload,
        request: Request,
    ):
        """Public/Protected endpoint to log client-side tampering attempts."""
        # 1. Intentar obtener el usuario de la sesión activa si existe
        current_user = None
        try:
            current_user = await require_auth(request)
        except Exception:
            current_user = payload.user_hint

        # 2. Capturar IP y User-Agent reales
        forwarded_for = request.headers.get("x-forwarded-for")
        client_ip = (
            forwarded_for.split(",")[0].strip()
            if forwarded_for
            else (request.client.host if request.client else "unknown")
        )
        user_agent = request.headers.get("user-agent", "unknown")

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        now_iso = now_utc.isoformat()
        
        # Formato local amigable
        local_time_str = now_utc.strftime("%d/%m/%Y, %I:%M:%S %p UTC")

        user_id = current_user.get("user_id") if isinstance(current_user, dict) else "unauthenticated"
        user_name = current_user.get("name") if isinstance(current_user, dict) else "Usuario no autenticado"
        user_role = current_user.get("role") if isinstance(current_user, dict) else "desconocido"
        user_email = current_user.get("email") if isinstance(current_user, dict) else "desconocido"
        branch_id = (
            payload.branch_id
            or (current_user.get("branch_id") if isinstance(current_user, dict) else None)
            or "branch_main"
        )

        incident_id = f"inc_{uuid.uuid4().hex[:12]}"
        incident_doc = {
            "incident_id": incident_id,
            "type": "SECURITY_TAMPER_ATTEMPT",
            "trigger_action": payload.trigger_action,
            "user_id": user_id,
            "user_name": user_name,
            "user_role": user_role,
            "user_email": user_email,
            "branch_id": branch_id,
            "client_ip": client_ip,
            "user_agent": user_agent,
            "window_metrics": payload.window_metrics or {},
            "details": payload.details or {},
            "timestamp": now_iso,
            "timestamp_local": local_time_str,
            "severity": "CRITICAL",
            "status": "unresolved",
            "created_at": now_iso,
        }

        # Guardar en colección de incidentes de seguridad
        await db.security_incidents.insert_one(incident_doc)

        # Crear notificación de alta prioridad para gerencia
        notification_doc = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "type": "SECURITY_ALERT",
            "title": f"🚨 Intento de inspección no autorizado: {user_name}",
            "message": (
                f"El usuario {user_name} ({user_role}) intentó acceder a las herramientas de desarrollo "
                f"({payload.trigger_action}) desde la IP {client_ip} en sucursal {branch_id} a las {local_time_str}."
            ),
            "severity": "high",
            "target_roles": ["gerencia", "programador"],
            "branch_id": branch_id,
            "read_by": [],
            "created_at": now_iso,
            "metadata": {
                "incident_id": incident_id,
                "client_ip": client_ip,
                "trigger": payload.trigger_action,
            },
        }
        await db.notifications.insert_one(notification_doc)

        return {
            "status": "logged",
            "incident_id": incident_id,
            "timestamp": local_time_str,
            "user": user_name,
            "role": user_role,
            "branch": branch_id,
            "ip": client_ip,
        }

    @router.get("/incidents")
    async def list_security_incidents(
        request: Request,
        limit: int = 50,
        user: Dict[str, Any] = Depends(require_roles(["gerencia", "programador"])),
    ):
        """List recent tamper incidents for management review."""
        incidents = (
            await db.security_incidents.find({}, {"_id": 0})
            .sort("created_at", -1)
            .to_list(limit)
        )
        return {"total": len(incidents), "incidents": incidents}

    return router
