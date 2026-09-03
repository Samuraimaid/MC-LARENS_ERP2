import asyncio
import os
import sys

# Asegurar encoding UTF-8 en Windows
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
os.environ["MONGO_URL"] = "mongodb+srv://dayavar18_db_user:El_Peluka_Sapbeee.2026@mclarens-db.nkdcim0.mongodb.net/mc-larens2_mundo_accesorios_erp?retryWrites=true&w=majority"
os.environ["MONGO_DB"] = "mc-larens2_mundo_accesorios_erp"

from pymongo import MongoClient

NEW_PROMOTIONAL_VIDEOS = [
    {
        "id": "bfgoodrich-ko3-kyle-strait",
        "title": "BFGoodrich All-Terrain T/A KO3 Tire - Kyle Strait",
        "orientation": "horizontal",
        "filename": "bfgoodrich_ko3_kyle_strait.mp4",
        "url": "/videos/promos/bfgoodrich_ko3_kyle_strait.mp4",
        "active": True,
        "sort_order": 12,
        "branches": ["*"],
        "allow_widescreen_on_mobile": True,
    },
    {
        "id": "bfgoodrich-ko3-tech-overview",
        "title": "BFGoodrich KO3 Tire Tech Overview",
        "orientation": "horizontal",
        "filename": "bfgoodrich_ko3_tech_overview.mp4",
        "url": "/videos/promos/bfgoodrich_ko3_tech_overview.mp4",
        "active": True,
        "sort_order": 13,
        "branches": ["*"],
        "allow_widescreen_on_mobile": True,
    },
    {
        "id": "ds18-audio-experiment",
        "title": "DS18 Audio - The Experiment",
        "orientation": "horizontal",
        "filename": "ds18_audio_the_experiment.mp4",
        "url": "/videos/promos/ds18_audio_the_experiment.mp4",
        "active": True,
        "sort_order": 14,
        "branches": ["*"],
        "allow_widescreen_on_mobile": True,
    },
    {
        "id": "bfgoodrich-ko2-gravity",
        "title": "BFGoodrich KO2 Takes On Gravity",
        "orientation": "horizontal",
        "filename": "bfgoodrich_ko2_takes_on_gravity.mp4",
        "url": "/videos/promos/bfgoodrich_ko2_takes_on_gravity.mp4",
        "active": True,
        "sort_order": 15,
        "branches": ["*"],
        "allow_widescreen_on_mobile": True,
    },
    {
        "id": "mickey-thompson-baja-boss",
        "title": "Mickey Thompson Colombia - Baja Boss A/T",
        "orientation": "horizontal",
        "filename": "mickey_thompson_baja_boss_at.mp4",
        "url": "/videos/promos/mickey_thompson_baja_boss_at.mp4",
        "active": True,
        "sort_order": 16,
        "branches": ["*"],
        "allow_widescreen_on_mobile": True,
    },
    {
        "id": "bfgoodrich-trail-terrain",
        "title": "The BFGoodrich Trail-Terrain T/A Tire Shanty",
        "orientation": "horizontal",
        "filename": "bfgoodrich_trail_terrain_shanty.mp4",
        "url": "/videos/promos/bfgoodrich_trail_terrain_shanty.mp4",
        "active": True,
        "sort_order": 17,
        "branches": ["*"],
        "allow_widescreen_on_mobile": True,
    },
    {
        "id": "dakar-2024-rally",
        "title": "The World's Toughest Rally - Dakar 2024",
        "orientation": "horizontal",
        "filename": "dakar_2024_toughest_rally.mp4",
        "url": "/videos/promos/dakar_2024_toughest_rally.mp4",
        "active": True,
        "sort_order": 18,
        "branches": ["*"],
        "allow_widescreen_on_mobile": True,
    },
    {
        "id": "mickey-thompson-trail-rough",
        "title": "Mickey Thompson - When the Trail Gets Rough",
        "orientation": "horizontal",
        "filename": "mickey_thompson_trail_rough_baja_boss.mp4",
        "url": "/videos/promos/mickey_thompson_trail_rough_baja_boss.mp4",
        "active": True,
        "sort_order": 19,
        "branches": ["*"],
        "allow_widescreen_on_mobile": True,
    },
]

def main():
    mongo_url = os.environ.get("MONGO_URL")
    mongo_db_name = os.environ.get("MONGO_DB", "mc-larens2_mundo_accesorios_erp")
    client = MongoClient(mongo_url)
    db = client[mongo_db_name]
    
    inserted = 0
    updated = 0
    for v in NEW_PROMOTIONAL_VIDEOS:
        exists = db.promotional_videos.find_one({"$or": [{"id": v["id"]}, {"filename": v["filename"]}]})
        if not exists:
            db.promotional_videos.insert_one(v)
            inserted += 1
            print(f"✔ Inserted: {v['title']}")
        else:
            db.promotional_videos.update_one({"_id": exists["_id"]}, {"$set": v})
            updated += 1
            print(f"✔ Updated: {v['title']}")

    total = db.promotional_videos.count_documents({})
    print(f"\nProceso finalizado! Insertados: {inserted}, Actualizados: {updated}. Total en BD: {total}")

if __name__ == "__main__":
    main()
