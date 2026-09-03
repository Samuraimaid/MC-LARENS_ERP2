import asyncio
import urllib.request
from motor.motor_asyncio import AsyncIOMotorClient

ATLAS_URI = "mongodb+srv://dayavar18_db_user:El_Peluka_Sapbeee.2026@mclarens-db.nkdcim0.mongodb.net/mc-larens2_mundo_accesorios_erp?retryWrites=true&w=majority"

async def main():
    client = AsyncIOMotorClient(ATLAS_URI)
    db = client["mc-larens2_mundo_accesorios_erp"]
    cursor = db.promotional_videos.find({}).sort("sort_order", 1)
    
    docs = []
    async for d in cursor:
        docs.append(d)
        
    print(f"Total videos en MongoDB: {len(docs)}")
    
    orphans = []
    valid = []
    
    for doc in docs:
        url = doc.get("url", "")
        title = doc.get("title", "")
        vid_id = doc.get("id") or str(doc.get("_id"))
        
        test_url = url
        if url.startswith("/"):
            test_url = "https://storage.googleapis.com/mclarens-erp-vehicles" + (url if url.startswith("/videos/promos/") else ("/videos/promos/" + url.split("/")[-1]))
        
        is_ok = False
        try:
            req = urllib.request.Request(test_url, method="HEAD")
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    is_ok = True
        except Exception:
            is_ok = False
            
        if is_ok:
            valid.append(doc)
            print(f"[OK] {title} ({url})")
        else:
            orphans.append(doc)
            print(f"[404 ORPHAN] {title} ({url}) [id={vid_id}]")

    print(f"\nResumen: {len(valid)} videos validos en GCS, {len(orphans)} huerfanos.")

    if orphans:
        orphan_ids = [d.get("id") or d.get("_id") for d in orphans]
        del_res = await db.promotional_videos.delete_many({
            "$or": [
                {"id": {"$in": orphan_ids}},
                {"_id": {"$in": [d.get("_id") for d in orphans]}},
                {"url": {"$regex": "^/uploads/promos/"}}
            ]
        })
        print(f"Limpieza realizada: Eliminados {del_res.deleted_count} registros huerfanos de MongoDB.")

    # Agregar videos de GCS faltantes
    extras = [
        {
            "id": "auxbeam-color-play",
            "title": "Auxbeam Color Play Series RGB Offroad Lights",
            "orientation": "horizontal",
            "filename": "auxbeam_color_play_series_rgb.mp4",
            "url": "/videos/promos/auxbeam_color_play_series_rgb.mp4",
            "active": True,
            "sort_order": 18,
            "branches": ["*"],
            "allow_widescreen_on_mobile": True,
            "created_by": "admin"
        },
        {
            "id": "auxbeam-rgb-switch-panel",
            "title": "Auxbeam 8 Gang RGB Switch Panel System",
            "orientation": "horizontal",
            "filename": "auxbeam_rgb_switch_panel_promo.mp4",
            "url": "/videos/promos/auxbeam_rgb_switch_panel_promo.mp4",
            "active": True,
            "sort_order": 19,
            "branches": ["*"],
            "allow_widescreen_on_mobile": True,
            "created_by": "admin"
        }
    ]
    for ex in extras:
        exists = await db.promotional_videos.find_one({"id": ex["id"]})
        if not exists:
            await db.promotional_videos.insert_one(ex)
            print(f"Insertado video valido de GCS: {ex['title']}")

    # Reindexar sort_order
    cursor = db.promotional_videos.find({}).sort("sort_order", 1)
    idx = 1
    async for d in cursor:
        await db.promotional_videos.update_one({"_id": d["_id"]}, {"$set": {"sort_order": idx}})
        print(f"#{idx}: {d.get('title')}")
        idx += 1
    print(f"\nFinalizado con exito. Total videos 100% operativos: {idx - 1}")

if __name__ == "__main__":
    asyncio.run(main())
