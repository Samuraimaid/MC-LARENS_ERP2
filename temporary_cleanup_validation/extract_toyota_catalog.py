import json
from collections import defaultdict
from pathlib import Path

catalog_path = Path(r"c:\MC-LARENS_ERP_3\MC-LARENS_ERP2\frontend\src\data\vehicleCatalog.json")
output_path = Path(r"c:\MC-LARENS_ERP_3\MC-LARENS_ERP2\temporary_cleanup_validation\toyota_catalog_lines.txt")

with open(catalog_path, "r", encoding="utf-8") as f:
    data = json.load(f)

toyota_by_descriptor = defaultdict(list)

for entry in data["entries"]:
    if entry.get("brand") == "TOYOTA":
        descriptor = entry["descriptor"]
        engine = entry["engine"]
        if engine not in toyota_by_descriptor[descriptor]:
            toyota_by_descriptor[descriptor].append(engine)

sorted_descriptors = sorted(toyota_by_descriptor.keys())

lines = []
lines.append("TOYOTA CATALOG EXTRACTION")
lines.append(f"Total unique descriptors: {len(sorted_descriptors)}")
lines.append("=" * 80)
lines.append("")

for i, descriptor in enumerate(sorted_descriptors, 1):
    engines = toyota_by_descriptor[descriptor]
    lines.append(f"{i}. {descriptor}")
    lines.append(f"   Engines ({len(engines)}):")
    for engine in engines:
        lines.append(f"     - {engine}")
    lines.append("")

output_path.parent.mkdir(parents=True, exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"Written to: {output_path}")
print(f"Total unique Toyota descriptors: {len(sorted_descriptors)}")
print()
print("DESCRIPTOR LIST:")
for i, d in enumerate(sorted_descriptors, 1):
    print(f"{i}. {d}")