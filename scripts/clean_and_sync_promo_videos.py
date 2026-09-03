import os
import sys

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

from pymongo import MongoClient

mongo_url = "mongodb+srv://dayavar18_db_user:El_Peluka_Sapbeee.2026@mclarens-db.nkdcim0.mongodb.net/mc-larens2_mundo_accesorios_erp?retryWrites=true&w=majority"
mongo_db_name = "mc-larens2_mundo_accesorios_erp"

client = MongoClient(mongo_url)
db = client[mongo_db_name]

# Eliminar entradas rotas o fallidas de intentos anteriores
deleted = db.promotional_videos.delete_many({
    "url": {"$regex": r"^/uploads/promos/"}
})
print(f"✔ Eliminadas {deleted.deleted_count} entradas rotas de /uploads/promos/")

VALID_VIDEOS = [
    {"id": "fox-raptor", "title": "Ford Gen 3 Raptor - FOX Factory Race Series", "orientation": "horizontal", "filename": "YTDown.com_YouTube_Ford-Gen-3-Raptor-FOX-Factory-Race-Serie_Media_Lb9K-TsubZ8_001_1080p.mp4", "url": "/videos/promos/YTDown.com_YouTube_Ford-Gen-3-Raptor-FOX-Factory-Race-Serie_Media_Lb9K-TsubZ8_001_1080p.mp4", "active": True, "sort_order": 1, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "auxbeam-master-t", "title": "Auxbeam MASTER T-Series 3 Flood Beam", "orientation": "horizontal", "filename": "YTDown.com_YouTube_Auxbeam-MASTER-T-Series-3-Flood-Beam-Off_Media_E25hxrZjQ_g_001_1080p.mp4", "url": "/videos/promos/YTDown.com_YouTube_Auxbeam-MASTER-T-Series-3-Flood-Beam-Off_Media_E25hxrZjQ_g_001_1080p.mp4", "active": True, "sort_order": 2, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "rigid-industries", "title": "Rigid Industries LED Lighting Built to Last", "orientation": "horizontal", "filename": "YTDown.com_YouTube_Rigid-Industries-LED-Lighting-Built-to-b_Media_8rkTz-3j2wg_001_1080p.mp4", "url": "/videos/promos/YTDown.com_YouTube_Rigid-Industries-LED-Lighting-Built-to-b_Media_8rkTz-3j2wg_001_1080p.mp4", "active": True, "sort_order": 3, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "fox-4runner", "title": "Toyota 4Runner - FOX Factory Race Series", "orientation": "horizontal", "filename": "YTDown.com_YouTube_Toyota-4Runner-FOX-Factory-Race-Series_Media_H-WlSQ1Tpjc_001_1080p.mp4", "url": "/videos/promos/YTDown.com_YouTube_Toyota-4Runner-FOX-Factory-Race-Series_Media_H-WlSQ1Tpjc_001_1080p.mp4", "active": True, "sort_order": 4, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "auxbeam-v-ultra-3", "title": "Auxbeam V-ULTRA Series 3-Inch 108W LED", "orientation": "horizontal", "filename": "YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-3-Inch-108W-LED-S_Media_EYKj2Gx4Zh0_001_1080p.mp4", "url": "/videos/promos/YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-3-Inch-108W-LED-S_Media_EYKj2Gx4Zh0_001_1080p.mp4", "active": True, "sort_order": 5, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "fox-victory", "title": "FOX - Your Victory Is Our Victory", "orientation": "horizontal", "filename": "YTDown.com_YouTube_Your-Victory-Is-Our-Victory-FOX_Media_RY7TCZJ9ruY_001_1080p.mp4", "url": "/videos/promos/YTDown.com_YouTube_Your-Victory-Is-Our-Victory-FOX_Media_RY7TCZJ9ruY_001_1080p.mp4", "active": True, "sort_order": 6, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "this-is-rigid", "title": "This is RIGID Industries", "orientation": "horizontal", "filename": "YTDown.com_YouTube_This-is-RIGID_Media_Cg2OX_e10mk_001_1080p.mp4", "url": "/videos/promos/YTDown.com_YouTube_This-is-RIGID_Media_Cg2OX_e10mk_001_1080p.mp4", "active": True, "sort_order": 7, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "auxbeam-v-ultra-5", "title": "Auxbeam V-ULTRA Series 5-Inch 172W LED", "orientation": "horizontal", "filename": "YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-5-Inch-172W-LED-S_Media_BrU095An_Oc_001_1080p.mp4", "url": "/videos/promos/YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-5-Inch-172W-LED-S_Media_BrU095An_Oc_001_1080p.mp4", "active": True, "sort_order": 8, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "auxbeam-side-shooter", "title": "Auxbeam V-ULTRA Series LED Side Shooter", "orientation": "horizontal", "filename": "YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-LED-Side-Shooter-_Media_s2zY0QzAtxc_001_1080p.mp4", "url": "/videos/promos/YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-LED-Side-Shooter-_Media_s2zY0QzAtxc_001_1080p.mp4", "active": True, "sort_order": 9, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "totem-1", "title": "Mundo de Accesorios Totem 1", "orientation": "vertical", "filename": "totem1-1.mp4", "url": "/videos/promos/totem1-1.mp4", "active": True, "sort_order": 10, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "totem-2", "title": "Mundo de Accesorios Totem 2", "orientation": "vertical", "filename": "totem2-1.mp4", "url": "/videos/promos/totem2-1.mp4", "active": True, "sort_order": 11, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "bfgoodrich-ko3-kyle-strait", "title": "BFGoodrich All-Terrain T/A KO3 Tire - Kyle Strait", "orientation": "horizontal", "filename": "bfgoodrich_ko3_kyle_strait.mp4", "url": "/videos/promos/bfgoodrich_ko3_kyle_strait.mp4", "active": True, "sort_order": 12, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "bfgoodrich-ko3-tech-overview", "title": "BFGoodrich KO3 Tire Tech Overview", "orientation": "horizontal", "filename": "bfgoodrich_ko3_tech_overview.mp4", "url": "/videos/promos/bfgoodrich_ko3_tech_overview.mp4", "active": True, "sort_order": 13, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "ds18-audio-experiment", "title": "DS18 Audio - The Experiment", "orientation": "horizontal", "filename": "ds18_audio_the_experiment.mp4", "url": "/videos/promos/ds18_audio_the_experiment.mp4", "active": True, "sort_order": 14, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "bfgoodrich-ko2-gravity", "title": "BFGoodrich KO2 Takes On Gravity", "orientation": "horizontal", "filename": "bfgoodrich_ko2_takes_on_gravity.mp4", "url": "/videos/promos/bfgoodrich_ko2_takes_on_gravity.mp4", "active": True, "sort_order": 15, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "mickey-thompson-baja-boss", "title": "Mickey Thompson Colombia - Baja Boss A/T", "orientation": "horizontal", "filename": "mickey_thompson_baja_boss_at.mp4", "url": "/videos/promos/mickey_thompson_baja_boss_at.mp4", "active": True, "sort_order": 16, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "bfgoodrich-trail-terrain", "title": "The BFGoodrich Trail-Terrain T/A Tire Shanty", "orientation": "horizontal", "filename": "bfgoodrich_trail_terrain_shanty.mp4", "url": "/videos/promos/bfgoodrich_trail_terrain_shanty.mp4", "active": True, "sort_order": 17, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "dakar-2024-rally", "title": "The World's Toughest Rally - Dakar 2024", "orientation": "horizontal", "filename": "dakar_2024_toughest_rally.mp4", "url": "/videos/promos/dakar_2024_toughest_rally.mp4", "active": True, "sort_order": 18, "branches": ["*"], "allow_widescreen_on_mobile": True},
    {"id": "mickey-thompson-trail-rough", "title": "Mickey Thompson - When the Trail Gets Rough", "orientation": "horizontal", "filename": "mickey_thompson_trail_rough_baja_boss.mp4", "url": "/videos/promos/mickey_thompson_trail_rough_baja_boss.mp4", "active": True, "sort_order": 19, "branches": ["*"], "allow_widescreen_on_mobile": True},
]

for v in VALID_VIDEOS:
    exists = db.promotional_videos.find_one({"id": v["id"]})
    if exists:
        db.promotional_videos.update_one({"_id": exists["_id"]}, {"$set": v})
    else:
        db.promotional_videos.insert_one(v)

total = db.promotional_videos.count_documents({})
print(f"✔ Total de videos activos en MongoDB Atlas: {total}")
for doc in db.promotional_videos.find({}).sort("sort_order", 1):
    print(f"  [{doc['sort_order']:02d}] {doc['title']} ({doc['id']}) -> {doc['url']}")
