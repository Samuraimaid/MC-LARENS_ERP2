import os
import shutil
import json
from pathlib import Path

def main():
    downloads_dir = Path(os.path.expanduser(r"C:\Users\Xinon\Downloads"))
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
    
    downloaded_files = [
        f for f in downloads_dir.iterdir()
        if f.is_file() and f.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]
    ]

    print(f"Scanning {downloads_dir} ({len(downloaded_files)} image files found)...")

    processed = []
    for f in downloaded_files:
        name_lower = f.name.lower()
        matched_task = None

        # Check direct task matching
        for fn, task in tasks_by_filename.items():
            fn_stem = Path(fn).stem.lower()
            # Match if downloaded file has the vehicle filename or ID in its name
            if fn_stem in name_lower or f"id_{task['id']:03d}" in name_lower or f"id {task['id']:03d}" in name_lower:
                matched_task = task
                break

        if matched_task:
            brand = matched_task["brand"].lower()
            dest_dir = hyundai_dest if brand == "hyundai" else kia_dest
            dest_file = dest_dir / matched_task["filename"]
            
            shutil.copy2(f, dest_file)
            print(f"✅ Ingested: {f.name} -> {dest_file}")
            processed.append(matched_task)

    print(f"\n==========================================")
    print(f"Ingestion Complete: {len(processed)} images processed.")
    if processed:
        last_id = max(p["id"] for p in processed)
        next_batch_num = (last_id // 6) + 1
        print(f"Next Suggested Batch: LOTE #{next_batch_num}")
    print(f"==========================================")

if __name__ == "__main__":
    main()
