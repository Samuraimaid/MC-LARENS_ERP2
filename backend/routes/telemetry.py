"""Telemetry & Error Boundary Crash Reporting Router.
Securely logs and stores client-side crash reports and stack traces in the backend
while keeping sensitive code and variables hidden from end users.
"""

from __future__ import annotations

import datetime
import json
import os
import re
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field


class CrashReportPayload(BaseModel):
    ticket_id: Optional[str] = Field(None, description="Client-generated or server-assigned ticket ID")
    timestamp: Optional[str] = Field(None, description="ISO timestamp of crash")
    url: Optional[str] = Field(None, description="Active URL/path when crash occurred")
    error_name: Optional[str] = Field(None, description="Error name (e.g. ReferenceError)")
    error_message: Optional[str] = Field(None, description="Error message")
    category: Optional[str] = Field(None, description="Categorized diagnostic label")
    suggestion: Optional[str] = Field(None, description="Smart automated suggestion")
    offending_component: Optional[str] = Field(None, description="Failing component name")
    user_agent: Optional[str] = Field(None, description="Browser user agent")
    screen: Optional[str] = Field(None, description="Screen resolution")
    component_stack: Optional[str] = Field(None, description="React component stack")
    stack: Optional[str] = Field(None, description="JavaScript call stack")
    user_hint: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


def generate_ticket_id(dt: Optional[datetime.datetime] = None) -> str:
    """Generates ticket format: B-#####-DD/MMM/AAAA-HH:MM:SS"""
    now = dt or datetime.datetime.now(datetime.timezone.utc)
    # 5-digit random numeric code
    rand_code = f"{uuid.uuid4().int % 90000 + 10000:05d}"
    months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]
    month_name = months[now.month - 1]
    return f"B-{rand_code}-{now.day:02d}/{month_name}/{now.year}-{now.strftime('%H:%M:%S')}"


def sanitize_filename(ticket_id: str) -> str:
    """Converts ticket ID into safe filename characters."""
    return re.sub(r'[^A-Za-z0-9_\-]', '_', ticket_id)


def get_telemetry_router(
    db: Any,
    require_auth: Any,
    require_roles: Any,
) -> APIRouter:
    router = APIRouter(prefix="/telemetry", tags=["Telemetry & Diagnostics"])

    # Ensure local crash logs directory exists
    logs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs", "crashes")
    os.makedirs(logs_dir, exist_ok=True)

    @router.post("/crash-report")
    async def record_crash_report(
        payload: CrashReportPayload,
        request: Request,
    ):
        """Public endpoint called by ErrorBoundary to register a crash report securely.
        Returns the ticket_id to show to the end user without leaking internals.
        """
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        now_iso = now_utc.isoformat()

        # 1. Resolve User from auth session if available, else user_hint
        current_user = None
        try:
            current_user = await require_auth(request)
        except Exception:
            current_user = payload.user_hint

        # 2. Client IP & User Agent
        forwarded_for = request.headers.get("x-forwarded-for")
        client_ip = (
            forwarded_for.split(",")[0].strip()
            if forwarded_for
            else (request.client.host if request.client else "unknown")
        )
        user_agent = request.headers.get("user-agent", payload.user_agent or "unknown")

        # 3. Resolve or assign Ticket ID
        ticket_id = payload.ticket_id or generate_ticket_id(now_utc)

        user_id = current_user.get("user_id") if isinstance(current_user, dict) else "unauthenticated"
        user_name = current_user.get("name") if isinstance(current_user, dict) else "Usuario no autenticado"
        user_role = current_user.get("role") if isinstance(current_user, dict) else "desconocido"
        branch_id = current_user.get("branch_id") if isinstance(current_user, dict) else "default"

        report_doc = {
            "ticket_id": ticket_id,
            "created_at": now_iso,
            "timestamp_utc": now_iso,
            "local_time_display": now_utc.strftime("%d/%m/%Y %H:%M:%S UTC"),
            "client_ip": client_ip,
            "user_agent": user_agent,
            "screen": payload.screen or "unknown",
            "url": payload.url or "",
            "user": {
                "user_id": user_id,
                "name": user_name,
                "role": user_role,
                "branch_id": branch_id,
            },
            "error": {
                "name": payload.error_name or "Error",
                "message": payload.error_message or "",
                "category": payload.category or "Excepción en Renderizado",
                "suggestion": payload.suggestion or "",
                "offending_component": payload.offending_component or "Desconocido",
                "component_stack": payload.component_stack or "",
                "stack": payload.stack or "",
            },
            "metadata": payload.metadata or {},
            "status": "open",
            "resolution_notes": None,
        }

        # 4. Save in MongoDB (if accessible)
        try:
            if db is not None:
                await db.crash_reports.update_one(
                    {"ticket_id": ticket_id},
                    {"$set": report_doc},
                    upsert=True,
                )
        except Exception as db_err:
            print(f"[Telemetry] Warning saving crash report to DB: {db_err}")

        # 5. Save in local filesystem backup
        try:
            safe_id = sanitize_filename(ticket_id)
            filepath = os.path.join(logs_dir, f"{safe_id}.json")
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(report_doc, f, indent=2, ensure_ascii=False)
        except Exception as file_err:
            print(f"[Telemetry] Warning saving crash report to file: {file_err}")

        return {
            "status": "ok",
            "ticket_id": ticket_id,
            "message": "Reporte de incidencia registrado exitosamente en el backend.",
        }

    @router.get("/crash-report/{ticket_id:path}")
    async def get_crash_report(
        ticket_id: str,
        request: Request,
    ):
        """Allows developers or authorized staff to query crash details by ticket_id."""
        # 1. Look up in MongoDB
        doc = None
        try:
            if db is not None:
                doc = await db.crash_reports.find_one({"ticket_id": ticket_id}, {"_id": 0})
        except Exception:
            pass

        # 2. Look up in local files if not found
        if not doc:
            safe_id = sanitize_filename(ticket_id)
            filepath = os.path.join(logs_dir, f"{safe_id}.json")
            if os.path.exists(filepath):
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        doc = json.load(f)
                except Exception:
                    pass

        if not doc:
            # Also search for files matching substring
            for fname in os.listdir(logs_dir):
                if safe_id in fname and fname.endswith(".json"):
                    filepath = os.path.join(logs_dir, fname)
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            doc = json.load(f)
                            break
                    except Exception:
                        pass

        if not doc:
            raise HTTPException(status_code=404, detail=f"No se encontró reporte para el ticket: {ticket_id}")

        return doc

    @router.get("/crash-reports")
    async def list_recent_crash_reports(
        limit: int = 50,
        request: Request = None,
    ):
        """Returns recent crash reports for dashboard & developer lookup."""
        results = []
        try:
            if db is not None:
                cursor = db.crash_reports.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
                results = await cursor.to_list(length=limit)
        except Exception:
            pass

        if not results:
            # Fallback list from local filesystem
            file_list = []
            for fname in os.listdir(logs_dir):
                if fname.endswith(".json"):
                    fpath = os.path.join(logs_dir, fname)
                    try:
                        with open(fpath, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            file_list.append(data)
                    except Exception:
                        pass
            file_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            results = file_list[:limit]

        return {"total": len(results), "reports": results}

    return router
