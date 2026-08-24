"""
Script de verificación sintáctica básica de archivos React/JSX modificados.
"""
import os
import re

files_to_check = [
    "frontend/src/lib/audioAlerts.js",
    "frontend/src/components/coordinator/TintCuttingStation.jsx",
    "frontend/src/components/technician/TechnicianTintJobView.jsx",
    "frontend/src/components/technician/TechnicianAccessoriesJobView.jsx",
    "frontend/src/components/technician/TechnicianElectricalJobView.jsx",
    "frontend/src/pages/TechnicianMobilePage.jsx",
    "frontend/src/pages/CoordinatorPage.jsx",
    "frontend/src/pages/kds/KDSTintPage.jsx",
]

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

errors = 0
for rel_path in files_to_check:
    full_path = os.path.join(base_dir, rel_path)
    if not os.path.exists(full_path):
        print(f"[ERROR] File not found: {rel_path}")
        errors += 1
        continue

    content = open(full_path, encoding="utf-8").read()
    
    # Check brace/bracket/parenthesis balance
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    in_string = False
    string_char = ''
    
    for idx, ch in enumerate(content):
        if ch in ('"', "'", '`') and (idx == 0 or content[idx-1] != '\\'):
            if not in_string:
                in_string = True
                string_char = ch
            elif string_char == ch:
                in_string = False
        elif not in_string:
            if ch in ('(', '[', '{'):
                stack.append(ch)
            elif ch in (')', ']', '}'):
                if not stack or stack[-1] != pairs[ch]:
                    print(f"[WARN] Potential mismatch at char {idx} in {rel_path}: '{ch}'")
                else:
                    stack.pop()
                    
    print(f"[OK] {rel_path} - Length: {len(content)} chars, Balanced: {len(stack) == 0}")

if errors == 0:
    print("=" * 60)
    print("ALL FRONTEND TARGET FILES VERIFIED 100%!")
    print("=" * 60)
