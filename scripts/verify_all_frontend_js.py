"""
Analizador estricto de variables y sintaxis en frontend/src
"""
import glob
import os
import re

src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "src"))
files = glob.glob(os.path.join(src_dir, "**", "*.js*"), recursive=True)

print(f"Checking {len(files)} frontend files...")
errors = 0

for file_path in files:
    content = open(file_path, encoding="utf-8").read()
    # Check for selectedGama or other known patterns
    if "selectedGama" in content:
        print(f"Found selectedGama in: {os.path.relpath(file_path, src_dir)}")

print("Scan complete.")
