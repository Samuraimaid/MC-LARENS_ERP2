from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import Response

from backend.domains.media.local_storage import (
    build_branch_media_url,
    read_local_image_bytes,
    save_local_image,
)


def get_warranties_media_router(db, require_auth, require_roles):
    router = APIRouter()

    @router.get("/warranties/media/{image_id}")
    async def stream_warranty_media(image_id: str, request: Request):
        """
        Puente P2P vía Cloudflare: sirve bytes desde /app/uploads del nodo local.
        Accesible públicamente a través del túnel de la sucursal de origen.
        """
        await require_auth(request)
        payload, content_type = read_local_image_bytes(image_id)
        return Response(
            content=payload,
            media_type=content_type,
            headers={
                "Cache-Control": "private, max-age=3600",
                "X-Media-Source": "local-volume",
            },
        )

    @router.post("/warranties/media/upload")
    async def upload_warranty_media(
        request: Request,
        file: UploadFile = File(...),
        claim_id: Optional[str] = None,
    ):
        user = await require_roles(request, ["gerencia", "supervisor", "instalaciones", "bodegas", "ventas"])
        saved = await save_local_image(
            file,
            category="warranties",
            branch_id=str(user.branch_id or ""),
        )
        doc: Dict[str, Any] = {
            **saved,
            "claim_id": claim_id,
            "uploaded_by": user.user_id,
            "uploaded_by_name": user.name,
        }
        await db.warranty_media.insert_one(doc)
        if claim_id:
            await db.warranty_claims.update_one(
                {"claim_id": claim_id},
                {"$addToSet": {"evidence_image_ids": saved["image_id"], "evidence_urls": saved["media_url"]}},
            )
        return doc

    @router.get("/warranties/media/{image_id}/resolve")
    async def resolve_warranty_media_source(image_id: str, request: Request, branch_id: Optional[str] = None):
        """Devuelve la URL del túnel de la sucursal dueña de la evidencia (para consumo cross-branch)."""
        await require_auth(request)
        record = await db.warranty_media.find_one({"image_id": image_id}, {"_id": 0})
        owner_branch = str((record or {}).get("branch_id") or branch_id or "").strip()
        if not owner_branch:
            raise HTTPException(status_code=404, detail="No se pudo resolver la sucursal de origen")
        return {
            "image_id": image_id,
            "branch_id": owner_branch,
            "proxy_url": build_branch_media_url(image_id, owner_branch),
            "local_path": (record or {}).get("relative_path"),
        }

    @router.post("/products/media/upload")
    async def upload_product_media(request: Request, file: UploadFile = File(...), product_id: Optional[str] = None):
        user = await require_roles(request, ["gerencia", "supervisor", "bodegas", "jefe_tienda"])
        saved = await save_local_image(
            file,
            category="products",
            branch_id=str(user.branch_id or ""),
        )
        doc = {**saved, "product_id": product_id, "uploaded_by": user.user_id}
        await db.product_media.insert_one(doc)
        if product_id:
            await db.products.update_one(
                {"product_id": product_id},
                {"$addToSet": {"images": saved["media_url"]}},
            )
        return doc

    return router