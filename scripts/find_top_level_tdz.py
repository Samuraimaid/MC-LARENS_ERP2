import os
import re

base_dir = os.path.abspath('frontend/src')

def check_file(fp):
    try:
        with open(fp, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except Exception:
        return []

    lines = content.split('\n')
    top_consts = {}
    for idx, l in enumerate(lines):
        m = re.match(r'^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=', l)
        if m:
            top_consts[m.group(1)] = idx

    violations = []
    # Check if any top_const is used at top level or inside a hook/component defined BEFORE it
    for name, def_line in top_consts.items():
        pattern = r'\b' + re.escape(name) + r'\b'
        for idx in range(def_line):
            line_text = lines[idx]
            if re.search(pattern, line_text):
                # Ignore import lines
                if line_text.strip().startswith(('import ', 'export *')):
                    continue
                # If this is another top-level const or component function header
                violations.append((idx + 1, def_line + 1, name, line_text.strip()))
    return violations

for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith(('.js', '.jsx')) and not f.endswith(('.test.js', '.test.jsx')):
            fp = os.path.join(root, f)
            v = check_file(fp)
            if v:
                rel = os.path.relpath(fp, base_dir)
                print(f"File: {rel}")
                for u, d, n, t in v:
                    print(f"  Line {u} uses '{n}' (defined at line {d}): {t[:100]}")
