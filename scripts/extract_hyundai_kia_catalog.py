import json
from collections import defaultdict

def main():
    with open("frontend/src/data/vehicleCatalog.json", "r", encoding="utf-8") as f:
        vcat = json.load(f)

    entries = vcat.get("entries", [])
    hyundai_models = defaultdict(set)
    kia_models = defaultdict(set)

    for e in entries:
        b = (e.get("brand") or e.get("make") or "").upper()
        m = e.get("model", "").strip()
        desc = e.get("descriptor", "")
        vtype = e.get("vehicle_type_label", "")
        if b == "HYUNDAI":
            hyundai_models[m].add((desc, vtype))
        elif b == "KIA":
            kia_models[m].add((desc, vtype))

    print(f"=== HYUNDAI ({len(hyundai_models)} unique models) ===")
    for m, vals in sorted(hyundai_models.items()):
        descs = sorted(list(set(v[0] for v in vals)))
        type_str = ", ".join(set(v[1] for v in vals))
        print(f"\n* HYUNDAI {m} [{len(vals)} variants, types: {type_str}]")
        for d in descs[:10]:
            print(f"   - {d}")
        if len(descs) > 10:
            print(f"   ... and {len(descs)-10} more")

    print(f"\n\n=== KIA ({len(kia_models)} unique models) ===")
    for m, vals in sorted(kia_models.items()):
        descs = sorted(list(set(v[0] for v in vals)))
        type_str = ", ".join(set(v[1] for v in vals))
        print(f"\n* KIA {m} [{len(vals)} variants, types: {type_str}]")
        for d in descs[:10]:
            print(f"   - {d}")
        if len(descs) > 10:
            print(f"   ... and {len(descs)-10} more")

if __name__ == "__main__":
    main()
