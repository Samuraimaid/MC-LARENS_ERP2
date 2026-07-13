from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from backend.domains.media.local_storage import read_local_image_bytes


def get_deliveries_media_router(db, require_auth, require_roles):
    router = APIRouter(prefix="/deliveries", tags=["delivery-proof"])

    @router.get("/media/{image_id}")
    async def stream_delivery_proof_media(image_id: str, request: Request):
        await require_auth(request)
        try:
            payload, content_type = read_local_image_bytes(image_id, category="deliveries")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=404, detail="Evidencia no encontrada") from exc
        return Response(
            content=payload,
            media_type=content_type,
            headers={
                "Cache-Control": "private, max-age=3600",
                "X-Media-Source": "delivery-proof",
            },
        )

    return router