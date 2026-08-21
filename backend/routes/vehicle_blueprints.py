"""Vehicle Blueprints & Silhouette Uploader Router for MC-LARENS ERP."""

from __future__ import annotations

import os
import re
import shutil
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_BLUEPRINTS_DIR = WORKSPACE_ROOT / "backend" / "data" / "blueprints_raw"
CLEAN_BLUEPRINTS_DIR = WORKSPACE_ROOT / "backend" / "data" / "blueprints_cleaned"
PUBLIC_VEHICLES_DIR = WORKSPACE_ROOT / "frontend" / "public" / "vehicles"


def clean_image_footer_banner(src_path: Path, dest_path: Path) -> bool:
    """Elimina el pie de página de la imagen (escala y logo the-blueprints.com) usando Pillow."""
    try:
        from PIL import Image

        with Image.open(src_path) as img:
            width, height = img.size
            if height < 60 or width < 60:
                img.save(dest_path)
                return True

            # Detectar línea divisoria en los últimos 45px
            banner_height = 30
            rgb_img = img.convert("RGB")
            for y in range(height - 15, max(0, height - 42), -1):
                dark_count = 0
                for x in range(10, width - 10, 10):
                    r, g, b = rgb_img.getpixel((x, y))
                    if r < 200 and g < 200 and b < 200:
                        dark_count += 1
                if dark_count > 25:
                    banner_height = height - y + 1
                    break

            new_height = max(50, height - banner_height)
            cropped = img.crop((0, 0, width, new_height))
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            cropped.save(dest_path, format="PNG")
            return True
    except Exception as e:
        print(f"Error cleaning footer of {src_path.name}: {e}")
        try:
            shutil.copy2(src_path, dest_path)
            return True
        except Exception:
            return False


class LocalZipProcessPayload(BaseModel):
    zip_path: str
    brand: Optional[str] = None


