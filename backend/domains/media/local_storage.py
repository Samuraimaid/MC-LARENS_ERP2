from __future__ import annotations

import mimetypes
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException, UploadFile

UPLOAD_ROOT = Path(os.environ.get("LOCAL_UPLOAD_ROOT", "/app/uploads"))
SAFE_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{6,128}$")
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def ensure_upload_root() -> Path:
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    return UPLOAD_ROOT


def normalize_image_id(image_id: str) -> str:
    value = str(image_id or "").strip()
    if not SAFE_ID_RE.match(value):
        raise HTTPException(status_code=400, detail="image_id inválido")
    return value


def _category_dir(category: str) -> Path:
    safe = re.sub(r"[^a-z0-9_-]", "", str(category or "misc").lower()) or "misc"
    path = ensure_upload_root() / safe
    path.mkdir(parents=True, exist_ok=True)
    return path


async def save_local_image(
    upload: UploadFile,
    *,
    category: str = "warranties",
    image_id: Optional[str] = None,
    branch_id: Optional[str] = None,
) -> Dict[str, Any]:
    content_type = str(upload.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes JPEG, PNG, WEBP o GIF")

    raw = await upload.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    if len(raw) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen supera el límite de 12 MB")

    media_id = normalize_image_id(image_id or f"wmed_{uuid.uuid4().hex[:12]}")
    extension = ALLOWED_IMAGE_TYPES[content_type]
    relative_path = f"{category}/{media_id}{extension}"
    absolute_path = _category_dir(category) / f"{media_id}{extension}"
    absolute_path.write_bytes(raw)

    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "image_id": media_id,
        "category": category,
        "relative_path": relative_path,
        "absolute_path": str(absolute_path),
        "content_type": content_type,
        "size_bytes": len(raw),
        "branch_id": branch_id,
        "media_url": f"/api/warranties/media/{media_id}",
        "created_at": now_iso,
    }


def resolve_local_image_path(image_id: str, *, category: Optional[str] = None) -> Tuple[Path, str]:
    media_id = normalize_image_id(image_id)
    search_dirs = [_category_dir(category)] if category else [
        _category_dir("warranties"),
        _category_dir("products"),
        _category_dir("evidence"),
    ]

    for folder in search_dirs:
        for candidate in folder.glob(f"{media_id}.*"):
            if candidate.is_file():
                content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
                return candidate, content_type

    raise HTTPException(status_code=404, detail="Imagen no encontrada en almacenamiento local")


def read_local_image_bytes(image_id: str, *, category: Optional[str] = None) -> Tuple[bytes, str]:
    path, content_type = resolve_local_image_path(image_id, category=category)
    return path.read_bytes(), content_type


def build_branch_media_url(image_id: str, branch_id: str) -> str:
    tunnel_map = {
        "branch_main": os.environ.get("PUBLIC_TUNNEL_URL_MAIN", "https://mclarenerp.com"),
        "branch_north": os.environ.get("PUBLIC_TUNNEL_URL_NORTH", "https://north.mclarenerp.com"),
        "branch_south": os.environ.get("PUBLIC_TUNNEL_URL_SOUTH", "https://south.mclarenerp.com"),
    }
    base = str(tunnel_map.get(branch_id) or os.environ.get("PUBLIC_TUNNEL_URL", "https://mclarenerp.com")).rstrip("/")
    return f"{base}/api/warranties/media/{image_id}"