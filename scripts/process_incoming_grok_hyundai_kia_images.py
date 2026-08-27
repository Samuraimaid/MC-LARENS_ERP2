import os
import shutil
import json
from pathlib import Path

def main():
    incoming_dir = Path("scripts/incoming_grok")
    hyundai_dest = Path("frontend/public/vehicles/models/hyundai")
    kia_dest = Path("frontend/public/vehicles/models/kia")
    
    hyundai_dest.mkdir(parents=True, exist_ok=True)
    kia_dest.mkdir(parents=True, exist_ok=True)

    prompts_file = Path("scripts/grok_hyundai_kia_catalog_prompts.json")
    if not prompts_file.exists():
        print("Error: Prompts file not found.")
        return

    with open(prompts_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    tasks_by_filename = {t["filename"].lower(): t for t in data["tasks"]}
    
    if not incoming_dir.exists():
        incoming_dir.mkdir(parents=True, exist_ok=True)
        print(f"Created incoming folder at: {incoming_dir.resolve()}")
        print("Place your downloaded Grok images (.png, .jpg, .webp) there and run this script.")
        return

    incoming_files = [f for f in incoming_dir.iterdir() if f.is_file() and f.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]]
    print(f"Found {len(incoming_files)} images in {incoming_dir}")

    processed_count = 0
    for f in incoming_files:
        name_lower = f.name.lower()
        matched_task = None

        # Direct match by exact or partial filename
        for fn, task in tasks_by_filename.items():
            fn_stem = Path(fn).stem
            if fn_stem in name_lower or name_lower.startswith(fn_stem):
                matched_task = task
                break

        if matched_task:
            brand = matched_task["brand"].lower()
            dest_folder = hyundai_dest if brand == "hyundai" else kia_dest
            target_path = dest_folder / matched_task["filename"]
            
            shutil.copy2(f, target_path)
            print(f"✅ Processed [{matched_task['brand']} {matched_task['model']}]: {f.name} -> {target_path}")
            processed_count += 1
        else:
            print(f"⚠️ Could not automatically match: {f.name}")

    print(f"\nFinished: Successfully processed {processed_count} images.")

if __name__ == "__main__":
    main()
