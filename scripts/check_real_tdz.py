import os
import re

base_dir = os.path.abspath('frontend/src')

all_errors = []

for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith(('.js', '.jsx')):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8', errors='replace') as file:
                code = file.read()
            
            decl_map = {}
            lines = code.split('\n')
            for line_no, line in enumerate(lines, 1):
                for m in re.finditer(r'(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=', line):
                    name = m.group(1)
                    if name not in decl_map:
                        decl_map[name] = line_no
            
            matches = re.finditer(r'\}\s*,\s*\[([^\]]*)\]\s*\)', code)
            for m in matches:
                deps_text = m.group(1)
                hook_end_line = code[:m.end()].count('\n') + 1
                deps = re.findall(r'\b([A-Za-z0-9_$]+)\b', deps_text)
                for dep in deps:
                    if dep in decl_map:
                        decl_line = decl_map[dep]
                        if decl_line > hook_end_line:
                            rel_path = os.path.relpath(filepath, base_dir)
                            print(f"TDZ in {rel_path} at line {hook_end_line}: dependency '{dep}' declared below at line {decl_line}!")
                            all_errors.append((rel_path, hook_end_line, dep, decl_line))

if not all_errors:
    print("\n>>> 100% CLEAN: 0 TDZ ERRORS in ANY React hook dependency array across ALL frontend files! <<<")
else:
    print(f"\nFound {len(all_errors)} total TDZ errors across frontend!")
