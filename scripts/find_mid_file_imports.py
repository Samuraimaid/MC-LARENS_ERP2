import os
import re

base_dir = os.path.abspath('frontend/src')

out_of_order = []

for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith(('.jsx', '.js')):
            fp = os.path.join(root, f)
            with open(fp, 'r', encoding='utf-8', errors='replace') as file:
                lines = file.readlines()
            
            seen_code = False
            for idx, line in enumerate(lines):
                stripped = line.strip()
                if not stripped or stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*'):
                    continue
                if stripped.startswith('import '):
                    if seen_code:
                        rel = os.path.relpath(fp, base_dir)
                        out_of_order.append((rel, idx + 1, stripped))
                else:
                    seen_code = True

print(f"Found {len(out_of_order)} imports placed after executable code:")
for rel, line_num, code in out_of_order:
    print(f"  {rel}:{line_num} -> {code}")