def get_vehicle_blueprints_router(
    db: Any,
    require_auth: Any,
    require_roles: Any,
) -> APIRouter:
    router = APIRouter(prefix="/vehicle-blueprints", tags=["Vehicle Blueprints & Silhouettes"])

    @router.get("/brands")
    async def list_available_blueprint_brands(request: Request):
        """Lista todas las marcas con blueprints procesados."""
        brands = []
        if CLEAN_BLUEPRINTS_DIR.exists():
            for brand_dir in CLEAN_BLUEPRINTS_DIR.iterdir():
                if brand_dir.is_dir():
                    count = len(list(brand_dir.glob("*.png")))
                    brands.append({
                        "brand": brand_dir.name.upper(),
                        "slug": brand_dir.name.lower(),
                        "models_count": count,
                    })
        return {"brands": sorted(brands, key=lambda x: x["brand"])}

    @router.post("/process-local-zip")
    async def process_local_zip_endpoint(
        payload: LocalZipProcessPayload,
        request: Request,
        user: Any = Depends(require_roles(["gerente", "admin", "programador", "developer", "cajero", "vendedor"])),
    ):
        """Procesa un archivo .zip local en el servidor."""
        local_path = Path(payload.zip_path)
        if not local_path.exists():
            raise HTTPException(status_code=404, detail=f"No se encontró el archivo en {payload.zip_path}")

        brand_name = payload.brand or local_path.stem.replace("Vector Drawings - ", "").strip()
        brand_slug = re.sub(r"[^a-zA-Z0-9_-]", "_", brand_name).lower().strip("_")

        raw_brand_dir = RAW_BLUEPRINTS_DIR / brand_slug
        clean_brand_dir = CLEAN_BLUEPRINTS_DIR / brand_slug
        public_brand_dir = PUBLIC_VEHICLES_DIR / "blueprints" / brand_slug

        raw_brand_dir.mkdir(parents=True, exist_ok=True)
        clean_brand_dir.mkdir(parents=True, exist_ok=True)
        public_brand_dir.mkdir(parents=True, exist_ok=True)

        try:
            with zipfile.ZipFile(local_path, "r") as zip_ref:
                zip_ref.extractall(raw_brand_dir)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error al descomprimir archivo zip: {e}")

        all_imgs = [
            p for p in raw_brand_dir.rglob("*")
            if p.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]
        ]

        processed_count = 0
        for img_path in all_imgs:
            dest_clean = clean_brand_dir / f"{img_path.stem}.png"
            dest_public = public_brand_dir / f"{img_path.stem}.png"
            ok = clean_image_footer_banner(img_path, dest_clean)
            if ok:
                try:
                    shutil.copy2(dest_clean, dest_public)
                except Exception:
                    pass
                processed_count += 1

        # Registrar en la colección vehicle_blueprints_catalog
        try:
            await db.vehicle_blueprints_catalog.update_one(
                {"slug": brand_slug},
                {
                    "$set": {
                        "brand": brand_name.upper(),
                        "slug": brand_slug,
                        "models_count": processed_count,
                        "updated_at": "now",
                    }
                },
                upsert=True,
            )
        except Exception as e:
            print(f"Error saving to db: {e}")

        return {
            "success": True,
            "brand": brand_name.upper(),
            "slug": brand_slug,
            "total_extracted": len(all_imgs),
            "total_processed": processed_count,
            "message": f"Se procesaron con éxito {processed_count} modelos de {brand_name.upper()}.",
        }

    @router.post("/upload-zip")
    async def upload_blueprint_zip_endpoint(
        file: UploadFile = File(...),
        brand: Optional[str] = Form(None),
        request: Request = None,
        user: Any = Depends(require_roles(["gerente", "admin", "programador", "developer", "cajero", "vendedor"])),
    ):
        """Sube un archivo .zip con planos de vehículos desde el navegador."""
        if not file.filename.lower().endswith(".zip"):
            raise HTTPException(status_code=400, detail="El archivo debe ser un .ZIP válido.")

        brand_name = brand or Path(file.filename).stem.replace("Vector Drawings - ", "").strip()
        brand_slug = re.sub(r"[^a-zA-Z0-9_-]", "_", brand_name).lower().strip("_")

        temp_zip = RAW_BLUEPRINTS_DIR / f"temp_{file.filename}"
        RAW_BLUEPRINTS_DIR.mkdir(parents=True, exist_ok=True)

        try:
            with open(temp_zip, "wb") as f:
                shutil.copyfileobj(file.file, f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error guardando archivo: {e}")

        raw_brand_dir = RAW_BLUEPRINTS_DIR / brand_slug
        clean_brand_dir = CLEAN_BLUEPRINTS_DIR / brand_slug
        public_brand_dir = PUBLIC_VEHICLES_DIR / "blueprints" / brand_slug

        raw_brand_dir.mkdir(parents=True, exist_ok=True)
        clean_brand_dir.mkdir(parents=True, exist_ok=True)
        public_brand_dir.mkdir(parents=True, exist_ok=True)

        try:
            with zipfile.ZipFile(temp_zip, "r") as zip_ref:
                zip_ref.extractall(raw_brand_dir)
        except Exception as e:
            if temp_zip.exists():
                temp_zip.unlink()
            raise HTTPException(status_code=400, detail=f"Error descomprimiendo zip: {e}")

        if temp_zip.exists():
            temp_zip.unlink()

        all_imgs = [
            p for p in raw_brand_dir.rglob("*")
            if p.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]
        ]

        processed_count = 0
        for img_path in all_imgs:
            dest_clean = clean_brand_dir / f"{img_path.stem}.png"
            dest_public = public_brand_dir / f"{img_path.stem}.png"
            ok = clean_image_footer_banner(img_path, dest_clean)
            if ok:
                try:
                    shutil.copy2(dest_clean, dest_public)
                except Exception:
                    pass
                processed_count += 1

        try:
            await db.vehicle_blueprints_catalog.update_one(
                {"slug": brand_slug},
                {
                    "$set": {
                        "brand": brand_name.upper(),
                        "slug": brand_slug,
                        "models_count": processed_count,
                        "updated_at": "now",
                    }
                },
                upsert=True,
            )
        except Exception as e:
            print(f"Error saving to db: {e}")

        return {
            "success": True,
            "brand": brand_name.upper(),
            "slug": brand_slug,
            "total_extracted": len(all_imgs),
            "total_processed": processed_count,
            "message": f"Se procesaron con éxito {processed_count} modelos de {brand_name.upper()}.",
        }

    return router
